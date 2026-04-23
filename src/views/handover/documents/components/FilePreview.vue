<script setup>
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch
} from "vue";
import { Close, FullScreen, ScaleToOriginal } from "@element-plus/icons-vue";
import {
  createHandoverDocumentObjectUrl,
  getHandoverDocumentPreviewKind,
  unwrapHandoverDocumentFileResponse
} from "@/utils/handoverDocument";
import { downloadHandoverDocumentFile } from "@/api/handoverDocuments";
import PdfViewer from "./PdfViewer.vue";
import DocxViewer from "./DocxViewer.vue";
import ExcelViewer from "./ExcelViewer.vue";
import MarkdownViewer from "./MarkdownViewer.vue";
import OfficeViewer from "./OfficeViewer.vue";
import TextViewer from "./TextViewer.vue";
import ImageViewer from "./ImageViewer.vue";
import MediaViewer from "./MediaViewer.vue";
const CadViewer = defineAsyncComponent(() => import("./CadViewer.vue"));

defineOptions({ name: "FilePreview" });

const props = defineProps({
  row: { type: Object, default: null },
  visible: { type: Boolean, default: false }
});

const emit = defineEmits(["update:visible", "download"]);

const previewUrl = ref("");
const previewBlob = shallowRef(null);
const isFullscreen = ref(false);
let revokeHandle = null;
let loadToken = 0;
let previewAbortController = null;

const previewKind = computed(() => {
  const row = props.row;
  if (!row) return "unknown";
  return getHandoverDocumentPreviewKind({
    ...row,
    url: previewUrl.value || ""
  });
});

const previewBodyClass = computed(() => {
  return isFullscreen.value
    ? "dd-file-preview-body dd-file-preview-body--fullscreen"
    : "dd-file-preview-body";
});

const previewFooterClass = computed(() => {
  return isFullscreen.value
    ? "dd-file-preview-footer dd-file-preview-footer--fullscreen"
    : "dd-file-preview-footer";
});

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx++;
  }
  const fixed = idx === 0 ? 0 : value < 10 ? 2 : 1;
  return `${value.toFixed(fixed)} ${units[idx]}`;
}

function isAbortError(error) {
  return (
    error?.name === "AbortError" ||
    error?.name === "CanceledError" ||
    error?.code === "ERR_CANCELED" ||
    error?.isCancelRequest
  );
}

async function resolveUrl(row, signal) {
  const fileBlob = await unwrapHandoverDocumentFileResponse(
    await downloadHandoverDocumentFile(row.id, { signal }),
    "获取预览文件失败"
  );
  return {
    ...createHandoverDocumentObjectUrl(fileBlob),
    blob: fileBlob
  };
}

async function loadPreview() {
  cleanup();
  const currentToken = ++loadToken;
  const currentRowId = props.row?.id;
  if (!props.row) return;

  const controller = new AbortController();
  previewAbortController = controller;
  try {
    const preview = await resolveUrl(props.row, controller.signal);
    if (
      currentToken !== loadToken ||
      controller.signal.aborted ||
      !props.visible ||
      props.row?.id !== currentRowId
    ) {
      preview.revoke();
      return;
    }

    revokeHandle = preview.revoke;
    previewBlob.value = preview.blob;
    previewUrl.value = preview.url;
  } catch (error) {
    if (isAbortError(error)) return;
    if (currentToken === loadToken && !controller.signal.aborted) {
      previewUrl.value = "";
    }
  } finally {
    if (previewAbortController === controller) {
      previewAbortController = null;
    }
  }
}

function cleanup() {
  loadToken += 1;
  if (previewAbortController) {
    previewAbortController.abort();
    previewAbortController = null;
  }
  if (revokeHandle) revokeHandle();
  revokeHandle = null;
  previewBlob.value = null;
  previewUrl.value = "";
}

function close() {
  emit("update:visible", false);
}

function notifyPreviewResize() {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
  nextTick(notifyPreviewResize);
}

