<script setup>
import { computed, ref, watch } from "vue";
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

defineOptions({ name: "FilePreview" });

const props = defineProps({
  row: { type: Object, default: null },
  visible: { type: Boolean, default: false }
});

const emit = defineEmits(["update:visible", "download"]);

const previewUrl = ref("");
let revokeHandle = null;

const previewKind = computed(() => {
  const row = props.row;
  if (!row) return "unknown";
  return getHandoverDocumentPreviewKind({
    ...row,
    url: previewUrl.value || ""
  });
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

async function resolveUrl(row) {
  if (!row) return "";
  try {
    const fileBlob = await unwrapHandoverDocumentFileResponse(
      await downloadHandoverDocumentFile(row.id),
      "获取预览文件失败"
    );
    const { url, revoke } = createHandoverDocumentObjectUrl(fileBlob);
    revokeHandle = revoke;
    return url;
  } catch {
    return "";
  }
}

async function loadPreview() {
  cleanup();
  if (!props.row) return;
  try {
    previewUrl.value = await resolveUrl(props.row);
  } catch {
    previewUrl.value = "";
  }
}

function cleanup() {
  if (revokeHandle) revokeHandle();
  revokeHandle = null;
  previewUrl.value = "";
}

function close() {
  emit("update:visible", false);
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
      cleanup();
    }
  },
  { immediate: true }
);
</script>

<template>
  <el-dialog
    :model-value="props.visible"
    title="在线预览"
    width="980px"
    @update:model-value="v => emit('update:visible', v)"
  >
    <div v-if="props.row" class="text-sm">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div class="min-w-0">
          <div class="font-semibold truncate">{{ props.row.name }}</div>
          <div class="text-xs text-[var(--el-text-color-secondary)] mt-1">
            类型：{{ props.row.type }} | 大小：{{ formatSize(props.row.size) }}
          </div>
        </div>
        <el-button type="primary" @click="onDownload">下载</el-button>
      </div>

      <div v-if="!previewUrl" class="text-[var(--el-text-color-secondary)]">
        当前文档只有元数据（演示）。接入后端存储后可在线预览。
      </div>

      <PdfViewer v-else-if="previewKind === 'pdf'" :url="previewUrl" />

      <ImageViewer v-else-if="previewKind === 'image'" :url="previewUrl" />

      <DocxViewer v-else-if="previewKind === 'docx'" :url="previewUrl" />

      <ExcelViewer
        v-else-if="previewKind === 'excel'"
        :url="previewUrl"
        :name="props.row.name"
      />

      <MarkdownViewer
        v-else-if="previewKind === 'markdown'"
        :url="previewUrl"
      />

      <TextViewer
        v-else-if="previewKind === 'text'"
        :url="previewUrl"
        :mime="props.row.mime"
        :name="props.row.name"
      />

      <MediaViewer
        v-else-if="previewKind === 'audio'"
        :url="previewUrl"
        kind="audio"
      />

      <MediaViewer
        v-else-if="previewKind === 'video'"
        :url="previewUrl"
        kind="video"
      />

      <OfficeViewer
        v-else-if="previewKind === 'office'"
        :url="previewUrl"
        :row="props.row"
      />

      <div v-else class="text-[var(--el-text-color-secondary)]">
        该类型暂未提供在线预览（{{ props.row.type }}）。
      </div>
    </div>
    <template #footer>
      <el-button type="primary" @click="close">关闭</el-button>
    </template>
  </el-dialog>
</template>
