<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree
} from "three-mesh-bvh";
import { TextureBudget } from "../utils/textureBudget";
import {
  disposeObject3D,
  computeBounds,
  setMaterialsTransparent
} from "../utils/dispose";
import {
  inferModelType,
  loadModelToGroup,
  computeModelStats
} from "../loaders/loadModel";
import { PerformanceMonitor } from "../utils/stats";
import { MeasureTool } from "../utils/measure";
import { ClippingTool } from "../utils/clipping";
import { ObjectPicker } from "../utils/picker";
import { ScreenshotTool } from "../utils/screenshot";
import { TouchGestures } from "../utils/touch";

defineOptions({ name: "ThreeModelViewer" });

const cameraMarkerIconUrl = new URL(
  "../../assets/web3d/camera.png",
  import.meta.url
).href;
const textureLoader = new THREE.TextureLoader();
const cameraMarkerTexture = textureLoader.load(cameraMarkerIconUrl);

const props = defineProps({
  modelUrl: { type: String, default: "" },
  modelName: { type: String, default: "" },
  sceneModels: { type: Array, default: () => [] },
  transparent: { type: Boolean, default: false },
  // 将加载到的所有材质统一替换为基础材质（不受光照影响）
  useBasicMaterial: { type: Boolean, default: false },
  // 画质档位：low | medium | high
  quality: { type: String, default: "high" },
  // low 档可选：直接释放贴图以极限降低显存占用（切回 medium/high 会自动重载模型恢复）
  extremeLowMemory: { type: Boolean, default: false },
  // 仅 high 档可选开启阴影（默认关闭，避免硬件压力）
  enableShadows: { type: Boolean, default: false },
  interactionMode: {
    type: String,
    default: "all" // all | rotate | pan | zoom | measure | pick
  },
  ifcWasmPath: { type: String, default: "/wasm/" },
  showStats: { type: Boolean, default: false },
  enableClipping: { type: Boolean, default: false },
  enableBvh: { type: Boolean, default: true },
  firstPersonSpeed: { type: Number, default: 0.18 }
});

function normalizeQuality(q) {
  if (q === "low" || q === "medium" || q === "high") return q;
  return "high";
}

const qualityOverride = ref(null);
const effectiveQuality = computed(() => {
  return normalizeQuality(qualityOverride.value ?? props.quality);
});
const materialThemeOverride = ref(null);

function normalizeMaterialTheme(theme) {
  if (theme === "original" || theme === "textured-basic" || theme === "basic") {
    return theme;
  }
  return props.useBasicMaterial ? "textured-basic" : "original";
}

const effectiveMaterialTheme = computed(() =>
  normalizeMaterialTheme(materialThemeOverride.value)
);

const originalMaterialsByUUID = new Map();
const basicMaterialCacheWithTextures = new WeakMap();
const basicMaterialCacheNoTextures = new WeakMap();

// low 档：从贴图采样“代表色”，避免纯白/同色导致构件难以区分
const representativeColorByTexture = new WeakMap();
const representativeColorByMaterial = new WeakMap();

const detachedTextureCache = new WeakMap();
const detachedMaterials = new Set();
let texturesDisposedInLowMode = false;
let qualityReloadInProgress = false;
let isDestroying = false;

function createSceneModelInstance(item = {}, index = 0) {
  return {
    instanceId:
      item.instanceId ||
      `scene-model-${Date.now()}-${index}-${Math.random().toString(16).slice(2, 6)}`,
    modelId: String(item.modelId || item.id || "").trim(),
    modelName: String(
      item.modelName || item.name || `模型 ${index + 1}`
    ).trim(),
    modelUrl: String(item.modelUrl || item.url || "").trim(),
    visible: item.visible !== false,
    transform: {
      position: Array.isArray(item.transform?.position)
        ? item.transform.position
        : [0, 0, 0],
      rotation: Array.isArray(item.transform?.rotation)
        ? item.transform.rotation
        : [0, 0, 0],
      scale: Array.isArray(item.transform?.scale)
        ? item.transform.scale
        : [1, 1, 1]
    }
  };
}

const resolvedSceneModels = computed(() => {
  if (Array.isArray(props.sceneModels) && props.sceneModels.length > 0) {
    return props.sceneModels
      .map((item, index) => createSceneModelInstance(item, index))
      .filter(item => item.modelUrl);
  }

  const modelUrl = String(props.modelUrl || "").trim();
  if (!modelUrl) return [];
  return [
    createSceneModelInstance({
      instanceId: "scene-model-default",
      modelId: "",
      modelName: props.modelName || "默认模型",
      modelUrl
    })
  ];
});

const hasModelInput = computed(() => resolvedSceneModels.value.length > 0);

const TEXTURE_KEYS = [
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
  "envMap",
  "clearcoatMap",
  "clearcoatNormalMap",
  "clearcoatRoughnessMap",
  "sheenColorMap",
  "sheenRoughnessMap",
  "transmissionMap",
  "thicknessMap",
  "iridescenceMap",
  "iridescenceThicknessMap",
  "anisotropyMap"
];

function clampByte(v) {
  return Math.max(0, Math.min(255, v | 0));
}

function tryAverageColorFromImageLike(image) {
  if (!image) return null;

  // 支持 HTMLImageElement / HTMLCanvasElement / ImageBitmap / OffscreenCanvas 等
  const width = image.width ?? image.videoWidth ?? image.naturalWidth;
  const height = image.height ?? image.videoHeight ?? image.naturalHeight;
  if (!width || !height) return null;

  // 图片未加载完成时无法采样
  if (typeof image.complete === "boolean" && image.complete === false) {
    return null;
  }

  const sampleSize = 16;
  let canvas;
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      canvas = new OffscreenCanvas(sampleSize, sampleSize);
    } else {
      canvas = document.createElement("canvas");
      canvas.width = sampleSize;
      canvas.height = sampleSize;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.clearRect(0, 0, sampleSize, sampleSize);
    ctx.drawImage(image, 0, 0, sampleSize, sampleSize);

    const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let w = 0;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255;
      // 忽略几乎透明像素，避免平均后偏灰
      if (a <= 0.05) continue;
      r += data[i] * a;
      g += data[i + 1] * a;
      b += data[i + 2] * a;
      w += a;
    }

    if (w <= 0) return null;
    return {
      r: clampByte(r / w),
      g: clampByte(g / w),
      b: clampByte(b / w)
    };
  } catch {
    // 可能被跨域资源污染（tainted canvas），或浏览器不支持读取
    return null;
  }
}

function tryAverageColorFromDataTexture(texture) {
  const image = texture?.image;
  const data = image?.data;
  const width = image?.width;
  const height = image?.height;
  if (!data || !width || !height) return null;

  // 仅抽样部分像素，避免大贴图计算开销
  const totalPixels = width * height;
  const step = Math.max(1, Math.floor(totalPixels / 2048));

  let r = 0;
  let g = 0;
  let b = 0;
  let w = 0;

  // 兼容 Uint8Array / Uint8ClampedArray 等
  for (let p = 0; p < totalPixels; p += step) {
    const i = p * 4;
    const a = (data[i + 3] ?? 255) / 255;
    if (a <= 0.05) continue;
    r += (data[i] ?? 0) * a;
    g += (data[i + 1] ?? 0) * a;
    b += (data[i + 2] ?? 0) * a;
    w += a;
  }

  if (w <= 0) return null;
  return {
    r: clampByte(r / w),
    g: clampByte(g / w),
    b: clampByte(b / w)
  };
}

function getRepresentativeColorFromTexture(texture) {
  if (!texture || !texture.isTexture) return null;
  const cached = representativeColorByTexture.get(texture);
  if (cached) return cached;

  let avg = null;
  // DataTexture
  if (texture.isDataTexture) {
    avg = tryAverageColorFromDataTexture(texture);
  }

  // 普通贴图（image 可为 HTMLImageElement / Canvas / ImageBitmap 等）
  if (!avg) {
    avg = tryAverageColorFromImageLike(texture.image);
  }
  if (!avg) return null;

  const color = new THREE.Color(avg.r / 255, avg.g / 255, avg.b / 255);
  // 若贴图为 sRGB，转换到线性空间，避免低画质下颜色偏暗
  try {
    if (texture.colorSpace && THREE.SRGBColorSpace) {
      if (texture.colorSpace === THREE.SRGBColorSpace)
        color.convertSRGBToLinear();
    }
  } catch {
    // ignore
  }

  representativeColorByTexture.set(texture, color);
  return color;
}

function getRepresentativeColorForMaterial(mat) {
  if (!mat) return null;
  const cached = representativeColorByMaterial.get(mat);
  if (cached) return cached;

  // 优先使用 baseColor 贴图；没有则尝试 emissiveMap（很多模型用 emissiveMap 表达颜色信息）
  const tex = mat.map || mat.emissiveMap;
  const texColor = getRepresentativeColorFromTexture(tex);
  if (texColor) {
    representativeColorByMaterial.set(mat, texColor);
    return texColor;
  }

  return null;
}

function detachTexturesFromMaterial(mat) {
  if (!mat || detachedTextureCache.has(mat)) return false;

  const record = {};
  let changed = false;
  TEXTURE_KEYS.forEach(k => {
    const v = mat[k];
    if (v && v.isTexture) {
      record[k] = v;
      mat[k] = null;
      changed = true;
    }
  });

  if (!changed) return false;
  detachedTextureCache.set(mat, record);
  detachedMaterials.add(mat);
  mat.needsUpdate = true;
  return true;
}

function restoreTexturesToMaterial(mat) {
  if (!mat) return false;
  const record = detachedTextureCache.get(mat);
  if (!record) return false;

  Object.keys(record).forEach(k => {
    if (record[k]) mat[k] = record[k];
  });
  detachedTextureCache.delete(mat);
  detachedMaterials.delete(mat);
  mat.needsUpdate = true;
  return true;
}

function detachTexturesFromOriginalMaterials() {
  const uniqueMats = new Set();
  originalMaterialsByUUID.forEach(mat => {
    const list = Array.isArray(mat) ? mat : [mat];
    list.filter(Boolean).forEach(m => uniqueMats.add(m));
  });
  uniqueMats.forEach(m => detachTexturesFromMaterial(m));
}

function restoreTexturesFromOriginalMaterials() {
  // 使用 detachedMaterials 集合保证能恢复所有已解绑贴图的材质
  Array.from(detachedMaterials).forEach(m => restoreTexturesToMaterial(m));
}

function disposeDetachedTexturesAndForget() {
  let disposed = 0;
  Array.from(detachedMaterials).forEach(mat => {
    const record = detachedTextureCache.get(mat);
    if (record) {
      Object.keys(record).forEach(k => {
        const tex = record[k];
        if (tex && tex.isTexture) {
          tex.dispose?.();
          disposed++;
        }
      });
    }
    detachedTextureCache.delete(mat);
    detachedMaterials.delete(mat);
    mat.needsUpdate = true;
  });

  if (disposed > 0) texturesDisposedInLowMode = true;
  return disposed;
}

