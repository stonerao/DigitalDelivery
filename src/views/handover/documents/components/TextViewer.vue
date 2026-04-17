<script setup>
import { ref, watch } from "vue";

defineOptions({ name: "TextViewer" });

const props = defineProps({
  url: { type: String, default: "" },
  mime: { type: String, default: "" },
  name: { type: String, default: "" }
});

const loading = ref(false);
const content = ref("");
const error = ref("");

async function loadText(url) {
  if (!url) {
    error.value = "当前文件缺少可预览地址";
    return;
  }
  loading.value = true;
  content.value = "";
  error.value = "";
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`文本预览加载失败（${response.status}）`);
    }
    const text = await response.text();
    const isJson =
      String(props.mime || "")
        .toLowerCase()
        .includes("json") ||
      String(props.name || "")
        .toLowerCase()
        .endsWith(".json");
    if (isJson) {
      try {
        content.value = JSON.stringify(JSON.parse(text), null, 2);
        return;
      } catch {
        // keep raw text
      }
    }
    content.value = text;
  } catch (e) {
    error.value = e?.message || "文本预览加载失败";
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.url,
  url => {
    if (url) loadText(url);
  },
  { immediate: true }
);
</script>

<template>
  <div class="dd-text-viewer">
    <div
      v-if="loading"
      class="dd-text-tip text-[var(--el-text-color-secondary)]"
    >
      正在加载文本内容...
    </div>
    <div v-else-if="error" class="dd-text-tip text-[var(--el-color-danger)]">
      {{ error }}
    </div>
    <pre v-else class="dd-text-content">{{ content }}</pre>
  </div>
</template>

<style scoped>
.dd-text-viewer {
  width: 100%;
  min-height: 640px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
}

.dd-text-tip {
  text-align: center;
  padding: 24px;
}

.dd-text-content {
  width: 100%;
  height: 608px;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.6;
  font-family: Consolas, "Courier New", monospace;
}
</style>
