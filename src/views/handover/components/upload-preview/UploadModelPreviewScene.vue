<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  inferUploadPreviewType,
  loadUploadPreviewModel
} from "./loadUploadPreviewModel";

defineOptions({ name: "UploadModelPreviewScene" });

const props = defineProps({
  modelUrl: { type: String, default: "" },
  modelName: { type: String, default: "" },
  ifcWasmPath: { type: String, default: "/wasm/" }
});

const emit = defineEmits(["loaded", "error", "progress"]);

const rootRef = ref(null);
const loading = ref(false);
const progress = ref(0);
const errorText = ref("");

let renderer;
let scene;
let camera;
let controls;
let resizeObserver;
let mountedObject = null;
let frameId = 0;

const modelTypeText = computed(() => {
  const type = inferUploadPreviewType({
    url: props.modelUrl,
    name: props.modelName
  });
  return type ? type.toUpperCase() : "-";
});

function createRenderer(width, height) {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
}

function createScene(width, height) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f6f8);

  camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 5000);
  camera.position.set(6, 4, 6);

  const ambient = new THREE.AmbientLight(0xffffff, 1.8);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xbfc7d1, 1.2);
  hemi.position.set(0, 20, 0);
  const dirA = new THREE.DirectionalLight(0xffffff, 1.2);
  dirA.position.set(8, 10, 6);
  const dirB = new THREE.DirectionalLight(0xdbeafe, 0.7);
  dirB.position.set(-8, 5, -6);

  const grid = new THREE.GridHelper(10, 10, 0xd1d5db, 0xe5e7eb);
  grid.position.y = -0.001;

  scene.add(ambient, hemi, dirA, dirB, grid);
}

function createControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.1;
  controls.maxDistance = 5000;
}

function animate() {
  frameId = window.requestAnimationFrame(animate);
  controls?.update();
  renderer?.render(scene, camera);
}

function fitToView(object3d) {
  if (!object3d || !camera || !controls) return;

  const box = new THREE.Box3().setFromObject(object3d);
  if (box.isEmpty()) return;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z, 1);
  const fitHeightDistance =
    maxSize / (2 * Math.tan((Math.PI * camera.fov) / 360));
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  const distance = 1.4 * Math.max(fitHeightDistance, fitWidthDistance);

  camera.near = Math.max(distance / 1000, 0.01);
  camera.far = Math.max(distance * 100, 5000);
  camera.updateProjectionMatrix();

  const direction = new THREE.Vector3(1, 0.7, 1).normalize();
  camera.position.copy(center).add(direction.multiplyScalar(distance));
  controls.target.copy(center);
  controls.update();
}

function createBasicMaterial(material) {
  const baseColor = material?.color?.clone?.() || new THREE.Color(0xffffff);

  return new THREE.MeshBasicMaterial({
    color: baseColor,
    map: material?.map || null,
    transparent: Boolean(material?.transparent || material?.opacity < 1),
    opacity: Number.isFinite(material?.opacity) ? material.opacity : 1,
    side: material?.side ?? THREE.FrontSide,
    alphaTest: material?.alphaTest ?? 0,
    vertexColors: Boolean(material?.vertexColors)
  });
}

function replaceWithBasicMaterial(object3d) {
  if (!object3d) return;

  object3d.traverse(child => {
    if (!child?.isMesh || !child.material) return;

    const original = child.material;
    const nextMaterial = Array.isArray(original)
      ? original.map(item => createBasicMaterial(item))
      : createBasicMaterial(original);

    child.material = nextMaterial;
    disposeMaterial(original, { disposeTextures: false });
  });
}

function disposeMaterial(material, options = {}) {
  const { disposeTextures = true } = options;
  if (!material) return;
  const list = Array.isArray(material) ? material : [material];
  list.forEach(item => {
    if (!item) return;
    if (disposeTextures) {
      Object.keys(item).forEach(key => {
        const value = item[key];
        if (value?.isTexture) value.dispose();
      });
    }
    item.dispose?.();
  });
}

function disposeObject(object3d) {
  if (!object3d) return;
  object3d.traverse(child => {
    if (!child) return;
    child.geometry?.dispose?.();
    disposeMaterial(child.material);
  });
}

function clearModel() {
  if (!mountedObject || !scene) return;
  scene.remove(mountedObject);
  disposeObject(mountedObject);
  mountedObject = null;
}

