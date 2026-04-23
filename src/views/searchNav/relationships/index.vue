<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import { getHandoverKksList } from "@/api/handoverData";
import {
  downloadHandoverDocumentFile,
  getHandoverDocumentDetail,
  getHandoverDocumentList
} from "@/api/handoverDocuments";
import { getHandoverModelList } from "@/api/handoverModels";
import FilePreview from "@/views/handover/documents/components/FilePreview.vue";
import {
  batchDeleteRelationRecords,
  createRelationRecord,
  deleteRelationRecord,
  deleteRelationRecordsBySource,
  deleteRelationRecordsByTarget,
  getRelationRecordDetail,
  getSystemNodeTree,
  pageQueryRelationRecords,
  updateRelationRecord
} from "@/api/searchNav";
import { message } from "@/utils/message";
import {
  normalizeHandoverDocumentRecord,
  triggerHandoverDocumentDownload,
  unwrapHandoverDocumentFileResponse
} from "@/utils/handoverDocument";
import { parseModelNodeRelationName } from "@/views/visualization/viewer3d/services/modelNodeRelationService";

defineOptions({
  name: "Relationships"
});

const router = useRouter();

const form = reactive({
  keyword: "",
  type: "",
  sourceKind: "",
  sourceId: "",
  targetKind: "",
  targetId: ""
});

const relTypes = [
  { label: "全部", value: "" },
  { label: "节点-文档", value: "node_doc" },
  { label: "节点-模型", value: "node_model" },
  { label: "KKS-文档", value: "kks_doc" },
  { label: "KKS-模型", value: "kks_model" },
  { label: "模型-节点-文档", value: "model_object_doc" }
];

const editableRelationTypeValues = new Set([
  "node_doc",
  "node_model",
  "kks_doc",
  "kks_model"
]);

const editableRelTypes = computed(() =>
  relTypes.filter(
    item => item.value && editableRelationTypeValues.has(item.value)
  )
);

function relTypeLabel(value) {
  return relTypes.find(item => item.value === value)?.label || value || "-";
}

const kindOptions = [
  { label: "系统节点", value: "node" },
  { label: "KKS", value: "kks" },
  { label: "文档", value: "doc" },
  { label: "模型", value: "model" }
];

const relationRows = ref([]);
const total = ref(0);
const listLoading = ref(false);
const selectedRows = ref([]);
const nodeNameMap = ref({});
const nodeTreeOptions = ref([]);
const kksNameMap = ref({});
const documentNameMap = ref({});
const modelNameMap = ref({});
const nodeOptions = ref([]);
const kksOptions = ref([]);
const documentOptions = ref([]);
const modelOptions = ref([]);

const pagination = reactive({
  page: 1,
  size: 10
});

function readOptionList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.options)) return data.options;
  if (Array.isArray(data?.list)) return data.list;
  return [];
}

function getKindOptions(kind) {
  if (kind === "node") return nodeOptions.value;
  if (kind === "kks") return kksOptions.value;
  if (kind === "doc") return documentOptions.value;
  if (kind === "model") return modelOptions.value;
  return [];
}

function flattenTree(nodes = [], result = {}) {
  nodes.forEach(node => {
    if (node?.id) {
      result[node.id] = node.name || node.label || node.code || node.id;
    }
    if (Array.isArray(node?.children) && node.children.length > 0) {
      flattenTree(node.children, result);
    }
  });
  return result;
}

function mapTreeOptions(nodes = []) {
  return nodes.map(node => ({
    value: node.id,
    label: node.name || node.label || node.code || node.id,
    children: Array.isArray(node.children) ? mapTreeOptions(node.children) : []
  }));
}

