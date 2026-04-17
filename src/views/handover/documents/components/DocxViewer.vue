<script setup>
import { nextTick, ref, watch } from "vue";
import { renderAsync as renderDocxAsync } from "docx-preview";

defineOptions({ name: "DocxViewer" });

const props = defineProps({
  url: { type: String, default: "" }
});

const loading = ref(false);
const error = ref("");
const containerRef = ref(null);

async function loadDocx(url) {
  if (!url) {
    error.value = "当前文件缺少可预览地址";
    return;
  }
  loading.value = true;
  error.value = "";
  await nextTick();
  const container = containerRef.value;
  if (!container) {
    loading.value = false;
    error.value = "Docx 预览容器初始化失败";
    return;
  }
  container.innerHTML = "";
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Docx 预览加载失败（${response.status}）`);
    }
    const buffer = await response.arrayBuffer();
    await renderDocxAsync(buffer, container, undefined, {
      className: "dd-docx-render",
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      experimental: false
    });
  } catch (e) {
    if (container) container.innerHTML = "";
    error.value = e?.message || "Docx 预览加载失败";
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.url,
  url => {
    if (url) loadDocx(url);
  },
  { immediate: true }
);
</script>

<template>
  <div class="dd-docx-viewer">
    <div
      v-if="loading"
      class="dd-docx-tip text-[var(--el-text-color-secondary)]"
    >
      正在加载 Word 预览...
    </div>
    <div
      v-if="!loading && error"
      class="dd-docx-tip text-[var(--el-color-danger)]"
    >
      {{ error }}
    </div>
    <div
      ref="containerRef"
      v-show="!loading && !error"
      class="dd-docx-container"
    />
  </div>
</template>

<style scoped>
.dd-docx-viewer {
  width: 100%;
  min-height: 640px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: #f5f7fa;
  overflow: auto;
}

.dd-docx-tip {
  min-height: 640px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
}

.dd-docx-container {
  min-height: 640px;
  padding: 24px;
}

:deep(.dd-docx-render-wrapper) {
  display: flex;
  justify-content: center;
}

:deep(.dd-docx-render) {
  color: var(--el-text-color-primary);
}
</style>
