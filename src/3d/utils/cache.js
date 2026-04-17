/**
 * 离线缓存管理 - 使用 IndexedDB 缓存模型文件
 */

const DB_NAME = "bim-viewer-cache";
const DB_VERSION = 1;
const STORE_NAME = "models";

class ModelCache {
  constructor() {
    this.db = null;
    this.ready = false;
  }

  /**
   * 初始化数据库
   */
  async init() {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.warn("IndexedDB 打开失败:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.ready = true;
        resolve();
      };

      request.onupgradeneeded = event => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "url" });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("size", "size", { unique: false });
        }
      };
    });
  }

  /**
   * 检查是否有缓存
   */
  async has(url) {
    if (!this.ready) await this.init();
    if (!this.db) return false;

    return new Promise(resolve => {
      const tx = this.db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(url);

      request.onsuccess = () => {
        resolve(!!request.result);
      };

      request.onerror = () => {
        resolve(false);
      };
    });
  }

  /**
   * 获取缓存的模型数据
   */
  async get(url) {
    if (!this.ready) await this.init();
    if (!this.db) return null;

    return new Promise(resolve => {
      const tx = this.db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(url);

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.data) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  }

  /**
   * 存储模型数据
   */
  async set(url, data, metadata = {}) {
    if (!this.ready) await this.init();
    if (!this.db) return false;

    const entry = {
      url,
      data,
      timestamp: Date.now(),
      size: data.byteLength || data.length || 0,
      ...metadata
    };

    return new Promise(resolve => {
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        console.warn("缓存写入失败:", request.error);
        resolve(false);
      };
    });
  }

  /**
   * 删除缓存
   */
  async delete(url) {
    if (!this.ready) await this.init();
    if (!this.db) return false;

    return new Promise(resolve => {
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(url);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        resolve(false);
      };
    });
  }

  /**
   * 清除所有缓存
   */
  async clear() {
    if (!this.ready) await this.init();
    if (!this.db) return false;

    return new Promise(resolve => {
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        resolve(false);
      };
    });
  }

  /**
   * 获取缓存统计信息
   */
  async getStats() {
    if (!this.ready) await this.init();
    if (!this.db) return { count: 0, totalSize: 0, items: [] };

    return new Promise(resolve => {
      const tx = this.db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result || [];
        const totalSize = items.reduce(
          (sum, item) => sum + (item.size || 0),
          0
        );

        resolve({
          count: items.length,
          totalSize,
          items: items.map(i => ({
            url: i.url,
            size: i.size,
            timestamp: i.timestamp
          }))
        });
      };

      request.onerror = () => {
        resolve({ count: 0, totalSize: 0, items: [] });
      };
    });
  }

  /**
   * 根据大小限制清理旧缓存
   */
  async cleanup(maxSizeBytes = 100 * 1024 * 1024) {
    const stats = await this.getStats();

    if (stats.totalSize <= maxSizeBytes) return;

    // 按时间排序，删除最旧的
    const sorted = stats.items.sort((a, b) => a.timestamp - b.timestamp);
    let freed = 0;
    const target = stats.totalSize - maxSizeBytes;

    for (const item of sorted) {
      if (freed >= target) break;
      await this.delete(item.url);
      freed += item.size;
    }
  }
}

// 单例导出
export const modelCache = new ModelCache();

/**
 * 带缓存的模型加载
 */
export async function fetchWithCache(url, options = {}) {
  const { useCache = true, cacheResult = true } = options;

  // 尝试从缓存获取
  if (useCache) {
    try {
      const cached = await modelCache.get(url);
      if (cached) {
        console.log("[Cache] 命中缓存:", url);
        return cached;
      }
    } catch (e) {
      console.warn("[Cache] 读取失败:", e);
    }
  }

  // 从网络获取
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`加载失败: ${response.status}`);
  }

  const data = await response.arrayBuffer();

  // 存入缓存
  if (cacheResult) {
    try {
      await modelCache.set(url, data, {
        contentType: response.headers.get("content-type")
      });
      console.log("[Cache] 已缓存:", url);
    } catch (e) {
      console.warn("[Cache] 写入失败:", e);
    }
  }

  return data;
}

export default modelCache;