async function fetchNodeNameMap() {
  try {
    const response = await getSystemNodeTree();
    console.log("[search-nav/relationships] systemNodes.tree:", response);
    const nodes = Array.isArray(response?.data) ? response.data : [];
    nodeNameMap.value = flattenTree(nodes, {});
    nodeTreeOptions.value = mapTreeOptions(nodes);
    nodeOptions.value = Object.entries(nodeNameMap.value).map(
      ([value, label]) => ({
        value,
        label
      })
    );
  } catch (error) {
    console.error("[search-nav/relationships] systemNodes.tree failed:", error);
    nodeNameMap.value = {};
    nodeTreeOptions.value = [];
    nodeOptions.value = [];
  }
}

async function fetchKksNameMap() {
  try {
    const response = await getHandoverKksList({
      page: 1,
      size: 1000
    });
    console.log("[search-nav/relationships] kks.options:", response);
    const rows = readOptionList(response?.data);
    kksNameMap.value = rows.reduce((acc, item) => {
      if (item?.id) {
        acc[item.id] = item.name || item.kks || item.id;
      }
      if (item?.kks) {
        acc[item.kks] = item.name || item.kks;
      }
      return acc;
    }, {});
    kksOptions.value = rows.map(item => ({
      value: item.id || item.kks,
      label: item.name || item.kks || item.id
    }));
  } catch (error) {
    console.error("[search-nav/relationships] kks.options failed:", error);
    kksNameMap.value = {};
    kksOptions.value = [];
  }
}

async function fetchDocumentNameMap() {
  try {
    const response = await getHandoverDocumentList({
      page: 1,
      size: 100
    });
    console.log("[search-nav/relationships] documents.list:", response);
    const rows = readOptionList(response?.data);
    documentNameMap.value = rows.reduce((acc, item) => {
      if (item?.id) {
        acc[item.id] = item.name || item.id;
      }
      return acc;
    }, {});
    documentOptions.value = rows.map(item => ({
      value: item.id,
      label: item.name || item.id
    }));
  } catch (error) {
    console.error("[search-nav/relationships] documents.list failed:", error);
    documentNameMap.value = {};
    documentOptions.value = [];
  }
}

async function fetchModelNameMap() {
  try {
    const response = await getHandoverModelList({
      page: 1,
      size: 100
    });
    console.log("[search-nav/relationships] models.list:", response);
    const rows = readOptionList(response?.data);
    modelNameMap.value = rows.reduce((acc, item) => {
      if (item?.id) {
        acc[item.id] = item.name || item.id;
      }
      return acc;
    }, {});
    modelOptions.value = rows.map(item => ({
      value: item.id,
      label: item.name || item.id
    }));
  } catch (error) {
    console.error("[search-nav/relationships] models.list failed:", error);
    modelNameMap.value = {};
    modelOptions.value = [];
  }
}

function resolveRelationName(kind, id) {
  if (!kind || !id) return "-";
  if (kind === "node") {
    return nodeNameMap.value[id] || `${kind}:${id}`;
  }
  if (kind === "kks") {
    return kksNameMap.value[id] || `${kind}:${id}`;
  }
  if (kind === "doc") {
    return documentNameMap.value[id] || `${kind}:${id}`;
  }
  if (kind === "model") {
    return modelNameMap.value[id] || `${kind}:${id}`;
  }
  return `${kind}:${id}`;
}

function resolveModelNodeRelation(row) {
  if (row?.type !== "model_object_doc") {
    return {
      modelId: "",
      modelText: "",
      nodeText: ""
    };
  }
  const parsed = parseModelNodeRelationName(row?.nodeName);
  const modelId = parsed.modelId || row?.sourceId || "";
  const modelText = modelId ? resolveRelationName("model", modelId) : "";
  return {
    modelId,
    modelText,
    nodeText: parsed.nodeName || ""
  };
}

