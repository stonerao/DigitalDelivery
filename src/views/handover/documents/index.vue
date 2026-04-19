<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from "vue";
import { ElMessageBox } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import { message } from "@/utils/message";
import { useUserStoreHook } from "@/store/modules/user";
import { useDdLinkageStoreHook } from "@/store/modules/ddLinkage";
import { getHandoverSystemNodeOptions } from "@/api/handoverDictionary";
import { getHandoverKksList } from "@/api/handoverData";
import UploadDialog from "../components/UploadDialog.vue";
import FilePreview from "./components/FilePreview.vue";
import {
  batchDownloadHandoverDocuments,
  createHandoverDocFolder,
  deleteHandoverDocFolder,
  deleteHandoverDocuments,
  downloadHandoverDocumentFile,
  exportHandoverDocFolder,
  getHandoverDocumentDetail,
  getHandoverDocumentList,
  getHandoverDocumentVersions,
  getHandoverDocFolderTree,
  importHandoverDocFolder,
  moveHandoverDocFolder,
  moveHandoverDocuments,
  purgeHandoverDocuments,
  renameHandoverDocFolder,
  restoreHandoverDocuments,
  rollbackHandoverDocumentVersion,
  updateHandoverDocument,
  uploadHandoverDocument,
  uploadHandoverDocumentVersion
} from "@/api/handoverDocuments";
import {
  triggerHandoverDocumentDownload,
  isHandoverDocumentPreviewable,
  normalizeHandoverDocumentRecord,
  unwrapHandoverDocumentFileResponse
} from "@/utils/handoverDocument";

defineOptions({
  name: "HandoverDocuments"
});

const userStore = useUserStoreHook();

const currentUser = computed(() => {
  return userStore?.nickname || userStore?.username || "当前用户";
});

const route = useRoute();
const router = useRouter();
const ddStore = useDdLinkageStoreHook();

const keyword = ref("");
const searchMode = ref("fuzzy");
const typeFilters = ref([]);
const updatedRange = ref([]);
const kksKeyword = ref("");
const nodeIdFilter = ref("");
const showRecycleBin = ref(false);

const selectedFolderId = ref("root");
const highlightId = ref("");
const tableRef = ref(null);
const tableLoading = ref(false);
const documents = ref([]);
const pagination = ref({
  page: 1,
  size: 20,
  total: 0,
  totalPages: 0
});
const nodeOptions = ref([]);
const nodeTreeOptions = ref([]);
const kksOptions = ref([]);
const folderTreeData = ref([
  {
    id: "root",
    label: "全部文档",
    parentId: "",
    children: []
  }
]);

const ROOT_FOLDER_ID = "root";
const folderTreeMenuVisible = ref(false);
const folderTreeMenuNode = ref(null);
const folderTreeMenuStyle = ref({
  left: "0px",
  top: "0px"
});

function unwrapData(resp) {
  return resp?.data ?? resp ?? {};
}

function isApiSuccess(response) {
  return (
    response?.success === true || response?.code === 200 || response?.code === 0
  );
}

function unwrapApiData(response, fallbackMessage) {
  if (!isApiSuccess(response)) {
    throw new Error(response?.message || fallbackMessage);
  }
  return response?.data;
}

function readRecords(data) {
  return Array.isArray(data?.records) ? data.records : [];
}

function readOptionList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.options)) return data.options;
  if (Array.isArray(data?.list)) return data.list;
  return [];
}

function normalizeDocument(item) {
  return normalizeHandoverDocumentRecord(item);
}

function normalizeOption(item) {
  const value = item?.value ?? item?.id ?? item?.nodeId ?? item?.kks;
  const label = item?.label ?? item?.name ?? item?.title ?? item?.kks;
  return value && label
    ? {
        label: String(label),
        value: String(value)
      }
    : null;
}

function normalizeNodeTreeOption(item) {
  const value = item?.value ?? item?.id ?? item?.nodeId ?? item?.kks;
  const label = item?.label ?? item?.name ?? item?.title ?? item?.kks;
  if (!value || !label) return null;
  return {
    value: String(value),
    label: String(label),
    parentId: String(item?.parentId ?? item?.parentNodeId ?? "").trim(),
    children: Array.isArray(item?.children)
      ? item.children.map(normalizeNodeTreeOption).filter(Boolean)
      : []
  };
}

function flattenNodeTreeOptions(nodes = [], result = []) {
  nodes.forEach(node => {
    result.push({
      label: node.label,
      value: node.value
    });
    if (Array.isArray(node.children) && node.children.length > 0) {
      flattenNodeTreeOptions(node.children, result);
    }
  });
  return result;
}

function buildNodeTreeOptions(items = []) {
  const normalized = items.map(normalizeNodeTreeOption).filter(Boolean);
  if (!normalized.length) return [];
  if (
    normalized.some(
      item => Array.isArray(item.children) && item.children.length
    )
  ) {
    return normalized;
  }

  const nodeMap = new Map(
    normalized.map(item => [
      item.value,
      {
        ...item,
        children: []
      }
    ])
  );
  const roots = [];

  nodeMap.forEach(node => {
    const parentId = String(node.parentId || "").trim();
    if (parentId && nodeMap.has(parentId) && parentId !== node.value) {
      nodeMap.get(parentId).children.push(node);
      return;
    }
    roots.push(node);
  });

  return roots;
}

function getNodeLabel(nodeId) {
  const hit = nodeOptions.value.find(item => item.value === nodeId);
  return hit?.label || ddStore.getNodeLabel(nodeId);
}

function findFolderLabel(nodes = [], targetId = "") {
  for (const node of nodes) {
    if (node.id === targetId) return node.label;
    if (Array.isArray(node.children) && node.children.length > 0) {
      const childLabel = findFolderLabel(node.children, targetId);
      if (childLabel) return childLabel;
    }
  }
  return "";
}

function findFolderNode(nodes = [], targetId = "") {
  for (const node of nodes) {
    if (node.id === targetId) return node;
    if (Array.isArray(node.children) && node.children.length > 0) {
      const childNode = findFolderNode(node.children, targetId);
      if (childNode) return childNode;
    }
  }
  return null;
}

function collectDescendantIds(node, result = new Set()) {
  if (!node || !Array.isArray(node.children)) return result;
  node.children.forEach(child => {
    result.add(child.id);
    collectDescendantIds(child, result);
  });
  return result;
}

function isFolderProtected(node) {
  return !node || node.id === ROOT_FOLDER_ID || Boolean(node.isDefault);
}

function getFolderDropParentId(dropNode, dropType) {
  if (dropType === "inside") {
    return dropNode?.data?.id || ROOT_FOLDER_ID;
  }
  return dropNode?.data?.parentId || ROOT_FOLDER_ID;
}

