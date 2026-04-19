import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { IFCLoader } from "web-ifc-three/IFCLoader.js";
import {
  applyModelRequestHeaders,
  getModelRequestHeaders
} from "./requestHeaders";

function getExt(source = "") {
  const clean = String(source || "")
    .toLowerCase()
    .split("?")[0]
    .split("#")[0];
  if (!clean || clean.startsWith("blob:") || clean.startsWith("data:")) {
    return "";
  }
  const dot = clean.lastIndexOf(".");
  if (dot < 0) return "";

  const slash = Math.max(clean.lastIndexOf("/"), clean.lastIndexOf("\\"));
  if (slash > dot) return "";
  return clean.slice(dot + 1);
}

function extOf(url, fallbackName = "") {
  // blob: / data: / object URL 往往没有后缀，需要回退到原始文件名识别格式。
  return getExt(url) || getExt(fallbackName);
}

export function inferModelType({ url, name } = {}) {
  const ext = extOf(url, name);
  if (["gltf", "glb", "ifc", "obj"].includes(ext)) return ext;
  return "";
}

/**
 * 计算模型统计信息
 */
export function computeModelStats(object) {
  let vertices = 0;
  let triangles = 0;
  let meshCount = 0;

  object.traverse(child => {
    if (child.isMesh && child.geometry) {
      meshCount++;
      const geo = child.geometry;
      const posAttr = geo.attributes?.position;
      if (posAttr) {
        vertices += posAttr.count;
      }
      if (geo.index) {
        triangles += geo.index.count / 3;
      } else if (posAttr) {
        triangles += posAttr.count / 3;
      }
    }
  });

  return {
    vertices: Math.floor(vertices),
    triangles: Math.floor(triangles),
    meshCount
  };
}

/**
 * 加载模型到 Group
 * @param {Object} options - 加载选项
 * @param {string} options.url - 模型 URL
 * @param {string} [options.name] - 模型名称
 * @param {string} [options.ifcWasmPath] - IFC WASM 路径
 * @param {string} [options.mtlUrl] - OBJ 材质文件 URL
 * @param {Function} [options.onProgress] - 进度回调 (loaded, total)
 */
export async function loadModelToGroup({
  url,
  name,
  ifcWasmPath = "/wasm/",
  mtlUrl = null,
  onProgress = null
} = {}) {
  if (!url) throw new Error("缺少模型地址");

  const type = inferModelType({ url, name });
  if (!type)
    throw new Error("不支持的模型格式，请选择 .gltf / .glb / .ifc / .obj");

  const progressHandler = onProgress
    ? e => {
        if (e.lengthComputable) {
          onProgress(e.loaded, e.total);
        }
      }
    : undefined;

  // GLTF / GLB
  if (type === "gltf" || type === "glb") {
    const loader = new GLTFLoader();
    const requestHeaders = getModelRequestHeaders(url);
    if (type === "gltf") {
      applyModelRequestHeaders(loader, url);
    }

    // Draco 解码器（用于 draco 压缩的 glb/gltf）
    // decoder 地址基于 BASE_URL，兼容子路径部署
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(`${import.meta.env.BASE_URL || "/"}draco/`);
    dracoLoader.setDecoderConfig({ type: "wasm" });
    loader.setDRACOLoader(dracoLoader);

    const loadOnce = targetUrl =>
      new Promise((resolve, reject) => {
        loader.load(targetUrl, resolve, progressHandler, reject);
      });

    const withCacheBust = targetUrl => {
      const sep = targetUrl.includes("?") ? "&" : "?";
      return `${targetUrl}${sep}_=${Date.now()}`;
    };

    const resourcePath = (() => {
      try {
        return new URL(".", url).href;
      } catch {
        const slashIndex = String(url).lastIndexOf("/");
        return slashIndex >= 0 ? String(url).slice(0, slashIndex + 1) : "";
      }
    })();

    const loadGlbByFetch = async targetUrl => {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: requestHeaders,
        credentials: Object.keys(requestHeaders).length
          ? "same-origin"
          : "same-origin"
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const data = await response.arrayBuffer();
      if (onProgress) {
        const total = Number(response.headers.get("content-length") || 0);
        onProgress(data.byteLength, total || data.byteLength);
      }
      return new Promise((resolve, reject) => {
        loader.parse(data, resourcePath, resolve, reject);
      });
    };

    let gltf;
    try {
      try {
        gltf = type === "glb" ? await loadGlbByFetch(url) : await loadOnce(url);
      } catch (err) {
        const msg = err?.message || String(err);
        // 部分环境下 304 会被 three.js 当作失败
        if (msg.includes("304") || msg.toLowerCase().includes("not modified")) {
          gltf =
            type === "glb"
              ? await loadGlbByFetch(withCacheBust(url))
              : await loadOnce(withCacheBust(url));
        } else {
          throw err;
        }
      }

      const group = new THREE.Group();
      group.add(gltf.scene);
      const stats = computeModelStats(group);
      return { object: group, type, stats };
    } catch (error) {
      throw new Error(
        `模型加载失败（${type.toUpperCase()}）：${url}。${error?.message || error}`,
        { cause: error }
      );
    } finally {
      // 避免 worker 泄漏
      dracoLoader.dispose();
    }
  }

  // OBJ (可选 MTL 材质)
  if (type === "obj") {
    let materials = null;

    // 尝试加载 MTL 材质
    if (mtlUrl) {
      const mtlLoader = new MTLLoader();
      applyModelRequestHeaders(mtlLoader, mtlUrl);
      try {
        materials = await new Promise((resolve, reject) => {
          mtlLoader.load(mtlUrl, resolve, undefined, reject);
        });
        materials.preload();
      } catch {
        console.warn("MTL 材质加载失败，使用默认材质");
      }
    }

    const objLoader = new OBJLoader();
    applyModelRequestHeaders(objLoader, url);
    if (materials) {
      objLoader.setMaterials(materials);
    }

    let obj;
    try {
      obj = await new Promise((resolve, reject) => {
        objLoader.load(url, resolve, progressHandler, reject);
      });
    } catch (error) {
      throw new Error(
        `模型加载失败（OBJ）：${url}。${error?.message || error}`,
        { cause: error }
      );
    }

    const group = new THREE.Group();
    group.add(obj);

    // 如果没有材质，添加默认材质
    if (!materials) {
      group.traverse(child => {
        if (child.isMesh && !child.material) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.7,
            metalness: 0.1
          });
        }
      });
    }

    const stats = computeModelStats(group);
    return { object: group, type, stats };
  }

  // IFC
  if (type === "ifc") {
    const loader = new IFCLoader();
    applyModelRequestHeaders(loader, url);
    loader.ifcManager.setWasmPath(ifcWasmPath);

    let mesh;
    try {
      mesh = await new Promise((resolve, reject) => {
        loader.load(url, resolve, progressHandler, reject);
      });
    } catch (error) {
      throw new Error(
        `模型加载失败（IFC）：${url}。${error?.message || error}`,
        { cause: error }
      );
    }

    const group = new THREE.Group();
    group.add(mesh);
    const stats = computeModelStats(group);
    return { object: group, type, stats };
  }

  throw new Error("不支持的模型格式");
}