function enrichRelationRow(row = {}) {
  const modelNode = resolveModelNodeRelation(row);
  const sourceText =
    row?.type === "model_object_doc"
      ? [modelNode.modelText, modelNode.nodeText].filter(Boolean).join(" / ") ||
        resolveRelationName(row.sourceKind, row.sourceId)
      : resolveRelationName(row.sourceKind, row.sourceId);
  return {
    ...row,
    typeText: relTypeLabel(row.type),
    sourceText,
    targetText: resolveRelationName(row.targetKind, row.targetId),
    modelNodeText: modelNode.nodeText,
    modelNodeModelId: modelNode.modelId
  };
}

async function fetchRelationRecords() {
  listLoading.value = true;
  try {
    const response = await pageQueryRelationRecords({
      type: form.type || undefined,
      sourceKind: form.sourceKind || undefined,
      sourceId: form.sourceId || undefined,
      targetKind: form.targetKind || undefined,
      targetId: form.targetId || undefined,
      page: pagination.page,
      size: pagination.size
    });
    console.log(
      "[search-nav/relationships] relationRecords.pageQuery:",
      response
    );
    relationRows.value = Array.isArray(response?.data?.records)
      ? response.data.records
      : [];
    total.value = Number(response?.data?.total || 0);
  } catch (error) {
    console.error("[search-nav/relationships] relation query failed:", error);
    relationRows.value = [];
    total.value = 0;
  } finally {
    listLoading.value = false;
  }
}

const displayRows = computed(() => {
  return relationRows.value.map(row => enrichRelationRow(row));
});

const filteredRows = computed(() => {
  const keyword = form.keyword.trim().toLowerCase();
  if (!keyword) return displayRows.value;
  return displayRows.value.filter(row => {
    return `${row.sourceText} ${row.targetText} ${row.id} ${row.type} ${row.typeText} ${row.nodeName || ""} ${row.modelNodeText || ""}`
      .toLowerCase()
      .includes(keyword);
  });
});

const detailOpen = ref(false);
const detailRow = ref(null);
const detailLoading = ref(false);
const documentPreviewVisible = ref(false);
const documentPreviewRow = ref(null);
const editOpen = ref(false);
const editMode = ref("create");
const editForm = reactive({
  id: "",
  type: "node_doc",
  sourceKind: "node",
  sourceId: "",
  targetKind: "doc",
  targetId: ""
});

const typeKindMap = {
  node_doc: { sourceKind: "node", targetKind: "doc" },
  node_model: { sourceKind: "node", targetKind: "model" },
  kks_doc: { sourceKind: "kks", targetKind: "doc" },
  kks_model: { sourceKind: "kks", targetKind: "model" }
};

function syncKindsByType() {
  const next = typeKindMap[editForm.type];
  if (!next) return;
  editForm.sourceKind = next.sourceKind;
  editForm.targetKind = next.targetKind;
  editForm.sourceId = "";
  editForm.targetId = "";
}

async function openDetail(row) {
  detailOpen.value = true;
  detailLoading.value = true;
  try {
    const response = await getRelationRecordDetail(row.id);
    console.log("[search-nav/relationships] relationRecords.detail:", response);
    const detail = response?.data || row;
    detailRow.value = enrichRelationRow(detail);
  } catch (error) {
    console.error(
      "[search-nav/relationships] relationRecords.detail failed:",
      error
    );
    detailRow.value = enrichRelationRow(row);
  } finally {
    detailLoading.value = false;
  }
}

async function openDocumentPreviewById(documentId) {
  if (!documentId) return;
  try {
    const response = await getHandoverDocumentDetail(documentId);
    const detail = normalizeHandoverDocumentRecord(response?.data || {});
    if (!detail?.id) {
      throw new Error("未获取到文档详情");
    }
    documentPreviewRow.value = detail;
    documentPreviewVisible.value = true;
  } catch (error) {
    console.error(
      "[search-nav/relationships] open document preview failed:",
      error
    );
    message(error?.message || "打开文档失败", { type: "error" });
  }
}

