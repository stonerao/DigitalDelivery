/**
 * 纹理内存预算器
 * 按显存阈值自动降采样与淘汰最久未使用的纹理
 */

const DEFAULT_BUDGET_MB = 256;
const DOWNSAMPLE_RATIO = 0.85; // 85% → 开始降采样
const EVICT_RATIO = 0.95; // 95% → 开始淘汰
const MIN_SIZE = 256; // 降采样后最小边长

const TEX_KEYS = [
  "map",
  "alphaMap",
  "aoMap",
  "lightMap",
  "emissiveMap",
  "normalMap",
  "bumpMap",
  "displacementMap",
  "roughnessMap",
  "metalnessMap",
  "specularMap",
  "envMap"
];

export class TextureBudget {
  /**
   * @param {{ budgetMB?: number }} options
   */
  constructor(options = {}) {
    this.budgetBytes = (options.budgetMB ?? DEFAULT_BUDGET_MB) * 1024 * 1024;
    /** @type {Map<THREE.Texture, { bytes: number, lastUsed: number, downsampled: boolean, originalImage: any }>} */
    this.entries = new Map();
    this.totalBytes = 0;
  }

  // ---------- 追踪 ----------

  /**
   * 注册单个纹理
   */
  track(texture) {
    if (!texture?.isTexture) return;
    if (this.entries.has(texture)) return;

    const bytes = _estimateBytes(texture);
    this.entries.set(texture, {
      bytes,
      lastUsed: performance.now(),
      downsampled: false,
      originalImage: null
    });
    this.totalBytes += bytes;
  }

  /**
   * 标记最近使用（延迟淘汰策略的依据）
   */
  touch(texture) {
    const e = this.entries.get(texture);
    if (e) e.lastUsed = performance.now();
  }

  /**
   * 扫描场景树中所有材质的纹理并自动注册
   */
  trackFromRoot(root) {
    if (!root) return;
    const seen = new Set();
    root.traverse(obj => {
      if (!obj?.isMesh) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (let m = 0; m < mats.length; m++) {
        const mat = mats[m];
        if (!mat) continue;
        for (let k = 0; k < TEX_KEYS.length; k++) {
          const tex = mat[TEX_KEYS[k]];
          if (tex?.isTexture && !seen.has(tex)) {
            seen.add(tex);
            this.track(tex);
          }
        }
      }
    });
  }

  // ---------- 预算执行 ----------

  /**
   * 强制执行预算——降采样或淘汰
   * @returns {{ downsampled: number, evicted: number }}
   */
  enforce() {
    let downsampled = 0;
    let evicted = 0;

    if (this.totalBytes < this.budgetBytes * DOWNSAMPLE_RATIO) {
      return { downsampled, evicted };
    }

    // 按 lastUsed 升序排序（最旧/最少使用 → 优先处理）
    const sorted = [...this.entries.entries()].sort(
      (a, b) => a[1].lastUsed - b[1].lastUsed
    );

    // 阶段 1：降采样
    for (const [tex, entry] of sorted) {
      if (this.totalBytes < this.budgetBytes * DOWNSAMPLE_RATIO) break;
      if (entry.downsampled) continue;
      if (_downsample(tex, entry)) {
        this.totalBytes += entry.bytes - _estimateBytes(tex);
        entry.bytes = _estimateBytes(tex);
        downsampled++;
      }
    }

    // 阶段 2：淘汰（dispose）
    if (this.totalBytes >= this.budgetBytes * EVICT_RATIO) {
      for (const [tex, entry] of sorted) {
        if (this.totalBytes < this.budgetBytes * DOWNSAMPLE_RATIO) break;
        try {
          tex.dispose?.();
        } catch {
          // ignore
        }
        this.totalBytes -= entry.bytes;
        this.entries.delete(tex);
        evicted++;
      }
    }

    return { downsampled, evicted };
  }

  /**
   * 取消追踪某纹理（不 dispose）
   */
  untrack(texture) {
    const e = this.entries.get(texture);
    if (!e) return;
    this.totalBytes -= e.bytes;
    this.entries.delete(texture);
  }

  /**
   * 获取当前 VRAM 估算（MB）
   */
  get usageMB() {
    return this.totalBytes / (1024 * 1024);
  }

  /**
   * 获取预算上限（MB）
   */
  get budgetMB() {
    return this.budgetBytes / (1024 * 1024);
  }

  dispose() {
    this.entries.clear();
    this.totalBytes = 0;
  }
}

// ---------- 内部工具 ----------

function _estimateBytes(texture) {
  const img = texture?.image;
  if (!img) return 0;
  const w = img.width || img.naturalWidth || 0;
  const h = img.height || img.naturalHeight || 0;
  if (!w || !h) return 0;
  // RGBA × mipmap 系数
  const mipFactor = texture.generateMipmaps !== false ? 1.33 : 1;
  return Math.ceil(w * h * 4 * mipFactor);
}

function _downsample(texture, entry) {
  const img = texture.image;
  if (!img) return false;
  const w = img.width || img.naturalWidth || 0;
  const h = img.height || img.naturalHeight || 0;
  if (w <= MIN_SIZE && h <= MIN_SIZE) return false;

  const halfW = Math.max(1, w >> 1);
  const halfH = Math.max(1, h >> 1);

  try {
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(halfW, halfH)
        : document.createElement("canvas");
    if (!(canvas instanceof OffscreenCanvas)) {
      canvas.width = halfW;
      canvas.height = halfH;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, halfW, halfH);

    entry.originalImage = entry.originalImage || img;
    texture.image = canvas;
    texture.needsUpdate = true;
    entry.downsampled = true;
    return true;
  } catch {
    return false;
  }
}

export default TextureBudget;
