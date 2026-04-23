<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { ThreeModelViewer } from "@/3d";
import { useRoute, useRouter } from "vue-router";
import { getHandoverKksList } from "@/api/handoverData";
import PdfViewer from "@/views/handover/documents/components/PdfViewer.vue";
import DocxViewer from "@/views/handover/documents/components/DocxViewer.vue";
import ExcelViewer from "@/views/handover/documents/components/ExcelViewer.vue";
import MarkdownViewer from "@/views/handover/documents/components/MarkdownViewer.vue";
import OfficeViewer from "@/views/handover/documents/components/OfficeViewer.vue";
import TextViewer from "@/views/handover/documents/components/TextViewer.vue";
import ImageViewer from "@/views/handover/documents/components/ImageViewer.vue";
import MediaViewer from "@/views/handover/documents/components/MediaViewer.vue";
import CadViewer from "@/views/handover/documents/components/CadViewer.vue";
import {
  downloadHandoverDocumentFile,
  getHandoverDocumentDetail
} from "@/api/handoverDocuments";
import { getHandoverModelDetail } from "@/api/handoverModels";
import { searchNav } from "@/api/searchNav";
import { message } from "@/utils/message";
import {
  createHandoverDocumentObjectUrl,
  getHandoverDocumentPreviewKind,
  normalizeHandoverDocumentRecord,
  triggerHandoverDocumentDownload,
  unwrapHandoverDocumentFileResponse
} from "@/utils/handoverDocument";

defineOptions({
  name: "SmartSearch"
});

const route = useRoute();
const router = useRouter();

const keyword = ref("");
const scopes = ref({
  documents: true,
  models: true,
  devices: true,
  pid: false
});

const results = ref([]);
const hasSearched = ref(false);
const searchLoading = ref(false);

const docDetailVisible = ref(false);
const docDetailLoading = ref(false);
const docDetail = ref(null);
const docDetailError = ref("");
let revokeDocPreviewUrl = null;

const modelPreviewVisible = ref(false);
const modelPreviewLoading = ref(false);
const modelDetail = ref(null);
const modelPreviewRow = ref(null);
const modelDetailError = ref("");

const kksPreviewVisible = ref(false);
const kksPreviewLoading = ref(false);
const kksDetail = ref(null);
const kksPreviewRow = ref(null);
const kksDetailError = ref("");

const selectedScopes = computed(() => {
  return Object.entries(scopes.value)
    .filter(([, value]) => value)
    .map(([key]) => key);
});

const docPreviewKind = computed(() => {
  if (!docDetail.value) return "unknown";
  return getHandoverDocumentPreviewKind(docDetail.value);
});

const docPreviewUrl = computed(() => {
  return (
    (typeof docDetail.value?.url === "string" && docDetail.value.url.trim()) ||
    ""
  );
});

const modelPreviewUrl = computed(() => {
  return (
    (typeof modelDetail.value?.url === "string" &&
      modelDetail.value.url.trim()) ||
    ""
  );
});

function resetPreviewState() {
  cleanupDocPreviewUrl();
  docDetailVisible.value = false;
  docDetailLoading.value = false;
  docDetail.value = null;
  docDetailError.value = "";

  modelPreviewVisible.value = false;
  modelPreviewLoading.value = false;
  modelDetail.value = null;
  modelPreviewRow.value = null;
  modelDetailError.value = "";

  kksPreviewVisible.value = false;
  kksPreviewLoading.value = false;
  kksDetail.value = null;
  kksPreviewRow.value = null;
  kksDetailError.value = "";
}

function normalizeScopeKeys(scopeKeys) {
  return scopeKeys.includes("pid")
    ? Array.from(
        new Set(scopeKeys.filter(scope => scope !== "pid").concat("documents"))
      )
    : scopeKeys;
}