async function handlePreviewDownload(row) {
  if (!row?.id) return;
  try {
    const blob = await unwrapHandoverDocumentFileResponse(
      await downloadHandoverDocumentFile(row.id),
      "下载文件失败"
    );
    if (!triggerHandoverDocumentDownload(blob, row.name || "document")) {
      throw new Error("浏览器不支持当前下载方式");
    }
    message(`已开始下载：${row.name || row.id}`, { type: "success" });
  } catch (error) {
    console.error(
      "[search-nav/relationships] download document failed:",
      error
    );
    message(error?.message || "下载文件失败", { type: "error" });
  }
}

function openCreate() {
  editMode.value = "create";
  editForm.id = "";
  editForm.type = "node_doc";
  syncKindsByType();
  editForm.sourceId = nodeOptions.value[0]?.value || "";
  editForm.targetId = documentOptions.value[0]?.value || "";
  editOpen.value = true;
}

function canEditRelation(row) {
  return row?.type !== "model_object_doc";
}

function openEdit(row) {
  if (!canEditRelation(row)) {
    message("模型-节点-文档关系请在三维页面维护", { type: "warning" });
    return;
  }
  editMode.value = "edit";
  editForm.id = row.id;
  editForm.type = row.type;
  editForm.sourceKind = row.sourceKind;
  editForm.sourceId = row.sourceId;
  editForm.targetKind = row.targetKind;
  editForm.targetId = row.targetId;
  editOpen.value = true;
}

async function handleSearch() {
  pagination.page = 1;
  await fetchRelationRecords();
}

async function handlePageChange(page) {
  pagination.page = page;
  await fetchRelationRecords();
}

async function handleSizeChange(size) {
  pagination.size = size;
  pagination.page = 1;
  await fetchRelationRecords();
}

async function deleteRow(row) {
  if (!row?.id) return;
  try {
    await deleteRelationRecord(row.id);
    console.log("[search-nav/relationships] relationRecords.delete:", row.id);
    message("已删除关联关系", { type: "success" });
    await fetchRelationRecords();
  } catch (error) {
    console.error(
      "[search-nav/relationships] relationRecords.delete failed:",
      error
    );
  }
}

const sourceOptions = computed(() => {
  if (editForm.sourceKind === "node") return nodeOptions.value;
  if (editForm.sourceKind === "kks") return kksOptions.value;
  if (editForm.sourceKind === "model") return modelOptions.value;
  return [];
});

const targetOptions = computed(() => {
  if (editForm.targetKind === "doc") return documentOptions.value;
  if (editForm.targetKind === "model") return modelOptions.value;
  return [];
});

const querySourceOptions = computed(() => getKindOptions(form.sourceKind));
const queryTargetOptions = computed(() => getKindOptions(form.targetKind));
const canDeleteBySource = computed(() => {
  return Boolean(form.sourceKind && form.sourceId);
});
const canDeleteByTarget = computed(() => {
  return Boolean(form.targetKind && form.targetId);
});

async function saveRelation() {
  if (!editForm.type || !editForm.sourceId || !editForm.targetId) {
    message("请完整选择关系类型、来源和目标", { type: "warning" });
    return;
  }

  const payload = {
    type: editForm.type,
    sourceKind: editForm.sourceKind,
    sourceId: editForm.sourceId,
    targetKind: editForm.targetKind,
    targetId: editForm.targetId
  };

  try {
    if (editMode.value === "create") {
      const response = await createRelationRecord(payload);
      console.log(
        "[search-nav/relationships] relationRecords.create:",
        response
      );
      message("已创建关联关系", { type: "success" });
    } else {
      const response = await updateRelationRecord({
        id: editForm.id,
        ...payload
      });
      console.log(
        "[search-nav/relationships] relationRecords.update:",
        response
      );
      message("已更新关联关系", { type: "success" });
    }
    editOpen.value = false;
    await fetchRelationRecords();
  } catch (error) {
    console.error("[search-nav/relationships] save relation failed:", error);
  }
}

function handleSelectionChange(rows) {
  selectedRows.value = rows;
}