function captureOriginalMaterials(root) {
  originalMaterialsByUUID.clear();
  if (!root) return;

  root.traverse(obj => {
    if (!obj?.isMesh) return;
    if (obj.userData?.isHelper || obj.userData?.isMeasure) return;
    originalMaterialsByUUID.set(obj.uuid, obj.material);
  });
}

function toBasicMaterial(src, { keepTextures }) {
  if (!src) return src;
  if (src.isMeshBasicMaterial) {
    if (keepTextures) return src;
    // low 档：仅当完全无贴图时可复用
    if (!src.map && !src.alphaMap && !src.aoMap && !src.lightMap) return src;
  }

  const cache = keepTextures
    ? basicMaterialCacheWithTextures
    : basicMaterialCacheNoTextures;
  const cached = cache.get(src);
  if (cached) {
    // low 档：尽可能用贴图代表色修正基础色
    if (!keepTextures && cached.color) {
      const rep = getRepresentativeColorForMaterial(src);
      if (rep) {
        cached.color.copy(rep);
        cached.needsUpdate = true;
      }
    }
    return cached;
  }

  const params = {
    side: src.side,
    transparent: Boolean(src.transparent),
    opacity: typeof src.opacity === "number" ? src.opacity : 1,
    depthWrite: src.depthWrite,
    depthTest: src.depthTest,
    alphaTest: typeof src.alphaTest === "number" ? src.alphaTest : 0,
    vertexColors: src.vertexColors,
    wireframe: Boolean(src.wireframe)
  };

  // low 档：纯色（优先从贴图采样代表色，否则沿用原材质颜色）
  if (!keepTextures) {
    const rep = getRepresentativeColorForMaterial(src);
    if (rep) params.color = rep;
  }
  if (!params.color && src.color) params.color = src.color;
  if (!params.color) params.color = new THREE.Color(0xffffff);

  // medium 档：保留基础纹理贴图（map 等），但不使用光照
  if (keepTextures) {
    if (src.map) params.map = src.map;
    if (src.alphaMap) params.alphaMap = src.alphaMap;
    if (src.aoMap) params.aoMap = src.aoMap;
    if (src.lightMap) params.lightMap = src.lightMap;
    if (typeof src.lightMapIntensity === "number") {
      params.lightMapIntensity = src.lightMapIntensity;
    }
  }

  const basic = new THREE.MeshBasicMaterial(params);
  basic.name = src.name
    ? `${src.name} (${keepTextures ? "basic" : "basic-no-texture"})`
    : keepTextures
      ? "basic"
      : "basic-no-texture";
  basic.needsUpdate = true;

  cache.set(src, basic);
  return basic;
}

function applyMaterialQuality(quality) {
  const q = normalizeQuality(quality);
  const theme = effectiveMaterialTheme.value;
  const materialMode =
    q === "low"
      ? "low"
      : q === "medium"
        ? "medium"
        : theme === "original"
          ? "high"
          : theme === "basic"
            ? "low"
            : "medium";
  const keepTextures = materialMode === "medium";

  modelGroup.traverse(obj => {
    if (!obj?.isMesh) return;
    if (obj.userData?.isHelper || obj.userData?.isMeasure) return;

    const original = originalMaterialsByUUID.get(obj.uuid) ?? obj.material;
    if (materialMode === "high") {
      obj.material = original;
      return;
    }

    const next = Array.isArray(original)
      ? original.map(m => toBasicMaterial(m, { keepTextures }))
      : toBasicMaterial(original, { keepTextures });
    obj.material = next;
  });
}

function disposeMaterialDeep(material) {
  if (!material) return;
  const list = Array.isArray(material) ? material : [material];
  list.filter(Boolean).forEach(mat => {
    try {
      Object.keys(mat).forEach(key => {
        const value = mat[key];
        if (value && value.isTexture) value.dispose?.();
      });
      mat.dispose?.();
    } catch {
      // 忽略释放异常
    }
  });
}

const emit = defineEmits([
  "loaded",
  "error",
  "scene-click",
  "progress",
  "object-select",
  "measure-complete",
  "measure-change",
  "scene-anchor-click",
  "clipping-change"
]);

const rootRef = ref(null);
const loading = ref(false);
const loadProgress = ref(0);
const errorText = ref("");
const modelStats = ref({ vertices: 0, triangles: 0, meshCount: 0 });

let renderer;
let scene;
let camera;
let perspectiveCamera;
let orthographicCamera;
let controls;
let resizeObserver;
let canvasEl;
let rafId = 0;
let isLoopRunning = false;
let onVisibilityChange;
let loadRequestId = 0;
let adaptiveInteractionLevel = "normal";
let lastAdaptiveUpdateAt = 0;
let lastFrameAt = 0;
let lastRenderAt = 0;
let lastInteractionAt = 0;

let pointerDown = null;
let onPointerDown;
let onPointerUp;
let onPointerMove;
let onWheel;
let onCanvasClick;
let suppressNextCanvasClick = false;
let onFirstPersonKeyDown;
let onFirstPersonKeyUp;
let onFirstPersonMouseMove;
let onPointerLockChange;

let selectionHighlightTarget = null;
let selectionHighlightOriginalMaterial = null;
const meshOpacityOverrides = new Map();
const visibilityOverrides = new Map();
const isFirstPerson = ref(false);
const firstPersonKeys = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  KeyQ: false,
  KeyE: false,
  ShiftLeft: false,
  ShiftRight: false
};
let firstPersonYaw = 0;
let firstPersonPitch = 0;

// 工具实例
let perfMonitor = null;
let measureTool = null;
let clippingTool = null;
let objectPicker = null;
let screenshotTool = null;
let touchGestures = null;
let linkedPointVisible = true;
let anchorsVisible = true;
let cameraAnchorsVisible = true;
let sceneAnchors = [];
let sceneCameraAnchors = [];
let linkedPoints = [];
const anchorObjectMap = new Map();
const cameraAnchorObjectMap = new Map();
const anchorRaycaster = new THREE.Raycaster();
const anchorPointer = new THREE.Vector2();

const modelGroup = new THREE.Group();
const linkedPointGroup = new THREE.Group();
const anchorGroup = new THREE.Group();
const cameraAnchorGroup = new THREE.Group();
let lastBounds = null;
const isOrthographic = ref(false);
let bvhPatched = false;

// 动态像素比自适应
let dynamicPixelRatio = null; // null = 使用画质配置默认值
let lastDprAdjustAt = 0;
const DPR_ADJUST_INTERVAL = 2000; // 每 2s 评估一次
const DPR_MIN = 0.75;

// 纹理内存预算器
let textureBudget = null;
let lastTexBudgetEnforceAt = 0;
const TEX_BUDGET_INTERVAL = 5000; // 每 5s 检查一次

let hemiLight;
let dirLight;
let ambientLight;

let rendererAntialias = true;

const canRender = computed(() => Boolean(rootRef.value));

function getViewportAdaptiveScale() {
  const rect = rootRef.value?.getBoundingClientRect?.();
  const width = Math.max(1, rect?.width || 1920);
  const height = Math.max(1, rect?.height || 1080);
  const shortEdge = Math.min(width, height);
  return THREE.MathUtils.clamp(shortEdge / 1080, 0.72, 1.18);
}

function createScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f7fa);

  hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  hemiLight.position.set(0, 1, 0);
  scene.add(hemiLight);

  dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(5, 10, 7);
  dirLight.castShadow = false;
  scene.add(dirLight);

  ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);

  const grid = new THREE.GridHelper(10, 10, 0xcccccc, 0xe5e7eb);
  grid.position.y = 0;
  grid.userData.isHelper = true;
  scene.add(grid);

  const axes = new THREE.AxesHelper(2);
  axes.position.set(0, 0, 0);
  axes.userData.isHelper = true;
  scene.add(axes);

  scene.add(modelGroup);
  linkedPointGroup.userData.isHelper = true;
  scene.add(linkedPointGroup);
  anchorGroup.userData.isHelper = true;
  cameraAnchorGroup.userData.isHelper = true;
  scene.add(anchorGroup);
  scene.add(cameraAnchorGroup);
}

function getPointStatusColor(status) {
  if (status === "alarm") return 0xef4444;
  if (status === "warning") return 0xf59e0b;
  return 0x10b981;
}

function wrapSpriteText(ctx, text, maxWidth) {
  const content = String(text || "").trim() || "-";
  const chars = Array.from(content);
  const lines = [];
  let current = "";

  chars.forEach(char => {
    const candidate = `${current}${char}`;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = char;
      return;
    }
    current = candidate;
  });

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : ["-"];
}

function createBadgeSprite(text, color, options = {}) {
  const fontSize = options.fontSize || 24;
  const fontWeight = options.fontWeight || "bold";
  const fontFamily = options.fontFamily || "sans-serif";
  const paddingX = options.paddingX || 22;
  const paddingY = options.paddingY || 16;
  const lineHeight = options.lineHeight || Math.round(fontSize * 1.35);
  const minWidth = options.minWidth || 180;
  const maxWidth = options.maxWidth || 300;
  const canvas = document.createElement("canvas");
  canvas.width = maxWidth;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const lines = wrapSpriteText(ctx, text, maxWidth - paddingX * 2);
  const measuredWidth = lines.reduce(
    (width, line) => Math.max(width, ctx.measureText(line).width),
    0
  );
  canvas.width = Math.ceil(
    Math.min(maxWidth, Math.max(minWidth, measuredWidth + paddingX * 2))
  );
  canvas.height = Math.ceil(
    Math.max(options.minHeight || 76, lines.length * lineHeight + paddingY * 2)
  );
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = options.backgroundColor || "rgba(15, 23, 42, 0.82)";
  ctx.strokeStyle =
    options.strokeColor || `#${color.toString(16).padStart(6, "0")}`;
  ctx.lineWidth = options.borderWidth || 4;
  const radius = 14;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(canvas.width - radius, 0);
  ctx.quadraticCurveTo(canvas.width, 0, canvas.width, radius);
  ctx.lineTo(canvas.width, canvas.height - radius);
  ctx.quadraticCurveTo(
    canvas.width,
    canvas.height,
    canvas.width - radius,
    canvas.height
  );
  ctx.lineTo(radius, canvas.height);
  ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = options.textColor || "#ffffff";
  const blockHeight = lines.length * lineHeight;
  const startY = (canvas.height - blockHeight) / 2 + lineHeight / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const viewportScale =
    options.sizeAttenuation === false ? getViewportAdaptiveScale() : 1;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    sizeAttenuation: options.sizeAttenuation !== false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(
    (options.scaleX || canvas.width / 120) * viewportScale,
    (options.scaleY || canvas.height / 120) * viewportScale,
    options.scaleZ || 1
  );
  if (options.center) {
    sprite.center.set(options.center[0], options.center[1]);
  }
  sprite.userData.isHelper = true;
  return sprite;
}