async function fetchSearchData() {
  const trimmedKeyword = keyword.value.trim();
  if (!trimmedKeyword) {
    results.value = [];
    hasSearched.value = false;
    return;
  }

  try {
    searchLoading.value = true;
    hasSearched.value = true;
    const response = await searchNav({
      query: trimmedKeyword,
      scopeKeys: normalizeScopeKeys(selectedScopes.value)
    });
    console.log("[search-nav/search] /api/search-nav/search:", response);
    results.value = Array.isArray(response?.data) ? response.data : [];
  } catch (error) {
    console.error("[search-nav/search] /api/search-nav/search failed:", error);
    results.value = [];
  } finally {
    searchLoading.value = false;
  }
}

async function doSearch() {
  if (selectedScopes.value.length === 0) {
    message("请至少选择一个搜索范围", { type: "warning" });
    return;
  }

  if (!keyword.value.trim()) {
    results.value = [];
    hasSearched.value = false;
    message("请输入搜索关键字", { type: "warning" });
    return;
  }

  await fetchSearchData();
  message("搜索请求已发送，请查看结果列表", { type: "success" });
}

function applyQueryToSearch() {
  const nodeId = route.query?.nodeId;
  const q = route.query?.q;

  if (typeof q === "string" && q.trim()) {
    keyword.value = q.trim();
    doSearch();
    return;
  }

  if (typeof nodeId === "string" && nodeId.trim()) {
    keyword.value = nodeId.trim();
    doSearch();
  }
}

function cleanupDocPreviewUrl() {
  if (typeof revokeDocPreviewUrl === "function") revokeDocPreviewUrl();
  revokeDocPreviewUrl = null;
}

async function resolveDocumentBlob(row) {
  if (!row?.id) return null;

  try {
    return await unwrapHandoverDocumentFileResponse(
      await downloadHandoverDocumentFile(row.id),
      "获取文档文件失败"
    );
  } catch (error) {
    console.error("[search-nav/search] document file load failed:", error);
    return null;
  }
}

async function openDocumentDetail(row) {
  resetPreviewState();
  docDetailVisible.value = true;
  docDetailLoading.value = true;
  try {
    const response = await getHandoverDocumentDetail(row.id);
    const data = response?.data ?? response ?? {};
    const detail = normalizeHandoverDocumentRecord(data);
    const blob = await resolveDocumentBlob(detail);
    if (blob) {
      const { url, revoke } = createHandoverDocumentObjectUrl(blob);
      detail.url = url;
      detail.previewBlob = blob;
      revokeDocPreviewUrl = revoke;
    }

    docDetail.value = detail;
    console.log("[search-nav/search] document detail:", detail);
  } catch (error) {
    console.error("[search-nav/search] document detail failed:", error);
    docDetailError.value = error?.message || "加载文档详情失败";
    message("加载文档详情失败", { type: "error" });
  } finally {
    docDetailLoading.value = false;
  }
}

async function openModelPreview(row) {
  resetPreviewState();
  modelPreviewVisible.value = true;
  modelPreviewLoading.value = true;
  modelPreviewRow.value = row;
  try {
    const response = await getHandoverModelDetail({ id: row.id });
    const data = response?.data ?? response ?? {};
    modelDetail.value = {
      ...data,
      meta: data?.meta || {}
    };
    console.log("[search-nav/search] model detail:", modelDetail.value);
  } catch (error) {
    console.error("[search-nav/search] model detail failed:", error);
    modelDetailError.value = error?.message || "加载模型详情失败";
    message("加载模型详情失败", { type: "error" });
  } finally {
    modelPreviewLoading.value = false;
  }
}

async function openKksPreview(row) {
  resetPreviewState();
  kksPreviewVisible.value = true;
  kksPreviewLoading.value = true;
  kksPreviewRow.value = row;
  try {
    const response = await getHandoverKksList({
      keyword: row.kks || row.title || undefined,
      page: 1,
      size: 20
    });
    const data = response?.data ?? response ?? {};
    const records = Array.isArray(data?.records)
      ? data.records
      : Array.isArray(data)
        ? data
        : [];
    kksDetail.value =
      records.find(item => item?.id === row.id) ||
      records.find(item => item?.kks === row.kks) ||
      null;
    console.log("[search-nav/search] kks detail:", kksDetail.value);
    if (!kksDetail.value) {
      kksDetailError.value = "未匹配到对应的数据详情";
    }
  } catch (error) {
    console.error("[search-nav/search] kks detail failed:", error);
    kksDetailError.value = error?.message || "加载数据详情失败";
    message("加载数据详情失败", { type: "error" });
  } finally {
    kksPreviewLoading.value = false;
  }
}

