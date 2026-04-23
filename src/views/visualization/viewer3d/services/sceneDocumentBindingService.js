export function createDefaultDocumentBindingPagination() {
  return {
    page: 1,
    size: 20,
    total: 0
  };
}

const DEFAULT_DOCUMENT_BINDING_FOLDER_ID = "root";
const DEFAULT_DOCUMENT_BINDING_FOLDER_LABEL = "全部文档";

export function createDefaultDocumentBindingFolderTree() {
  return [
    {
      id: DEFAULT_DOCUMENT_BINDING_FOLDER_ID,
      label: DEFAULT_DOCUMENT_BINDING_FOLDER_LABEL,
      parentId: "",
      isDefault: true,
      children: []
    }
  ];
}

function normalizeFolderId(value) {
  return (
    String(value || DEFAULT_DOCUMENT_BINDING_FOLDER_ID).trim() ||
    DEFAULT_DOCUMENT_BINDING_FOLDER_ID
  );
}

function normalizeDocumentBindingFolderNode(node) {
  if (!node || typeof node !== "object") return null;
  const id = String(node?.id || "").trim();
  if (!id) return null;
  return {
    id,
    label: String(node?.label || node?.name || "未命名目录").trim(),
    parentId: String(node?.parentId || "").trim(),
    isDefault: Boolean(node?.isDefault),
    children: Array.isArray(node?.children)
      ? node.children.map(normalizeDocumentBindingFolderNode).filter(Boolean)
      : []
  };
}

function readFolderTreeNodes(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.folders)) return data.folders;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.list)) return data.list;
  return [];
}

function findFolderNode(nodes = [], targetId = "") {
  const key = String(targetId || "").trim();
  if (!key) return null;
  for (const node of nodes) {
    if (node?.id === key) return node;
    const child = findFolderNode(node?.children || [], key);
    if (child) return child;
  }
  return null;
}

function collectFolderIds(nodes = [], result = []) {
  nodes.forEach(node => {
    const id = String(node?.id || "").trim();
    if (id) result.push(id);
    if (Array.isArray(node?.children) && node.children.length) {
      collectFolderIds(node.children, result);
    }
  });
  return result;
}

function uniqueValues(values = []) {
  return Array.from(
    new Set(values.map(item => String(item || "").trim()).filter(Boolean))
  );
}

function normalizeDocumentBindingFolderTree(data) {
  const normalized = readFolderTreeNodes(data)
    .map(normalizeDocumentBindingFolderNode)
    .filter(Boolean);
  if (!normalized.length) {
    return createDefaultDocumentBindingFolderTree();
  }
  if (findFolderNode(normalized, DEFAULT_DOCUMENT_BINDING_FOLDER_ID)) {
    return normalized;
  }
  return [
    {
      ...createDefaultDocumentBindingFolderTree()[0],
      children: normalized
    }
  ];
}

export async function loadDocumentBindingFolders({
  getFolderTree,
  unwrapApiData
}) {
  if (typeof getFolderTree !== "function") {
    return createDefaultDocumentBindingFolderTree();
  }
  const data = unwrapApiData(await getFolderTree(), "加载文档目录失败");
  return normalizeDocumentBindingFolderTree(data);
}

export function normalizeDocumentBindingOption(item) {
  const id = String(item?.id || "").trim();
  if (!id) return null;
  return {
    id,
    name: String(item?.name || item?.title || "").trim(),
    type: String(item?.type || "").trim(),
    size: Number(item?.size || 0),
    folderId: String(item?.folderId || "").trim(),
    updatedAt: String(item?.updatedAt || item?.uploadedAt || "").trim()
  };
}

export function mergeSelectedDocumentBindings(
  current = [],
  next = [],
  replaceIds = []
) {
  const replaceIdSet = new Set(
    replaceIds.map(item => String(item || "").trim()).filter(Boolean)
  );
  const mergedMap = new Map();
  current.forEach(item => {
    if (!replaceIdSet.has(item.id)) {
      mergedMap.set(item.id, item);
    }
  });
  next.forEach(item => {
    mergedMap.set(item.id, item);
  });
  return Array.from(mergedMap.values());
}

export function syncDocumentBindingTableSelection({
  tableRef,
  selectedDocuments = [],
  records = []
}) {
  const table = tableRef?.value || tableRef;
  if (!table) return;
  const selectedIdSet = new Set(selectedDocuments.map(item => item.id));
  table.clearSelection();
  records.forEach(row => {
    if (selectedIdSet.has(row.id)) {
      table.toggleRowSelection(row, true);
    }
  });
}