function createPointLabelSprite(text, status) {
  return createBadgeSprite(text, getPointStatusColor(status));
}

function createImageSprite(texture, options = {}) {
  if (!texture) return null;
  const useSizeAttenuation = options.sizeAttenuation !== false;
  const viewportScale = useSizeAttenuation ? 1 : getViewportAdaptiveScale();
  const attenuationBoost = useSizeAttenuation ? 2.2 : 1;
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: options.color || 0xffffff,
    transparent: true,
    alphaTest: 0.05,
    depthWrite: false,
    sizeAttenuation: useSizeAttenuation
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(
    (options.scaleX || 0.5) * viewportScale * attenuationBoost,
    (options.scaleY || 0.5) * viewportScale * attenuationBoost,
    options.scaleZ || 1
  );
  if (options.center) {
    sprite.center.set(options.center[0], options.center[1]);
  }
  sprite.userData.isHelper = true;
  return sprite;
}

function getAnchorTypeColor(type) {
  const map = {
    "measurement-point": 0x22c55e,
    "device-point": 0x3b82f6,
    "label-point": 0xf59e0b,
    "warning-point": 0xef4444,
    "custom-point": 0x8b5cf6,
    "camera-point": 0x0f766e
  };
  return map[type] || 0x3b82f6;
}

function resolveAnchorColor(colorValue, fallback) {
  if (!colorValue) return fallback;
  try {
    return new THREE.Color(colorValue);
  } catch {
    return fallback;
  }
}

function getAnchorLabelText(anchor) {
  if (!anchor) return "点位";
  if (anchor.type === "camera-point") {
    return anchor.cameraName || anchor.name || "摄像头";
  }
  if (anchor.runtimeState?.displayText) return anchor.runtimeState.displayText;
  return anchor.name || anchor.code || "点位";
}

function getAnchorRenderStyle(anchor, isCamera = false) {
  const style = anchor?.style || {};
  const fallbackColor = getAnchorTypeColor(anchor?.type);
  const labelFontSize =
    Number.isFinite(Number(style.labelFontSize)) &&
    Number(style.labelFontSize) > 0
      ? Number(style.labelFontSize)
      : 24;
  const labelScaleBase = THREE.MathUtils.clamp(labelFontSize / 24, 0.75, 2.4);
  return {
    markerSize:
      Number.isFinite(Number(style.markerSize)) && Number(style.markerSize) > 0
        ? Number(style.markerSize)
        : isCamera
          ? 0.42
          : 0.09,
    labelScaleX: (isCamera ? 2.4 : 2) * labelScaleBase,
    labelScaleY: (isCamera ? 0.63 : 0.72) * Math.sqrt(labelScaleBase),
    labelFontSize,
    labelOffsetY:
      Number.isFinite(Number(style.labelOffsetY)) &&
      Number(style.labelOffsetY) > 0
        ? Number(style.labelOffsetY)
        : isCamera
          ? 0.52
          : 0.42,
    iconSizeAttenuation: Boolean(style.iconSizeAttenuation),
    showLabel: style.showLabel !== false,
    markerColor: resolveAnchorColor(style.color, fallbackColor),
    labelColor: style.labelColor || (isCamera ? "#e6f4ff" : "#ffffff")
  };
}

function getObjectWorldPositionByUUID(uuid) {
  const obj = findObjectByUUID(uuid);
  if (!obj) return null;
  const box = new THREE.Box3().setFromObject(obj);
  const center = new THREE.Vector3();
  box.getCenter(center);
  if (!Number.isFinite(center.lengthSq())) return null;
  return center;
}

function clearLinkedPoints() {
  while (linkedPointGroup.children.length) {
    const child = linkedPointGroup.children.pop();
    child.traverse?.(node => {
      node.geometry?.dispose?.();
      if (node.material?.map?.dispose) node.material.map.dispose();
      node.material?.dispose?.();
    });
  }
}

function clearAnchorObjects(targetGroup, targetMap) {
  while (targetGroup.children.length) {
    const child = targetGroup.children.pop();
    child.traverse?.(node => {
      node.geometry?.dispose?.();
      if (node.material?.map?.dispose) node.material.map.dispose();
      node.material?.dispose?.();
    });
  }
  targetMap.clear();
}

function resolveSceneAnchorPosition(anchor) {
  if (!anchor) return null;
  let position = null;
  if (anchor.anchorMode === "object" && anchor.objectUuid) {
    position = getObjectWorldPositionByUUID(anchor.objectUuid);
  } else if (Array.isArray(anchor.worldPosition)) {
    position = new THREE.Vector3().fromArray(anchor.worldPosition);
  }
  if (!position) return null;

  const offset = Array.isArray(anchor.offset) ? anchor.offset : [0, 0.4, 0];
  return position.add(new THREE.Vector3().fromArray(offset));
}

function buildSceneAnchorObject(anchor, isCamera = false) {
  const position = resolveSceneAnchorPosition(anchor);
  if (!position) return null;

  const renderStyle = getAnchorRenderStyle(anchor, isCamera);
  const group = new THREE.Group();
  group.userData.isHelper = true;
  group.userData.isSceneAnchor = true;
  group.userData.sceneAnchorId = anchor.id;
  group.userData.sceneAnchorType = anchor.type;
  group.position.copy(position);

  if (isCamera) {
    const cameraSprite = createImageSprite(cameraMarkerTexture, {
      scaleX: renderStyle.markerSize,
      scaleY: renderStyle.markerSize,
      color: renderStyle.markerColor,
      sizeAttenuation: renderStyle.iconSizeAttenuation,
      center: [0.5, 0.0]
    });
    if (cameraSprite) {
      cameraSprite.userData.isSceneAnchor = true;
      cameraSprite.userData.sceneAnchorId = anchor.id;
      cameraSprite.userData.sceneAnchorType = anchor.type;
      group.add(cameraSprite);
    }
  } else {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(renderStyle.markerSize, 20, 20),
      new THREE.MeshBasicMaterial({ color: renderStyle.markerColor })
    );
    body.userData.isHelper = true;
    body.userData.isSceneAnchor = true;
    body.userData.sceneAnchorId = anchor.id;
    body.userData.sceneAnchorType = anchor.type;
    group.add(body);
  }

  if (renderStyle.showLabel) {
    const sprite = createBadgeSprite(
      getAnchorLabelText(anchor),
      renderStyle.markerColor,
      isCamera
        ? {
            minWidth: 220,
            maxWidth: 360,
            minHeight: 55,
            backgroundColor: "rgba(18, 38, 84, 0.82)",
            strokeColor: "#69b7ff",
            textColor: renderStyle.labelColor,
            borderWidth: 3,
            fontSize: renderStyle.labelFontSize,
            sizeAttenuation: false,
            center: [0.5, 0],
            scaleX: renderStyle.labelScaleX,
            scaleY: renderStyle.labelScaleY
          }
        : {
            width: 280,
            height: 96,
            backgroundColor: "rgba(15, 23, 42, 0.82)",
            strokeColor: undefined,
            textColor: renderStyle.labelColor,
            borderWidth: 4,
            fontSize: renderStyle.labelFontSize,
            sizeAttenuation: false,
            scaleX: renderStyle.labelScaleX,
            scaleY: renderStyle.labelScaleY
          }
    );
    if (sprite) {
      sprite.position.set(0, renderStyle.labelOffsetY, 0);
      sprite.userData.isSceneAnchor = true;
      sprite.userData.sceneAnchorId = anchor.id;
      sprite.userData.sceneAnchorType = anchor.type;
      group.add(sprite);
    }
  }

  return group;
}

function renderSceneAnchors() {
  clearAnchorObjects(anchorGroup, anchorObjectMap);
  anchorGroup.visible = anchorsVisible;

  sceneAnchors.forEach(anchor => {
    const group = buildSceneAnchorObject(anchor, false);
    if (!group) return;
    anchorObjectMap.set(anchor.id, group);
    anchorGroup.add(group);
  });
}

function renderCameraAnchors() {
  clearAnchorObjects(cameraAnchorGroup, cameraAnchorObjectMap);
  cameraAnchorGroup.visible = cameraAnchorsVisible;

  sceneCameraAnchors.forEach(anchor => {
    const group = buildSceneAnchorObject(anchor, true);
    if (!group) return;
    cameraAnchorObjectMap.set(anchor.id, group);
    cameraAnchorGroup.add(group);
  });
}

function setAnchors(anchors = []) {
  sceneAnchors = Array.isArray(anchors) ? anchors : [];
  renderSceneAnchors();
}

function setCameraAnchors(anchors = []) {
  sceneCameraAnchors = Array.isArray(anchors) ? anchors : [];
  renderCameraAnchors();
}

function clearAnchors() {
  sceneAnchors = [];
  renderSceneAnchors();
}

function clearCameraAnchors() {
  sceneCameraAnchors = [];
  renderCameraAnchors();
}

function setAnchorsVisible(visible) {
  anchorsVisible = Boolean(visible);
  anchorGroup.visible = anchorsVisible;
}

function setCameraAnchorsVisible(visible) {
  cameraAnchorsVisible = Boolean(visible);
  cameraAnchorGroup.visible = cameraAnchorsVisible;
}

function findAnchorHit(event) {
  if (!rootRef.value || !camera) return null;
  const rect = rootRef.value.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  anchorPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  anchorPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  anchorRaycaster.setFromCamera(anchorPointer, camera);

  const targets = [...anchorGroup.children, ...cameraAnchorGroup.children];
  if (!targets.length) return null;

  const intersects = anchorRaycaster.intersectObjects(targets, true);
  const hit = intersects.find(item => item.object?.userData?.isSceneAnchor);
  if (!hit) return null;

  const anchorId = hit.object.userData.sceneAnchorId;
  const anchorType = hit.object.userData.sceneAnchorType;
  const list =
    anchorType === "camera-point" ? sceneCameraAnchors : sceneAnchors;
  const anchor = list.find(item => item.id === anchorId) || null;
  return anchor ? { anchor, point: hit.point } : null;
}

function setLinkedPointsVisible(visible) {
  linkedPointVisible = Boolean(visible);
  linkedPointGroup.visible = linkedPointVisible;
}

function setLinkedPoints(points = []) {
  linkedPoints = Array.isArray(points) ? points : [];
  clearLinkedPoints();
  linkedPointGroup.visible = linkedPointVisible;

  linkedPoints.forEach(point => {
    const position = point?.targetUuid
      ? getObjectWorldPositionByUUID(point.targetUuid)
      : Array.isArray(point?.position)
        ? new THREE.Vector3().fromArray(point.position)
        : null;
    if (!position) return;

    const group = new THREE.Group();
    group.userData.isHelper = true;
    group.position.copy(position);
    group.position.y += 0.45;

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 20, 20),
      new THREE.MeshBasicMaterial({ color: getPointStatusColor(point.status) })
    );
    sphere.userData.isHelper = true;
    group.add(sphere);

    const labelText = `${point.tag || point.name || "测点"} ${point.value ?? "-"}${point.unit || ""}`;
    const sprite = createPointLabelSprite(labelText, point.status);
    if (sprite) {
      sprite.position.set(0, 0.42, 0);
      group.add(sprite);
    }

    linkedPointGroup.add(group);
  });
}

