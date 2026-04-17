<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { ThreeModelViewer } from "@/3d";
import { ElMessageBox } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import PdfViewer from "@/views/handover/documents/components/PdfViewer.vue";
import {
  downloadHandoverDocumentFile,
  getHandoverDocumentDetail
} from "@/api/handoverDocuments";
import { getHandoverModelDetail } from "@/api/handoverModels";
import {
  createSystemNode,
  deleteSystemNodes,
  exportSystemNodes,
  getSystemNodeDetail,
  getSystemNodeTree,
  importSystemNodes,
  moveSystemNode,
  renameSystemNode
} from "@/api/searchNav";
import { message } from "@/utils/message";
import {
  createHandoverDocumentObjectUrl,
  normalizeHandoverDocumentRecord,
  triggerHandoverDocumentDownload,
  unwrapHandoverDocumentFileResponse
} from "@/utils/handoverDocument";

defineOptions({
  name: "SystemNavigation"
});

const route = useRoute();
const router = useRouter();

const treeData = ref([]);
const treeRef = ref();
const selectedId = ref("");
const expandedKeys = ref([]);
const nodeDetail = ref({
  nodeMeta: {},
  kksItems: [],
  models: [],
  documents: [],
  relations: []
});
const treeLoading = ref(false);
const detailLoading = ref(false);
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

const editVisible = ref(false);
const editFormRef = ref();
const editMode = ref("create");
const editTarget = ref(null);
const editForm = reactive({
  name: "",
  code: "",
  type: "",
  description: ""
});
const editRules = {
  name: [{ required: true, message: "请输入节点名称", trigger: "blur" }],
  code: [
    {
      max: 100,
      message: "节点编码长度不能超过 100 个字符",
      trigger: "blur"
    }
  ],
  type: [
    {
      max: 100,
      message: "节点类型长度不能超过 100 个字符",
      trigger: "blur"
    }
  ],
  description: [
    {
      max: 500,
      message: "描述长度不能超过 500 个字符",
      trigger: "blur"
    }
  ]
};

const moveVisible = ref(false);
const moveTargetNode = ref(null);
const moveTargetParentId = ref("");

const importVisible = ref(false);
const importFileList = ref([]);
const importText = ref("");

function mapTreeNodes(nodes = [], parentId = "") {
  return nodes.map(node => {
    const id = node.id || node.nodeId || node.code;
    return {
      ...node,
      id,
      parentId: node.parentId || parentId || "",
      label: node.name || node.label || node.code || id || "-",
      children: mapTreeNodes(node.children || [], id)
    };
  });
}

function normalizeImportNode(node) {
  return {
    name: node?.name || "",
    code: node?.code || "",
    type: node?.type || "",
    description: node?.description ?? "",
    children: Array.isArray(node?.children)
      ? node.children.map(normalizeImportNode)
      : []
  };
}

function normalizeImportPayload(parsed) {
  if (Array.isArray(parsed)) {
    return { nodes: parsed.map(normalizeImportNode) };
  }
  if (Array.isArray(parsed?.nodes)) {
    return { nodes: parsed.nodes.map(normalizeImportNode) };
  }
  return { nodes: [normalizeImportNode(parsed)] };
}

function flattenTree(nodes = [], result = []) {
  nodes.forEach(node => {
    result.push(node);
    if (Array.isArray(node.children) && node.children.length > 0) {
      flattenTree(node.children, result);
    }
  });
  return result;
}

function collectExpandableKeys(nodes = [], result = []) {
  nodes.forEach(node => {
    if (Array.isArray(node.children) && node.children.length > 0) {
      result.push(node.id);
      collectExpandableKeys(node.children, result);
    }
  });
  return result;
}

function collectDescendantKeys(targetId) {
  const result = [];

  function walk(nodes = []) {
    nodes.forEach(node => {
      if (node.id === targetId) {
        flattenTree(node.children || [], result);
        return;
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        walk(node.children);
      }
    });
  }

  walk(treeData.value);
  return result.map(node => node.id);
}