function createDocumentBindingListParams({
  keyword = "",
  folderId = DEFAULT_DOCUMENT_BINDING_FOLDER_ID,
  pagination
}) {
  return {
    searchMode: "fuzzy",
    keyword: keyword.trim() || undefined,
    folderId: normalizeFolderId(folderId),
    recycleBin: false,
    page: pagination.page,
    size: pagination.size
  };
}

function readDocumentListRecords(data) {
  return Array.isArray(data?.records) ? data.records : [];
}

function normalizeDocumentListPagination(data, fallbackPagination) {
  return {
    total: Number(data?.total ?? 0),
    page: Number(data?.page ?? fallbackPagination.page),
    size: Number(data?.size ?? fallbackPagination.size),
    totalPages: Number(data?.totalPages ?? 0)
  };
}

function compareDocumentBindingOptions(a, b) {
  const timeA = Date.parse(a?.updatedAt || "") || 0;
  const timeB = Date.parse(b?.updatedAt || "") || 0;
  if (timeA !== timeB) return timeB - timeA;
  return String(a?.name || "").localeCompare(String(b?.name || ""), "zh-CN");
}

function getDocumentBindingQueryFolderIds({
  folderId = DEFAULT_DOCUMENT_BINDING_FOLDER_ID,
  folderTreeData = []
}) {
  const normalizedFolderId = normalizeFolderId(folderId);
  if (normalizedFolderId !== DEFAULT_DOCUMENT_BINDING_FOLDER_ID) {
    return [normalizedFolderId];
  }
  const ids = uniqueValues([
    DEFAULT_DOCUMENT_BINDING_FOLDER_ID,
    ...collectFolderIds(folderTreeData)
  ]);
  return ids.length ? ids : [DEFAULT_DOCUMENT_BINDING_FOLDER_ID];
}

async function loadSingleFolderDocumentBindingOptions({
  keyword = "",
  folderId = DEFAULT_DOCUMENT_BINDING_FOLDER_ID,
  pagination,
  getDocumentList,
  unwrapApiData
}) {
  const data = unwrapApiData(
    await getDocumentList(
      createDocumentBindingListParams({
        keyword,
        folderId,
        pagination
      })
    ),
    "加载文档列表失败"
  );
  const records = readDocumentListRecords(data);
  return {
    records: records.map(normalizeDocumentBindingOption).filter(Boolean),
    pagination: normalizeDocumentListPagination(data, pagination)
  };
}

async function loadAllFolderDocumentBindingOptions({
  keyword = "",
  folderIds = [],
  pagination,
  getDocumentList,
  unwrapApiData
}) {
  const page = Math.max(1, Number(pagination?.page || 1));
  const size = Math.max(1, Number(pagination?.size || 20));
  const initialSize = Math.max(size, 20);
  const basePagination = {
    page: 1,
    size: initialSize
  };
  const queryIds = uniqueValues(folderIds);
  const initialResults = await Promise.all(
    queryIds.map(async folderId => {
      const data = unwrapApiData(
        await getDocumentList(
          createDocumentBindingListParams({
            keyword,
            folderId,
            pagination: basePagination
          })
        ),
        "加载文档列表失败"
      );
      const records = readDocumentListRecords(data);
      const total = Number(data?.total ?? records.length);
      return {
        folderId,
        total,
        records
      };
    })
  );

  const completedRecords = [];
  const pendingResults = await Promise.all(
    initialResults
      .filter(item => item.total > item.records.length)
      .map(async item => {
        const data = unwrapApiData(
          await getDocumentList(
            createDocumentBindingListParams({
              keyword,
              folderId: item.folderId,
              pagination: {
                page: 1,
                size: item.total
              }
            })
          ),
          "加载文档列表失败"
        );
        return {
          folderId: item.folderId,
          records: readDocumentListRecords(data)
        };
      })
  );
  const pendingRecordMap = new Map(
    pendingResults.map(item => [item.folderId, item.records])
  );

  initialResults.forEach(item => {
    completedRecords.push(
      ...(pendingRecordMap.get(item.folderId) || item.records)
    );
  });

  const uniqueDocumentMap = new Map();
  completedRecords
    .map(normalizeDocumentBindingOption)
    .filter(Boolean)
    .forEach(item => {
      uniqueDocumentMap.set(item.id, item);
    });
  const records = Array.from(uniqueDocumentMap.values()).sort(
    compareDocumentBindingOptions
  );
  const start = (page - 1) * size;
  return {
    records: records.slice(start, start + size),
    pagination: {
      total: records.length,
      page,
      size,
      totalPages: Math.ceil(records.length / size)
    }
  };
}