async function resetForm() {
  form.keyword = "";
  form.type = "";
  form.sourceKind = "";
  form.sourceId = "";
  form.targetKind = "";
  form.targetId = "";
  pagination.page = 1;
  await fetchRelationRecords();
}

async function batchDeleteRows() {
  const ids = selectedRows.value.map(row => row.id).filter(Boolean);
  if (ids.length === 0) {
    message("请先选择要删除的关联关系", { type: "warning" });
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确认批量删除选中的 ${ids.length} 条关联关系吗？`,
      "批量删除确认",
      {
        type: "warning",
        confirmButtonText: "确认删除",
        cancelButtonText: "取消"
      }
    );
    const response = await batchDeleteRelationRecords(ids);
    console.log(
      "[search-nav/relationships] relationRecords.batchDelete:",
      response
    );
    message("已批量删除关联关系", { type: "success" });
    selectedRows.value = [];
    await fetchRelationRecords();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    console.error(
      "[search-nav/relationships] relationRecords.batchDelete failed:",
      error
    );
  }
}

async function deleteBySource() {
  if (!canDeleteBySource.value) {
    message("请先选择来源类型和来源对象", { type: "warning" });
    return;
  }
  try {
    await ElMessageBox.confirm(
      "确认删除该来源下的所有关联关系吗？",
      "按来源删除确认",
      {
        type: "warning",
        confirmButtonText: "确认删除",
        cancelButtonText: "取消"
      }
    );
    const response = await deleteRelationRecordsBySource({
      sourceKind: form.sourceKind,
      sourceId: form.sourceId
    });
    console.log(
      "[search-nav/relationships] relationRecords.deleteBySource:",
      response
    );
    message("已删除指定来源的关联关系", { type: "success" });
    await fetchRelationRecords();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    console.error(
      "[search-nav/relationships] relationRecords.deleteBySource failed:",
      error
    );
  }
}

async function deleteByTarget() {
  if (!canDeleteByTarget.value) {
    message("请先选择目标类型和目标对象", { type: "warning" });
    return;
  }
  try {
    await ElMessageBox.confirm(
      "确认删除该目标下的所有关联关系吗？",
      "按目标删除确认",
      {
        type: "warning",
        confirmButtonText: "确认删除",
        cancelButtonText: "取消"
      }
    );
    const response = await deleteRelationRecordsByTarget({
      targetKind: form.targetKind,
      targetId: form.targetId
    });
    console.log(
      "[search-nav/relationships] relationRecords.deleteByTarget:",
      response
    );
    message("已删除指定目标的关联关系", { type: "success" });
    await fetchRelationRecords();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    console.error(
      "[search-nav/relationships] relationRecords.deleteByTarget failed:",
      error
    );
  }
}

function jumpTo(type, query = {}) {
  if (type === "docs")
    return router.push({ path: "/handover/documents", query });
  if (type === "models")
    return router.push({ path: "/handover/models", query });
  if (type === "viewer") return router.push("/visualization/3d-viewer");
  if (type === "nav") return router.push("/search-nav/navigation");
  if (type === "search") return router.push("/search-nav/search");
  message("该跳转尚未实现", { type: "info" });
}

function smartJumpFromRelation(row) {
  if (row?.targetKind === "node") {
    return router.push({
      path: "/search-nav/navigation",
      query: { nodeId: row.targetId }
    });
  }
  if (row?.targetKind === "kks") {
    return router.push({
      path: "/search-nav/search",
      query: { q: row.targetId }
    });
  }
  if (row?.targetKind === "doc") {
    return jumpTo("docs", { id: row.targetId });
  }
  if (row?.targetKind === "model") {
    return jumpTo("models", { id: row.targetId });
  }
  return jumpTo("search");
}

onMounted(async () => {
  await Promise.all([
    fetchNodeNameMap(),
    fetchKksNameMap(),
    fetchDocumentNameMap(),
    fetchModelNameMap()
  ]);
  await fetchRelationRecords();
});
</script>

<template>
  <div class="dd-page">
    <el-card shadow="never" class="mb-4">
      <el-form :inline="true" :model="form">
        <el-form-item label="关系类型">
          <el-select
            v-model="form.type"
            style="width: 180px"
            clearable
            @change="handleSearch"
          >
            <el-option
              v-for="item in relTypes"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="来源类型">
          <el-select
            v-model="form.sourceKind"
            style="width: 140px"
            clearable
            @change="form.sourceId = ''"
          >
            <el-option
              v-for="item in kindOptions.filter(item =>
                ['node', 'kks', 'model'].includes(item.value)
              )"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="来源对象">
          <el-tree-select
            v-if="form.sourceKind === 'node'"
            v-model="form.sourceId"
            :data="nodeTreeOptions"
            check-strictly
            clearable
            filterable
            node-key="value"
            style="width: 220px"
          />
          <el-select
            v-else
            v-model="form.sourceId"
            style="width: 220px"
            filterable
            clearable
            :disabled="!form.sourceKind"
          >
            <el-option
              v-for="item in querySourceOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="目标类型">
          <el-select
            v-model="form.targetKind"
            style="width: 140px"
            clearable
            @change="form.targetId = ''"
          >
            <el-option
              v-for="item in kindOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="目标对象">
          <el-tree-select
            v-if="form.targetKind === 'node'"
            v-model="form.targetId"
            :data="nodeTreeOptions"
            check-strictly
            clearable
            filterable
            node-key="value"
            style="width: 220px"
          />
          <el-select
            v-else
            v-model="form.targetId"
            style="width: 220px"
            filterable
            clearable
            :disabled="!form.targetKind"
          >
            <el-option
              v-for="item in queryTargetOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input
            v-model="form.keyword"
            placeholder="页内筛选：类型/来源/目标/节点/ID"
            style="width: 260px"
            clearable
          />
        </el-form-item>
        <el-form-item>
          <el-space wrap>
            <el-button type="primary" @click="openCreate">新增关系</el-button>
            <el-button type="primary" @click="handleSearch">查询</el-button>
            <el-button @click="resetForm">重置</el-button>
            <el-button @click="batchDeleteRows">批量删除</el-button>
            <el-button :disabled="!canDeleteBySource" @click="deleteBySource">
              按来源删除
            </el-button>
            <el-button :disabled="!canDeleteByTarget" @click="deleteByTarget">
              按目标删除
            </el-button>
            <el-button @click="jumpTo('nav')">去系统导航</el-button>
          </el-space>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="font-semibold">关系列表</div>
          <div class="text-xs text-[var(--el-text-color-secondary)]">
            后端总数 {{ total }} 条，当前页展示 {{ filteredRows.length }} 条
          </div>
        </div>
      </template>

      <el-table
        v-loading="listLoading"
        :data="filteredRows"
        stripe
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="48" />
        <el-table-column label="类型" width="150">
          <template #default="scope">{{ scope.row.typeText }}</template>
        </el-table-column>
        <el-table-column
          prop="sourceText"
          label="来源"
          min-width="240"
          show-overflow-tooltip
        />
        <el-table-column
          prop="targetText"
          label="目标"
          min-width="240"
          show-overflow-tooltip
        />
        <el-table-column prop="updatedAt" label="更新时间" width="180" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="scope">
            <el-space>
              <el-button link type="primary" @click="openDetail(scope.row)"
                >详情</el-button
              >
              <el-button
                v-if="canEditRelation(scope.row)"
                link
                type="primary"
                @click="openEdit(scope.row)"
                >编辑</el-button
              >
              <el-button link type="danger" @click="deleteRow(scope.row)"
                >删除</el-button
              >
            </el-space>
          </template>
        </el-table-column>
      </el-table>

      <div class="flex justify-end mt-4">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next"
          :current-page="pagination.page"
          :page-size="pagination.size"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="detailOpen" title="关系详情" width="560px">
      <div v-if="detailRow" v-loading="detailLoading" class="text-sm">
        <div class="mb-2">
          <span class="font-semibold">ID：</span>{{ detailRow.id || "-" }}
        </div>
        <div class="mb-2">
          <span class="font-semibold">类型：</span
          >{{ relTypeLabel(detailRow.type) }}
        </div>
        <div v-if="detailRow.type === 'model_object_doc'" class="mb-2">
          <span class="font-semibold">模型节点：</span
          >{{ detailRow.modelNodeText || detailRow.nodeName || "-" }}
        </div>
        <div class="mb-2">
          <span class="font-semibold">来源：</span>{{ detailRow.sourceText }}
        </div>
        <div class="mb-2">
          <span class="font-semibold">来源标识：</span
          >{{ detailRow.sourceKind }}:{{ detailRow.sourceId }}
        </div>
        <div class="mb-2">
          <span class="font-semibold">目标：</span>{{ detailRow.targetText }}
        </div>
        <div class="mb-2">
          <span class="font-semibold">目标标识：</span
          >{{ detailRow.targetKind }}:{{ detailRow.targetId }}
        </div>
        <div class="mb-2">
          <span class="font-semibold">更新时间：</span
          >{{ detailRow.updatedAt || "-" }}
        </div>
        <div class="mb-2">
          <span class="font-semibold">创建时间：</span
          >{{ detailRow.createdAt || "-" }}
        </div>
        <div class="mb-2">
          <span class="font-semibold">创建人：</span
          >{{ detailRow.createdBy || "-" }}
        </div>
        <div class="mb-2">
          <span class="font-semibold">更新人：</span
          >{{ detailRow.updatedBy || "-" }}
        </div>
        <el-divider />
        <el-space wrap>
          <el-button
            v-if="detailRow.targetKind === 'doc'"
            @click="openDocumentPreviewById(detailRow.targetId)"
          >
            打开文档
          </el-button>
          <el-button
            v-if="detailRow.targetKind === 'doc'"
            @click="jumpTo('docs', { id: detailRow.targetId })"
          >
            进入文档管理
          </el-button>
          <el-button v-else @click="jumpTo('docs')">查看文档</el-button>
          <el-button @click="jumpTo('models')">查看模型</el-button>
          <el-button @click="jumpTo('viewer')">三维查看</el-button>
          <el-button type="primary" @click="smartJumpFromRelation(detailRow)"
            >智能跳转</el-button
          >
        </el-space>
      </div>
      <template #footer>
        <el-button @click="detailOpen = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="editOpen"
      :title="editMode === 'create' ? '新增关系' : '编辑关系'"
      width="560px"
    >
      <el-form label-width="90px">
        <el-form-item label="关系类型">
          <el-select
            v-model="editForm.type"
            style="width: 220px"
            @change="syncKindsByType"
          >
            <el-option
              v-for="item in editableRelTypes"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="来源">
          <el-tree-select
            v-if="editForm.sourceKind === 'node'"
            v-model="editForm.sourceId"
            :data="nodeTreeOptions"
            check-strictly
            clearable
            filterable
            node-key="value"
            class="w-full"
          />
          <el-select
            v-else
            v-model="editForm.sourceId"
            class="w-full"
            filterable
          >
            <el-option
              v-for="item in sourceOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="目标">
          <el-select v-model="editForm.targetId" class="w-full" filterable>
            <el-option
              v-for="item in targetOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-space>
          <el-button @click="editOpen = false">取消</el-button>
          <el-button type="primary" @click="saveRelation">保存</el-button>
        </el-space>
      </template>
    </el-dialog>

    <FilePreview
      v-model:visible="documentPreviewVisible"
      :row="documentPreviewRow"
      @download="handlePreviewDownload"
    />
  </div>
</template>
