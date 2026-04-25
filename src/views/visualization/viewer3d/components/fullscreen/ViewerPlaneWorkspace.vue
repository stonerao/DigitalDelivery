<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from "vue";
import { Camera, Refresh, ZoomIn, ZoomOut } from "@element-plus/icons-vue";

defineOptions({
  name: "ViewerPlaneWorkspace"
});

const props = defineProps({
  snapshot: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  },
  anchors: {
    type: Array,
    default: () => []
  },
  cameraAnchors: {
    type: Array,
    default: () => []
  },
  anchorMarkersVisible: {
    type: Boolean,
    default: true
  },
  cameraMarkersVisible: {
    type: Boolean,
    default: true
  },
  selectedAnchorId: {
    type: String,
    default: ""
  },
  selectedCameraId: {
    type: String,
    default: ""
  },
  objectPositionMap: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits([
  "canvas-contextmenu",
  "scene-anchor-click",
  "refresh-snapshot"
]);

const stageRef = ref(null);
const fitState = ref({ x: 0, y: 0, scale: 1 });
const pan = ref({ x: 0, y: 0 });
const zoom = ref(1);
const dragging = ref(null);
let resizeObserver = null;

const hasSnapshot = computed(() => Boolean(props.snapshot?.imageUrl));
const viewBounds = computed(() => props.snapshot?.viewBounds || null);
function getPositiveNumber(value, fallback = 1) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? numberValue
    : fallback;
}
const imageWidth = computed(() => getPositiveNumber(props.snapshot?.width));
const imageHeight = computed(() => getPositiveNumber(props.snapshot?.height));
const contentScale = computed(() => fitState.value.scale * zoom.value);
const contentStyle = computed(() => ({
  width: `${imageWidth.value}px`,
  height: `${imageHeight.value}px`,
  transform: `translate(${fitState.value.x + pan.value.x}px, ${
    fitState.value.y + pan.value.y
  }px) scale(${contentScale.value})`
}));

function getVectorArray(value) {
  if (Array.isArray(value) && value.length >= 3) {
    const next = value.slice(0, 3).map(Number);
    return next.every(Number.isFinite) ? next : null;
  }
  if (value && typeof value.toArray === "function") {
    return getVectorArray(value.toArray());
  }
  return null;
}

function resolveAnchorPosition(anchor) {
  if (!anchor) return null;
  if (anchor.objectUuid) {
    const mapped = getVectorArray(props.objectPositionMap?.[anchor.objectUuid]);
    if (mapped) return mapped;
  }
  return getVectorArray(anchor.worldPosition);
}

function worldToPlane(position) {
  const bounds = viewBounds.value;
  const vector = getVectorArray(position);
  if (!bounds || !vector) return null;

  const width = Number(bounds.maxX) - Number(bounds.minX);
  const depth = Number(bounds.maxZ) - Number(bounds.minZ);
  if (!Number.isFinite(width) || !Number.isFinite(depth) || !width || !depth) {
    return null;
  }

  const x = ((vector[0] - Number(bounds.minX)) / width) * 100;
  const y = ((vector[2] - Number(bounds.minZ)) / depth) * 100;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    left: `${x}%`,
    top: `${y}%`
  };
}

function getMarkerLabel(anchor, isCamera = false) {
  if (!anchor) return isCamera ? "摄像头" : "点位";
  return (
    anchor.cameraName ||
    anchor.name ||
    anchor.code ||
    (isCamera ? "摄像头" : "点位")
  );
}

function buildPlaneItems(items = [], isCamera = false) {
  return items
    .map(item => ({
      item,
      isCamera,
      label: getMarkerLabel(item, isCamera),
      iconUrl: item?.style?.iconUrl || "",
      showLabel: isCamera ? item?.style?.showLabel === true : true,
      style: worldToPlane(resolveAnchorPosition(item))
    }))
    .filter(entry => Boolean(entry.style));
}

const planeAnchors = computed(() =>
  props.anchorMarkersVisible ? buildPlaneItems(props.anchors, false) : []
);
const planeCameraAnchors = computed(() =>
  props.cameraMarkersVisible ? buildPlaneItems(props.cameraAnchors, true) : []
);