async function loadDictionaries() {
  try {
    const [nodeRes, kksRes] = await Promise.all([
      getHandoverSystemNodeOptions(),
      getHandoverKksList({
        page: 1,
        size: 1000
      })
    ]);
    const rawNodeOptions = readOptionList(nodeRes?.data);
    nodeTreeOptions.value = buildNodeTreeOptions(rawNodeOptions);
    nodeOptions.value = flattenNodeTreeOptions(nodeTreeOptions.value, []);
    kksOptions.value = readRecords(kksRes?.data)
      .map(item => {
        const value = String(item?.kks || "").trim();
        if (!value) return null;
        const name = String(item?.name || "").trim();
        return {
          value,
          label: name ? `${value} / ${name}` : value
        };
      })
      .filter(Boolean);
  } catch (error) {
    nodeOptions.value = [];
    nodeTreeOptions.value = [];
    kksOptions.value = [];
    message(error?.message || "加载对象字典失败", { type: "error" });
  }
}

function normalizeFolderNode(node) {
  if (!node) return null;
  return {
    id: node.id,
    label: node.name || node.label || "未命名目录",
    parentId: node.parentId || "",
    isDefault: Boolean(node.isDefault),
    children: Array.isArray(node.children)
      ? node.children.map(normalizeFolderNode).filter(Boolean)
      : []
  };
}

async function loadFolders() {
  try {
    const res = await getHandoverDocFolderTree();
    const data = unwrapData(res);
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.folders)
        ? data.folders
        : [];
    const normalized = list.map(normalizeFolderNode).filter(Boolean);
    if (normalized.length) {
      folderTreeData.value = normalized;
      if (!findFolderNode(normalized, selectedFolderId.value)) {
        selectedFolderId.value = ROOT_FOLDER_ID;
      }
      return;
    }
  } catch (error) {
    console.error("load folders failed", error);
  }
  folderTreeData.value = [
    {
      id: ROOT_FOLDER_ID,
      label: "全部文档",
      parentId: "",
      children: []
    }
  ];
}

async function loadDocuments(showMessage = false) {
  tableLoading.value = true;
  try {
    const [start, end] = Array.isArray(updatedRange.value)
      ? updatedRange.value
      : [];
    const params = {
      keyword: keyword.value.trim() || undefined,
      searchMode: searchMode.value || undefined,
      types: typeFilters.value?.length ? typeFilters.value : undefined,
      updatedFrom: start || undefined,
      updatedTo: end || undefined,
      kksKeyword: kksKeyword.value.trim() || undefined,
      nodeId: nodeIdFilter.value || undefined,
      folderId: selectedFolderId.value || "root",
      recycleBin: showRecycleBin.value,
      page: pagination.value.page,
      size: pagination.value.size
    };

    const res = await getHandoverDocumentList(params);
    const data = unwrapApiData(res, "获取文档列表失败");
    documents.value = readRecords(data).map(normalizeDocument);
    pagination.value.total = Number(data?.total || 0);
    pagination.value.page = Number(data?.page || pagination.value.page || 1);
    pagination.value.size = Number(data?.size || pagination.value.size || 20);
    pagination.value.totalPages = Number(data?.totalPages || 0);
    if (
      pagination.value.totalPages > 0 &&
      pagination.value.page > pagination.value.totalPages
    ) {
      pagination.value.page = pagination.value.totalPages;
      await loadDocuments(showMessage);
      return;
    }
    if (showMessage) message("已应用筛选条件", { type: "success" });
  } catch (error) {
    console.error("load documents failed", error);
    documents.value = [];
    pagination.value.total = 0;
    pagination.value.totalPages = 0;
    message(error?.message || "获取文档列表失败", { type: "error" });
  } finally {
    tableLoading.value = false;
  }
}

function applyQuery() {
  const q = route.query?.q;
  if (typeof q === "string") keyword.value = q;
}

async function locateById() {
  const id = route.query?.id;
  if (typeof id !== "string") return;
  const targetId = id.trim();
  if (!targetId) return;

  const row = (documents.value || []).find(item => item?.id === targetId);
  if (!row) {
    try {
      const res = await getHandoverDocumentDetail(targetId);
      const detail = normalizeDocument(unwrapApiData(res, "加载文档详情失败"));
      if (!detail?.id) return;
      highlightId.value = targetId;
      openPreview(detail);
    } catch (error) {
      console.error("locate document by id failed", error);
    }
    return;
  }

  highlightId.value = targetId;
  // 为了确保目标行可见，定位时优先清空关键字过滤
  keyword.value = "";
  openPreview(row);

  nextTick(() => {
    const idx = filteredData.value.findIndex(r => r.id === targetId);
    if (idx < 0) return;
    const el = tableRef.value?.$el;
    const wrap =
      el?.querySelector?.(".el-table__body-wrapper") ||
      el?.querySelector?.(".el-scrollbar__wrap") ||
      null;
    if (!wrap) return;
    const rowHeight = 48;
    wrap.scrollTop = Math.max(0, idx * rowHeight - rowHeight);
  });
}

onMounted(() => {
  applyQuery();
  loadDictionaries();
  loadFolders();
  loadDocuments().then(() => locateById());
  window.addEventListener("click", closeFolderContextMenu);
  window.addEventListener("contextmenu", closeFolderContextMenu);
  window.addEventListener("resize", closeFolderContextMenu);
  window.addEventListener("scroll", closeFolderContextMenu, true);
});

onBeforeUnmount(() => {
  window.removeEventListener("click", closeFolderContextMenu);
  window.removeEventListener("contextmenu", closeFolderContextMenu);
  window.removeEventListener("resize", closeFolderContextMenu);
  window.removeEventListener("scroll", closeFolderContextMenu, true);
});

watch(
  () => route.query?.q,
  () => {
    applyQuery();
    pagination.value.page = 1;
    loadDocuments();
  }
);

watch(
  () => route.query?.id,
  () => {
    locateById();
  }
);

watch(
  () => documents.value.length,
  () => {
    locateById();
  }
);

watch(
  () => showRecycleBin.value,
  () => {
    pagination.value.page = 1;
    loadDocuments();
  }
);

const filteredData = computed(() => {
  return documents.value || [];
});

function canPreviewRow(row) {
  return isHandoverDocumentPreviewable(row);
}

const selectedRows = ref([]);

function onSelectionChange(rows) {
  selectedRows.value = rows || [];
}

const isBatchZipping = ref(false);
const downloadProgressText = ref("");

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

function handleSearch() {
  pagination.value.page = 1;
  loadDocuments(true);
}

const uploadDialogVisible = ref(false);
function openUpload() {
  uploadDialogVisible.value = true;
}