async function loadModel() {
  const url = String(props.modelUrl || "").trim();
  if (!url) {
    clearModel();
    errorText.value = "";
    return;
  }

  loading.value = true;
  progress.value = 0;
  errorText.value = "";
  clearModel();

  try {
    const { object, type } = await loadUploadPreviewModel({
      url,
      name: props.modelName,
      ifcWasmPath: props.ifcWasmPath,
      onProgress: (loaded, total) => {
        const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
        progress.value = percent;
        emit("progress", { loaded, total, percent });
      }
    });

    replaceWithBasicMaterial(object);
    mountedObject = object;
    scene.add(object);
    fitToView(object);
    emit("loaded", { type });
  } catch (error) {
    const msg = error?.message || String(error);
    errorText.value = msg;
    emit("error", error);
  } finally {
    loading.value = false;
  }
}

function captureScreenshot({
  width = 400,
  height = 400,
  format = "image/jpeg",
  quality = 0.9,
  backgroundColor = "#f4f6f8"
} = {}) {
  if (!renderer || !scene || !camera) return "";

  const originalSize = renderer.getSize(new THREE.Vector2());
  const originalAspect = camera.aspect;
  const originalBackground = scene.background;

  const target = new THREE.WebGLRenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
    stencilBuffer: false
  });

  try {
    scene.background = new THREE.Color(backgroundColor);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setRenderTarget(target);
    renderer.setSize(width, height);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);

    const pixels = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(width, height);

    for (let y = 0; y < height; y++) {
      const srcY = height - 1 - y;
      const srcOffset = srcY * width * 4;
      const dstOffset = y * width * 4;
      imageData.data.set(
        pixels.subarray(srcOffset, srcOffset + width * 4),
        dstOffset
      );
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL(format, quality);
  } finally {
    renderer.setRenderTarget(null);
    target.dispose();
    camera.aspect = originalAspect;
    camera.updateProjectionMatrix();
    scene.background = originalBackground;
    renderer.setSize(originalSize.x, originalSize.y);
    renderer.render(scene, camera);
  }
}

function mountScene() {
  if (!rootRef.value) return;
  const rect = rootRef.value.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);

  createRenderer(width, height);
  createScene(width, height);
  createControls();
  rootRef.value.appendChild(renderer.domElement);

  resizeObserver = new ResizeObserver(entries => {
    const entry = entries[0];
    const box = entry?.contentRect;
    if (!box || !renderer || !camera) return;
    const nextWidth = Math.max(1, box.width);
    const nextHeight = Math.max(1, box.height);
    renderer.setSize(nextWidth, nextHeight);
    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(rootRef.value);

  animate();
  loadModel();
}

function destroyScene() {
  if (frameId) {
    window.cancelAnimationFrame(frameId);
    frameId = 0;
  }
  resizeObserver?.disconnect?.();
  resizeObserver = null;
  clearModel();
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

function resetView() {
  fitToView(mountedObject);
}

defineExpose({
  captureScreenshot,
  resetView
});

onMounted(() => {
  mountScene();
});

onBeforeUnmount(() => {
  destroyScene();
});

watch(
  () => [props.modelUrl, props.modelName],
  () => {
    loadModel();
  }
);
</script>

<template>
  <div class="relative h-full w-full">
    <div ref="rootRef" class="h-full w-full rounded overflow-hidden" />

    <div class="absolute left-3 top-3 flex flex-col gap-2 pointer-events-none">
      <el-tag effect="light" size="small">格式：{{ modelTypeText }}</el-tag>
      <el-tag v-if="loading" type="primary" effect="light" size="small">
        加载中{{ progress > 0 ? ` ${progress}%` : "..." }}
      </el-tag>
      <el-tag v-else type="success" effect="light" size="small">就绪</el-tag>
    </div>

    <div
      v-if="!props.modelUrl"
      class="absolute inset-0 flex items-center justify-center"
    >
      <div class="text-center text-sm text-[var(--el-text-color-secondary)]">
        请选择模型文件进行预览
      </div>
    </div>

    <div v-if="errorText" class="absolute left-3 right-3 bottom-3">
      <el-alert :title="errorText" type="error" :closable="false" show-icon />
    </div>
  </div>
</template>
