import {
  normalizeHandoverModelRecord,
  resolveHandoverModelUrl
} from "@/utils/handoverModel";

export function unwrapViewerApiData(resp, fallback = {}) {
  return resp?.data ?? resp ?? fallback;
}

export function readViewerApiRecords(data) {
  return Array.isArray(data?.records) ? data.records : [];
}

export function normalizeViewerModelItem(item) {
  return normalizeHandoverModelRecord({
    id: item?.id || "",
    name: item?.name || "未命名模型",
    lod: item?.lod || "LOD300",
    components: Number(item?.components || 0),
    updatedAt: item?.updatedAt || "-",
    nodeIds: Array.isArray(item?.nodeIds) ? item.nodeIds : [],
    kksRefs: Array.isArray(item?.kksRefs) ? item.kksRefs : [],
    url: item?.url || "",
    thumbnailUrl: item?.thumbnailUrl || item?.thumbnail || ""
  });
}

export function parseViewerProjectInfo(rawValue) {
  if (!rawValue) return null;
  if (typeof rawValue === "object") return rawValue;
  try {
    return JSON.parse(String(rawValue));
  } catch (error) {
    console.error("parse projectInfo failed", error);
    return null;
  }
}

export function createViewerSceneModel(
  detail = {},
  partial = {},
  options = {}
) {
  const {
    buildInstanceId,
    defaultMetadata = {},
    includeSystemBinding = false
  } = options;

  const instanceId =
    partial.instanceId ||
    buildInstanceId?.(detail, partial) ||
    `scene-model-${detail.id || Date.now()}`;
  const model = {
    instanceId,
    modelId: detail.id || partial.modelId || "",
    modelName: detail.name || partial.modelName || "未命名模型",
    modelUrl: resolveHandoverModelUrl(detail.url || partial.modelUrl || ""),
    visible: partial.visible !== false,
    locked: Boolean(partial.locked),
    opacity: Number.isFinite(Number(partial.opacity))
      ? Number(partial.opacity)
      : 1,
    transform: {
      position: Array.isArray(partial.transform?.position)
        ? partial.transform.position
        : [0, 0, 0],
      rotation: Array.isArray(partial.transform?.rotation)
        ? partial.transform.rotation
        : [0, 0, 0],
      scale: Array.isArray(partial.transform?.scale)
        ? partial.transform.scale
        : [1, 1, 1]
    },
    metadata: {
      lod: detail.lod || partial.metadata?.lod || "LOD300",
      ...defaultMetadata,
      ...(partial.metadata || {})
    },
    rawDetail: detail
  };

  if (!includeSystemBinding) {
    return model;
  }

  return {
    ...model,
    systemNodeId: String(
      partial.systemNodeId || partial.nodeId || detail.systemNodeId || ""
    ).trim(),
    systemNodeLabel: String(
      partial.systemNodeLabel ||
        partial.nodeLabel ||
        detail.systemNodeLabel ||
        detail.systemNodeName ||
        ""
    ).trim()
  };
}

export function serializeSceneModels(sceneModels = [], options = {}) {
  const { mapMetadata } = options;
  return sceneModels.map(item => ({
    instanceId: item.instanceId,
    modelId: item.modelId,
    modelName: item.modelName,
    modelUrl: item.modelUrl,
    ...(item.systemNodeId !== undefined
      ? {
          systemNodeId: item.systemNodeId || "",
          systemNodeLabel: item.systemNodeLabel || ""
        }
      : {}),
    visible: item.visible !== false,
    locked: Boolean(item.locked),
    opacity: item.opacity ?? 1,
    transform: item.transform || {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    },
    metadata: mapMetadata ? mapMetadata(item) : item.metadata || {}
  }));
}

export function serializeSceneObjectBindings(sceneDevices = [], options = {}) {
  const {
    bindingIdBuilder,
    resolveInstanceId,
    includeTypeInProperties = false,
    includeDocumentBindings = false,
    normalizeDocuments
  } = options;

  return sceneDevices
    .filter(item => item?.uuid)
    .map(item => {
      const payload = {
        bindingId:
          bindingIdBuilder?.(item) ||
          `binding-${item.instanceId || "default"}-${item.uuid}`,
        instanceId: resolveInstanceId?.(item) || item.instanceId || "",
        objectUuid: item.uuid,
        meshUuids: Array.isArray(item.meshUuids) ? item.meshUuids : [],
        objectName: item.name || "",
        path: item.path || "",
        businessBinding: {
          nodeId: item.nodeId || "",
          kks: item.kks || "",
          tag: "",
          bindingType: item.kks ? "device" : "custom"
        },
        properties: {
          customName: item.name || "",
          systemName: item.systemName || "",
          status: item.status || "-",
          ...(includeTypeInProperties ? { type: item.type || "" } : {})
        }
      };

      if (includeDocumentBindings) {
        payload.documentBindings = normalizeDocuments
          ? normalizeDocuments(item.boundDocuments || [])
          : Array.isArray(item.boundDocuments)
            ? item.boundDocuments
            : [];
      }

      return payload;
    });
}
