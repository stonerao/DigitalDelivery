<script setup>
import { ref, watch } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";

defineOptions({ name: "MarkdownViewer" });

const props = defineProps({
  url: { type: String, default: "" }
});

const loading = ref(false);
const html = ref("");
const error = ref("");

marked.setOptions({
  gfm: true,
  breaks: true
});

function sanitize(rawHtml) {
  if (typeof DOMPurify?.sanitize === "function") {
    return DOMPurify.sanitize(rawHtml);
  }
  return rawHtml;
}

async function loadMarkdown(url) {
  if (!url) {
    error.value = "当前文件缺少可预览地址";
    return;
  }
  loading.value = true;
  html.value = "";
  error.value = "";
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Markdown 加载失败（${response.status}）`);
    }
    const text = await response.text();
    const rawHtml = await marked.parse(text);
    html.value = sanitize(rawHtml);
  } catch (e) {
    error.value = e?.message || "Markdown 预览加载失败";
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.url,
  url => {
    if (url) loadMarkdown(url);
  },
  { immediate: true }
);
</script>

<template>
  <div class="dd-markdown-viewer">
    <div v-if="loading" class="dd-md-tip text-[var(--el-text-color-secondary)]">
      正在加载 Markdown 预览...
    </div>
    <div v-else-if="error" class="dd-md-tip text-[var(--el-color-danger)]">
      {{ error }}
    </div>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-else class="dd-md-content" v-html="html" />
  </div>
</template>

<style scoped>
.dd-markdown-viewer {
  width: 100%;
  min-height: 640px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
  overflow: auto;
}

.dd-md-tip {
  min-height: 640px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
}

.dd-md-content {
  padding: 24px 32px;
  font-size: 14px;
  line-height: 1.8;
  color: var(--el-text-color-primary);
  max-height: 640px;
  overflow: auto;
}

.dd-md-content :deep(h1),
.dd-md-content :deep(h2),
.dd-md-content :deep(h3),
.dd-md-content :deep(h4) {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-weight: 600;
}

.dd-md-content :deep(h1) {
  font-size: 1.6em;
  border-bottom: 1px solid var(--el-border-color);
  padding-bottom: 0.3em;
}

.dd-md-content :deep(h2) {
  font-size: 1.3em;
  border-bottom: 1px solid var(--el-border-color-lighter);
  padding-bottom: 0.3em;
}

.dd-md-content :deep(code) {
  padding: 2px 6px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 0.9em;
  font-family: Consolas, "Courier New", monospace;
}

.dd-md-content :deep(pre) {
  padding: 12px 16px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  overflow-x: auto;
  line-height: 1.5;
}

.dd-md-content :deep(pre code) {
  padding: 0;
  background: none;
}

.dd-md-content :deep(blockquote) {
  margin: 0.5em 0;
  padding: 8px 16px;
  border-left: 4px solid var(--el-color-primary-light-5);
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-secondary);
}

.dd-md-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5em 0;
}

.dd-md-content :deep(th),
.dd-md-content :deep(td) {
  border: 1px solid var(--el-border-color);
  padding: 8px 12px;
  text-align: left;
}

.dd-md-content :deep(th) {
  background: var(--el-fill-color-light);
  font-weight: 600;
}

.dd-md-content :deep(img) {
  max-width: 100%;
  border-radius: 4px;
}

.dd-md-content :deep(a) {
  color: var(--el-color-primary);
}

.dd-md-content :deep(ul),
.dd-md-content :deep(ol) {
  padding-left: 2em;
}

.dd-md-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--el-border-color);
  margin: 1em 0;
}
</style>