async function openDetail(row) {
  if (!row?.id) return;
  if (row.kind === "doc") return openDocumentDetail(row);
  if (row.kind === "model") return openModelPreview(row);
  if (row.kind === "kks") return openKksPreview(row);
}

async function downloadDocument() {
  if (!docDetail.value?.id) return;
  try {
    const blob = await resolveDocumentBlob(docDetail.value);
    if (!blob) {
      message("未获取到文档文件", { type: "warning" });
      return;
    }
    triggerHandoverDocumentDownload(blob, docDetail.value.name || "document");
    message("已开始下载文档", { type: "success" });
  } catch (error) {
    console.error("[search-nav/search] download document failed:", error);
    message("文档下载失败", { type: "error" });
  }
}

function openDocumentPage() {
  if (!docDetail.value?.id) return;
  router.push({
    path: "/handover/documents",
    query: { id: docDetail.value.id }
  });
}

function openModelPage() {
  if (!modelDetail.value?.id) return;
  router.push({
    path: "/handover/models",
    query: { id: modelDetail.value.id }
  });
}

function openKksPage() {
  const q = kksDetail.value?.kks || kksPreviewRow.value?.kks || "";
  if (!q) return;
  router.push({
    path: "/handover/data",
    query: { q }
  });
}

onMounted(() => {
  applyQueryToSearch();
});

watch(
  () => [route.query?.q, route.query?.nodeId],
  () => {
    applyQueryToSearch();
  }
);

watch(
  () => docDetailVisible.value,
  visible => {
    if (!visible) cleanupDocPreviewUrl();
  }
);
</script>