function collectAncestorKeys(targetId) {
  if (!targetId) return [];
  const allNodes = flattenTree(treeData.value, []);
  const nodeMap = new Map(allNodes.map(node => [node.id, node]));
  const result = [];
  let current = nodeMap.get(targetId);

  while (current?.parentId) {
    result.unshift(current.parentId);
    current = nodeMap.get(current.parentId);
  }

  return result;
}

function findNodeByMatcher(matcher) {
  return flattenTree(treeData.value, []).find(matcher);
}

function findNodeByNameAndParent(name, parentId = "") {
  return findNodeByMatcher(
    node => node.label === name && (node.parentId || "") === (parentId || "")
  );
}

function appendExpandedKeys(keys = []) {
  expandedKeys.value = Array.from(new Set([...expandedKeys.value, ...keys]));
}

function syncExpandedState() {
  const allExpandableKeys = new Set(collectExpandableKeys(treeData.value, []));
  expandedKeys.value = expandedKeys.value.filter(key =>
    allExpandableKeys.has(key)
  );

  if (selectedId.value) {
    const ancestorKeys = collectAncestorKeys(selectedId.value).filter(key =>
      allExpandableKeys.has(key)
    );
    appendExpandedKeys(ancestorKeys);
  }
}

async function restoreTreeUiState() {
  await nextTick();
  treeRef.value?.store?.setDefaultExpandedKeys?.(expandedKeys.value);
  treeRef.value?.setCurrentKey?.(selectedId.value || null);
}

const flatTreeOptions = computed(() => {
  return flattenTree(treeData.value, []).map(node => ({
    value: node.id,
    label: node.label
  }));
});

const moveTargetOptions = computed(() => {
  const invalidIds = new Set([
    moveTargetNode.value?.id,
    ...collectDescendantKeys(moveTargetNode.value?.id)
  ]);

  return flatTreeOptions.value.filter(option => !invalidIds.has(option.value));
});

const selectedNode = computed(() => {
  return flattenTree(treeData.value, []).find(
    node => node.id === selectedId.value
  );
});

const selectedLabel = computed(() => {
  const currentMeta = nodeDetail.value.nodeMeta || {};
  return (
    currentMeta.systemName ||
    selectedNode.value?.label ||
    currentMeta.name ||
    currentMeta.code ||
    ""
  );
});

function normalizeRelationEntityRows(relations = [], kind) {
  return relations
    .filter(item => item?.sourceKind === kind || item?.targetKind === kind)
    .map(item => {
      const isSource = item?.sourceKind === kind;
      const entityId = isSource ? item?.sourceId : item?.targetId;
      return {
        id: entityId || item?.id,
        relationId: item?.id || "-",
        name: entityId || "-",
        type: item?.type || "-",
        kind,
        sourceKind: item?.sourceKind || "-",
        sourceId: item?.sourceId || "-",
        targetKind: item?.targetKind || "-",
        targetId: item?.targetId || "-"
      };
    });
}