function createCamera(width, height) {
  // 透视相机
  perspectiveCamera = new THREE.PerspectiveCamera(
    45,
    width / height,
    0.01,
    2000
  );
  perspectiveCamera.position.set(6, 4, 6);

  // 正交相机
  const aspect = width / height;
  const frustumSize = 10;
  orthographicCamera = new THREE.OrthographicCamera(
    (-frustumSize * aspect) / 2,
    (frustumSize * aspect) / 2,
    frustumSize / 2,
    -frustumSize / 2,
    0.01,
    2000
  );
  orthographicCamera.position.set(6, 4, 6);

  camera = perspectiveCamera;
}

function getQualityConfig(quality) {
  const q = normalizeQuality(quality);
  return {
    antialias: q !== "low",
    pixelRatio: q === "low" ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    shadowsEnabled: q === "high" && Boolean(props.enableShadows)
  };
}

function applyShadowSettings(enabled) {
  if (!scene) return;

  if (dirLight) {
    dirLight.castShadow = Boolean(enabled);
    if (enabled) {
      dirLight.shadow.mapSize.set(1024, 1024);
      dirLight.shadow.camera.near = 0.5;
      dirLight.shadow.camera.far = 200;
    }
  }

  modelGroup.traverse(obj => {
    if (!obj) return;
    if (obj.userData?.isHelper || obj.userData?.isMeasure) return;
    if (obj.isMesh) {
      obj.castShadow = Boolean(enabled);
      obj.receiveShadow = Boolean(enabled);
    }
  });
}

function createRenderer(width, height, quality) {
  const cfg = getQualityConfig(quality);
  rendererAntialias = cfg.antialias;
  renderer = new THREE.WebGLRenderer({
    antialias: cfg.antialias,
    alpha: false,
    preserveDrawingBuffer: false
  });
  renderer.setPixelRatio(cfg.pixelRatio);
  renderer.setSize(width, height);
  renderer.localClippingEnabled = true; // 启用剖切支持

  renderer.shadowMap.enabled = cfg.shadowsEnabled;
  if (cfg.shadowsEnabled) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
}

function applyRendererQuality(quality) {
  if (!renderer) return;
  const cfg = getQualityConfig(quality);
  renderer.setPixelRatio(cfg.pixelRatio);
  renderer.shadowMap.enabled = cfg.shadowsEnabled;
  if (cfg.shadowsEnabled) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  applyShadowSettings(cfg.shadowsEnabled);
}

function replaceRendererIfNeeded(quality) {
  if (!rootRef.value || !renderer || !camera) return false;
  const cfg = getQualityConfig(quality);
  if (cfg.antialias === rendererAntialias) return false;

  if (
    typeof onPointerDown !== "function" ||
    typeof onPointerUp !== "function"
  ) {
    // 事件处理器未就绪，避免重建后无法正确绑定
    return false;
  }

  // 记录剖切状态（重建 renderer 后需要恢复）
  const clippingState = clippingTool?.getState?.();

  // 解绑旧 canvas 事件
  if (canvasEl && onPointerDown)
    canvasEl.removeEventListener("pointerdown", onPointerDown);
  if (canvasEl && onPointerUp)
    canvasEl.removeEventListener("pointerup", onPointerUp);
  if (canvasEl && onPointerMove)
    canvasEl.removeEventListener("pointermove", onPointerMove);
  if (canvasEl && onWheel) canvasEl.removeEventListener("wheel", onWheel);

  const rect = rootRef.value.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);

  // 销毁旧 controls（其事件绑定在旧 canvas 上）
  const oldTarget = controls?.target?.clone?.();
  controls?.dispose?.();
  controls = null;

  // 替换 renderer
  const oldRenderer = renderer;
  const oldCanvas = oldRenderer?.domElement;

  createRenderer(width, height, quality);
  canvasEl = renderer.domElement;

  if (oldCanvas?.parentNode) {
    oldCanvas.parentNode.replaceChild(canvasEl, oldCanvas);
  } else {
    rootRef.value.appendChild(canvasEl);
  }

  try {
    oldRenderer?.dispose?.();
  } catch {
    // ignore
  }

  // 重建 controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  if (oldTarget) controls.target.copy(oldTarget);
  applyInteractionMode(props.interactionMode);
  controls.update();

  // 更新依赖 renderer 的工具
  if (clippingTool) {
    clippingTool.dispose();
    clippingTool = null;
  }
  clippingTool = new ClippingTool({ renderer, scene, root: modelGroup });
  clippingTool.onChange = payload => {
    emit("clipping-change", {
      ...(payload || {}),
      stats: payload?.stats || clippingTool?.getStats?.() || null
    });
  };
  if (lastBounds?.box) {
    clippingTool.setBounds(lastBounds.box);
  }
  clippingTool.setState({
    ...(clippingState || {}),
    enabled: Boolean(props.enableClipping || clippingState?.enabled)
  });

  if (screenshotTool) {
    screenshotTool.renderer = renderer;
  }

  // 重新绑定 canvas 事件
  canvasEl.addEventListener("pointerdown", onPointerDown);
  canvasEl.addEventListener("pointerup", onPointerUp);
  if (onPointerMove)
    canvasEl.addEventListener("pointermove", onPointerMove, { passive: true });
  if (onWheel) canvasEl.addEventListener("wheel", onWheel, { passive: true });

  return true;
}

function createControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.addEventListener("start", noteUserInteraction);
  controls.addEventListener("change", noteUserInteraction);
  controls.addEventListener("end", noteUserInteraction);
  applyInteractionMode(props.interactionMode);
}

function resetFirstPersonKeys() {
  Object.keys(firstPersonKeys).forEach(key => {
    firstPersonKeys[key] = false;
  });
}

function syncFirstPersonAnglesFromCamera() {
  if (!camera || !controls) return;
  const dir = new THREE.Vector3()
    .subVectors(controls.target, camera.position)
    .normalize();
  firstPersonYaw = Math.atan2(dir.x, dir.z);
  firstPersonPitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
}

function updateFirstPersonLook() {
  if (!camera || !controls) return;
  const direction = new THREE.Vector3(
    Math.sin(firstPersonYaw) * Math.cos(firstPersonPitch),
    Math.sin(firstPersonPitch),
    Math.cos(firstPersonYaw) * Math.cos(firstPersonPitch)
  ).normalize();
  controls.target.copy(camera.position).add(direction);
  controls.update();
}

function updateFirstPersonMovement(frameMs) {
  if (!isFirstPerson.value || !camera || !controls) return;

  const moveSpeed =
    props.firstPersonSpeed *
    (firstPersonKeys.ShiftLeft || firstPersonKeys.ShiftRight ? 2.2 : 1);
  const distance = moveSpeed * Math.max(frameMs / 16.7, 0.5);
  const move = new THREE.Vector3();
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() === 0) {
    forward.set(0, 0, 1);
  } else {
    forward.normalize();
  }

  const right = new THREE.Vector3()
    .crossVectors(forward, camera.up)
    .normalize()
    .multiplyScalar(-1);

  if (firstPersonKeys.KeyW) move.add(forward);
  if (firstPersonKeys.KeyS) move.sub(forward);
  if (firstPersonKeys.KeyD) move.add(right);
  if (firstPersonKeys.KeyA) move.sub(right);
  if (firstPersonKeys.KeyE) move.y += 1;
  if (firstPersonKeys.KeyQ) move.y -= 1;

  if (move.lengthSq() === 0) return;

  move.normalize().multiplyScalar(distance);
  camera.position.add(move);
  controls.target.add(move);
  controls.update();
}

function exitPointerLock() {
  if (document.pointerLockElement === canvasEl) {
    document.exitPointerLock?.();
  }
}

function enableFirstPerson() {
  if (!camera || !controls || !canvasEl || isFirstPerson.value) return false;
  if (isOrthographic.value) {
    toggleProjection();
  }

  isFirstPerson.value = true;
  syncFirstPersonAnglesFromCamera();
  controls.enableRotate = false;
  controls.enablePan = false;
  controls.enableZoom = false;
  canvasEl.style.cursor = "crosshair";
  noteUserInteraction();
  return true;
}

function disableFirstPerson() {
  if (!isFirstPerson.value) return false;
  isFirstPerson.value = false;
  resetFirstPersonKeys();
  exitPointerLock();
  if (controls) {
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    applyInteractionMode(props.interactionMode);
  }
  if (canvasEl) {
    canvasEl.style.cursor = "";
  }
  noteUserInteraction();
  return true;
}

function toggleFirstPerson(force) {
  if (force === true) return enableFirstPerson();
  if (force === false) return disableFirstPerson();
  return isFirstPerson.value ? disableFirstPerson() : enableFirstPerson();
}

function applyInteractionMode(mode) {
  if (!controls) return;

  // 禁用测量和拾取模式的默认行为
  measureTool?.disable();
  objectPicker?.disable();
  if (canvasEl) {
    canvasEl.style.cursor = "";
  }

  if (mode === "rotate") {
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    };
    controls.enableRotate = true;
    controls.enablePan = false;
    controls.enableZoom = true;
    return;
  }
  if (mode === "pan") {
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    controls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_PAN
    };
    controls.enableRotate = false;
    controls.enablePan = true;
    controls.enableZoom = true;
    return;
  }
  if (mode === "zoom") {
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.DOLLY,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    };
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = true;
    return;
  }
  if (mode === "measure") {
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    controls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_PAN
    };
    controls.enableRotate = false;
    controls.enablePan = true;
    controls.enableZoom = true;
    measureTool?.enable();
    return;
  }
  if (mode === "pick") {
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    controls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_PAN
    };
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = true;
    if (canvasEl) {
      canvasEl.style.cursor = "crosshair";
    }
    objectPicker?.enable();
    return;
  }

  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
  };
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN
  };
  controls.enableRotate = true;
  controls.enablePan = true;
  controls.enableZoom = true;
}

function findObjectByUUID(uuid) {
  if (!uuid) return null;
  let found = null;
  modelGroup.traverse(obj => {
    if (found) return;
    if (obj.uuid === uuid) found = obj;
  });
  return found;
}

function cloneMaterialSafe(material) {
  if (!material) return material;
  if (Array.isArray(material)) {
    return material.map(item => item?.clone?.() || item);
  }
  return material?.clone?.() || material;
}

function disposeClonedMaterialSafe(material) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach(item => item?.dispose?.());
    return;
  }
  material?.dispose?.();
}