async function onUploaded(payload) {
  const files = payload?.files ?? [];
  if (!files.length) return;

  const formData = new FormData();
  files.forEach(file => {
    const raw = file?.raw || file;
    if (raw instanceof Blob) {
      formData.append("files", raw, file?.name || raw.name || "file");
    }
  });
  formData.append("folderId", selectedFolderId.value || "root");
  (payload?.nodeIds || []).forEach(item => {
    if (item) formData.append("nodeIds", item);
  });
  (payload?.kksRefs || []).forEach(item => {
    if (item) formData.append("kksRefs", item);
  });
  if (payload?.transferDepth) {
    formData.append("transferDepth", payload.transferDepth);
  }

  try {
    await unwrapApiData(
      await uploadHandoverDocument({ data: formData }),
      "上传失败"
    );
    message(`已上传 ${files.length} 个文件（操作人：${currentUser.value}）`, {
      type: "success"
    });
    loadDocuments();
  } catch (error) {
    console.error("upload document failed", error);
    message(error?.message || "上传失败", { type: "error" });
  }
}

const previewVisible = ref(false);
const previewRow = ref(null);
const detailVisible = ref(false);
const detailLoading = ref(false);
const detailRow = ref(null);

async function openPreview(row) {
  previewRow.value = normalizeDocument(row);
  previewVisible.value = true;
}

async function openDetail(row) {
  if (!row?.id) return;
  detailVisible.value = true;
  detailLoading.value = true;
  try {
    const res = await getHandoverDocumentDetail(row.id);
    detailRow.value = normalizeDocument(unwrapApiData(res, "加载文档详情失败"));
  } catch (error) {
    detailRow.value = null;
    console.error("load document detail failed", error);
    message(error?.message || "加载文档详情失败", { type: "error" });
  } finally {
    detailLoading.value = false;
  }
}

function refreshDetailIfActive(documentId) {
  if (!detailVisible.value) return;
  if (String(detailRow.value?.id || "") !== String(documentId || "")) return;
  openDetail({ id: documentId });
}

function downloadRow(row) {
  downloadHandoverDocumentFile(row.id)
    .then(response => {
      return unwrapHandoverDocumentFileResponse(response, "下载文件失败");
    })
    .then(blob => {
      if (!triggerHandoverDocumentDownload(blob, row.name || "document")) {
        throw new Error("浏览器不支持当前下载方式");
      }
      message(`已开始下载：${row.name}`, { type: "success" });
    })
    .catch(error => {
      console.error("download document failed", error);
      message(error?.message || `下载失败：${row.name}`, { type: "error" });
    });
}

const renameVisible = ref(false);
const renameRow = ref(null);
const renameValue = ref("");
function openRename(row) {
  renameRow.value = row;
  renameValue.value = row.name;
  renameVisible.value = true;
}

function confirmRename() {
  const value = renameValue.value.trim();
  if (!value) {
    message("文件名不能为空", { type: "warning" });
    return;
  }
  updateHandoverDocument({ id: renameRow.value.id, name: value })
    .then(() => {
      renameVisible.value = false;
      message("已更新文件名", { type: "success" });
      refreshDetailIfActive(renameRow.value.id);
      loadDocuments();
    })
    .catch(error => {
      console.error("rename document failed", error);
      message("更新文件名失败", { type: "error" });
    });
}

const folderVisible = ref(false);
const folderName = ref("");
const folderParentId = ref(ROOT_FOLDER_ID);
function openNewFolder(parentNode) {
  folderName.value = "";
  folderParentId.value =
    parentNode?.id || selectedFolderId.value || ROOT_FOLDER_ID;
  folderVisible.value = true;
}

function confirmNewFolder() {
  const value = folderName.value.trim();
  if (!value) {
    message("文件夹名称不能为空", { type: "warning" });
    return;
  }
  createHandoverDocFolder({
    name: value,
    parentId: folderParentId.value || ROOT_FOLDER_ID
  })
    .then(() => {
      folderVisible.value = false;
      message(`已创建文件夹：${value}`, { type: "success" });
      return loadFolders();
    })
    .then(() => {
      selectedFolderId.value = folderParentId.value || ROOT_FOLDER_ID;
      loadDocuments();
    })
    .catch(error => {
      console.error("create folder failed", error);
      message("创建失败", { type: "error" });
    });
}

function batchAction() {
  const count = selectedRows.value.length;
  if (count === 0) {
    message("请先勾选要操作的文档", { type: "warning" });
    return;
  }
  message(`已选择 ${count} 项`, { type: "success" });
}