const docPreviewKind = computed(() => {
  const type = String(docDetail.value?.type || "").toUpperCase();
  const mime = String(docDetail.value?.mime || "").toLowerCase();
  const url = String(docDetail.value?.url || "").toLowerCase();

  if (type === "PDF" || mime.includes("pdf") || url.endsWith(".pdf")) {
    return "pdf";
  }
  if (
    type === "IMAGE" ||
    mime.startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"].some(ext =>
      url.endsWith(ext)
    )
  ) {
    return "image";
  }

  return "unknown";
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

const related = computed(() => {
  const currentMeta = nodeDetail.value.nodeMeta || {};
  const relations = Array.isArray(nodeDetail.value.relations)
    ? nodeDetail.value.relations
    : [];
  const documentRows = Array.isArray(nodeDetail.value.documents)
    ? nodeDetail.value.documents
    : [];
  const modelRows = Array.isArray(nodeDetail.value.models)
    ? nodeDetail.value.models
    : [];
  const kksRows = Array.isArray(nodeDetail.value.kksItems)
    ? nodeDetail.value.kksItems
    : [];

  return {
    systemNodeId: currentMeta.systemNodeId || selectedId.value || "-",
    metaId: currentMeta.id || "-",
    systemName: currentMeta.systemName || selectedLabel.value || "-",
    kksRoot: currentMeta.kksRoot || "-",
    discipline: currentMeta.discipline || "-",
    scope: currentMeta.scope || "-",
    owner: currentMeta.owner || "-",
    description: currentMeta.description || "-",
    createdAt: currentMeta.createdAt || "-",
    updatedAt: currentMeta.updatedAt || "-",
    createdBy: currentMeta.createdBy || "-",
    updatedBy: currentMeta.updatedBy || "-",
    docs:
      documentRows.length > 0
        ? documentRows
        : normalizeRelationEntityRows(relations, "doc"),
    models:
      modelRows.length > 0
        ? modelRows
        : normalizeRelationEntityRows(relations, "model"),
    devices:
      kksRows.length > 0
        ? kksRows
        : normalizeRelationEntityRows(relations, "kks"),
    relations
  };
});

async function fetchSystemNodeTree(preserveSelected = true) {
  treeLoading.value = true;
  try {
    const response = await getSystemNodeTree();
    console.log("[search-nav/navigation] systemNodes.tree:", response);
    const nodes = Array.isArray(response?.data) ? response.data : [];
    treeData.value = mapTreeNodes(nodes);

    const allNodes = flattenTree(treeData.value, []);
    const hasCurrent = allNodes.some(node => node.id === selectedId.value);
    if (!preserveSelected || !selectedId.value || !hasCurrent) {
      selectedId.value = allNodes[0]?.id || "";
    }

    syncExpandedState();
  } catch (error) {
    console.error("[search-nav/navigation] systemNodes.tree failed:", error);
    treeData.value = [];
    expandedKeys.value = [];
  } finally {
    treeLoading.value = false;
  }
}

async function fetchSystemNodeDetailData() {
  if (!selectedId.value) {
    nodeDetail.value = {
      nodeMeta: {},
      kksItems: [],
      models: [],
      documents: [],
      relations: []
    };
    return;
  }

  detailLoading.value = true;
  try {
    const response = await getSystemNodeDetail(selectedId.value);
    console.log("[search-nav/navigation] systemNodes.detail:", response);
    nodeDetail.value = {
      nodeMeta: response?.data?.nodeMeta || {},
      kksItems: Array.isArray(response?.data?.kksItems)
        ? response.data.kksItems
        : [],
      models: Array.isArray(response?.data?.models) ? response.data.models : [],
      documents: Array.isArray(response?.data?.documents)
        ? response.data.documents
        : [],
      relations: Array.isArray(response?.data?.relations)
        ? response.data.relations
        : []
    };
  } catch (error) {
    console.error("[search-nav/navigation] systemNodes.detail failed:", error);
    nodeDetail.value = {
      nodeMeta: {},
      kksItems: [],
      models: [],
      documents: [],
      relations: []
    };
  } finally {
    detailLoading.value = false;
  }
}

function applyQuery() {
  const nodeId = route.query?.nodeId;
  if (typeof nodeId !== "string") return;
  const next = nodeId.trim();
  if (!next) return;
  selectedId.value = next;
}

function handleNodeClick(data) {
  selectedId.value = data.id;
  fetchSystemNodeDetailData();
}

function handleNodeExpand(data) {
  if (!expandedKeys.value.includes(data.id)) {
    expandedKeys.value = [...expandedKeys.value, data.id];
  }
}

function handleNodeCollapse(data) {
  expandedKeys.value = expandedKeys.value.filter(key => key !== data.id);
}

function openCreateRoot() {
  editMode.value = "create";
  editTarget.value = null;
  editForm.name = "";
  editForm.code = "";
  editForm.type = "";
  editForm.description = "";
  editVisible.value = true;
}

function resetImportDialog() {
  importVisible.value = false;
  importText.value = "";
  importFileList.value = [];
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsText(file, "utf-8");
  });
}