function applyHighlightTint(material, color = 0xff7a1a) {
  if (!material) return;
  if (material.emissive) {
    material.emissive.setHex(color);
    material.emissiveIntensity = Math.max(
      0.8,
      Number(material.emissiveIntensity) || 0
    );
  } else if (material.color) {
    material.color.lerp(new THREE.Color(color), 0.35);
  }
  material.needsUpdate = true;
}

function clearBoxSelection() {
  if (!selectionHighlightTarget) return;
  selectionHighlightOriginalMaterial?.forEach((originalMaterial, mesh) => {
    disposeClonedMaterialSafe(mesh.material);
    mesh.material = originalMaterial;
  });
  selectionHighlightTarget = null;
  selectionHighlightOriginalMaterial = null;
}

function highlightByUUID(uuid) {
  if (!scene) return false;
  const obj = findObjectByUUID(uuid);
  if (!obj) return false;

  clearBoxSelection();
  selectionHighlightTarget = obj;
  selectionHighlightOriginalMaterial = new Map();
  obj.traverse(target => {
    if (
      !target?.isMesh ||
      target.userData?.isHelper ||
      target.userData?.isMeasure
    ) {
      return;
    }
    selectionHighlightOriginalMaterial.set(target, target.material);
    target.material = cloneMaterialSafe(target.material);
    const materials = Array.isArray(target.material)
      ? target.material
      : [target.material];
    materials.filter(Boolean).forEach(material => {
      applyHighlightTint(material);
    });
  });
  return true;
}

function focusByUUID(uuid) {
  const obj = findObjectByUUID(uuid);
  if (!obj || !camera || !controls) return false;

  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return false;

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const dist = maxDim * 1.8;

  const dir = new THREE.Vector3()
    .subVectors(camera.position, controls.target)
    .normalize();
  if (!Number.isFinite(dir.lengthSq()) || dir.lengthSq() === 0) {
    dir.set(1, 0.6, 1).normalize();
  }
  const targetPos = center.clone().add(dir.multiplyScalar(dist));
  animateCamera(targetPos, center);
  return true;
}

function focusByUUIDs(uuids = []) {
  if (!camera || !controls || !Array.isArray(uuids) || !uuids.length) {
    return false;
  }

  const box = new THREE.Box3();
  let hasObject = false;

  uuids.forEach(uuid => {
    const obj = findObjectByUUID(uuid);
    if (!obj) return;
    box.expandByObject(obj);
    hasObject = true;
  });

  if (!hasObject || box.isEmpty()) return false;

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const dist = maxDim * 1.35;

  const dir = new THREE.Vector3()
    .subVectors(camera.position, controls.target)
    .normalize();
  if (!Number.isFinite(dir.lengthSq()) || dir.lengthSq() === 0) {
    dir.set(1, 0.6, 1).normalize();
  }

  const targetPos = center.clone().add(dir.multiplyScalar(dist));
  animateCamera(targetPos, center);
  return true;
}

function disposeMaterialSafe(mat) {
  if (!mat) return;
  if (Array.isArray(mat)) {
    mat.forEach(m => m?.dispose?.());
    return;
  }
  mat.dispose?.();
}

function setMeshOpacityByUUID(uuid, opacity = 0.2) {
  const obj = findObjectByUUID(uuid);
  if (!obj || !obj.isMesh) return false;

  const nextOpacity = Math.max(0, Math.min(1, Number(opacity)));
  const existing = meshOpacityOverrides.get(obj.uuid);

  if (nextOpacity >= 1) {
    if (existing) {
      obj.material = existing.original;
      disposeMaterialSafe(existing.override);
      meshOpacityOverrides.delete(obj.uuid);
    }
    return true;
  }

  if (!existing) {
    meshOpacityOverrides.set(obj.uuid, {
      original: obj.material,
      override: null
    });
  } else {
    // 先释放旧的覆盖材质，避免泄漏
    disposeMaterialSafe(existing.override);
  }

  const original = meshOpacityOverrides.get(obj.uuid).original;
  const makeTransparent = src => {
    const m = src?.clone?.() || new THREE.MeshBasicMaterial();
    m.transparent = true;
    m.opacity = nextOpacity;
    m.depthWrite = false;
    m.needsUpdate = true;
    return m;
  };

  const override = Array.isArray(original)
    ? original.map(makeTransparent)
    : makeTransparent(original);

  meshOpacityOverrides.set(obj.uuid, { original, override });
  obj.material = override;
  return true;
}

function clearIsolation() {
  if (!visibilityOverrides.size) return true;
  visibilityOverrides.forEach((visible, uuid) => {
    const obj = findObjectByUUID(uuid);
    if (obj) obj.visible = visible;
  });
  visibilityOverrides.clear();
  objectPicker?.markSceneTreeDirty?.();
  return true;
}

function isolateByUUID(uuid) {
  const target = findObjectByUUID(uuid);
  if (!target) return false;

  // 先恢复上一次隔离状态
  clearIsolation();

  const keep = new Set();

  // 保留：目标子树
  target.traverse(obj => {
    if (obj?.userData?.isHelper || obj?.userData?.isMeasure) return;
    keep.add(obj.uuid);
  });

  // 保留：目标祖先链（否则子节点会因父节点不可见而不渲染）
  let parent = target.parent;
  while (parent && parent !== modelGroup) {
    keep.add(parent.uuid);
    parent = parent.parent;
  }
  keep.add(modelGroup.uuid);

  // 对 modelGroup 下的对象做可见性隔离
  modelGroup.traverse(obj => {
    if (!obj) return;
    if (obj?.userData?.isHelper || obj?.userData?.isMeasure) return;

    const shouldVisible = keep.has(obj.uuid);
    if (obj.visible !== shouldVisible) {
      visibilityOverrides.set(obj.uuid, obj.visible);
      obj.visible = shouldVisible;
    }
  });

  objectPicker?.markSceneTreeDirty?.();

  return true;
}

function showOnlyUUIDs(uuids = []) {
  if (!Array.isArray(uuids) || !uuids.length) {
    return clearIsolation();
  }

  clearIsolation();

  const keep = new Set([modelGroup.uuid]);

  uuids.forEach(uuid => {
    const target = findObjectByUUID(uuid);
    if (!target) return;

    target.traverse(obj => {
      if (obj?.userData?.isHelper || obj?.userData?.isMeasure) return;
      keep.add(obj.uuid);
    });

    let parent = target.parent;
    while (parent && parent !== modelGroup) {
      keep.add(parent.uuid);
      parent = parent.parent;
    }
  });

  modelGroup.traverse(obj => {
    if (!obj) return;
    if (obj?.userData?.isHelper || obj?.userData?.isMeasure) return;

    const shouldVisible = keep.has(obj.uuid);
    if (obj.visible !== shouldVisible) {
      visibilityOverrides.set(obj.uuid, obj.visible);
      obj.visible = shouldVisible;
    }
  });

  objectPicker?.markSceneTreeDirty?.();
  return true;
}

function filterVisibleUUIDs(uuids = null) {
  if (uuids === null) {
    return clearIsolation();
  }

  clearIsolation();

  const keep = new Set([modelGroup.uuid]);

  if (Array.isArray(uuids) && uuids.length) {
    uuids.forEach(uuid => {
      const target = findObjectByUUID(uuid);
      if (!target) return;

      target.traverse(obj => {
        if (obj?.userData?.isHelper || obj?.userData?.isMeasure) return;
        keep.add(obj.uuid);
      });

      let parent = target.parent;
      while (parent && parent !== modelGroup) {
        keep.add(parent.uuid);
        parent = parent.parent;
      }
    });
  }

  modelGroup.traverse(obj => {
    if (!obj) return;
    if (obj?.userData?.isHelper || obj?.userData?.isMeasure) return;

    const shouldVisible = keep.has(obj.uuid);
    if (obj.visible !== shouldVisible) {
      visibilityOverrides.set(obj.uuid, obj.visible);
      obj.visible = shouldVisible;
    }
  });

  objectPicker?.markSceneTreeDirty?.();
  return true;
}

function ensureBvhPatched() {
  if (bvhPatched) return;
  if (!THREE.BufferGeometry.prototype.computeBoundsTree) {
    THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
  }
  if (!THREE.BufferGeometry.prototype.disposeBoundsTree) {
    THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
  }
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
  bvhPatched = true;
}