<template>
  <div class="dd-page">
    <el-card shadow="never" class="mb-4">
      <div class="mb-3">
        <el-input
          v-model="keyword"
          placeholder="输入设备编码、文档名称或关键词..."
          clearable
          size="large"
          @keyup.enter="doSearch"
        />
      </div>
      <div class="mb-3">
        <div class="font-semibold mb-2">搜索范围：</div>
        <el-space wrap>
          <el-checkbox v-model="scopes.documents">文档</el-checkbox>
          <el-checkbox v-model="scopes.models">三维模型</el-checkbox>
          <el-checkbox v-model="scopes.devices">设备数据</el-checkbox>
          <!-- <el-checkbox v-model="scopes.pid">P&ID图纸</el-checkbox> -->
        </el-space>
      </div>
      <el-button
        type="primary"
        class="w-full"
        :loading="searchLoading"
        @click="doSearch"
      >
        开始搜索
      </el-button>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="font-semibold">搜索结果</div>
      </template>

      <div
        v-if="results.length === 0"
        class="text-sm text-[var(--el-text-color-secondary)]"
      >
        {{
          hasSearched ? "未查询到匹配结果。" : "请输入关键字后发起全局搜索。"
        }}
      </div>

      <div v-for="row in results" :key="row.id" class="mb-3 last:mb-0">
        <el-card shadow="never">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="font-semibold truncate">
                {{ row.title || "-" }}
              </div>
              <div class="text-sm text-[var(--el-text-color-secondary)] mt-1">
                类型：{{ row.type || "-" }}
                <span v-if="row.kks"> | KKS编码：{{ row.kks }}</span>
              </div>
              <div
                v-if="row.description"
                class="text-sm text-[var(--el-text-color-secondary)] mt-1"
              >
                {{ row.description }}
              </div>
            </div>
            <el-button type="primary" @click="openDetail(row)"
              >查看详情</el-button
            >
          </div>
        </el-card>
      </div>
    </el-card>

    <el-dialog v-model="docDetailVisible" title="文档详情" width="960px">
      <div v-loading="docDetailLoading">
        <div v-if="docDetail" class="text-sm">
          <div class="mb-2">
            <span class="font-semibold">名称：</span>{{ docDetail.name || "-" }}
          </div>
          <div class="mb-2">
            <span class="font-semibold">类型：</span>{{ docDetail.type || "-" }}
          </div>
          <div class="mb-2">
            <span class="font-semibold">大小：</span>{{ docDetail.size || "-" }}
          </div>
          <div class="mb-2">
            <span class="font-semibold">更新时间：</span
            >{{ docDetail.updatedAt || "-" }}
          </div>
          <div class="mb-2">
            <span class="font-semibold">对象编码：</span
            >{{
              Array.isArray(docDetail.kksRefs)
                ? docDetail.kksRefs.join("、")
                : "-"
            }}
          </div>
          <div class="mb-2">
            <span class="font-semibold">关联系统：</span
            >{{
              Array.isArray(docDetail.nodeIds)
                ? docDetail.nodeIds.join("、")
                : "-"
            }}
          </div>

          <el-divider />

          <div class="font-semibold mb-3">在线预览</div>

          <div
            v-if="docPreviewKind === 'pdf' && docPreviewUrl"
            class="rounded overflow-hidden border border-[var(--el-border-color)]"
          >
            <PdfViewer :url="docPreviewUrl" />
          </div>

          <div
            v-else-if="docPreviewKind === 'image' && docPreviewUrl"
            class="rounded overflow-hidden border border-[var(--el-border-color)]"
          >
            <ImageViewer :url="docPreviewUrl" />
          </div>

          <div
            v-else-if="docPreviewKind === 'docx' && docPreviewUrl"
            class="rounded overflow-hidden border border-[var(--el-border-color)]"
          >
            <DocxViewer :url="docPreviewUrl" />
          </div>

          <div
            v-else-if="docPreviewKind === 'excel' && docPreviewUrl"
            class="rounded overflow-hidden border border-[var(--el-border-color)] p-4 bg-[var(--el-fill-color-blank)]"
          >
            <ExcelViewer :url="docPreviewUrl" :name="docDetail.name" />
          </div>

          <div
            v-else-if="docPreviewKind === 'markdown' && docPreviewUrl"
            class="rounded overflow-hidden border border-[var(--el-border-color)]"
          >
            <MarkdownViewer :url="docPreviewUrl" />
          </div>

          <div
            v-else-if="docPreviewKind === 'text' && docPreviewUrl"
            class="rounded overflow-hidden border border-[var(--el-border-color)]"
          >
            <TextViewer
              :url="docPreviewUrl"
              :mime="docDetail.mime"
              :name="docDetail.name"
            />
          </div>

          <div
            v-else-if="docPreviewKind === 'audio' && docPreviewUrl"
            class="rounded overflow-hidden border border-[var(--el-border-color)] p-4 bg-[var(--el-fill-color-blank)]"
          >
            <MediaViewer :url="docPreviewUrl" kind="audio" />
          </div>

          <div
            v-else-if="docPreviewKind === 'video' && docPreviewUrl"
            class="rounded overflow-hidden border border-[var(--el-border-color)] p-4 bg-[var(--el-fill-color-blank)]"
          >
            <MediaViewer :url="docPreviewUrl" kind="video" />
          </div>

          <div
            v-else-if="docPreviewKind === 'cad' && docPreviewUrl"
            class="rounded overflow-hidden border border-[var(--el-border-color)]"
          >
            <CadViewer
              :url="docPreviewUrl"
              :blob="docDetail.previewBlob"
              :name="docDetail.name"
            />
          </div>

          <div
            v-else-if="docPreviewKind === 'office' && docDetail"
            class="rounded overflow-hidden border border-[var(--el-border-color)] p-4 bg-[var(--el-fill-color-blank)]"
          >
            <OfficeViewer :url="docPreviewUrl" :row="docDetail" />
          </div>

          <div
            v-else
            class="text-sm text-[var(--el-text-color-secondary)] rounded border border-[var(--el-border-color)] p-4"
          >
            当前文档类型暂不支持在线预览，请使用下载功能查看。
          </div>
        </div>
        <div v-else-if="!docDetailLoading" class="text-sm">
          <div class="text-[var(--el-color-danger)]">
            {{ docDetailError || "暂无详情数据。" }}
          </div>
        </div>
      </div>
      <template #footer>
        <el-space>
          <el-button @click="docDetailVisible = false">关闭</el-button>
          <el-button v-if="docDetail" @click="openDocumentPage">
            打开文档管理
          </el-button>
          <el-button v-if="docDetail" type="primary" @click="downloadDocument">
            下载
          </el-button>
        </el-space>
      </template>
    </el-dialog>

    <el-dialog
      v-model="modelPreviewVisible"
      title="模型预览"
      width="960px"
      destroy-on-close
    >
      <div v-loading="modelPreviewLoading">
        <div v-if="modelDetail" class="mb-3 text-sm">
          <div class="font-semibold">
            {{ modelDetail.name || modelPreviewRow?.title || "-" }}
          </div>
          <div class="text-[var(--el-text-color-secondary)] mt-1">
            精度：{{ modelDetail.lod || "-" }} | 构件数：{{
              modelDetail.components || 0
            }}
          </div>
          <div class="text-[var(--el-text-color-secondary)] mt-1">
            作者：{{ modelDetail.meta?.author || modelDetail.author || "-" }} |
            版本：{{ modelDetail.meta?.version || modelDetail.version || "-" }}
          </div>
        </div>

        <div
          v-if="modelPreviewUrl"
          class="h-[560px] rounded overflow-hidden border border-[var(--el-border-color)]"
        >
          <ThreeModelViewer
            :model-url="modelPreviewUrl"
            :model-name="modelDetail?.name || modelPreviewRow?.title || ''"
            quality="medium"
          />
        </div>

        <div
          v-else-if="!modelPreviewLoading"
          class="text-sm text-[var(--el-text-color-secondary)]"
        >
          {{ modelDetailError || "当前模型没有可用预览地址。" }}
        </div>
      </div>

      <template #footer>
        <el-space>
          <el-button @click="modelPreviewVisible = false">关闭</el-button>
          <el-button v-if="modelDetail" type="primary" @click="openModelPage">
            打开模型管理
          </el-button>
        </el-space>
      </template>
    </el-dialog>

    <el-dialog v-model="kksPreviewVisible" title="数据预览" width="680px">
      <div v-loading="kksPreviewLoading">
        <div v-if="kksDetail" class="text-sm">
          <div class="mb-2">
            <span class="font-semibold">KKS编码：</span
            >{{ kksDetail.kks || "-" }}
          </div>
          <div class="mb-2">
            <span class="font-semibold">名称：</span>{{ kksDetail.name || "-" }}
          </div>
          <div class="mb-2">
            <span class="font-semibold">类型：</span>{{ kksDetail.type || "-" }}
          </div>
          <div class="mb-2">
            <span class="font-semibold">状态：</span
            >{{ kksDetail.status || "-" }}
          </div>
          <div class="mb-2">
            <span class="font-semibold">分类：</span
            >{{ kksDetail.category || "-" }}
          </div>
          <div class="mb-2">
            <span class="font-semibold">系统节点：</span
            >{{ kksDetail.systemNodeId || "-" }}
          </div>
          <div class="mb-2">
            <span class="font-semibold">创建时间：</span
            >{{ kksDetail.createdAt || "-" }}
          </div>
          <div class="mb-2">
            <span class="font-semibold">更新时间：</span
            >{{ kksDetail.updatedAt || "-" }}
          </div>
        </div>
        <div v-else-if="!kksPreviewLoading" class="text-sm">
          <div class="text-[var(--el-color-danger)]">
            {{ kksDetailError || "暂无详情数据。" }}
          </div>
        </div>
      </div>

      <template #footer>
        <el-space>
          <el-button @click="kksPreviewVisible = false">关闭</el-button>
          <el-button type="primary" @click="openKksPage"
            >打开数据管理</el-button
          >
        </el-space>
      </template>
    </el-dialog>
  </div>
</template>