export async function loadDocumentBindingOptions({
  keyword = "",
  folderId = DEFAULT_DOCUMENT_BINDING_FOLDER_ID,
  folderTreeData = [],
  pagination,
  getDocumentList,
  unwrapApiData
}) {
  const folderIds = getDocumentBindingQueryFolderIds({
    folderId,
    folderTreeData
  });
  if (folderIds.length <= 1) {
    return loadSingleFolderDocumentBindingOptions({
      keyword,
      folderId: folderIds[0] || folderId,
      pagination,
      getDocumentList,
      unwrapApiData
    });
  }
  return loadAllFolderDocumentBindingOptions({
    keyword,
    folderIds,
    pagination,
    getDocumentList,
    unwrapApiData
  });
}

export async function fetchBoundDocumentsByRelation({
  sourceKind,
  sourceId,
  nodeName = "",
  relationType,
  listRelationRecordsBySourceAndType,
  fetchDocumentOptionsByIds
}) {
  const targetId = String(sourceId || "").trim();
  if (!targetId) return [];
  const relations = await listRelationRecordsBySourceAndType({
    sourceKind,
    sourceId: targetId,
    type: relationType
  });
  const normalizedNodeName = String(nodeName || "").trim();
  const relationRows = (
    Array.isArray(relations?.data) ? relations.data : []
  ).filter(item => {
    if (!normalizedNodeName) return true;
    return String(item?.nodeName || "").trim() === normalizedNodeName;
  });
  const documentIds = Array.from(
    new Set(
      relationRows
        .map(item => String(item?.targetId || "").trim())
        .filter(Boolean)
    )
  );
  return fetchDocumentOptionsByIds(documentIds);
}

export async function replaceDocumentRelations({
  sourceKind,
  sourceId,
  nodeName = "",
  relationType,
  documents = [],
  listRelationRecordsBySourceAndType,
  deleteRelationRecord,
  createRelationRecord,
  normalizeDocuments
}) {
  const targetId = String(sourceId || "").trim();
  if (!targetId) {
    return {
      documents: [],
      relationIds: []
    };
  }

  const relations = await listRelationRecordsBySourceAndType({
    sourceKind,
    sourceId: targetId,
    type: relationType
  });
  const normalizedNodeName = String(nodeName || "").trim();
  const currentRows = (
    Array.isArray(relations?.data) ? relations.data : []
  ).filter(item => {
    if (!normalizedNodeName) return true;
    return String(item?.nodeName || "").trim() === normalizedNodeName;
  });
  const nextDocs = normalizeDocuments(documents);
  const nextDocIdSet = new Set(nextDocs.map(item => item.id));

  await Promise.all(
    currentRows
      .filter(item => !nextDocIdSet.has(String(item?.targetId || "").trim()))
      .map(item => String(item?.id || "").trim())
      .filter(Boolean)
      .map(id => deleteRelationRecord(id))
  );

  const currentDocIdSet = new Set(
    currentRows.map(item => String(item?.targetId || "").trim()).filter(Boolean)
  );

  for (const doc of nextDocs) {
    if (currentDocIdSet.has(doc.id)) continue;
    await createRelationRecord({
      type: relationType,
      sourceKind,
      sourceId: targetId,
      targetKind: "doc",
      targetId: doc.id,
      ...(normalizedNodeName ? { nodeName: normalizedNodeName } : {})
    });
  }

  const refreshedRelations = await listRelationRecordsBySourceAndType({
    sourceKind,
    sourceId: targetId,
    type: relationType
  });

  return {
    documents: nextDocs,
    relationIds: (Array.isArray(refreshedRelations?.data)
      ? refreshedRelations.data
      : []
    )
      .filter(item => {
        if (!normalizedNodeName) return true;
        return String(item?.nodeName || "").trim() === normalizedNodeName;
      })
      .map(item => String(item?.id || "").trim())
      .filter(Boolean)
  };
}