async function buildBvhForRoot(root, shouldCancel = () => false) {
  if (!root) return;
  ensureBvhPatched();

  const meshes = [];
  root.traverse(obj => {
    if (!obj?.isMesh) return;
    if (obj.userData?.isHelper || obj.userData?.isMeasure) return;
    if (!obj.geometry?.isBufferGeometry) return;
    meshes.push(obj);
  });

  for (let i = 0; i < meshes.length; i++) {
    if (shouldCancel()) return;

    const geo = meshes[i].geometry;
    if (geo.boundsTree) continue;

    if (shouldCancel()) return;

    // 主线程构建 BVH，避免 worker 在模型重载/卸载并发时抛出未捕获异常。
    try {
      if (geo.computeBoundsTree) {
        geo.computeBoundsTree({ maxLeafSize: 12 });
      }
    } catch (error) {
      // 某些模型几何存在异常时允许跳过 BVH，避免影响模型显示。
      console.warn("computeBoundsTree failed for geometry", error);
    }

    // 每 25 个让出主线程
    if (i > 0 && i % 25 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
}

function disposeBvhForRoot(root) {
  if (!root) return;
  root.traverse(obj => {
    if (!obj?.isMesh) return;
    if (obj.userData?.isHelper || obj.userData?.isMeasure) return;
    obj.geometry?.disposeBoundsTree?.();
  });
}

function noteUserInteraction() {
  lastInteractionAt = performance.now();
}

function shouldThrottleFrame(now) {
  const idleMs = now - lastInteractionAt;
  const targetFrameMs = idleMs > 1200 ? 1000 / 15 : 1000 / 60;
  return now - lastRenderAt < targetFrameMs;
}

function applyAdaptiveInteractionLevel(level) {
  if (adaptiveInteractionLevel === level) return;
  adaptiveInteractionLevel = level;
  measureTool?.setAdaptiveLevel?.(level);
  objectPicker?.setAdaptiveLevel?.(level);
}

function updateAdaptiveInteractionByFrame(frameMs, now) {
  // 每 500ms 评估一次，避免频繁抖动
  if (now - lastAdaptiveUpdateAt < 500) return;
  lastAdaptiveUpdateAt = now;

  if (frameMs > 32) {
    applyAdaptiveInteractionLevel("low-fps");
  } else if (frameMs > 20) {
    applyAdaptiveInteractionLevel("constrained");
  } else {
    applyAdaptiveInteractionLevel("normal");
  }

  // 动态像素比自适应
  updateDynamicPixelRatio(frameMs, now);

  // 纹理内存预算器周期执行
  if (textureBudget && now - lastTexBudgetEnforceAt > TEX_BUDGET_INTERVAL) {
    lastTexBudgetEnforceAt = now;
    textureBudget.enforce();
  }
}

function updateDynamicPixelRatio(frameMs, now) {
  if (!renderer) return;
  if (now - lastDprAdjustAt < DPR_ADJUST_INTERVAL) return;
  lastDprAdjustAt = now;

  const cfg = getQualityConfig(effectiveQuality.value);
  const baseDpr = cfg.pixelRatio;

  if (frameMs > 28) {
    // 帧时过高 → 降 DPR
    const current = dynamicPixelRatio ?? baseDpr;
    const next = Math.max(DPR_MIN, current - 0.25);
    if (next !== current) {
      dynamicPixelRatio = next;
      renderer.setPixelRatio(next);
    }
  } else if (frameMs < 14) {
    // 帧时充裕 → 恢复 DPR
    const current = dynamicPixelRatio ?? baseDpr;
    if (current < baseDpr) {
      const next = Math.min(baseDpr, current + 0.125);
      if (next >= baseDpr) {
        dynamicPixelRatio = null;
        renderer.setPixelRatio(baseDpr);
      } else {
        dynamicPixelRatio = next;
        renderer.setPixelRatio(next);
      }
    }
  }
}

function startLoop() {
  if (isLoopRunning) return;
  isLoopRunning = true;
  lastFrameAt = 0;
  lastRenderAt = 0;
  noteUserInteraction();

  const tick = () => {
    if (!isLoopRunning) return;
    if (!renderer || !scene || !camera) return;

    const now = performance.now();
    if (shouldThrottleFrame(now)) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    const frameMs = lastFrameAt ? now - lastFrameAt : 16.7;
    lastFrameAt = now;
    lastRenderAt = now;
    updateAdaptiveInteractionByFrame(frameMs, now);

    perfMonitor?.begin();

    updateFirstPersonMovement(frameMs);
    clippingTool?.updateAnimation?.(frameMs / 1000);
    controls?.update?.();
    renderer.render(scene, camera);

    // 更新测量标注
    measureTool?.update();

    perfMonitor?.end(renderer.info);

    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function stopLoop() {
  isLoopRunning = false;
  lastFrameAt = 0;
  lastRenderAt = 0;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

async function loadModel() {
  const requestId = ++loadRequestId;
  errorText.value = "";
  loadProgress.value = 0;

  const sceneModels = resolvedSceneModels.value;
  if (sceneModels.length === 0) {
    clearModel();
    return;
  }

  loading.value = true;
  try {
    clearModel();
    const totalCount = sceneModels.length;
    let totalTriangles = 0;
    let totalVertices = 0;
    let totalMeshCount = 0;
    const loadedModels = [];
    let modelType = "";

    for (let index = 0; index < sceneModels.length; index += 1) {
      const item = sceneModels[index];
      console.log("[ThreeModelViewer] load model", {
        index,
        totalCount,
        instanceId: item.instanceId,
        modelId: item.modelId || "",
        modelName: item.modelName || "",
        modelUrl: item.modelUrl
      });
      const { object, type, stats } = await loadModelToGroup({
        url: item.modelUrl,
        name: item.modelName,
        ifcWasmPath: props.ifcWasmPath,
        onProgress: (loaded, total) => {
          const currentPercent =
            total > 0 ? Math.round((loaded / total) * 100) : 0;
          loadProgress.value = Math.round(
            ((index + currentPercent / 100) / totalCount) * 100
          );
          emit("progress", {
            loaded,
            total,
            percent: loadProgress.value,
            index,
            totalCount,
            instanceId: item.instanceId
          });
        }
      });

      if (requestId !== loadRequestId) {
        disposeObject3D(object);
        return;
      }

      const instanceGroup = new THREE.Group();
      instanceGroup.name = item.modelName || `模型 ${index + 1}`;
      instanceGroup.visible = item.visible !== false;
      instanceGroup.userData.sceneModelInstanceId = item.instanceId;
      instanceGroup.userData.sceneModelId = item.modelId || "";
      instanceGroup.userData.sceneModelName = item.modelName || "";
      instanceGroup.userData.sceneModelType = type || "";
      instanceGroup.position.fromArray(item.transform.position || [0, 0, 0]);
      instanceGroup.rotation.set(...(item.transform.rotation || [0, 0, 0]));
      instanceGroup.scale.fromArray(item.transform.scale || [1, 1, 1]);

      object.traverse(child => {
        child.userData = child.userData || {};
        child.userData.sceneModelInstanceId = item.instanceId;
        child.userData.sceneModelId = item.modelId || "";
        child.userData.sceneModelName = item.modelName || "";
        child.userData.sceneModelType = type || "";
      });

      instanceGroup.add(object);
      modelGroup.add(instanceGroup);
      loadedModels.push(item);
      modelType = type || modelType;
      totalTriangles += Number(stats?.triangles || 0);
      totalVertices += Number(stats?.vertices || 0);
      totalMeshCount += Number(stats?.meshCount || 0);
    }

    if (props.enableBvh) {
      try {
        await buildBvhForRoot(
          modelGroup,
          () => isDestroying || requestId !== loadRequestId
        );
      } catch (error) {
        // BVH 仅用于加速拾取/测量，失败时不应阻止模型渲染。
        console.warn("buildBvhForRoot failed, continue without BVH", error);
      }
    }

    if (isDestroying || requestId !== loadRequestId) return;

    measureTool?.refreshPickTargets?.();
    objectPicker?.refreshPickTargets?.();
    captureOriginalMaterials(modelGroup);
    lastBounds = computeBounds(modelGroup);
    modelStats.value = {
      triangles: totalTriangles,
      vertices: totalVertices,
      meshCount: totalMeshCount
    };
    fitToView();
    renderSceneAnchors();
    renderCameraAnchors();

    // 纹理内存预算器跟踪
    if (!textureBudget) textureBudget = new TextureBudget();
    textureBudget.trackFromRoot(modelGroup);
    textureBudget.enforce();

    // 根据画质档位重新应用材质/渲染设置
    applyQualitySettings(effectiveQuality.value);

    // 更新剖切工具边界
    if (clippingTool && lastBounds) {
      clippingTool.setBounds(lastBounds.box);
    }

    console.log("[ThreeModelViewer] scene debug", {
      scene,
      modelGroup,
      loadedModels,
      modelType,
      modelStats: modelStats.value
    });

    emit("loaded", {
      url: loadedModels[0]?.modelUrl || "",
      type: sceneModels.length > 1 ? "multi" : modelType,
      stats: modelStats.value,
      models: loadedModels
    });
  } catch (e) {
    if (requestId !== loadRequestId) return;
    const msg = e?.message || String(e);
    console.error("[ThreeModelViewer] load model failed", {
      models: sceneModels.map(item => ({
        instanceId: item.instanceId,
        modelId: item.modelId || "",
        modelName: item.modelName || "",
        modelUrl: item.modelUrl
      })),
      error: e
    });
    errorText.value = msg;
    emit("error", e);
  } finally {
    if (requestId === loadRequestId) {
      loading.value = false;
      loadProgress.value = 0;
    }
  }
}

function clearModel() {
  // 若处于 low 档贴图解绑状态，先恢复贴图，确保 dispose 能正确释放贴图资源
  restoreTexturesFromOriginalMaterials();

  texturesDisposedInLowMode = false;
  qualityReloadInProgress = false;

  while (modelGroup.children.length) {
    const child = modelGroup.children.pop();
    disposeBvhForRoot(child);
    disposeObject3D(child);
  }
  clippingTool?.setBounds?.(null);
  clearLinkedPoints();
  renderSceneAnchors();
  renderCameraAnchors();
  measureTool?.refreshPickTargets?.();
  objectPicker?.refreshPickTargets?.();

  // 若当前使用的是 basic 材质，原始材质可能不在场景树里，需要手动释放
  if (originalMaterialsByUUID.size) {
    const uniqueMats = new Set();
    originalMaterialsByUUID.forEach(mat => {
      const list = Array.isArray(mat) ? mat : [mat];
      list.filter(Boolean).forEach(m => uniqueMats.add(m));
    });
    uniqueMats.forEach(m => disposeMaterialDeep(m));
    originalMaterialsByUUID.clear();
  }

  detachedMaterials.clear();

  clearIsolation();
  clearBoxSelection();
  meshOpacityOverrides.forEach(v => disposeMaterialSafe(v.override));
  meshOpacityOverrides.clear();
  lastBounds = null;
  modelStats.value = { vertices: 0, triangles: 0, meshCount: 0 };
}

function getSceneRadius() {
  const bounds = lastBounds || computeBounds(modelGroup);
  const size = bounds?.size || new THREE.Vector3(1, 1, 1);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  return Math.max(size.length() * 0.5, maxDim * 0.5, 0.5);
}

function updateCameraClipping(radius = getSceneRadius()) {
  if (!camera || !controls) return;
  const distance = camera.position.distanceTo(controls.target);
  const safeRadius = Math.max(radius, 0.5);
  camera.near = Math.max(
    0.001,
    Math.min(distance / 500, safeRadius / 200, 0.05)
  );
  camera.far = Math.max(distance * 50 + safeRadius * 10, 1000);
  camera.updateProjectionMatrix();
}

function fitToView() {
  if (!camera || !controls) return;

  const bounds = lastBounds || computeBounds(modelGroup);
  const { size, center } = bounds;
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const radius = Math.max(size.length() * 0.5, maxDim * 0.5, 0.5);
  const padding = 1.25;

  if (camera.isPerspectiveCamera) {
    const verticalFov = THREE.MathUtils.degToRad(camera.fov || 50);
    const horizontalFov =
      2 *
      Math.atan(
        Math.tan(verticalFov / 2) * Math.max(camera.aspect || 1, 0.0001)
      );
    const distanceForHeight = radius / Math.tan(verticalFov / 2);
    const distanceForWidth = radius / Math.tan(horizontalFov / 2);
    const dist = Math.max(distanceForHeight, distanceForWidth) * padding;

    const direction = new THREE.Vector3(1, 0.6, 1).normalize();
    camera.position.copy(center).addScaledVector(direction, dist);
  } else if (camera.isOrthographicCamera) {
    const aspect = Math.max(camera.aspect || 1, 0.0001);
    const halfHeight = Math.max(size.y, maxDim / aspect) * 0.5 * padding;
    const halfWidth = halfHeight * aspect;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    const dist = Math.max(radius * 2.4, maxDim * 1.6);
    const direction = new THREE.Vector3(1, 0.6, 1).normalize();
    camera.position.copy(center).addScaledVector(direction, dist);
  }

  controls.target.copy(center);
  updateCameraClipping(radius);
  controls.update();
}

function zoomBy(factor) {
  if (!camera || !controls) return;
  const dir = new THREE.Vector3();
  dir.subVectors(camera.position, controls.target);
  dir.multiplyScalar(factor);
  camera.position.copy(controls.target).add(dir);
  updateCameraClipping();
  controls.update();
}

// ============ 相机控制增强 ============

function toggleProjection() {
  const oldCamera = camera;
  camera = isOrthographic.value ? perspectiveCamera : orthographicCamera;
  isOrthographic.value = !isOrthographic.value;

  camera.position.copy(oldCamera.position);
  camera.quaternion.copy(oldCamera.quaternion);

  controls.object = camera;
  controls.update();

  return isOrthographic.value;
}

function setPresetView(preset) {
  if (!camera || !controls || !lastBounds) return;

  const { size, center } = lastBounds;
  const dist = Math.max(size.x, size.y, size.z) * 1.5;

  const positions = {
    top: new THREE.Vector3(center.x, center.y + dist, center.z + 0.001),
    bottom: new THREE.Vector3(center.x, center.y - dist, center.z + 0.001),
    front: new THREE.Vector3(center.x, center.y, center.z + dist),
    back: new THREE.Vector3(center.x, center.y, center.z - dist),
    left: new THREE.Vector3(center.x - dist, center.y, center.z),
    right: new THREE.Vector3(center.x + dist, center.y, center.z),
    iso: new THREE.Vector3(
      center.x + dist * 0.7,
      center.y + dist * 0.5,
      center.z + dist * 0.7
    )
  };

  const targetPos = positions[preset] || positions.iso;
  animateCamera(targetPos, center);
}

function animateCamera(targetPos, targetLookAt, duration = 400) {
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const startTime = performance.now();

  const animate = () => {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    const easeT = 1 - Math.pow(1 - t, 3);

    camera.position.lerpVectors(startPos, targetPos, easeT);
    controls.target.lerpVectors(startTarget, targetLookAt, easeT);
    updateCameraClipping();
    controls.update();

    if (t < 1) {
      requestAnimationFrame(animate);
    }
  };

  animate();
}

// ============ 剖切控制 ============

function setClippingState(state) {
  clippingTool?.setState?.(state);
}

function resetClipping() {
  clippingTool?.reset?.();
}

function setClippingEnabled(axis, enabled) {
  clippingTool?.setPlaneEnabled(axis, enabled);
}

function setClippingRange(axis, range) {
  clippingTool?.setPlaneRange?.(axis, range);
}

function setClippingPosition(axis, value) {
  clippingTool?.setPlanePosition(axis, value);
}

function getClippingState() {
  return clippingTool?.getState();
}

function getClippingStats() {
  return clippingTool?.getStats?.() || null;
}

function setClippingAnimationOptions(options = {}) {
  return clippingTool?.setAnimationOptions?.(options) || null;
}

function startClippingAnimation(options = {}) {
  return clippingTool?.startAnimation?.(options) || null;
}

function stopClippingAnimation() {
  return clippingTool?.stopAnimation?.() || false;
}

function getClippingAnimationState() {
  return clippingTool?.getAnimationState?.() || null;
}

// ============ 测量控制 ============

function clearMeasurements() {
  measureTool?.clearAll();
}

function getMeasurements() {
  return measureTool?.getResults() || [];
}

function setMeasurementMode(mode) {
  measureTool?.setMode?.(mode);
}

function removeMeasurement(id) {
  return measureTool?.removeMeasurement?.(id);
}

function setMeasurementVisible(id, visible) {
  return measureTool?.setMeasurementVisible?.(id, visible);
}

function exportMeasurements() {
  return measureTool?.exportResults?.() || "[]";
}

function setMeasurements(records = []) {
  measureTool?.setResults?.(records);
}

function focusMeasurement(id) {
  const item = getMeasurements().find(entry => entry.id === id);
  if (!item?.points?.length || !camera || !controls) return false;
  const center = new THREE.Vector3();
  item.points.forEach(point =>
    center.add(new THREE.Vector3().fromArray(point))
  );
  center.multiplyScalar(1 / item.points.length);
  const distance = Math.max(2, item.points.length * 0.8);
  animateCamera(
    new THREE.Vector3(
      center.x + distance,
      center.y + distance,
      center.z + distance
    ),
    center
  );
  return true;
}

// ============ 拾取控制 ============

function getSelectedObject() {
  return objectPicker?.getSelectedProperties();
}

function selectByUUID(uuid) {
  if (!uuid || !objectPicker) return false;
  const obj = objectPicker.selectByUUID(uuid);
  const props = objectPicker.getSelectedProperties();
  if (obj && props) {
    emit("object-select", props);
    return true;
  }
  return false;
}

function clearSelection() {
  objectPicker?.clearSelection();
}

function getSceneTree() {
  return objectPicker?.buildSceneTree(modelGroup);
}

// ============ 截图与书签 ============

function captureScreenshot(options) {
  return screenshotTool?.capture(options);
}

function downloadScreenshot(filename, options) {
  screenshotTool?.download(filename, options);
}

function addBookmark(name) {
  const cameraState = {
    position: camera.position.toArray(),
    target: controls.target.toArray(),
    isOrthographic: isOrthographic.value
  };
  return screenshotTool?.addBookmark(name, cameraState);
}

function getBookmarks() {
  return screenshotTool?.getBookmarks() || [];
}

function applyBookmark(bookmark) {
  if (!bookmark?.camera) return;
  const { position, target, isOrthographic: ortho } = bookmark.camera;

  if (ortho !== isOrthographic.value) {
    toggleProjection();
  }

  camera.position.fromArray(position);
  controls.target.fromArray(target);
  camera.updateProjectionMatrix();
  controls.update();
}

// ============ 生命周期 ============

function handleResize() {
  if (!rootRef.value || !renderer || !camera) return;
  const rect = rootRef.value.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);

  renderer.setSize(width, height);

  // 更新两个相机
  const aspect = width / height;
  perspectiveCamera.aspect = aspect;
  perspectiveCamera.updateProjectionMatrix();

  const frustumSize = 10;
  orthographicCamera.left = (-frustumSize * aspect) / 2;
  orthographicCamera.right = (frustumSize * aspect) / 2;
  orthographicCamera.updateProjectionMatrix();

  measureTool?.resize(width, height);
  renderSceneAnchors();
  renderCameraAnchors();
  setLinkedPoints(linkedPoints);
}

function mountRenderer() {
  if (!rootRef.value) return;
  const rect = rootRef.value.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);

  createScene();
  createCamera(width, height);
  createRenderer(width, height, effectiveQuality.value);
  createControls();

  applyRendererQuality(effectiveQuality.value);

  rootRef.value.appendChild(renderer.domElement);
  canvasEl = renderer.domElement;

  // 初始化工具
  perfMonitor = new PerformanceMonitor({ enabled: props.showStats });
  perfMonitor.mount(rootRef.value);

  measureTool = new MeasureTool({
    scene,
    camera,
    renderer,
    container: rootRef.value,
    pickRoot: modelGroup
  });
  measureTool.setAdaptiveLevel?.("normal");
  measureTool.onChange = payload => {
    emit("measure-change", payload);
  };
  measureTool.onComplete = (records, latest) => {
    emit("measure-complete", { records, latest });
  };

  clippingTool = new ClippingTool({ renderer, scene, root: modelGroup });
  clippingTool.onChange = payload => {
    emit("clipping-change", {
      ...(payload || {}),
      stats: payload?.stats || clippingTool?.getStats?.() || null
    });
  };
  if (props.enableClipping) {
    clippingTool.enable();
  }

  objectPicker = new ObjectPicker({
    scene,
    camera,
    container: rootRef.value,
    pickRoot: modelGroup
  });
  objectPicker.setAdaptiveLevel?.("normal");
  objectPicker.onSelect = (obj, objProps, hitPoint) => {
    emit("object-select", {
      ...objProps,
      hitPoint: Array.isArray(objProps?.hitPoint)
        ? objProps.hitPoint
        : hitPoint?.toArray?.() || null
    });
  };

  screenshotTool = new ScreenshotTool({ renderer, camera, scene });

  // 触摸手势
  touchGestures = new TouchGestures({
    container: rootRef.value,
    onRotate: (dx, dy) => {
      if (isFirstPerson.value) return;
      if (controls) {
        controls.rotateLeft(dx * 0.005);
        controls.rotateUp(dy * 0.005);
      }
    },
    onZoom: scale => {
      zoomBy(scale > 1 ? 0.95 : 1.05);
    },
    onPan: () => {
      // 平移由 OrbitControls 处理
    },
    onTap: () => {
      emit("scene-click");
    }
  });
  touchGestures.enable();

  // 点击事件处理
  onPointerDown = e => {
    noteUserInteraction();
    if (
      e.button === 0 &&
      clippingTool?.beginDrag?.(e, camera, canvasEl) &&
      !isFirstPerson.value
    ) {
      controls.enabled = false;
      canvasEl.style.cursor = "grabbing";
      pointerDown = {
        x: e.clientX,
        y: e.clientY,
        t: Date.now(),
        button: e.button,
        clippingDrag: true
      };
      return;
    }
    pointerDown = {
      x: e.clientX,
      y: e.clientY,
      t: Date.now(),
      button: e.button
    };
  };

  onPointerUp = e => {
    noteUserInteraction();
    if (clippingTool?.isDragging?.()) {
      clippingTool.endDrag();
      controls.enabled = true;
      canvasEl.style.cursor = "";
      suppressNextCanvasClick = true;
      pointerDown = null;
      return;
    }
    if (!pointerDown) return;
    const dx = Math.abs(e.clientX - pointerDown.x);
    const dy = Math.abs(e.clientY - pointerDown.y);
    const dt = Date.now() - pointerDown.t;
    const isClick = dx <= 5 && dy <= 5 && dt <= 250;
    const isLeft = pointerDown.button === 0;
    pointerDown = null;
    if (
      isClick &&
      isLeft &&
      !isFirstPerson.value &&
      props.interactionMode !== "measure" &&
      props.interactionMode !== "pick"
    ) {
      emit("scene-click");
    }
  };

  onPointerMove = e => {
    noteUserInteraction();
    if (clippingTool?.isDragging?.()) {
      clippingTool.updateDrag(e, camera, canvasEl);
      canvasEl.style.cursor = "grabbing";
      return;
    }
  };

  onWheel = () => {
    noteUserInteraction();
  };

  onCanvasClick = event => {
    if (suppressNextCanvasClick) {
      suppressNextCanvasClick = false;
      return;
    }
    const anchorHit = findAnchorHit(event);
    if (anchorHit?.anchor) {
      event.preventDefault();
      event.stopPropagation();
      emit("scene-anchor-click", anchorHit.anchor);
      return;
    }
    if (!isFirstPerson.value) return;
    if (document.pointerLockElement !== canvasEl) {
      canvasEl.requestPointerLock?.();
    }
  };

  onFirstPersonKeyDown = e => {
    if (!isFirstPerson.value) return;
    if (e.code in firstPersonKeys) {
      firstPersonKeys[e.code] = true;
      noteUserInteraction();
      e.preventDefault();
      return;
    }
    if (e.code === "Escape") {
      disableFirstPerson();
    }
  };

  onFirstPersonKeyUp = e => {
    if (e.code in firstPersonKeys) {
      firstPersonKeys[e.code] = false;
    }
  };

  onFirstPersonMouseMove = e => {
    if (!isFirstPerson.value || document.pointerLockElement !== canvasEl)
      return;
    const sensitivity = 0.0025;
    firstPersonYaw -= e.movementX * sensitivity;
    firstPersonPitch = THREE.MathUtils.clamp(
      firstPersonPitch - e.movementY * sensitivity,
      -Math.PI / 2 + 0.05,
      Math.PI / 2 - 0.05
    );
    updateFirstPersonLook();
    noteUserInteraction();
  };

  onPointerLockChange = () => {
    if (!isFirstPerson.value) return;
    if (document.pointerLockElement !== canvasEl) {
      resetFirstPersonKeys();
    }
  };

  canvasEl.addEventListener("pointerdown", onPointerDown);
  canvasEl.addEventListener("pointerup", onPointerUp);
  canvasEl.addEventListener("pointermove", onPointerMove, { passive: true });
  canvasEl.addEventListener("wheel", onWheel, { passive: true });
  canvasEl.addEventListener("click", onCanvasClick);
  document.addEventListener("keydown", onFirstPersonKeyDown);
  document.addEventListener("keyup", onFirstPersonKeyUp);
  document.addEventListener("mousemove", onFirstPersonMouseMove);
  document.addEventListener("pointerlockchange", onPointerLockChange);

  resizeObserver = new ResizeObserver(() => {
    handleResize();
  });
  resizeObserver.observe(rootRef.value);

  startLoop();
}

function clearQualitySideEffects() {
  // 质量切换会导致材质整体替换：清理拾取/透明覆写等“依赖旧材质引用”的状态
  objectPicker?.clearSelection?.();
  objectPicker?.clearHighlight?.();

  meshOpacityOverrides.forEach(v => disposeMaterialSafe(v.override));
  meshOpacityOverrides.clear();
}

function applyQualitySettings(quality) {
  const q = normalizeQuality(quality);

  // 若 low 档已做“极限省显存”贴图释放，则切回 medium/high 需要重载模型恢复贴图
  if (q !== "low" && texturesDisposedInLowMode && !qualityReloadInProgress) {
    texturesDisposedInLowMode = false;
    qualityReloadInProgress = true;
    // 重载模型以恢复贴图与原始材质
    Promise.resolve()
      .then(() => loadModel())
      .finally(() => {
        qualityReloadInProgress = false;
      });
    return;
  }

  // 从 low 切回 medium/high：需要先恢复原始材质上的贴图，避免 medium 档无法保留纹理
  if (q !== "low") {
    restoreTexturesFromOriginalMaterials();
  }

  // antialias 只能在创建 renderer 时设置，因此必要时重建
  replaceRendererIfNeeded(q);
  applyRendererQuality(q);

  clearQualitySideEffects();
  applyMaterialQuality(q);
  setMaterialsTransparent(modelGroup, props.transparent);
  clippingTool?.refreshMaterials?.();

  // low：对原始材质做贴图解绑（可逆），进一步降低 GPU 纹理压力
  if (q === "low") {
    detachTexturesFromOriginalMaterials();

    // 极限省显存：直接释放贴图（不可逆，切回 medium/high 会触发重载恢复）
    if (props.extremeLowMemory) {
      disposeDetachedTexturesAndForget();
    }
  }
}

function setQuality(quality) {
  qualityOverride.value = normalizeQuality(quality);
  applyQualitySettings(effectiveQuality.value);
}

function setMaterialTheme(theme) {
  materialThemeOverride.value = normalizeMaterialTheme(theme);
  applyQualitySettings(effectiveQuality.value);
}

function destroy() {
  isDestroying = true;
  loadRequestId += 1;
  stopLoop();
  resizeObserver?.disconnect?.();
  resizeObserver = null;

  if (onVisibilityChange) {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    onVisibilityChange = null;
  }

  if (canvasEl && onPointerDown)
    canvasEl.removeEventListener("pointerdown", onPointerDown);
  if (canvasEl && onPointerUp)
    canvasEl.removeEventListener("pointerup", onPointerUp);
  if (canvasEl && onPointerMove)
    canvasEl.removeEventListener("pointermove", onPointerMove);
  if (canvasEl && onWheel) canvasEl.removeEventListener("wheel", onWheel);
  if (canvasEl && onCanvasClick)
    canvasEl.removeEventListener("click", onCanvasClick);
  document.removeEventListener("keydown", onFirstPersonKeyDown);
  document.removeEventListener("keyup", onFirstPersonKeyUp);
  document.removeEventListener("mousemove", onFirstPersonMouseMove);
  document.removeEventListener("pointerlockchange", onPointerLockChange);
  disableFirstPerson();
  canvasEl = null;
  onPointerDown = null;
  onPointerUp = null;
  onPointerMove = null;
  onWheel = null;
  onCanvasClick = null;
  onFirstPersonKeyDown = null;
  onFirstPersonKeyUp = null;
  onFirstPersonMouseMove = null;
  onPointerLockChange = null;
  pointerDown = null;

  clearModel();

  // 销毁工具
  perfMonitor?.dispose();
  measureTool?.dispose();
  clippingTool?.dispose();
  objectPicker?.dispose();
  touchGestures?.dispose();
  textureBudget?.dispose();
  textureBudget = null;

  dynamicPixelRatio = null;

  controls?.dispose?.();
  controls = null;

  renderer?.dispose?.();
  if (renderer?.domElement?.parentNode) {
    renderer.domElement.parentNode.removeChild(renderer.domElement);
  }
  renderer = null;

  scene = null;
  camera = null;
}

function ensureLoaded() {
  if (!canRender.value) return;
  loadModel();
}

defineExpose({
  loadModel: ensureLoaded,
  resetView: fitToView,
  zoomIn: () => zoomBy(0.85),
  zoomOut: () => zoomBy(1.18),
  // 画质
  setQuality,
  setMaterialTheme,
  getMaterialTheme: () => effectiveMaterialTheme.value,
  // 相机控制
  toggleProjection,
  setPresetView,
  isOrthographic,
  isFirstPerson,
  toggleFirstPerson,
  // 剖切
  setClippingState,
  resetClipping,
  setClippingEnabled,
  setClippingRange,
  setClippingPosition,
  getClippingState,
  getClippingStats,
  setClippingAnimationOptions,
  startClippingAnimation,
  stopClippingAnimation,
  getClippingAnimationState,
  // 测量
  clearMeasurements,
  getMeasurements,
  setMeasurementMode,
  setMeasurements,
  removeMeasurement,
  setMeasurementVisible,
  exportMeasurements,
  focusMeasurement,
  // 拾取
  getSelectedObject,
  selectByUUID,
  clearSelection,
  getSceneTree,
  getObjectWorldPositionByUUID,
  // 结构树联动
  highlightByUUID,
  focusByUUID,
  focusByUUIDs,
  setMeshOpacityByUUID,
  clearBoxSelection,
  isolateByUUID,
  showOnlyUUIDs,
  filterVisibleUUIDs,
  clearIsolation,
  // 截图
  captureScreenshot,
  downloadScreenshot,
  setAnchors,
  clearAnchors,
  setAnchorsVisible,
  setCameraAnchors,
  clearCameraAnchors,
  setCameraAnchorsVisible,
  setLinkedPoints,
  clearLinkedPoints,
  setLinkedPointsVisible,
  addBookmark,
  getBookmarks,
  applyBookmark,
  // 状态
  modelStats
});

onMounted(() => {
  isDestroying = false;
  mountRenderer();

  onVisibilityChange = () => {
    if (document.hidden) {
      stopLoop();
    } else {
      startLoop();
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  nextTick(() => {
    loadModel();
  });
});

onBeforeUnmount(() => {
  destroy();
});

watch(
  () => [
    props.modelUrl,
    props.modelName,
    JSON.stringify(props.sceneModels || [])
  ],
  () => {
    loadModel();
  }
);

watch(
  () => props.transparent,
  val => {
    setMaterialsTransparent(modelGroup, val);
  }
);

watch(
  () => props.interactionMode,
  val => {
    applyInteractionMode(val);
  }
);

watch(
  () => props.showStats,
  val => {
    noteUserInteraction();
    perfMonitor?.setEnabled(val);
  }
);

watch(
  () => props.enableClipping,
  val => {
    if (val) {
      clippingTool?.patchState?.({ enabled: true });
    } else {
      clippingTool?.patchState?.({ enabled: false });
    }
  }
);

watch(
  () => [props.enableShadows, props.useBasicMaterial],
  () => {
    applyQualitySettings(effectiveQuality.value);
  }
);

watch(
  () => effectiveMaterialTheme.value,
  () => {
    applyQualitySettings(effectiveQuality.value);
  }
);

watch(
  () => effectiveQuality.value,
  val => {
    applyQualitySettings(val);
  }
);

const modelTypeText = computed(() => {
  if (resolvedSceneModels.value.length > 1) return "MULTI";
  const activeModel = resolvedSceneModels.value[0] || {};
  const type = inferModelType({
    url: activeModel.modelUrl || props.modelUrl,
    name: activeModel.modelName || props.modelName
  });
  return type ? type.toUpperCase() : "-";
});
</script>

<template>
  <div class="relative h-full w-full">
    <div ref="rootRef" class="h-full w-full rounded overflow-hidden" />

    <div class="absolute left-3 top-3 flex flex-col gap-2">
      <el-tag effect="light" size="small">格式：{{ modelTypeText }}</el-tag>
      <el-tag v-if="loading" type="primary" effect="light" size="small">
        加载中{{ loadProgress > 0 ? ` ${loadProgress}%` : "..." }}
      </el-tag>
      <el-tag v-else type="success" effect="light" size="small">就绪</el-tag>
      <el-tag
        v-if="modelStats.triangles > 0"
        effect="plain"
        size="small"
        type="info"
      >
        {{ (modelStats.triangles / 1000).toFixed(1) }}K 面
      </el-tag>
      <el-tag v-if="isOrthographic" effect="plain" size="small" type="warning">
        正交
      </el-tag>
    </div>

    <div
      v-if="!hasModelInput"
      class="absolute inset-0 flex items-center justify-center"
    >
      <div class="text-center">
        <div class="text-[48px] mb-2">🏗️</div>
        <div class="font-semibold">请选择/上传模型文件</div>
        <div class="text-xs text-[var(--el-text-color-secondary)] mt-1">
          支持 GLTF / GLB / IFC / OBJ；可旋转/缩放/平移
        </div>
      </div>
    </div>

    <div v-if="errorText" class="absolute left-3 right-3 bottom-3">
      <el-alert :title="errorText" type="error" :closable="false" show-icon />
    </div>
  </div>
</template>
