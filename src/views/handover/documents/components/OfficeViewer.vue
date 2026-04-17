<script setup>
import { ref, watch } from "vue";
import { resolveHandoverDocumentUrl } from "@/utils/handoverDocument";
import { getHandoverDocumentPreviewUrl } from "@/api/handoverDocuments";

defineOptions({ name: "OfficeViewer" });

const props = defineProps({
  url: { type: String, default: "" },
  row: { type: Object, default: () => ({}) }
});

const loading = ref(false);
const iframeUrl = ref("");
const error = ref("");

function buildOfficeOnlineUrl(sourceUrl) {
  const text = String(sourceUrl || "").trim();
  if (!text) return "";
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(text)}`;
}

function isPublicUrl(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const host = parsed.hostname;
    return !["localhost", "127.0.0.1", "0.0.0.0"].includes(host);
  } catch {
    return false;
  }
}

function unwrapApiData(response, fallbackMessage) {
  const ok =
    response?.success === true ||
    response?.code === 200 ||
    response?.code === 0;
  if (!ok) throw new Error(response?.message || fallbackMessage);
  return response?.data;
}

async function tryBackendConversion(docId) {
  try {
    const res = await getHandoverDocumentPreviewUrl(docId, { format: "pdf" });
    const data = unwrapApiData(res, "");
    const url = resolveHandoverDocumentUrl(String(data?.url || "").trim());
    if (url) return url;
  } catch {
    // backend conversion not available, fallback
  }
  return "";
}

async function tryBackendSourceUrl(docId) {
  try {
    const res = await getHandoverDocumentPreviewUrl(docId);
    const data = unwrapApiData(res, "");
    const url = resolveHandoverDocumentUrl(String(data?.url || "").trim());
    if (url) return url;
  } catch {
    // source preview url not available
  }
  return "";
}

async function loadOffice(row) {
  const docId = row?.id;
  if (!docId) {
    error.value = "当前文件缺少文档标识";
    return;
  }
  loading.value = true;
  iframeUrl.value = "";
  error.value = "";
  try {
    // 1. 优先尝试后端转换
    const convertedUrl = await tryBackendConversion(docId);
    if (convertedUrl) {
      // 后端已转换为 PDF，用 PdfViewer 的方式展示
      iframeUrl.value = convertedUrl;
      return;
    }

    // 2. 兜底 Office Online，优先使用后端返回的源文件地址
    const sourceUrl = String(
      (await tryBackendSourceUrl(docId)) || props.url || ""
    ).trim();
    if (!sourceUrl) {
      throw new Error("当前未配置 Office 在线预览地址，请使用后端转换预览");
    }
    if (!isPublicUrl(sourceUrl)) {
      throw new Error(
        "当前地址仅本机可访问，Office 在线预览服务无法读取该文件。请部署后端文档转换服务或提供公网可访问地址。"
      );
    }
    iframeUrl.value = buildOfficeOnlineUrl(sourceUrl);
  } catch (e) {
    error.value = e?.message || "Office 文件在线预览暂不可用";
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.row?.id, props.url],
  () => {
    if (props.row?.id) loadOffice(props.row);
  },
  { immediate: true }
);
</script>

<template>
  <div class="dd-office-viewer">
    <div
      v-if="loading"
      class="dd-office-tip text-[var(--el-text-color-secondary)]"
    >
      正在加载 Office 在线预览...
    </div>
    <div v-else-if="error" class="dd-office-tip text-[var(--el-color-danger)]">
      {{ error }}
    </div>
    <iframe v-else-if="iframeUrl" :src="iframeUrl" class="dd-office-iframe" />
  </div>
</template>

<style scoped>
.dd-office-viewer {
  width: 100%;
}

.dd-office-tip {
  min-height: 640px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
  text-align: center;
}

.dd-office-iframe {
  width: 100%;
  height: 640px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
}
</style>