function onDownload() {
  if (props.row) emit("download", props.row);
}

watch(
  () => [props.visible, props.row?.id],
  ([visible]) => {
    if (visible && props.row) {
      loadPreview();
    } else if (!visible) {
      isFullscreen.value = false;
      cleanup();
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  cleanup();
});
</script>

<template>
  <el-dialog
    :model-value="props.visible"
    class="dd-file-preview-dialog"
    width="min(1180px, 92vw)"
    :fullscreen="isFullscreen"
    :show-close="false"
    header-class="dd-file-preview-header"
    :body-class="previewBodyClass"
    :footer-class="previewFooterClass"
    destroy-on-close
    @update:model-value="v => emit('update:visible', v)"
  >
    <template #header>
      <div class="dd-file-preview-headerbar">
        <div class="dd-file-preview-title">在线预览</div>
        <div class="dd-file-preview-header-actions">
          <el-tooltip
            :content="isFullscreen ? '退出全屏' : '全屏'"
            placement="bottom"
          >
            <el-button
              text
              circle
              :aria-label="isFullscreen ? '退出全屏' : '全屏'"
              @click.stop="toggleFullscreen"
            >
              <el-icon>
                <ScaleToOriginal v-if="isFullscreen" />
                <FullScreen v-else />
              </el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip content="关闭" placement="bottom">
            <el-button text circle aria-label="关闭" @click.stop="close">
              <el-icon><Close /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>
    </template>

    <div
      v-if="props.row"
      class="dd-file-preview text-sm"
      :class="{ 'dd-file-preview--fullscreen': isFullscreen }"
    >
      <div class="dd-file-preview-meta">
        <div class="min-w-0">
          <div class="font-semibold truncate">{{ props.row.name }}</div>
          <div class="text-xs text-[var(--el-text-color-secondary)] mt-1">
            类型：{{ props.row.type }} | 大小：{{ formatSize(props.row.size) }}
          </div>
        </div>
        <el-button type="primary" @click="onDownload">下载</el-button>
      </div>

      <div class="dd-file-preview-content">
        <div
          v-if="!previewUrl"
          class="dd-file-preview-empty text-[var(--el-text-color-secondary)]"
        >
          当前文档只有元数据（演示）。接入后端存储后可在线预览。
        </div>

        <PdfViewer
          v-else-if="previewKind === 'pdf'"
          :url="previewUrl"
          class="dd-file-preview-renderer"
        />

        <ImageViewer
          v-else-if="previewKind === 'image'"
          :url="previewUrl"
          class="dd-file-preview-renderer"
        />

        <DocxViewer
          v-else-if="previewKind === 'docx'"
          :url="previewUrl"
          class="dd-file-preview-renderer"
        />

        <ExcelViewer
          v-else-if="previewKind === 'excel'"
          :url="previewUrl"
          :name="props.row.name"
          class="dd-file-preview-renderer"
        />

        <MarkdownViewer
          v-else-if="previewKind === 'markdown'"
          :url="previewUrl"
          class="dd-file-preview-renderer"
        />

        <TextViewer
          v-else-if="previewKind === 'text'"
          :url="previewUrl"
          :mime="props.row.mime"
          :name="props.row.name"
          class="dd-file-preview-renderer"
        />

        <MediaViewer
          v-else-if="previewKind === 'audio'"
          :url="previewUrl"
          kind="audio"
          class="dd-file-preview-renderer"
        />

        <MediaViewer
          v-else-if="previewKind === 'video'"
          :url="previewUrl"
          kind="video"
          class="dd-file-preview-renderer"
        />

        <CadViewer
          v-else-if="previewKind === 'cad'"
          :url="previewUrl"
          :blob="previewBlob"
          :name="props.row.name"
          class="dd-file-preview-renderer"
        />

        <OfficeViewer
          v-else-if="previewKind === 'office'"
          :url="previewUrl"
          :row="props.row"
          class="dd-file-preview-renderer"
        />

        <div
          v-else
          class="dd-file-preview-empty text-[var(--el-text-color-secondary)]"
        >
          该类型暂未提供在线预览（{{ props.row.type }}）。
        </div>
      </div>
    </div>
    <template #footer>
      <el-button type="primary" @click="close">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.dd-file-preview-headerbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.dd-file-preview-title {
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.dd-file-preview-header-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 4px;
  align-items: center;
  padding-right: 2px;
}

.dd-file-preview {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 0;
}

.dd-file-preview--fullscreen {
  height: 100%;
}

.dd-file-preview-meta {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.dd-file-preview-content {
  min-height: 0;
}

.dd-file-preview--fullscreen .dd-file-preview-content {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
}

.dd-file-preview-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  padding: 24px;
  text-align: center;
}

.dd-file-preview--fullscreen .dd-file-preview-empty,
.dd-file-preview--fullscreen .dd-file-preview-renderer {
  flex: 1 1 auto;
  min-height: 0;
}

.dd-file-preview--fullscreen .dd-file-preview-renderer {
  display: flex;
  flex-direction: column;
}

:global(.dd-file-preview-dialog.is-fullscreen) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:global(.dd-file-preview-header) {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin-right: 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

:global(.dd-file-preview-body) {
  overflow: auto;
}

:global(.dd-file-preview-body--fullscreen) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  padding: 12px 16px;
  overflow: hidden;
}

:global(.dd-file-preview-footer--fullscreen) {
  flex: 0 0 auto;
  padding: 8px 16px 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.dd-file-preview--fullscreen :deep(.dd-cad-viewer),
.dd-file-preview--fullscreen :deep(.dd-pdf),
.dd-file-preview--fullscreen :deep(.dd-excel-viewer),
.dd-file-preview--fullscreen :deep(.dd-office-viewer),
.dd-file-preview--fullscreen :deep(.dd-docx-viewer),
.dd-file-preview--fullscreen :deep(.dd-markdown-viewer),
.dd-file-preview--fullscreen :deep(.dd-text-viewer),
.dd-file-preview--fullscreen :deep(.dd-media-viewer) {
  flex: 1 1 auto;
  min-height: 0;
}

.dd-file-preview--fullscreen :deep(.dd-cad-stage),
.dd-file-preview--fullscreen :deep(.dd-pdf-stage),
.dd-file-preview--fullscreen :deep(.dd-image-viewer),
.dd-file-preview--fullscreen :deep(.dd-office-iframe),
.dd-file-preview--fullscreen :deep(.dd-office-tip),
.dd-file-preview--fullscreen :deep(.dd-docx-tip),
.dd-file-preview--fullscreen :deep(.dd-docx-container),
.dd-file-preview--fullscreen :deep(.dd-md-tip),
.dd-file-preview--fullscreen :deep(.dd-md-content),
.dd-file-preview--fullscreen :deep(.dd-text-content),
.dd-file-preview--fullscreen :deep(.dd-media-player),
.dd-file-preview--fullscreen :deep(.dd-excel-table-wrap),
.dd-file-preview--fullscreen :deep(.dd-excel-tip) {
  flex: 1 1 auto;
  height: auto;
  min-height: 0;
  max-height: none;
}

.dd-file-preview--fullscreen :deep(.dd-image-viewer),
.dd-file-preview--fullscreen :deep(.dd-office-iframe),
.dd-file-preview--fullscreen :deep(.dd-office-tip),
.dd-file-preview--fullscreen :deep(.dd-docx-viewer),
.dd-file-preview--fullscreen :deep(.dd-markdown-viewer),
.dd-file-preview--fullscreen :deep(.dd-text-viewer),
.dd-file-preview--fullscreen :deep(.dd-media-viewer),
.dd-file-preview--fullscreen :deep(.dd-excel-tip) {
  height: 100%;
}

.dd-file-preview--fullscreen :deep(.dd-excel-content) {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}
</style>
