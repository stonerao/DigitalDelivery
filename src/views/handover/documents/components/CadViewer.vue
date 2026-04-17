<script setup>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch
} from "vue";
import localWasmUrl from "@cadview/dwg/dist/libredwg.wasm?url";

defineOptions({ name: "CadViewer" });

const props = defineProps({
  url: { type: String, default: "" },
  name: { type: String, default: "" }
});

const canvasRef = ref(null);
const errorText = ref("");
const loading = ref(false);
const releaseName = ref("");
const versionText = ref("");

const viewerRef = shallowRef(null);

let runtimePromise = null;
let loadToken = 0;

const canOperate = computed(() => {
  return Boolean(viewerRef.value) && !loading.value;
});

async function ensureRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const [{ CadViewer }, dwgModule] = await Promise.all([
        import("@cadview/core"),
        import("@cadview/dwg")
      ]);
      await dwgModule.initWasm({ wasmUrl: localWasmUrl });
      return {
        CadViewer,
        ...dwgModule
      };
    })();
  }
  return runtimePromise;
}

async function ensureViewer() {
  if (viewerRef.value) return viewerRef.value;
  if (!canvasRef.value) return null;
  const { CadViewer, dwgConverter } = await ensureRuntime();
  if (viewerRef.value) return viewerRef.value;
  if (!canvasRef.value) return null;

  viewerRef.value = new CadViewer(canvasRef.value, {
    theme: "dark",
    initialTool: "pan",
    formatConverters: [dwgConverter]
  });
  return viewerRef.value;
}

function clearMeta() {
  releaseName.value = "";
  versionText.value = "";
}

function clearViewerDocument() {
  if (viewerRef.value) {
    viewerRef.value.clearDocument();
  }
}

async function loadDocument(url) {
  const currentToken = ++loadToken;
  errorText.value = "";
  clearMeta();

  if (!url) {
    clearViewerDocument();
    return;
  }

  loading.value = true;
  try {
    const response = await fetch(url, {
      credentials: "same-origin"
    });
    if (!response.ok) {
      throw new Error(`DWG 文件加载失败（HTTP ${response.status}）`);
    }
    const buffer = await response.arrayBuffer();
    if (currentToken !== loadToken) return;

    const runtime = await ensureRuntime();
    if (!runtime.isDwg(buffer)) {
      throw new Error("当前文件不是可识别的 DWG 格式");
    }

    versionText.value = runtime.getDwgVersion(buffer) || "";
    releaseName.value = versionText.value
      ? runtime.getDwgReleaseName(versionText.value) || ""
      : "";

    const viewer = await ensureViewer();
    if (!viewer || currentToken !== loadToken) return;
    await viewer.loadBuffer(buffer);
    if (currentToken !== loadToken) return;
    viewer.fitToView();
  } catch (error) {
    if (currentToken !== loadToken) return;
    clearViewerDocument();
    errorText.value = error?.message || "DWG 文件预览失败";
  } finally {
    if (currentToken === loadToken) {
      loading.value = false;
    }
  }
}

function fitToView() {
  if (!canOperate.value) return;
  viewerRef.value.fitToView();
}

function zoomBy(factor) {
  if (!canOperate.value) return;
  const transform = viewerRef.value.getViewTransform();
  viewerRef.value.zoomTo(transform.scale * factor);
}

watch(
  () => props.url,
  url => {
    if (canvasRef.value) {
      loadDocument(url);
    }
  }
);

onMounted(() => {
  if (props.url) {
    loadDocument(props.url);
  }
});

onBeforeUnmount(() => {
  ++loadToken;
  if (viewerRef.value) {
    viewerRef.value.destroy();
    viewerRef.value = null;
  }
});
</script>

<template>
  <div class="dd-cad-viewer">
    <div class="dd-cad-toolbar">
      <div class="dd-cad-title">
        <div class="dd-cad-name">{{ props.name || "DWG 预览" }}</div>
        <div class="dd-cad-meta">
          <span v-if="versionText">版本：{{ versionText }}</span>
          <span v-if="releaseName"> / {{ releaseName }}</span>
        </div>
      </div>
      <div class="dd-cad-actions">
        <el-button :disabled="!canOperate" @click="zoomBy(1.2)">放大</el-button>
        <el-button :disabled="!canOperate" @click="zoomBy(1 / 1.2)">
          缩小
        </el-button>
        <el-button :disabled="!canOperate" @click="fitToView">
          适配视图
        </el-button>
      </div>
    </div>

    <div class="dd-cad-stage">
      <canvas ref="canvasRef" class="dd-cad-canvas" />
      <div
        v-if="loading"
        class="dd-cad-tip text-[var(--el-text-color-secondary)]"
      >
        正在加载 DWG 文件与本地转换模块...
      </div>
      <div
        v-else-if="errorText"
        class="dd-cad-tip text-[var(--el-color-danger)]"
      >
        {{ errorText }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.dd-cad-viewer {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dd-cad-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.dd-cad-title {
  min-width: 0;
}

.dd-cad-name {
  font-size: 14px;
  font-weight: 600;
}

.dd-cad-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.dd-cad-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.dd-cad-tip {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.84);
  text-align: center;
  z-index: 2;
}

.dd-cad-stage {
  position: relative;
  height: 640px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  overflow: hidden;
  background: #0f172a;
}

.dd-cad-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