async function handleImportFileChange(uploadFile) {
  const rawFile = uploadFile?.raw;
  if (!rawFile) return false;
  try {
    importText.value = await readFileText(rawFile);
    importFileList.value = [uploadFile];
    message(`已读取文件：${rawFile.name}`, { type: "success" });
  } catch (error) {
    console.error("[search-nav/navigation] read import file failed:", error);
    message("读取导入文件失败", { type: "error" });
  }
  return false;
}

function openCreateChild(node) {
  editMode.value = "create";
  editTarget.value = node;
  editForm.name = "";
  editForm.code = "";
  editForm.type = "";
  editForm.description = "";
  editVisible.value = true;
}

function openRename(node) {
  editMode.value = "rename";
  editTarget.value = node;
  editForm.name = node?.name || node?.label || "";
  editForm.code = node?.code || "";
  editForm.type = node?.type || "";
  editForm.description = node?.description || "";
  editVisible.value = true;
}

async function submitNodeEdit() {
  const valid = await editFormRef.value?.validate?.().catch(() => false);
  if (valid === false) {
    return;
  }
  const trimmedName = editForm.name.trim();

  try {
    if (editMode.value === "create") {
      const parentId = editTarget.value?.id || "";
      const payload = {
        name: trimmedName,
        code: editForm.code.trim() || undefined,
        parentId: parentId || undefined,
        type: editForm.type.trim() || undefined,
        description: editForm.description.trim() || undefined
      };
      const response = await createSystemNode(payload);
      console.log("[search-nav/navigation] systemNodes.create:", response);
      appendExpandedKeys(
        parentId ? [...collectAncestorKeys(parentId), parentId] : []
      );
      message("已创建系统节点", { type: "success" });
      await fetchSystemNodeTree(true);
      const createdId =
        response?.data?.id || response?.data?.nodeId || response?.id;
      const createdNode =
        (createdId &&
          findNodeByMatcher(
            node => node.id === createdId || node.nodeId === createdId
          )) ||
        findNodeByNameAndParent(trimmedName, parentId);
      if (createdNode?.id) {
        selectedId.value = createdNode.id;
      }
    } else {
      const response = await renameSystemNode({
        id: editTarget.value?.id,
        name: trimmedName
      });
      console.log("[search-nav/navigation] systemNodes.rename:", response);
      message("已重命名系统节点", { type: "success" });
      selectedId.value = editTarget.value?.id || selectedId.value;
      await fetchSystemNodeTree(true);
    }
    editVisible.value = false;
    await fetchSystemNodeDetailData();
  } catch (error) {
    console.error("[search-nav/navigation] save node failed:", error);
    message("保存系统节点失败", { type: "error" });
  }
}

function openMove(node) {
  moveTargetNode.value = node;
  moveTargetParentId.value = node?.parentId || "";
  moveVisible.value = true;
}

async function submitMove() {
  if (!moveTargetNode.value?.id || !moveTargetParentId.value) {
    message("请选择目标父节点", { type: "warning" });
    return;
  }
  if (moveTargetNode.value.id === moveTargetParentId.value) {
    message("目标父节点不能是当前节点", { type: "warning" });
    return;
  }
  if (
    collectDescendantKeys(moveTargetNode.value.id).includes(
      moveTargetParentId.value
    )
  ) {
    message("目标父节点不能是当前节点的子孙节点", { type: "warning" });
    return;
  }
  try {
    selectedId.value = moveTargetNode.value.id;
    const response = await moveSystemNode({
      id: moveTargetNode.value.id,
      targetParentId: moveTargetParentId.value
    });
    console.log("[search-nav/navigation] systemNodes.move:", response);
    appendExpandedKeys([
      ...collectAncestorKeys(moveTargetParentId.value),
      moveTargetParentId.value
    ]);
    moveVisible.value = false;
    message("已移动系统节点", { type: "success" });
    await fetchSystemNodeTree(true);
    await fetchSystemNodeDetailData();
  } catch (error) {
    console.error("[search-nav/navigation] systemNodes.move failed:", error);
    message("移动系统节点失败", { type: "error" });
  }
}