function batchDownload() {
  const rows = selectedRows.value || [];
  if (!rows.length) {
    message("请先勾选要下载的文档", { type: "warning" });
    return;
  }

  if (rows.length === 1) {
    downloadRow(rows[0]);
    return;
  }

  isBatchZipping.value = true;
  downloadProgressText.value = "正在准备批量下载…";
  batchDownloadHandoverDocuments({
    ids: rows.map(r => r.id)
  })
    .then(res => {
      const data = unwrapApiData(res, "批量下载失败");
      const url = data?.url || "";
      if (!url) throw new Error("后端未返回批量下载地址");
      const a = document.createElement("a");
      a.href = url;
      a.download = `documents_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      message("批量下载已开始", { type: "success" });
    })
    .catch(err => {
      message(err?.message || "批量下载失败", { type: "error" });
    })
    .finally(() => {
      isBatchZipping.value = false;
      downloadProgressText.value = "";
    });
}

function batchDelete() {
  const rows = selectedRows.value || [];
  if (!rows.length) {
    message("请先勾选要删除的文档", { type: "warning" });
    return;
  }
  deleteHandoverDocuments({ ids: rows.map(r => r.id) })
    .then(() => {
      selectedRows.value = [];
      message(`已移入回收站 ${rows.length} 项`, { type: "success" });
      loadDocuments();
    })
    .catch(error => {
      console.error("batch delete documents failed", error);
      message("批量删除失败", { type: "error" });
    });
}

function deleteRow(row) {
  deleteHandoverDocuments({ ids: [row.id] })
    .then(() => {
      message("已移入回收站", { type: "success" });
      loadDocuments();
    })
    .catch(error => {
      console.error("delete document failed", error);
      message("删除失败", { type: "error" });
    });
}

function restoreRow(row) {
  restoreHandoverDocuments({ ids: [row.id] })
    .then(() => {
      message("已恢复", { type: "success" });
      loadDocuments();
    })
    .catch(error => {
      console.error("restore document failed", error);
      message("恢复失败", { type: "error" });
    });
}

function purgeRow(row) {
  purgeHandoverDocuments({ ids: [row.id] })
    .then(() => {
      message("已彻底删除", { type: "success" });
      loadDocuments();
    })
    .catch(error => {
      console.error("purge document failed", error);
      message("彻底删除失败", { type: "error" });
    });
}

const assocVisible = ref(false);
const assocRow = ref(null);
const assocNodeIds = ref([]);
const assocKksRefs = ref([]);
function openAssociations(row) {
  assocRow.value = row;
  assocNodeIds.value = [...(row.nodeIds || [])];
  assocKksRefs.value = [...(row.kksRefs || [])];
  assocVisible.value = true;
}

function saveAssociations() {
  if (!assocRow.value) return;
  updateHandoverDocument({
    id: assocRow.value.id,
    nodeIds: [...assocNodeIds.value],
    kksRefs: [...assocKksRefs.value]
  })
    .then(() => {
      assocVisible.value = false;
      message("已更新关联关系", { type: "success" });
      refreshDetailIfActive(assocRow.value.id);
      loadDocuments();
    })
    .catch(error => {
      console.error("save associations failed", error);
      message("更新关联失败", { type: "error" });
    });
}

function jumpToNode(nodeId) {
  router.push({ path: "/search-nav/navigation", query: { nodeId } });
}

function jumpToRelationships() {
  router.push("/search-nav/relationships");
}

const versionsVisible = ref(false);
const versionsRow = ref(null);
function openVersions(row) {
  versionsRow.value = row;
  versionUploadNote.value = "";
  getHandoverDocumentVersions(row.id)
    .then(res => {
      const data = unwrapApiData(res, "加载版本列表失败");
      const versions = Array.isArray(data)
        ? data
        : Array.isArray(data?.records)
          ? data.records
          : [];
      versionsRow.value = { ...row, versions };
    })
    .catch(error => {
      console.error("load versions failed", error);
      message(error?.message || "加载版本列表失败", { type: "error" });
    });
  versionsVisible.value = true;
}

const versionUploadNote = ref("");

function rollbackVersion(ver) {
  if (!versionsRow.value || !ver?.id) return;
  rollbackHandoverDocumentVersion(versionsRow.value.id, { versionId: ver.id })
    .then(res => {
      unwrapApiData(res, "回滚失败");
      message("已回滚并设为当前版本", { type: "success" });
      refreshDetailIfActive(versionsRow.value.id);
      openVersions(versionsRow.value);
      loadDocuments();
    })
    .catch(error => {
      console.error("rollback version failed", error);
      message("回滚失败", { type: "error" });
    });
}

function addNewVersion(file) {
  const row = versionsRow.value;
  if (!row || !file) return;
  const raw = file?.raw || file;
  if (!(raw instanceof Blob)) {
    message("版本文件无效", { type: "warning" });
    return;
  }

  const formData = new FormData();
  formData.append("file", raw, file?.name || raw.name || "file");
  formData.append("documentId", row.id);
  if (versionUploadNote.value.trim()) {
    formData.append("note", versionUploadNote.value.trim());
  }

  uploadHandoverDocumentVersion({ data: formData })
    .then(res => {
      unwrapApiData(res, "新增版本失败");
      message("已新增版本", { type: "success" });
      versionUploadNote.value = "";
      refreshDetailIfActive(row.id);
      openVersions(row);
      loadDocuments();
    })
    .catch(error => {
      console.error("upload version failed", error);
      message(error?.message || "新增版本失败", { type: "error" });
    });
}

// 对象详情抽屉（统一入口：对象属性/关联资源/3D 跳转）
const objectVisible = ref(false);
const objectKind = ref("kks");
const objectId = ref("");
const objectTab = ref("props");

const objectTitle = computed(() => {
  if (objectKind.value === "node") return getNodeLabel(objectId.value);
  return ddStore.getKksLabel(objectId.value);
});

const objectNodeDetail = computed(() => {
  if (objectKind.value !== "node") return null;
  return ddStore.getNodeDetail(objectId.value);
});

const objectKksDetail = computed(() => {
  if (objectKind.value !== "kks") return null;
  return (ddStore.kksItems || []).find(x => x.kks === objectId.value) || null;
});

const objectDocs = computed(() => {
  if (objectKind.value === "node") {
    return (documents.value || []).filter(d =>
      (d.nodeIds || []).includes(objectId.value)
    );
  }
  return (documents.value || []).filter(d =>
    (d.kksRefs || []).includes(objectId.value)
  );
});

const objectModels = computed(() => {
  if (objectKind.value === "node")
    return ddStore.getModelsForNode(objectId.value);
  return ddStore.getModelsForKks(objectId.value);
});

function openObject(kind, id) {
  objectKind.value = kind;
  objectId.value = id;
  objectTab.value = "props";
  objectVisible.value = true;
}

function open3dViewer() {
  router.push("/visualization/3d-viewer");
}

function allowFolderDrag(node) {
  return !isFolderProtected(node?.data);
}

function allowFolderDrop(draggingNode, dropNode, dropType) {
  const dragId = draggingNode?.data?.id;
  const dropId = dropNode?.data?.id;
  if (!dragId || dragId === ROOT_FOLDER_ID || !dropId) return false;
  if (dropType !== "inside" && dropId === ROOT_FOLDER_ID) return false;

  const draggingFolder = findFolderNode(folderTreeData.value, dragId);
  if (!draggingFolder) return false;

  if (dropType === "inside" && dragId === dropId) return false;
  const descendantIds = collectDescendantIds(draggingFolder);
  if (dropType === "inside" && descendantIds.has(dropId)) return false;

  const targetParentId = getFolderDropParentId(dropNode, dropType);
  if (dragId === targetParentId) return false;
  if (descendantIds.has(targetParentId)) return false;
  return true;
}

function onFolderDrop(draggingNode, dropNode, dropType) {
  const dragId = draggingNode?.data?.id;
  if (!allowFolderDrop(draggingNode, dropNode, dropType)) {
    message("不支持拖拽到该位置", { type: "warning" });
    return;
  }

  const targetParentId = getFolderDropParentId(dropNode, dropType);

  moveHandoverDocFolder({
    id: dragId,
    targetParentId: targetParentId || ROOT_FOLDER_ID
  })
    .then(() => {
      message("已更新目录结构", { type: "success" });
      return loadFolders();
    })
    .then(() => {
      loadDocuments();
    })
    .catch(error => {
      console.error("move folder failed", error);
      message("目录移动失败", { type: "error" });
    });
}

function closeFolderContextMenu() {
  folderTreeMenuVisible.value = false;
  folderTreeMenuNode.value = null;
}

function openFolderContextMenu(event, node) {
  event.preventDefault();
  event.stopPropagation();
  folderTreeMenuNode.value = node;
  folderTreeMenuStyle.value = {
    left: `${event.clientX + 4}px`,
    top: `${event.clientY + 4}px`
  };
  folderTreeMenuVisible.value = true;
}

function onFolderClick(node) {
  closeFolderContextMenu();
  selectedFolderId.value = node?.id || ROOT_FOLDER_ID;
  pagination.value.page = 1;
  loadDocuments();
}

const folderRenameVisible = ref(false);
const folderRenameValue = ref("");
const folderActionNode = ref(null);

function openFolderRename(node) {
  closeFolderContextMenu();
  if (!node?.id || node.id === ROOT_FOLDER_ID) return;
  folderActionNode.value = node;
  folderRenameValue.value = node.label || "";
  folderRenameVisible.value = true;
}

function confirmFolderRename() {
  const folder = folderActionNode.value;
  const name = folderRenameValue.value.trim();
  if (!folder?.id) return;
  if (!name) {
    message("目录名称不能为空", { type: "warning" });
    return;
  }
  renameHandoverDocFolder({
    id: folder.id,
    name
  })
    .then(() => {
      folderRenameVisible.value = false;
      message("目录已重命名", { type: "success" });
      return loadFolders();
    })
    .catch(error => {
      console.error("rename folder failed", error);
      message(error?.message || "目录重命名失败", { type: "error" });
    });
}

const folderMoveVisible = ref(false);
const folderMoveNode = ref(null);
const folderMoveTargetParentId = ref(ROOT_FOLDER_ID);

function openFolderMove(node) {
  closeFolderContextMenu();
  if (isFolderProtected(node)) return;
  folderMoveNode.value = node;
  folderMoveTargetParentId.value = node?.parentId || ROOT_FOLDER_ID;
  folderMoveVisible.value = true;
}

function isValidFolderMoveTarget(targetId) {
  const folder = folderMoveNode.value;
  if (!folder?.id) return false;
  if (folder.id === targetId) return false;
  const currentNode = findFolderNode(folderTreeData.value, folder.id);
  const descendantIds = collectDescendantIds(currentNode);
  return !descendantIds.has(targetId);
}

function onFolderMoveTreeClick(node) {
  const targetId = node?.id || ROOT_FOLDER_ID;
  if (!isValidFolderMoveTarget(targetId)) {
    message("不能移动到当前目录或其子目录下", { type: "warning" });
    return;
  }
  folderMoveTargetParentId.value = targetId;
}

function confirmFolderMove() {
  const folder = folderMoveNode.value;
  const targetParentId = folderMoveTargetParentId.value || ROOT_FOLDER_ID;
  if (!folder?.id) return;
  if (!isValidFolderMoveTarget(targetParentId)) {
    message("请选择有效的目标目录", { type: "warning" });
    return;
  }

  moveHandoverDocFolder({
    id: folder.id,
    targetParentId
  })
    .then(() => {
      folderMoveVisible.value = false;
      message("目录已移动", { type: "success" });
      return loadFolders();
    })
    .then(() => {
      loadDocuments();
    })
    .catch(error => {
      console.error("move folder by dialog failed", error);
      message(error?.message || "目录移动失败", { type: "error" });
    });
}

async function removeFolder(node) {
  closeFolderContextMenu();
  if (isFolderProtected(node)) {
    message("默认目录不支持删除", { type: "warning" });
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确认删除目录“${node.label || "未命名目录"}”吗？`,
      "删除目录",
      {
        type: "warning",
        confirmButtonText: "删除",
        cancelButtonText: "取消"
      }
    );
    await deleteHandoverDocFolder({
      ids: [node.id]
    });
    if (selectedFolderId.value === node.id) {
      selectedFolderId.value = node.parentId || ROOT_FOLDER_ID;
    }
    message("目录已删除", { type: "success" });
    await loadFolders();
    loadDocuments();
  } catch (error) {
    if (error === "cancel" || error === "close" || error?.action === "cancel") {
      return;
    }
    console.error("delete folder failed", error);
    message(error?.message || "目录删除失败", { type: "error" });
  }
}