function updateFit() {
  const stage = stageRef.value;
  if (!stage || !hasSnapshot.value) return;
  const rect = stage.getBoundingClientRect();
  const scale = Math.min(
    rect.width / imageWidth.value,
    rect.height / imageHeight.value
  );
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  fitState.value = {
    x: (rect.width - imageWidth.value * safeScale) / 2,
    y: (rect.height - imageHeight.value * safeScale) / 2,
    scale: safeScale
  };
}

function resetView() {
  pan.value = { x: 0, y: 0 };
  zoom.value = 1;
  nextTick(updateFit);
}

function zoomBy(factor, event = null) {
  if (!hasSnapshot.value) return;
  const stage = stageRef.value;
  const rect = stage?.getBoundingClientRect?.();
  if (!rect) return;

  const currentZoom = zoom.value;
  const nextZoom = Math.min(6, Math.max(0.6, currentZoom * factor));
  if (nextZoom === currentZoom) return;

  const originX = event ? event.clientX - rect.left : rect.width / 2;
  const originY = event ? event.clientY - rect.top : rect.height / 2;
  const imageX =
    (originX - fitState.value.x - pan.value.x) /
    (fitState.value.scale * currentZoom);
  const imageY =
    (originY - fitState.value.y - pan.value.y) /
    (fitState.value.scale * currentZoom);

  zoom.value = nextZoom;
  pan.value = {
    x: originX - fitState.value.x - imageX * fitState.value.scale * nextZoom,
    y: originY - fitState.value.y - imageY * fitState.value.scale * nextZoom
  };
}

function clientToWorld(event) {
  const bounds = viewBounds.value;
  const stage = stageRef.value;
  const rect = stage?.getBoundingClientRect?.();
  if (!bounds || !rect || !hasSnapshot.value) return null;

  const localX =
    (event.clientX - rect.left - fitState.value.x - pan.value.x) /
    contentScale.value;
  const localY =
    (event.clientY - rect.top - fitState.value.y - pan.value.y) /
    contentScale.value;
  const ratioX = Math.min(1, Math.max(0, localX / imageWidth.value));
  const ratioY = Math.min(1, Math.max(0, localY / imageHeight.value));
  const width = Number(bounds.maxX) - Number(bounds.minX);
  const depth = Number(bounds.maxZ) - Number(bounds.minZ);

  return [
    Number(bounds.minX) + width * ratioX,
    Number(bounds.y) || 0,
    Number(bounds.minZ) + depth * ratioY
  ];
}

function handleContextMenu(event) {
  event.preventDefault();
  event.stopPropagation();
  const hitPoint = clientToWorld(event);
  emit("canvas-contextmenu", {
    clientX: event.clientX,
    clientY: event.clientY,
    objectInfo: null,
    hitPoint
  });
}

function handleWheel(event) {
  event.preventDefault();
  zoomBy(event.deltaY > 0 ? 0.9 : 1.1, event);
}

function handlePointerDown(event) {
  if (event.button !== 0) return;
  if (event.target?.closest?.(".dd-plane-marker")) return;
  dragging.value = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    panX: pan.value.x,
    panY: pan.value.y
  };
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function handlePointerMove(event) {
  const drag = dragging.value;
  if (!drag || drag.pointerId !== event.pointerId) return;
  pan.value = {
    x: drag.panX + event.clientX - drag.startX,
    y: drag.panY + event.clientY - drag.startY
  };
}

function handlePointerUp(event) {
  if (dragging.value?.pointerId === event.pointerId) {
    dragging.value = null;
  }
  event.currentTarget.releasePointerCapture?.(event.pointerId);
}

function handleMarkerClick(entry) {
  emit("scene-anchor-click", entry.item);
}