async function removeNode(node) {
  if (!node?.id) return;
  try {
    await ElMessageBox.confirm(
      `确认删除系统节点“${node.label || node.name || node.id}”吗？`,
      "删除确认",
      {
        type: "warning",
        confirmButtonText: "确认删除",
        cancelButtonText: "取消"
      }
    );
    const fallbackSelectedId =
      selectedId.value === node.id ? node.parentId || "" : selectedId.value;
    const response = await deleteSystemNodes({
      ids: [node.id]
    });
    console.log("[search-nav/navigation] systemNodes.delete:", response);
    selectedId.value = fallbackSelectedId;
    message("已删除系统节点", { type: "success" });
    await fetchSystemNodeTree(true);
    await fetchSystemNodeDetailData();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    console.error("[search-nav/navigation] systemNodes.delete failed:", error);
    message("删除系统节点失败", { type: "error" });
  }
}

async function submitImport() {
  const raw = importText.value.trim();
  if (!raw) {
    message("请输入系统节点 JSON", { type: "warning" });
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    const payload = normalizeImportPayload(parsed);
    const response = await importSystemNodes(payload);
    console.log("[search-nav/navigation] systemNodes.import:", response);
    resetImportDialog();
    message("已导入系统节点", { type: "success" });
    await fetchSystemNodeTree(true);
    await fetchSystemNodeDetailData();
  } catch (error) {
    console.error("[search-nav/navigation] systemNodes.import failed:", error);
    message("导入系统节点失败，请检查 JSON 格式", { type: "error" });
  }
}

