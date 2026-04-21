<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import {
  createHandoverDocumentObjectUrl,
  unwrapHandoverDocumentFileResponse
} from "@/utils/handoverDocument";
import { downloadHandoverDocumentFile } from "@/api/handoverDocuments";
import CadViewer from "./components/CadViewer.vue";

defineOptions({ name: "DwgPreviewPoc" });

const activeUrl = ref("");
const activeName = ref("");
const documentId = ref("");
const remoteUrl = ref("");
const sourceLabel = ref("未加载");
const loading = ref(false);
const errorText = ref("");

let revokeHandle = null;

const hasPreview = computed(() => Boolean(activeUrl.value));

function cleanupObjectUrl() {
  if (revokeHandle) revokeHandle();
  revokeHandle = null;
}

function setPreviewSource(url, name, source) {
  activeUrl.value = url;
  activeName.value = name;
  sourceLabel.value = source;
  errorText.value = "";
}

function setPreviewBlob(blob, name, source) {
  cleanupObjectUrl();
  const { url, revoke } = createHandoverDocumentObjectUrl(blob);
  revokeHandle = revoke;
  setPreviewSource(url, name, source);
}

async function onSelectLocalFile(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  setPreviewBlob(file, file.name, "本地文件");
  event.target.value = "";
}

async function loadByDocumentId() {
  const id = String(documentId.value || "").trim();
  if (!id) {
    errorText.value = "请输入文档 ID";
    return;
  }
  loading.value = true;
  errorText.value = "";
  try {
    const blob = await unwrapHandoverDocumentFileResponse(
      await downloadHandoverDocumentFile(id),
      "下载 DWG 文件失败"
    );
    setPreviewBlob(blob, `document_${id}.dwg`, `文档 ID：${id}`);
  } catch (error) {
    errorText.value = error?.message || "加载文档 ID 失败";
  } finally {
    loading.value = false;
  }
}

async function loadByRemoteUrl() {
  const url = String(remoteUrl.value || "").trim();
  if (!url) {
    errorText.value = "请输入可访问的 DWG 地址";
    return;
  }
  loading.value = true;
  errorText.value = "";
  try {
    const response = await fetch(url, {
      credentials: "same-origin"
    });
    if (!response.ok) {
      throw new Error(`请求失败（HTTP ${response.status}）`);
    }
    const blob = await response.blob();
    const fileName =
      url.split("?")[0].split("#")[0].split("/").pop() || "remote.dwg";
    setPreviewBlob(blob, fileName, `远程地址：${url}`);
  } catch (error) {
    errorText.value = error?.message || "加载远程地址失败";
  } finally {
    loading.value = false;
  }
}

function clearPreview() {
  cleanupObjectUrl();
  activeUrl.value = "";
  activeName.value = "";
  sourceLabel.value = "未加载";
  errorText.value = "";
}

onBeforeUnmount(() => {
  cleanupObjectUrl();
});
</script>

<template>
  <div class="dd-dwg-poc page-container">
    <el-card shadow="never">
      <template #header>
        <div class="font-semibold">DWG 浏览器预览 PoC</div>
      </template>

      <div class="dd-dwg-poc__content">
        <el-alert
          type="warning"
          :closable="false"
          title="当前 PoC 使用 mlightcad/cad-viewer WebGL 预览组件。"
        />

        <div class="dd-dwg-poc__panel">
          <div class="dd-dwg-poc__section">
            <div class="dd-dwg-poc__label">方式 1：选择本地 DWG 文件</div>
            <input accept=".dwg" type="file" @change="onSelectLocalFile" />
          </div>

          <div class="dd-dwg-poc__section">
            <div class="dd-dwg-poc__label">方式 2：按文档 ID 下载并预览</div>
            <div class="dd-dwg-poc__row">
              <el-input
                v-model="documentId"
                placeholder="请输入文档 ID"
                clearable
              />
              <el-button
                :loading="loading"
                type="primary"
                @click="loadByDocumentId"
              >
                加载文档
              </el-button>
            </div>
          </div>

          <div class="dd-dwg-poc__section">
            <div class="dd-dwg-poc__label">方式 3：输入同源 DWG 地址</div>
            <div class="dd-dwg-poc__row">
              <el-input
                v-model="remoteUrl"
                placeholder="/api/files/example.dwg 或 blob:..."
                clearable
              />
              <el-button :loading="loading" @click="loadByRemoteUrl">
                加载地址
              </el-button>
            </div>
          </div>

          <div class="dd-dwg-poc__meta">
            <span>当前来源：{{ sourceLabel }}</span>
            <el-button
              :disabled="!hasPreview"
              text
              type="danger"
              @click="clearPreview"
            >
              清空预览
            </el-button>
          </div>

          <div v-if="errorText" class="text-[var(--el-color-danger)] text-sm">
            {{ errorText }}
          </div>
        </div>

        <CadViewer v-if="hasPreview" :url="activeUrl" :name="activeName" />
        <el-empty
          v-else
          description="请选择 DWG 文件、文档 ID 或同源地址开始验证"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.dd-dwg-poc__content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dd-dwg-poc__panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.dd-dwg-poc__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dd-dwg-poc__label {
  font-size: 13px;
  font-weight: 600;
}

.dd-dwg-poc__row {
  display: flex;
  gap: 12px;
}

.dd-dwg-poc__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

@media (max-width: 768px) {
  .dd-dwg-poc__row {
    flex-direction: column;
  }
}
</style>