onMounted(() => {
  nextTick(updateFit);
  if (stageRef.value) {
    resizeObserver = new ResizeObserver(() => updateFit());
    resizeObserver.observe(stageRef.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect?.();
  resizeObserver = null;
});

watch(
  () => props.snapshot,
  () => resetView()
);
</script>

<template>
  <div
    ref="stageRef"
    class="dd-plane-workspace"
    @contextmenu="handleContextMenu"
    @wheel="handleWheel"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerUp"
  >
    <div v-if="hasSnapshot" class="dd-plane-content" :style="contentStyle">
      <img
        class="dd-plane-image"
        :src="snapshot.imageUrl"
        alt=""
        draggable="false"
      />

      <button
        v-for="entry in planeAnchors"
        :key="entry.item.id"
        type="button"
        class="dd-plane-marker dd-plane-marker--point"
        :class="{ 'is-active': entry.item.id === selectedAnchorId }"
        :style="entry.style"
        @click.stop="handleMarkerClick(entry)"
        @contextmenu.stop.prevent
      >
        <span
          class="dd-plane-marker__dot"
          :class="{ 'has-icon': entry.iconUrl }"
        >
          <img v-if="entry.iconUrl" :src="entry.iconUrl" :alt="entry.label" />
        </span>
        <span v-if="entry.showLabel" class="dd-plane-marker__label">
          {{ entry.label }}
        </span>
      </button>

      <button
        v-for="entry in planeCameraAnchors"
        :key="entry.item.id"
        type="button"
        class="dd-plane-marker dd-plane-marker--camera"
        :class="{ 'is-active': entry.item.id === selectedCameraId }"
        :style="entry.style"
        @click.stop="handleMarkerClick(entry)"
        @contextmenu.stop.prevent
      >
        <span class="dd-plane-marker__camera">
          <img v-if="entry.iconUrl" :src="entry.iconUrl" :alt="entry.label" />
          <Camera v-else />
        </span>
        <span v-if="entry.showLabel" class="dd-plane-marker__label">
          {{ entry.label }}
        </span>
      </button>
    </div>

    <div v-if="loading || !hasSnapshot" class="dd-plane-state">
      <div class="dd-plane-state__title">
        {{ loading ? "正在生成平面底图" : "暂无平面底图" }}
      </div>
      <el-button
        v-if="!loading"
        size="small"
        :icon="Refresh"
        @click="emit('refresh-snapshot')"
      >
        重新生成
      </el-button>
    </div>

    <div class="dd-plane-controls">
      <el-tooltip content="放大" placement="left">
        <button type="button" class="dd-plane-control" @click="zoomBy(1.12)">
          <el-icon><ZoomIn /></el-icon>
        </button>
      </el-tooltip>
      <el-tooltip content="缩小" placement="left">
        <button type="button" class="dd-plane-control" @click="zoomBy(0.88)">
          <el-icon><ZoomOut /></el-icon>
        </button>
      </el-tooltip>
      <el-tooltip content="重置" placement="left">
        <button type="button" class="dd-plane-control" @click="resetView">
          <el-icon><Refresh /></el-icon>
        </button>
      </el-tooltip>
    </div>
  </div>
</template>

<style scoped>
.dd-plane-workspace {
  position: absolute;
  inset: 0;
  z-index: 1050;
  overflow: hidden;
  touch-action: none;
  background: #eef2f6;
}

.dd-plane-content {
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;
  transform-origin: 0 0;
  will-change: transform;
}

.dd-plane-image {
  display: block;
  width: 100%;
  height: 100%;
  user-select: none;
}

.dd-plane-marker {
  position: absolute;
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  padding: 4px;
  overflow: hidden;
  font-size: 10px;
  line-height: 1.15;
  color: #fff;
  text-align: center;
  white-space: normal;
  cursor: pointer;
  background: rgba(15, 23, 42, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.34);
  border-radius: 4px;
  box-shadow: 0 8px 20px rgb(15 23 42 / 18%);
  transform: translate(-50%, -50%);
}

.dd-plane-marker:hover,
.dd-plane-marker.is-active {
  background: var(--el-color-primary);
}

.dd-plane-marker__dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 10px;
  height: 10px;
  overflow: hidden;
  background: #22c55e;
  border: 2px solid #fff;
  border-radius: 999px;
}

.dd-plane-marker__dot img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.dd-plane-marker__dot.has-icon {
  width: 22px;
  height: 22px;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.dd-plane-marker__camera {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: #fff;
}

.dd-plane-marker__camera img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.dd-plane-marker__label {
  display: -webkit-box;
  max-width: 42px;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.dd-plane-marker--camera {
  width: 60px;
  background: rgba(15, 118, 110, 0.9);
}

.dd-plane-state {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  gap: 12px;
  justify-items: center;
  padding: 18px 22px;
  color: var(--el-text-color-regular);
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  box-shadow: var(--el-box-shadow-light);
  transform: translate(-50%, -50%);
}

.dd-plane-state__title {
  font-size: 14px;
}

.dd-plane-controls {
  position: absolute;
  right: 12px;
  bottom: 132px;
  z-index: 1;
  display: grid;
  gap: 6px;
}

.dd-plane-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  box-shadow: var(--el-box-shadow-light);
}

.dd-plane-control:hover {
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
}
</style>
