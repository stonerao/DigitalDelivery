<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

// pdfjs-dist 在安装后可用
import * as pdfjsLib from "pdfjs-dist";
import {
  EventBus,
  PDFLinkService,
  PDFViewer,
  PDFFindController
} from "pdfjs-dist/web/pdf_viewer";
import viewerCssText from "pdfjs-dist/web/pdf_viewer.css?raw";
import workerSrcUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

defineOptions({
  name: "PdfViewer"
});

const props = defineProps({
  url: {
    type: String,
    default: ""
  }
});

const emit = defineEmits(["loaded", "error"]);

const containerRef = ref();
const viewerRef = ref();

const loading = ref(false);
const errorText = ref("");

const pageNumber = ref(1);
const pageCount = ref(0);
const scale = ref(1);
const rotation = ref(0);

const findText = ref("");

let pdfDoc = null;
let viewer = null;
let eventBus = null;
let linkService = null;
let findController = null;

const canOperate = computed(() => Boolean(pdfDoc));

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function updateStateFromViewer() {
  if (!viewer) return;
  pageNumber.value = viewer.currentPageNumber || 1;
  pageCount.value = viewer.pagesCount || 0;
}

async function setupWorker() {
  // Vite 下推荐：用 ?url 让资源在构建期可解析
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrcUrl;
}

function ensurePdfViewerCss() {
  const id = "dd-pdfjs-viewer-css";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = viewerCssText;
  document.head.appendChild(style);
}

async function loadPdf(url) {
  if (!url) return;

  loading.value = true;
  errorText.value = "";

  try {
    await setupWorker();

    if (pdfDoc) {
      try {
        await pdfDoc.destroy();
      } catch {
        // ignore
      }
      pdfDoc = null;
    }

    eventBus = new EventBus();
    linkService = new PDFLinkService({ eventBus });
    findController = new PDFFindController({ eventBus, linkService });

    viewer = new PDFViewer({
      container: containerRef.value,
      viewer: viewerRef.value,
      eventBus,
      linkService,
      findController,
      textLayerMode: 2
    });

    linkService.setViewer(viewer);

    eventBus.on("pagesinit", () => {
      viewer.currentScaleValue = "page-width";
      scale.value = viewer.currentScale || 1;
      rotation.value = viewer.pagesRotation || 0;
      updateStateFromViewer();
    });

    eventBus.on("pagechanging", e => {
      pageNumber.value = e.pageNumber;
    });

    const task = pdfjsLib.getDocument({ url });
    pdfDoc = await task.promise;

    viewer.setDocument(pdfDoc);
    linkService.setDocument(pdfDoc, null);

    pageCount.value = pdfDoc.numPages;
    pageNumber.value = 1;

    emit("loaded", { pages: pdfDoc.numPages });
  } catch (e) {
    errorText.value = e?.message || "PDF 加载失败";
    emit("error", e);
  } finally {
    loading.value = false;
  }
}

function zoomIn() {
  if (!viewer) return;
  const next = clamp((viewer.currentScale || 1) + 0.1, 0.2, 4);
  viewer.currentScale = next;
  scale.value = next;
}

function zoomOut() {
  if (!viewer) return;
  const next = clamp((viewer.currentScale || 1) - 0.1, 0.2, 4);
  viewer.currentScale = next;
  scale.value = next;
}

function rotate90() {
  if (!viewer) return;
  const next = ((viewer.pagesRotation || 0) + 90) % 360;
  viewer.pagesRotation = next;
  rotation.value = next;
}

function goToPage(p) {
  if (!viewer) return;
  const next = clamp(Number(p) || 1, 1, viewer.pagesCount || 1);
  viewer.currentPageNumber = next;
  pageNumber.value = next;
}

function findNext() {
  if (!eventBus) return;
  if (!findText.value.trim()) return;
  eventBus.dispatch("find", {
    query: findText.value,
    caseSensitive: false,
    highlightAll: true,
    findPrevious: false
  });
}

function findPrev() {
  if (!eventBus) return;
  if (!findText.value.trim()) return;
  eventBus.dispatch("find", {
    query: findText.value,
    caseSensitive: false,
    highlightAll: true,
    findPrevious: true
  });
}