async function handleExport() {
  try {
    const response = await exportSystemNodes();
    console.log("[search-nav/navigation] systemNodes.export:", response);
    const exportData = response?.data ?? response ?? {};
    const content = JSON.stringify(exportData, null, 2);
    const blob = new Blob([content], {
      type: "application/json;charset=utf-8"
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `system-nodes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
    message("已导出系统节点 JSON", { type: "success" });
  } catch (error) {
    console.error("[search-nav/navigation] systemNodes.export failed:", error);
    message("导出系统节点失败", { type: "error" });
  }
}

function openDocs() {
  router.push("/handover/documents");
}

function openModels() {
  router.push("/handover/models");
}

function openViewer() {
  router.push("/visualization/3d-viewer");
}

function openRelationships() {
  router.push("/search-nav/relationships");
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
    console.error("[search-nav/navigation] document file load failed:", error);
    return null;
  }
}

async function openDocumentDetail(row) {
  if (!row?.id) {
    message("缺少文档ID，无法打开", { type: "warning" });
    return;
  }

  docDetailVisible.value = true;
  docDetailLoading.value = true;
  docDetail.value = null;
  docDetailError.value = "";
  cleanupDocPreviewUrl();

  try {
    const response = await getHandoverDocumentDetail(row.id);
    const data = response?.data ?? response ?? {};
    const detail = normalizeHandoverDocumentRecord(data);
    const blob = await resolveDocumentBlob(detail);
    if (blob) {
      const { url, revoke } = createHandoverDocumentObjectUrl(blob);
      detail.url = url;
      revokeDocPreviewUrl = revoke;
    }

    docDetail.value = detail;
    console.log("[search-nav/navigation] document detail:", detail);
  } catch (error) {
    console.error("[search-nav/navigation] document detail failed:", error);
    docDetailError.value = error?.message || "加载文档详情失败";
    message("加载文档详情失败", { type: "error" });
  } finally {
    docDetailLoading.value = false;
  }
}

async function downloadDocument(row = docDetail.value) {
  if (!row?.id) return;

  try {
    const blob = await resolveDocumentBlob(row);
    if (!blob) {
      message("未获取到文档文件", { type: "warning" });
      return;
    }
    triggerHandoverDocumentDownload(blob, row.name || "document");
    message("已开始下载文档", { type: "success" });
  } catch (error) {
    console.error("[search-nav/navigation] document download failed:", error);
    message("文档下载失败", { type: "error" });
  }
}

async function openModelPreview(row) {
  if (!row?.id) {
    message("缺少模型ID，无法打开", { type: "warning" });
    return;
  }

  modelPreviewVisible.value = true;
  modelPreviewLoading.value = true;
  modelDetail.value = null;
  modelPreviewRow.value = row;
  modelDetailError.value = "";

  try {
    const response = await getHandoverModelDetail({ id: row.id });
    const data = response?.data ?? response ?? {};
    modelDetail.value = {
      ...data,
      meta: data?.meta || {}
    };
    console.log("[search-nav/navigation] model detail:", modelDetail.value);
  } catch (error) {
    console.error("[search-nav/navigation] model detail failed:", error);
    modelDetailError.value = error?.message || "加载模型详情失败";
    message("加载模型详情失败", { type: "error" });
  } finally {
    modelPreviewLoading.value = false;
  }
}

function downloadModel(row = modelDetail.value) {
  const url =
    (typeof row?.url === "string" && row.url.trim()) ||
    (typeof modelPreviewRow.value?.url === "string" &&
    modelPreviewRow.value.url.trim()
      ? modelPreviewRow.value.url.trim()
      : "");

  if (!url) {
    message("当前模型没有可用下载地址", { type: "warning" });
    return;
  }

  triggerDownload(url, row?.name || modelPreviewRow.value?.name || "model");
  message("已开始下载模型", { type: "success" });
}

function openSmartSearch() {
  const q =
    related.value.kksRoot && related.value.kksRoot !== "-"
      ? related.value.kksRoot
      : selectedLabel.value;
  router.push({
    path: "/search-nav/search",
    query: { q, nodeId: selectedId.value }
  });
}

function locateKks() {
  console.log("[search-nav/navigation] locate kks:", related.value.kksRoot);
  message(`已定位：${related.value.kksRoot}`, { type: "success" });
}

onMounted(async () => {
  applyQuery();
  await fetchSystemNodeTree();
  await fetchSystemNodeDetailData();
});

watch(
  () => route.query?.nodeId,
  async () => {
    applyQuery();
    await fetchSystemNodeDetailData();
  }
);

watch(
  () => [treeData.value, expandedKeys.value, selectedId.value],
  async () => {
    await restoreTreeUiState();
  },
  { deep: true }
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
    <el-row :gutter="16">
      <el-col :xs="24" :lg="8" class="mb-4">
        <el-card shadow="never">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <div class="font-semibold">系统/专业树</div>
              <el-space wrap>
                <el-button size="small" type="primary" @click="openCreateRoot">
                  新增根节点
                </el-button>
                <el-button size="small" @click="importVisible = true">
                  导入
                </el-button>
                <el-button size="small" @click="handleExport">导出</el-button>
              </el-space>
            </div>
          </template>

          <el-tree
            ref="treeRef"
            v-loading="treeLoading"
            :data="treeData"
            node-key="id"
            :default-expanded-keys="expandedKeys"
            :current-node-key="selectedId"
            highlight-current
            @node-click="handleNodeClick"
            @node-expand="handleNodeExpand"
            @node-collapse="handleNodeCollapse"
          >
            <template #default="{ data }">
              <div class="flex items-center justify-between w-full gap-2 pr-1">
                <span class="truncate">{{ data.label }}</span>
                <el-space wrap>
                  <el-button
                    size="small"
                    text
                    @click.stop="openCreateChild(data)"
                  >
                    新增
                  </el-button>
                  <el-button size="small" text @click.stop="openRename(data)">
                    重命名
                  </el-button>
                  <el-button size="small" text @click.stop="openMove(data)">
                    移动
                  </el-button>
                  <el-button
                    size="small"
                    text
                    type="danger"
                    @click.stop="removeNode(data)"
                  >
                    删除
                  </el-button>
                </el-space>
              </div>
            </template>
          </el-tree>

          <div class="text-xs text-[var(--el-text-color-secondary)] mt-3">
            说明：当前模块已覆盖系统节点查询、创建、重命名、移动、删除、导入、导出。
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="16" class="mb-4">
        <el-card v-loading="detailLoading" shadow="never" class="mb-4">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="font-semibold truncate">
                当前节点：{{ selectedLabel || "未选择节点" }}
              </div>
              <el-space wrap>
                <el-button @click="locateKks">定位KKS</el-button>
                <el-button @click="openSmartSearch">关联搜索</el-button>
                <el-button @click="openRelationships">查看关联关系</el-button>
              </el-space>
            </div>
          </template>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <span class="font-semibold">元数据ID：</span>{{ related.metaId }}
            </div>
            <div>
              <span class="font-semibold">系统节点ID：</span>
              {{ related.systemNodeId }}
            </div>
            <div>
              <span class="font-semibold">系统名称：</span>
              {{ related.systemName }}
            </div>
            <div>
              <span class="font-semibold">KKS根编码：</span>
              {{ related.kksRoot }}
            </div>
            <div>
              <span class="font-semibold">专业：</span>{{ related.discipline }}
            </div>
            <div>
              <span class="font-semibold">范围：</span>{{ related.scope }}
            </div>
            <div>
              <span class="font-semibold">负责人：</span>{{ related.owner }}
            </div>
            <div>
              <span class="font-semibold">创建人：</span>{{ related.createdBy }}
            </div>
            <div>
              <span class="font-semibold">创建时间：</span>
              {{ related.createdAt }}
            </div>
            <div>
              <span class="font-semibold">更新人：</span>
              {{ related.updatedBy }}
            </div>
            <div class="md:col-span-2">
              <span class="font-semibold">更新时间：</span>
              {{ related.updatedAt }}
            </div>
            <div class="md:col-span-2">
              <span class="font-semibold">描述：</span>
              <span class="text-[var(--el-text-color-secondary)]">
                {{ related.description }}
              </span>
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="mb-4">
          <template #header>
            <div class="font-semibold">关联关系</div>
          </template>
          <el-table :data="related.relations" stripe>
            <el-table-column prop="type" label="关系类型" width="140" />
            <el-table-column label="来源">
              <template #default="{ row }">
                {{ row.sourceKind || "-" }} / {{ row.sourceId || "-" }}
              </template>
            </el-table-column>
            <el-table-column label="目标">
              <template #default="{ row }">
                {{ row.targetKind || "-" }} / {{ row.targetId || "-" }}
              </template>
            </el-table-column>
            <el-table-column prop="updatedAt" label="更新时间" width="180" />
            <el-table-column label="操作" width="160">
              <template #default="{ row }">
                <el-space>
                  <el-button
                    v-if="row.targetKind === 'doc'"
                    text
                    type="primary"
                    @click="openDocumentDetail({ id: row.targetId })"
                  >
                    打开文档
                  </el-button>
                  <el-button
                    v-if="row.targetKind === 'model'"
                    text
                    type="primary"
                    @click="openModelPreview({ id: row.targetId })"
                  >
                    预览模型
                  </el-button>
                </el-space>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card shadow="never" class="mb-4">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="font-semibold">关联文档</div>
              <el-button text type="primary" @click="openDocs">
                进入文档管理
              </el-button>
            </div>
          </template>
          <el-table :data="related.docs" stripe>
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="type" label="类型" width="120" />
            <el-table-column prop="relationId" label="关系ID" width="220" />
            <el-table-column label="操作" width="180">
              <template #default="{ row }">
                <el-space>
                  <el-button
                    text
                    type="primary"
                    @click="openDocumentDetail(row)"
                  >
                    查看
                  </el-button>
                  <el-button text @click="downloadDocument(row)"
                    >下载</el-button
                  >
                </el-space>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card shadow="never" class="mb-4">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="font-semibold">关联模型</div>
              <el-space>
                <el-button text type="primary" @click="openModels">
                  进入模型管理
                </el-button>
                <el-button text type="primary" @click="openViewer">
                  三维查看
                </el-button>
              </el-space>
            </div>
          </template>
          <el-table :data="related.models" stripe>
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="lod" label="精度" width="120" />
            <el-table-column prop="relationId" label="关系ID" width="220" />
            <el-table-column label="操作" width="180">
              <template #default="{ row }">
                <el-space>
                  <el-button text type="primary" @click="openModelPreview(row)">
                    预览
                  </el-button>
                  <el-button text @click="downloadModel(row)">下载</el-button>
                </el-space>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <div class="font-semibold">关联设备</div>
          </template>
          <el-table :data="related.devices" stripe>
            <el-table-column prop="kks" label="KKS编码" width="180" />
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="status" label="状态" width="120" />
            <el-table-column prop="relationId" label="关系ID" width="220" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>

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
            class="rounded overflow-hidden border border-[var(--el-border-color)] bg-[var(--el-fill-color-lighter)] p-4 text-center"
          >
            <img
              :src="docPreviewUrl"
              :alt="docDetail.name || 'document'"
              class="max-w-full max-h-[640px] inline-block"
            />
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
          <el-button
            v-if="docDetail"
            type="primary"
            @click="downloadDocument()"
          >
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
            {{ modelDetail.name || modelPreviewRow?.name || "-" }}
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
            :model-name="modelDetail?.name || modelPreviewRow?.name || ''"
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
          <el-button v-if="modelDetail" type="primary" @click="downloadModel()">
            下载
          </el-button>
        </el-space>
      </template>
    </el-dialog>

    <el-dialog
      v-model="editVisible"
      :title="editMode === 'create' ? '新增系统节点' : '重命名系统节点'"
      width="560px"
    >
      <el-form
        ref="editFormRef"
        :model="editForm"
        :rules="editRules"
        label-width="90px"
      >
        <el-form-item label="节点名称" prop="name">
          <el-input v-model="editForm.name" placeholder="请输入节点名称" />
        </el-form-item>
        <template v-if="editMode === 'create'">
          <el-form-item label="节点编码" prop="code">
            <el-input v-model="editForm.code" placeholder="请输入节点编码" />
          </el-form-item>
          <el-form-item label="节点类型" prop="type">
            <el-input v-model="editForm.type" placeholder="请输入节点类型" />
          </el-form-item>
          <el-form-item label="描述" prop="description">
            <el-input
              v-model="editForm.description"
              type="textarea"
              :rows="3"
              placeholder="请输入节点描述"
            />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-space>
          <el-button @click="editVisible = false">取消</el-button>
          <el-button type="primary" @click="submitNodeEdit">保存</el-button>
        </el-space>
      </template>
    </el-dialog>

    <el-dialog v-model="moveVisible" title="移动系统节点" width="560px">
      <div class="mb-3 text-sm">
        当前节点：{{ moveTargetNode?.label || "-" }}
      </div>
      <el-select
        v-model="moveTargetParentId"
        class="w-full"
        filterable
        placeholder="请选择目标父节点"
      >
        <el-option
          v-for="item in moveTargetOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <template #footer>
        <el-space>
          <el-button @click="moveVisible = false">取消</el-button>
          <el-button type="primary" @click="submitMove">确定</el-button>
        </el-space>
      </template>
    </el-dialog>

    <el-dialog
      v-model="importVisible"
      title="导入系统节点 JSON"
      width="720px"
      @closed="resetImportDialog"
    >
      <el-upload
        class="mb-3"
        action="#"
        accept=".json,application/json"
        :auto-upload="false"
        :limit="1"
        :file-list="importFileList"
        :on-change="handleImportFileChange"
      >
        <el-button>选择 JSON 文件</el-button>
      </el-upload>
      <el-input
        v-model="importText"
        type="textarea"
        :rows="12"
        placeholder='请输入或粘贴 JSON，支持 {"nodes":[...]} 或导出文件内容'
      />
      <template #footer>
        <el-space>
          <el-button @click="resetImportDialog">取消</el-button>
          <el-button type="primary" @click="submitImport">导入</el-button>
        </el-space>
      </template>
    </el-dialog>
  </div>
</template>