const importVisible = ref(false);
const importText = ref("");
function openImport() {
  importText.value = "";
  importVisible.value = true;
}

const moveVisible = ref(false);
const moveTargetFolderId = ref("root");
const moveTargetRows = ref([]);

function openMove(rows) {
  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  if (!list.length) {
    message("请选择要移动的文档", { type: "warning" });
    return;
  }
  moveTargetRows.value = list;
  moveTargetFolderId.value = selectedFolderId.value || "root";
  moveVisible.value = true;
}

function confirmMove() {
  const rows = moveTargetRows.value || [];
  const target = moveTargetFolderId.value || "root";
  if (!rows.length) {
    moveVisible.value = false;
    return;
  }
  moveHandoverDocuments({
    ids: rows.map(r => r.id),
    targetFolderId: target
  })
    .then(() => {
      moveVisible.value = false;
      message(`已移动 ${rows.length} 个文档`, { type: "success" });
      loadDocuments();
    })
    .catch(error => {
      console.error("move documents failed", error);
      message("移动失败", { type: "error" });
    });
}

function doImport() {
  try {
    const parsed = JSON.parse(importText.value || "{}");
    importHandoverDocFolder(parsed)
      .then(() => {
        message("导入成功", { type: "success" });
        importVisible.value = false;
        loadFolders();
      })
      .catch(error => {
        console.error("import folder json failed", error);
        message("导入失败", { type: "error" });
      });
  } catch {
    message("导入失败：请检查 JSON 格式", { type: "error" });
  }
}

async function doExport() {
  try {
    const res = await exportHandoverDocFolder();
    const data = unwrapData(res);
    const text = JSON.stringify(data || {}, null, 2);
    await navigator.clipboard.writeText(text);
    message("已复制目录结构 JSON 到剪贴板", { type: "success" });
  } catch {
    message("导出失败：无法写入剪贴板", { type: "warning" });
  }
}

function onPageChange(page) {
  pagination.value.page = Math.max(1, Number(page) || 1);
  loadDocuments();
}

function onPageSizeChange(size) {
  pagination.value.size = Number(size) || 20;
  pagination.value.page = 1;
  loadDocuments();
}

const docTypes = computed(() => {
  const set = new Set((documents.value || []).map(d => d.type).filter(Boolean));
  return Array.from(set.values()).sort();
});

const selectedFolderNode = computed(() => {
  return findFolderNode(
    folderTreeData.value,
    selectedFolderId.value || ROOT_FOLDER_ID
  );
});

const selectedFolderLabel = computed(() => {
  return (
    findFolderLabel(
      folderTreeData.value,
      selectedFolderId.value || ROOT_FOLDER_ID
    ) || "全部文档"
  );
});

const selectedFolderDocCount = computed(() => {
  return Number(pagination.value.total || 0);
});
</script>