function printPdf() {
  // 简化实现：新开 blob url 打印（浏览器原生 PDF 打印）
  if (!props.url) return;
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = props.url;
  document.body.appendChild(iframe);

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }
  };
}

// 平移（拖拽滚动容器）
const drag = ref({
  active: false,
  startX: 0,
  startY: 0,
  startLeft: 0,
  startTop: 0
});

function startPan(e) {
  if (!containerRef.value) return;
  drag.value.active = true;
  drag.value.startX = e.clientX;
  drag.value.startY = e.clientY;
  drag.value.startLeft = containerRef.value.scrollLeft;
  drag.value.startTop = containerRef.value.scrollTop;
}

function movePan(e) {
  if (!drag.value.active || !containerRef.value) return;
  const dx = e.clientX - drag.value.startX;
  const dy = e.clientY - drag.value.startY;
  containerRef.value.scrollLeft = drag.value.startLeft - dx;
  containerRef.value.scrollTop = drag.value.startTop - dy;
}

function endPan() {
  drag.value.active = false;
}

watch(
  () => props.url,
  url => {
    if (!url) return;
    loadPdf(url);
  },
  { immediate: true }
);

onMounted(() => {
  ensurePdfViewerCss();
});

onBeforeUnmount(async () => {
  try {
    if (pdfDoc) await pdfDoc.destroy();
  } catch {
    // ignore
  }
  pdfDoc = null;
});

defineExpose({
  zoomIn,
  zoomOut,
  rotate90,
  goToPage,
  findNext,
  findPrev,
  printPdf
});
</script>

<template>
  <div class="dd-pdf">
    <div class="dd-pdf-toolbar">
      <el-space wrap>
        <el-button :disabled="!canOperate" @click="zoomOut">缩小</el-button>
        <el-button :disabled="!canOperate" @click="zoomIn">放大</el-button>
        <el-button :disabled="!canOperate" @click="rotate90">旋转90°</el-button>
        <el-button :disabled="!props.url" @click="printPdf">打印</el-button>
      </el-space>

      <el-space wrap>
        <span class="text-xs text-[var(--el-text-color-secondary)]">
          缩放：{{ Math.round(scale * 100) }}% | 旋转：{{ rotation }}°
        </span>
      </el-space>

      <el-space wrap>
        <el-input
          v-model="findText"
          placeholder="查找文本"
          clearable
          style="width: 220px"
          @keyup.enter="findNext"
        />
        <el-button :disabled="!canOperate" @click="findPrev">上一个</el-button>
        <el-button :disabled="!canOperate" type="primary" @click="findNext">
          下一个
        </el-button>
      </el-space>

      <el-space wrap>
        <span class="text-xs text-[var(--el-text-color-secondary)]">页码</span>
        <el-input-number
          v-model="pageNumber"
          :min="1"
          :max="pageCount || 1"
          :disabled="!canOperate"
          controls-position="right"
          @change="goToPage"
        />
        <span class="text-xs text-[var(--el-text-color-secondary)]">
          / {{ pageCount || 0 }}
        </span>
      </el-space>
    </div>

    <div class="dd-pdf-stage">
      <div
        ref="containerRef"
        v-loading="loading"
        class="dd-pdf-container"
        @mousedown="startPan"
        @mousemove="movePan"
        @mouseup="endPan"
        @mouseleave="endPan"
      >
        <div v-if="errorText" class="dd-pdf-error">{{ errorText }}</div>
        <div v-else ref="viewerRef" class="pdfViewer" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dd-pdf {
  position: relative;
  width: 100%;
}

.dd-pdf-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.dd-pdf-stage {
  position: relative;
  width: 100%;
  height: 640px;
}

.dd-pdf-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  cursor: grab;
  user-select: none;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
}

:deep(.pdfViewer) {
  position: relative;
  min-height: 100%;
}

.dd-pdf-container:active {
  cursor: grabbing;
}

.dd-pdf-error {
  padding: 16px;
  color: var(--el-color-danger);
}
</style>
