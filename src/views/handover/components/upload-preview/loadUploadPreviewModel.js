import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { IFCLoader } from "web-ifc-three/IFCLoader.js";
import { applyModelRequestHeaders } from "@/3d/loaders/requestHeaders";

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

export function inferUploadPreviewType({ url, name } = {}) {
  const ext = getExt(url) || getExt(name);
  return ["gltf", "glb", "ifc", "obj"].includes(ext) ? ext : "";
}

export async function loadUploadPreviewModel({
  url,
  name,
  ifcWasmPath = "/wasm/",
  onProgress
} = {}) {
  if (!url) throw new Error("缺少模型地址");

  const type = inferUploadPreviewType({ url, name });
  if (!type) {
    throw new Error("不支持的模型格式，请选择 .gltf / .glb / .ifc / .obj");
  }

  const progressHandler = onProgress
    ? e => {
        if (e?.lengthComputable) onProgress(e.loaded, e.total);
      }
    : undefined;

  if (type === "gltf" || type === "glb") {
    const loader = new GLTFLoader();
    applyModelRequestHeaders(loader, url);
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(`${import.meta.env.BASE_URL || "/"}draco/`);
    dracoLoader.setDecoderConfig({ type: "wasm" });
    loader.setDRACOLoader(dracoLoader);

    try {
      const gltf = await new Promise((resolve, reject) => {
        loader.load(url, resolve, progressHandler, reject);
      });
      return {
        object: gltf.scene || gltf.scenes?.[0] || new THREE.Group(),
        type
      };
    } finally {
      dracoLoader.dispose();
    }
  }

  if (type === "obj") {
    const loader = new OBJLoader();
    applyModelRequestHeaders(loader, url);
    const obj = await new Promise((resolve, reject) => {
      loader.load(url, resolve, progressHandler, reject);
    });
    obj.traverse(child => {
      if (child.isMesh && !child.material) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0xcfd8e3,
          roughness: 0.75,
          metalness: 0.08
        });
      }
    });
    return { object: obj, type };
  }

  if (type === "ifc") {
    const loader = new IFCLoader();
    applyModelRequestHeaders(loader, url);
    loader.ifcManager.setWasmPath(ifcWasmPath);
    const mesh = await new Promise((resolve, reject) => {
      loader.load(url, resolve, progressHandler, reject);
    });
    return { object: mesh, type };
  }

  throw new Error("不支持的模型格式");
}
