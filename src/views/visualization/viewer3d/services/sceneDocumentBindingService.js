export function createDefaultDocumentBindingPagination() {
  return {
    page: 1,
    size: 20,
    total: 0
  };
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

export async function loadDocumentBindingOptions({
  keyword = "",
  pagination,
  getDocumentList,
  unwrapApiData
}) {
  const data = unwrapApiData(
    await getDocumentList({
      searchMode: "fuzzy",
      keyword: keyword.trim() || undefined,
      recycleBin: false,
      page: pagination.page,
      size: pagination.size
    }),
    "加载文档列表失败"
  );
  const records = Array.isArray(data?.records) ? data.records : [];
  return {
    records: records.map(normalizeDocumentBindingOption).filter(Boolean),
    pagination: {
      total: Number(data?.total ?? 0),
      page: Number(data?.page ?? pagination.page),
      size: Number(data?.size ?? pagination.size)
    }
  };
}

export async function fetchBoundDocumentsByRelation({
  sourceKind,
  sourceId,
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
  const relationRows = Array.isArray(relations?.data) ? relations.data : [];
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
  const currentRows = Array.isArray(relations?.data) ? relations.data : [];
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
      targetId: doc.id
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
      .map(item => String(item?.id || "").trim())
      .filter(Boolean)
  };
}