<template>
  <div class="dd-page">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex flex-wrap gap-2">
        <el-button type="primary" @click="openUpload">上传文档</el-button>
        <el-button @click="openNewFolder()">新建文件夹</el-button>
        <el-button @click="doExport">导出目录(JSON)</el-button>
        <el-button @click="openImport">导入目录(JSON)</el-button>
        <el-button :loading="isBatchZipping" @click="batchDownload"
          >批量下载</el-button
        >
        <el-button @click="openMove(selectedRows)">批量移动</el-button>
        <el-button type="danger" plain @click="batchDelete">批量删除</el-button>
      </div>
      <div class="flex items-center gap-2">
        <el-switch v-model="showRecycleBin" active-text="回收站" />
        <div class="text-sm text-[var(--el-text-color-secondary)]">
          已选择 {{ selectedRows.length }} 项
        </div>
        <div
          v-if="downloadProgressText"
          class="text-xs text-[var(--el-text-color-secondary)]"
        >
          {{ downloadProgressText }}
        </div>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :xs="24" :lg="6" class="mb-4">
        <el-card shadow="never">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <div class="font-semibold">目录结构</div>
              <el-button text type="primary" @click="openNewFolder()">
                新建根目录
              </el-button>
            </div>
          </template>
          <el-tree
            :data="folderTreeData"
            node-key="id"
            default-expand-all
            highlight-current
            :current-node-key="selectedFolderId"
            draggable
            :allow-drag="allowFolderDrag"
            :allow-drop="allowFolderDrop"
            @node-click="onFolderClick"
            @node-drop="onFolderDrop"
          >
            <template #default="{ data }">
              <div
                class="folder-tree-node"
                @contextmenu="openFolderContextMenu($event, data)"
              >
                <span class="folder-tree-node__label" :title="data.label">
                  {{ data.label }}
                </span>
              </div>
            </template>
          </el-tree>
          <div
            v-if="folderTreeMenuVisible && folderTreeMenuNode"
            class="folder-tree-context-menu"
            :style="folderTreeMenuStyle"
            @click.stop
            @contextmenu.prevent
          >
            <button
              type="button"
              class="folder-tree-context-menu__item"
              @click="openNewFolder(folderTreeMenuNode)"
            >
              新建子目录
            </button>
            <button
              v-if="folderTreeMenuNode.id !== ROOT_FOLDER_ID"
              type="button"
              class="folder-tree-context-menu__item"
              @click="openFolderRename(folderTreeMenuNode)"
            >
              重命名
            </button>
            <button
              v-if="!isFolderProtected(folderTreeMenuNode)"
              type="button"
              class="folder-tree-context-menu__item"
              @click="openFolderMove(folderTreeMenuNode)"
            >
              移动
            </button>
            <button
              v-if="!isFolderProtected(folderTreeMenuNode)"
              type="button"
              class="folder-tree-context-menu__item folder-tree-context-menu__item--danger"
              @click="removeFolder(folderTreeMenuNode)"
            >
              删除
            </button>
          </div>
          <div
            class="mt-3 rounded-md bg-[var(--el-fill-color-light)] p-3 text-xs text-[var(--el-text-color-secondary)]"
          >
            <div>当前目录：{{ selectedFolderLabel }}</div>
            <div>当前目录文档数：{{ selectedFolderDocCount }}</div>
            <div>
              拖拽可调整层级，默认目录不允许删除；也可用“移动”进行精确调整。
            </div>
          </div>
          <div class="text-xs text-[var(--el-text-color-secondary)] mt-3">
            说明：目录已对接后端接口，支持导入/导出目录 JSON。
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="18" class="mb-4">
        <el-card shadow="never" class="mb-4">
          <template #header>
            <div class="font-semibold">高级检索</div>
          </template>
          <el-form :inline="true" class="flex flex-wrap gap-2">
            <el-form-item label="名称">
              <el-input
                v-model="keyword"
                placeholder="文档名称"
                clearable
                style="width: 220px"
                @keyup.enter="handleSearch"
              />
            </el-form-item>
            <el-form-item label="匹配">
              <el-select v-model="searchMode" style="width: 120px">
                <el-option label="模糊" value="fuzzy" />
                <el-option label="精确" value="exact" />
              </el-select>
            </el-form-item>
            <el-form-item label="类型">
              <el-select
                v-model="typeFilters"
                multiple
                collapse-tags
                collapse-tags-tooltip
                clearable
                style="width: 220px"
              >
                <el-option
                  v-for="t in docTypes"
                  :key="t"
                  :label="t"
                  :value="t"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="日期">
              <el-date-picker
                v-model="updatedRange"
                type="daterange"
                value-format="YYYY-MM-DD"
                range-separator="-"
                start-placeholder="开始"
                end-placeholder="结束"
              />
            </el-form-item>
            <el-form-item label="对象编码">
              <el-input
                v-model="kksKeyword"
                placeholder="KKS/对象编码"
                clearable
                style="width: 200px"
              />
            </el-form-item>
            <el-form-item label="关联系统">
              <el-select
                v-model="nodeIdFilter"
                clearable
                filterable
                style="width: 220px"
              >
                <el-option
                  v-for="i in nodeOptions"
                  :key="i.value"
                  :label="i.label"
                  :value="i.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-space wrap>
                <el-button type="primary" @click="handleSearch">应用</el-button>
                <el-button @click="jumpToRelationships">关联关系</el-button>
              </el-space>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="font-semibold">
                文档列表
                <span class="text-xs text-[var(--el-text-color-secondary)]">
                  （共 {{ pagination.total }} 条）
                </span>
              </div>
              <div class="text-xs text-[var(--el-text-color-secondary)]">
                当前目录：{{ selectedFolderLabel }}
              </div>
            </div>
          </template>

          <el-table
            ref="tableRef"
            v-loading="tableLoading"
            :data="filteredData"
            row-key="id"
            :row-class-name="
              ({ row }) => (row?.id === highlightId ? 'dd-row-highlight' : '')
            "
            @selection-change="onSelectionChange"
          >
            <el-table-column type="selection" width="46" />
            <el-table-column label="名称" min-width="280" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="flex items-center gap-2 min-w-0">
                  <el-tag size="small" effect="plain">{{ row.type }}</el-tag>
                  <span class="truncate">{{ row.name }}</span>
                  <el-tag v-if="row.deletedAt" type="danger" size="small"
                    >回收站</el-tag
                  >
                </div>
              </template>
            </el-table-column>
            <el-table-column label="对象编码" min-width="220">
              <template #default="{ row }">
                <div class="flex flex-wrap gap-1">
                  <el-tag
                    v-for="k in row.kksRefs || []"
                    :key="k"
                    size="small"
                    effect="plain"
                    class="cursor-pointer"
                    @click="openObject('kks', k)"
                    >{{ k }}</el-tag
                  >
                </div>
              </template>
            </el-table-column>
            <el-table-column label="关联系统" min-width="220">
              <template #default="{ row }">
                <div class="flex flex-wrap gap-1">
                  <el-tag
                    v-for="n in row.nodeIds || []"
                    :key="n"
                    size="small"
                    effect="plain"
                    class="cursor-pointer"
                    @click="jumpToNode(n)"
                    >{{ getNodeLabel(n) }}</el-tag
                  >
                </div>
              </template>
            </el-table-column>
            <el-table-column label="大小" width="140">
              <template #default="{ row }">{{ formatSize(row.size) }}</template>
            </el-table-column>
            <el-table-column prop="updatedAt" label="修改日期" width="120" />
            <el-table-column label="操作" width="360" fixed="right">
              <template #default="{ row }">
                <el-space wrap>
                  <el-button text @click="openDetail(row)">详情</el-button>
                  <el-button
                    text
                    type="primary"
                    :disabled="!canPreviewRow(row)"
                    @click="openPreview(row)"
                    >预览</el-button
                  >
                  <el-button text @click="downloadRow(row)">下载</el-button>
                  <el-button text @click="openAssociations(row)"
                    >关联</el-button
                  >
                  <el-button text @click="openVersions(row)">版本</el-button>
                  <el-button v-if="!row.deletedAt" text @click="openMove(row)"
                    >移动</el-button
                  >
                  <el-button v-if="!row.deletedAt" text @click="openRename(row)"
                    >重命名</el-button
                  >
                  <el-button
                    v-if="!row.deletedAt"
                    text
                    type="danger"
                    @click="deleteRow(row)"
                    >删除</el-button
                  >
                  <el-button
                    v-if="row.deletedAt"
                    text
                    type="primary"
                    @click="restoreRow(row)"
                    >恢复</el-button
                  >
                  <el-button
                    v-if="row.deletedAt"
                    text
                    type="danger"
                    @click="purgeRow(row)"
                    >彻底删除</el-button
                  >
                </el-space>
              </template>
            </el-table-column>
          </el-table>
          <div class="mt-4 flex justify-end">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next"
              :total="pagination.total"
              :current-page="pagination.page"
              :page-size="pagination.size"
              :page-sizes="[20, 50, 100]"
              @current-change="onPageChange"
              @size-change="onPageSizeChange"
            />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <UploadDialog
      v-model="uploadDialogVisible"
      title="上传文档"
      :show-associations="true"
      :current-folder-label="selectedFolderLabel"
      :node-tree-data="nodeTreeOptions"
      :kks-options="kksOptions"
      @uploaded="onUploaded"
    />

    <FilePreview
      v-model:visible="previewVisible"
      :row="previewRow"
      @download="downloadRow"
    />

    <el-drawer v-model="detailVisible" title="文档详情" size="560px">
      <div v-loading="detailLoading" class="grid gap-4">
        <template v-if="detailRow">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-base font-semibold truncate">
                {{ detailRow.name }}
              </div>
              <div class="text-sm text-[var(--el-text-color-secondary)] mt-1">
                类型：{{ detailRow.type }} | 大小：{{
                  formatSize(detailRow.size)
                }}
              </div>
            </div>
            <el-space wrap>
              <el-button type="primary" @click="openPreview(detailRow)">
                预览
              </el-button>
              <el-button @click="downloadRow(detailRow)">下载</el-button>
            </el-space>
          </div>

          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="创建时间">
              {{ detailRow.createdAt || "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="创建人">
              {{ detailRow.createdBy || "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="更新时间">
              {{ detailRow.updatedAt || "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="更新人">
              {{ detailRow.updatedBy || "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="所属目录">
              {{
                findFolderLabel(folderTreeData, detailRow.folderId || "root") ||
                detailRow.folderId ||
                "全部文档"
              }}
            </el-descriptions-item>
            <el-descriptions-item label="删除时间">
              {{ detailRow.deletedAt || "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="删除人">
              {{ detailRow.deletedBy || "-" }}
            </el-descriptions-item>
          </el-descriptions>

          <div>
            <div class="mb-2 font-semibold">关联系统</div>
            <div class="flex flex-wrap gap-2">
              <el-tag
                v-for="nodeId in detailRow.nodeIds || []"
                :key="nodeId"
                effect="plain"
              >
                {{ getNodeLabel(nodeId) }}
              </el-tag>
              <span
                v-if="!(detailRow.nodeIds || []).length"
                class="text-sm text-[var(--el-text-color-secondary)]"
              >
                未关联
              </span>
            </div>
          </div>

          <div>
            <div class="mb-2 font-semibold">对象编码</div>
            <div class="flex flex-wrap gap-2">
              <el-tag
                v-for="kks in detailRow.kksRefs || []"
                :key="kks"
                effect="plain"
              >
                {{ kks }}
              </el-tag>
              <span
                v-if="!(detailRow.kksRefs || []).length"
                class="text-sm text-[var(--el-text-color-secondary)]"
              >
                未关联
              </span>
            </div>
          </div>

          <div>
            <div class="mb-2 font-semibold">版本列表</div>
            <el-table :data="detailRow.versions || []" stripe size="small">
              <el-table-column prop="versionNumber" label="版本" width="70" />
              <el-table-column
                prop="uploadedAt"
                label="上传时间"
                min-width="160"
              />
              <el-table-column prop="uploadedBy" label="上传人" width="120" />
              <el-table-column prop="note" label="说明" min-width="160" />
            </el-table>
          </div>
        </template>
      </div>
    </el-drawer>

    <el-drawer v-model="objectVisible" :title="objectTitle" size="520px">
      <el-tabs v-model="objectTab">
        <el-tab-pane label="属性" name="props">
          <div v-if="objectKind === 'node' && objectNodeDetail" class="text-sm">
            <div class="mb-2">
              <span class="font-semibold">系统：</span
              >{{ objectNodeDetail.systemName }}
            </div>
            <div class="mb-2">
              <span class="font-semibold">专业：</span
              >{{ objectNodeDetail.discipline }}
            </div>
            <div class="mb-2">
              <span class="font-semibold">范围：</span
              >{{ objectNodeDetail.scope }}
            </div>
            <div class="mb-2">
              <span class="font-semibold">负责人：</span
              >{{ objectNodeDetail.owner }}
            </div>
            <div class="text-[var(--el-text-color-secondary)]">
              {{ objectNodeDetail.description }}
            </div>
          </div>
          <div
            v-else-if="objectKind === 'kks' && objectKksDetail"
            class="text-sm"
          >
            <div class="mb-2">
              <span class="font-semibold">编码：</span>{{ objectKksDetail.kks }}
            </div>
            <div class="mb-2">
              <span class="font-semibold">名称：</span
              >{{ objectKksDetail.name }}
            </div>
            <div class="mb-2">
              <span class="font-semibold">类型：</span
              >{{ objectKksDetail.type }}
            </div>
            <div class="mb-2">
              <span class="font-semibold">状态：</span
              >{{ objectKksDetail.status }}
            </div>
            <div class="mb-2">
              <span class="font-semibold">所属系统：</span
              >{{ getNodeLabel(objectKksDetail.nodeId) }}
            </div>
            <el-space wrap>
              <el-button
                type="primary"
                @click="
                  router.push({
                    path: '/search-nav/search',
                    query: { q: objectKksDetail.kks }
                  })
                "
                >综合搜索</el-button
              >
              <el-button type="primary" plain @click="open3dViewer"
                >3D查看</el-button
              >
            </el-space>
          </div>
          <div v-else class="text-[var(--el-text-color-secondary)]">
            暂无数据
          </div>
        </el-tab-pane>

        <el-tab-pane label="关联文档" name="docs">
          <el-table :data="objectDocs" stripe>
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="type" label="类型" width="120" />
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button
                  link
                  type="primary"
                  @click="
                    router.push({
                      path: '/handover/documents',
                      query: { id: row.id }
                    })
                  "
                  >打开</el-button
                >
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="关联模型" name="models">
          <el-table :data="objectModels" stripe>
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="lod" label="LOD" width="120" />
            <el-table-column label="操作" width="200">
              <template #default="{ row }">
                <el-space>
                  <el-button
                    link
                    type="primary"
                    @click="
                      router.push({
                        path: '/handover/models',
                        query: { id: row.id }
                      })
                    "
                    >打开</el-button
                  >
                  <el-button link type="primary" @click="open3dViewer"
                    >3D查看</el-button
                  >
                </el-space>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-drawer>

    <el-dialog v-model="assocVisible" title="对象编码关联" width="640px">
      <div v-if="assocRow" class="text-sm">
        <div class="mb-2">
          <span class="font-semibold">文档：</span>{{ assocRow.name }}
        </div>
        <el-form label-width="90px">
          <el-form-item label="关联系统">
            <el-tree-select
              v-model="assocNodeIds"
              :data="nodeTreeOptions"
              multiple
              show-checkbox
              check-strictly
              node-key="value"
              filterable
              class="w-full"
            />
          </el-form-item>
          <el-form-item label="对象编码">
            <el-select
              v-model="assocKksRefs"
              multiple
              filterable
              class="w-full"
            >
              <el-option
                v-for="i in kksOptions"
                :key="i.value"
                :label="i.label"
                :value="i.value"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-space>
          <el-button @click="assocVisible = false">取消</el-button>
          <el-button type="primary" @click="saveAssociations">保存</el-button>
        </el-space>
      </template>
    </el-dialog>

    <el-dialog v-model="versionsVisible" title="版本管理" width="720px">
      <div v-if="versionsRow" class="text-sm">
        <div class="mb-3">
          <span class="font-semibold">当前文档：</span>{{ versionsRow.name }}
        </div>
        <el-input
          v-model="versionUploadNote"
          class="mb-3"
          placeholder="请输入版本说明（可选）"
        />
        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          :on-change="file => addNewVersion(file)"
        >
          <el-button type="primary">上传新版本</el-button>
        </el-upload>
        <el-divider />
        <el-table :data="versionsRow.versions || []" stripe>
          <el-table-column prop="uploadedAt" label="时间" width="120" />
          <el-table-column prop="uploadedBy" label="操作人" width="120" />
          <el-table-column prop="name" label="文件" min-width="260" />
          <el-table-column label="大小" width="120">
            <template #default="{ row }">{{ formatSize(row.size) }}</template>
          </el-table-column>
          <el-table-column prop="note" label="备注" min-width="160" />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button
                text
                type="primary"
                :disabled="versionsRow?.versions?.[0]?.id === row.id"
                @click="rollbackVersion(row)"
                >回滚</el-button
              >
            </template>
          </el-table-column>
        </el-table>
        <div class="text-xs text-[var(--el-text-color-secondary)] mt-2">
          说明：版本对比（diff）需按文件类型实现（PDF/Office/DWG 不同方案）。
        </div>
      </div>
      <template #footer>
        <el-button @click="versionsVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="moveVisible" title="移动到目录" width="560px">
      <div class="text-sm">
        <div class="mb-2 text-[var(--el-text-color-secondary)]">
          已选择 {{ moveTargetRows.length }} 项
        </div>
        <el-tree
          :data="folderTreeData"
          node-key="id"
          default-expand-all
          highlight-current
          :current-node-key="moveTargetFolderId"
          @node-click="n => (moveTargetFolderId = n?.id || 'root')"
        />
      </div>
      <template #footer>
        <el-space>
          <el-button @click="moveVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmMove">确定</el-button>
        </el-space>
      </template>
    </el-dialog>

    <el-dialog v-model="folderMoveVisible" title="移动目录" width="560px">
      <div class="text-sm">
        <div class="mb-2 text-[var(--el-text-color-secondary)]">
          当前目录：{{ folderMoveNode?.label || "-" }}
        </div>
        <el-tree
          :data="folderTreeData"
          node-key="id"
          default-expand-all
          highlight-current
          :current-node-key="folderMoveTargetParentId"
          @node-click="onFolderMoveTreeClick"
        />
      </div>
      <template #footer>
        <el-space>
          <el-button @click="folderMoveVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmFolderMove">确定</el-button>
        </el-space>
      </template>
    </el-dialog>

    <el-dialog v-model="importVisible" title="导入目录结构(JSON)" width="720px">
      <el-input
        v-model="importText"
        type="textarea"
        :rows="10"
        placeholder='粘贴 JSON，例如：{"folders":[{"id":"root","label":"全部文档","parentId":"","order":0}]}'
      />
      <template #footer>
        <el-space>
          <el-button @click="importVisible = false">取消</el-button>
          <el-button type="primary" @click="doImport">导入</el-button>
        </el-space>
      </template>
    </el-dialog>

    <el-dialog v-model="renameVisible" title="编辑文件名" width="480px">
      <el-input v-model="renameValue" placeholder="请输入文件名" />
      <template #footer>
        <el-button @click="renameVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmRename">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="folderVisible" title="新建文件夹" width="480px">
      <div class="mb-3 text-sm text-[var(--el-text-color-secondary)]">
        上级目录：{{
          findFolderLabel(folderTreeData, folderParentId || ROOT_FOLDER_ID) ||
          "全部文档"
        }}
      </div>
      <el-input v-model="folderName" placeholder="请输入文件夹名称" />
      <template #footer>
        <el-button @click="folderVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmNewFolder">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="folderRenameVisible" title="重命名目录" width="480px">
      <el-input v-model="folderRenameValue" placeholder="请输入目录名称" />
      <template #footer>
        <el-button @click="folderRenameVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmFolderRename">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.dd-row-highlight td {
  background-color: var(--el-color-primary-light-9) !important;
}

.folder-tree-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.folder-tree-node__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-tree-context-menu {
  position: fixed;
  z-index: 2100;
  min-width: 140px;
  padding: 6px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: var(--el-bg-color-overlay);
  box-shadow: var(--el-box-shadow-light);
}

.folder-tree-context-menu__item {
  display: block;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--el-text-color-regular);
  text-align: left;
  cursor: pointer;
}

.folder-tree-context-menu__item:hover {
  background: var(--el-fill-color-light);
}

.folder-tree-context-menu__item--danger {
  color: var(--el-color-danger);
}
</style>
