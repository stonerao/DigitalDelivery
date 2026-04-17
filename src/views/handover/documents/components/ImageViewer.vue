<script setup>
import { ref } from "vue";

defineOptions({ name: "ImageViewer" });

const props = defineProps({
  url: { type: String, default: "" }
});

const zoom = ref(1);
const rotate = ref(0);
const drag = ref({ dragging: false, x: 0, y: 0, startX: 0, startY: 0 });

function zoomIn() {
  zoom.value = Math.min(4, zoom.value + 0.1);
}

function zoomOut() {
  zoom.value = Math.max(0.2, zoom.value - 0.1);
}

function rotate90() {
  rotate.value = (rotate.value + 90) % 360;
}

function reset() {
  zoom.value = 1;
  rotate.value = 0;
  drag.value = { dragging: false, x: 0, y: 0, startX: 0, startY: 0 };
}

function startDrag(e) {
  drag.value.dragging = true;
  drag.value.startX = e.clientX;
  drag.value.startY = e.clientY;
}

function onDragMove(e) {
  if (!drag.value.dragging) return;
  drag.value.x += e.clientX - drag.value.startX;
  drag.value.y += e.clientY - drag.value.startY;
  drag.value.startX = e.clientX;
  drag.value.startY = e.clientY;
}

function endDrag() {
  drag.value.dragging = false;
}

defineExpose({ zoomIn, zoomOut, rotate90, reset });
</script>

<template>
  <div>
    <div class="dd-image-toolbar">
      <el-space wrap>
        <el-button @click="zoomOut">缩小</el-button>
        <el-button @click="zoomIn">放大</el-button>
        <el-button @click="rotate90">旋转90°</el-button>
        <el-button @click="reset">复位</el-button>
      </el-space>
    </div>
    <div
      class="dd-image-viewer"
      @mousedown="startDrag"
      @mousemove="onDragMove"
      @mouseup="endDrag"
      @mouseleave="endDrag"
    >
      <img
        v-if="props.url"
        :src="props.url"
        alt="image"
        class="dd-image"
        :style="{
          transform: `translate(${drag.x}px, ${drag.y}px) scale(${zoom}) rotate(${rotate}deg)`
        }"
      />
      <div v-else class="dd-empty-tip">当前文档缺少可预览地址</div>
    </div>
  </div>
</template>

<style scoped>
.dd-image-toolbar {
  margin-bottom: 8px;
}

.dd-image-viewer {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 640px;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
}

.dd-image-viewer:active {
  cursor: grabbing;
}

.dd-image {
  max-width: none;
  max-height: none;
  will-change: transform;
}

.dd-empty-tip {
  color: var(--el-text-color-secondary);
}
</style>
