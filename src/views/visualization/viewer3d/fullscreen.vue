<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from "vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import { ElMessageBox } from "element-plus";
import { Camera, Pointer, Position } from "@element-plus/icons-vue";
import { message } from "@/utils/message";
import { getConfig } from "@/config";
import { getHandoverKksList } from "@/api/handoverData";
import {
  downloadHandoverDocumentFile,
  getHandoverDocumentDetail,
  getHandoverDocumentList,
  getHandoverDocFolderTree
} from "@/api/handoverDocuments";
import {
  normalizeHandoverDocumentRecord,
  triggerHandoverDocumentDownload,
  unwrapHandoverDocumentFileResponse
} from "@/utils/handoverDocument";
import { resolveHandoverModelUrl } from "@/utils/handoverModel";
import {
  getHandoverModelDetail,
  getHandoverModelList
} from "@/api/handoverModels";
import {
  getHandoverProjectDetail,
  updateHandoverProject
} from "@/api/handoverProjects";
import {
  createRelationRecord,
  deleteRelationRecord,
  listRelationRecordsBySourceAndType,
  pageQueryRelationRecords,
  updateRelationRecord
} from "@/api/searchNav";
import { createViewerAdapter } from "@/3d/runtime/adapter/viewerAdapter";
import { createVideoAdapter } from "@/3d/runtime/cameras/videoAdapter";
import { createRuntimeEventBus } from "@/3d/runtime/events/runtimeEventBus";
import { createRealtimeDataAdapter } from "@/3d/runtime/integrations/realtimeDataAdapter";
import { createBackendBridge } from "@/3d/runtime/integrations/backendBridge";
import { createScriptEngine } from "@/3d/runtime/scripting/scriptEngine";
import { useDdLinkageStoreHook } from "@/store/modules/ddLinkage";
import { useViewer3dRuntimeStoreHook } from "@/store/modules/viewer3dRuntime";
import { useViewer3dProjectStoreHook } from "@/store/modules/viewer3dProject";
import ViewerTopbar from "./toolbars/ViewerTopbar.vue";
import {
  applyClippingPreset,
  CLIPPING_AXIS_OPTIONS,
  CLIPPING_DIRECTION_OPTIONS,
  CLIPPING_MODE_OPTIONS,
  CLIPPING_TARGET_OPTIONS,
  cloneClippingState,
  createDefaultClippingState,
  ensureVisibleClippingState,
  getActiveClippingSummary,
  normalizeClippingState,
  resetClippingState
} from "@/3d/runtime/clipping/clippingState";
import {
  buildConfiguredObjectBindings,
  buildSceneDevices,
  normalizeBindingText
} from "./services/sceneBindingService";
import {
  buildModelNodeRelationName,
  getModelNodeRelationKey,
  getRelationRecordModelNodeKey,
  parseModelNodeRelationName
} from "./services/modelNodeRelationService";
import {
  createDefaultDocumentBindingFolderTree,
  createDefaultDocumentBindingPagination,
  fetchBoundDocumentsByRelation,
  loadDocumentBindingFolders,
  loadDocumentBindingOptions,
  mergeSelectedDocumentBindings,
  normalizeDocumentBindingOption,
  replaceDocumentRelations,
  syncDocumentBindingTableSelection
} from "./services/sceneDocumentBindingService";
import {
  createViewerSceneModel,
  normalizeViewerModelItem,
  parseViewerProjectInfo,
  serializeSceneModels,
  serializeSceneObjectBindings
} from "./services/sceneProjectPersistenceService";
import {
  applyRestoredViewerProjectState,
  resolveRestoredViewerProjectState
} from "./services/viewerProjectStateService";
import {
  handleViewerLoadedLifecycle,
  resetViewerSceneOnModelChange
} from "./services/viewerSceneLifecycleService";
import {
  handleActiveCameraChange,
  handleVideoDialogVisibilityChange,
  syncAssetGroupsFromManifest,
  syncMeasurementModeOnWatcher,
  syncMeasurementPointsOnWatcher,
  syncRuntimeServicesIfReady,
  syncSceneAnchorsOnWatcher,
  syncViewerMaterialTheme,
  syncViewerQuality,
  syncViewerClippingAnimationOptions
} from "./services/viewerWatcherService";
import {
  ANCHOR_BINDING_TYPE_OPTIONS,
  CAMERA_STREAM_TYPE_OPTIONS,
  CAMERA_TYPE_OPTIONS,
  CAMERA_WINDOW_MODE_OPTIONS,
  SCENE_ANCHOR_TYPE_OPTIONS,
  buildRenderableAnchors,
  createEmptyAnchorForm,
  createEmptyCameraForm,
  normalizeAnchorStyle,
  normalizeAnchorForm,
  normalizeCameraForm,
  pickAnchorIconStyle,
  removeItem,
  summarizeAnchorBinding,
  upsertItem
} from "./services/sceneAnchorService";
import {
  CAMERA_ANCHOR_ICON_OPTIONS,
  SCENE_ANCHOR_ICON_OPTIONS
} from "./services/sceneAnchorIconService";
import {
  exportSceneAnchorExcel,
  exportSceneAnchorJson,
  importSceneAnchorFile
} from "./services/sceneAnchorTransferService";
import {
  buildCurrentSceneSchemePayload,
  formatSceneSchemeTime,
  resolveSceneSchemeUuids
} from "./services/sceneSchemeService";
import {
  applyDisplayMode as applySceneDisplayMode,
  applyLayerVisibility as applySceneLayerVisibility,
  getDevicesByRegion as getSceneDevicesByRegion,
  getDevicesBySystem as getSceneDevicesBySystem,
  handleNavigationNodeClick as handleSceneNavigationNodeClick,
  isolateDevice as isolateSceneDevice,
  locateByKks as locateSceneByKks,
  locateDevice as locateSceneDevice,
  locateRegion as locateSceneRegion,
  locateSystem as locateSceneSystem,
  syncLayerTreeSelection as syncSceneLayerTreeSelection,
  syncNavigationSelections as syncSceneNavigationSelections
} from "./services/sceneNavigationService";
import {
  buildBindPropertyForm,
  clearNodeProperty,
  confirmPropertyDialog as confirmScenePropertyDialog,
  createEmptyPropertyForm,
  getContextDeviceProps,
  openContextMenu
} from "./services/scenePropertyService";
import {
  closeObjectPanel as closeSceneObjectPanel,
  expandTreeToUUID as expandSceneTreeToUUID,
  onObjectSelect as handleSceneObjectSelect,
  scrollCurrentTreeNodeIntoView as scrollSceneCurrentTreeNodeIntoView,
  selectTreeNodeByUUID as selectSceneTreeNodeByUUID
} from "./services/sceneSelectionService";
import { buildTreeNodeIndex } from "./services/sceneTreeService";
import {
  hasProjectPackageContent,
  loadProjectPackage,
  parseImportedProjectPackage,
  saveProjectPackage,
  patchProjectPackage
} from "./services/projectPackageService";
import { useViewerToolbarState } from "./services/useViewerToolbarState";
import Viewer3DWorkspace from "./components/fullscreen/Viewer3DWorkspace.vue";
import ViewerPlaneWorkspace from "./components/fullscreen/ViewerPlaneWorkspace.vue";
import Viewer2DWorkspace from "./components/fullscreen/Viewer2DWorkspace.vue";
import FilePreview from "@/views/handover/documents/components/FilePreview.vue";
import SceneSettingsDialog from "./components/fullscreen/dialogs/SceneSettingsDialog.vue";
import ModelPickerDialog from "./components/fullscreen/dialogs/ModelPickerDialog.vue";
import DocumentBindingDialog from "./components/fullscreen/dialogs/DocumentBindingDialog.vue";
import PropertyBindingDialog from "./components/fullscreen/dialogs/PropertyBindingDialog.vue";
import AnchorEditorDialog from "./components/fullscreen/dialogs/AnchorEditorDialog.vue";
import AnchorDetailDialog from "./components/fullscreen/dialogs/AnchorDetailDialog.vue";
import CameraVideoDialog from "./components/fullscreen/dialogs/CameraVideoDialog.vue";

defineOptions({
  name: "Viewer3DFullscreen"
});

const route = useRoute();
const router = useRouter();
const ddStore = useDdLinkageStoreHook();
const runtimeStore = useViewer3dRuntimeStoreHook();
const projectStore = useViewer3dProjectStoreHook();
const viewerAdapter = createViewerAdapter();
const videoAdapter = createVideoAdapter();
const runtimeEventBus = createRuntimeEventBus();

function pushRuntimeLog(entry) {
  runtimeStore.addRuntimeLog(entry);
}

const backendBridge = createBackendBridge({
  eventBus: runtimeEventBus,
  onLog: pushRuntimeLog,
  onStateChange: payload => runtimeStore.setBackendState(payload)
});

const realtimeAdapter = createRealtimeDataAdapter({
  eventBus: runtimeEventBus,
  onPacket: packet => {
    runtimeStore.setRealtimeState({
      lastPacket: packet,
      lastPacketAt: packet.timestamp
    });
    applyRealtimeDeviceStatusPacket(packet);
  },
  onLog: pushRuntimeLog,
  onStateChange: payload => runtimeStore.setRealtimeState(payload)
});

const scriptEngine = createScriptEngine({
  eventBus: runtimeEventBus,
  viewerAdapter,
  runtimeStore,
  projectStore,
  backendBridge,
  notify: message,
  actions: {
    openVideoByCameraId: cameraId => {
      const camera = renderableCameraAnchors.value.find(
        item => item.id === cameraId
      );
      if (camera) openCameraVideo(camera);
    },
    setDisplayMode: mode => applyDisplayMode(mode, false),
    setMeasurementMode: mode => setMeasurementMode(mode),
    setAnchorVisibility: (kind, visible) => {
      if (kind === "camera") {
        cameraMarkersVisible.value = visible;
        return;
      }
      anchorMarkersVisible.value = visible;
    },
    setPointMarkersVisible: visible => {
      pointMarkersVisible.value = visible;
    },
    setAnchorState: payload => {
      const isCamera = payload.kind === "camera";
      const source = isCamera ? cameraAnchors.value : anchors.value;
      const next = source.map(item =>
        item.id === payload.id
          ? {
              ...item,
              status: payload.status || item.status || "normal",
              payload: {
                ...(item.payload || {}),
                displayText:
                  payload.displayText !== undefined
                    ? payload.displayText
                    : item.payload?.displayText || "",
                value:
                  payload.value !== undefined
                    ? payload.value
                    : item.payload?.value || ""
              }
            }
          : item
      );

      if (isCamera) {
        cameraAnchors.value = next;
        projectStore.setCameraAnchors(next);
      } else {
        anchors.value = next;
        projectStore.setAnchors(next);
      }
      persistSceneAnchorData();
      syncSceneAnchors();
    },
    setTransparentMode: enabled => {
      transparent.value = enabled;
    },
    setMaterialTheme: theme => {
      setMaterialTheme(theme);
    },
    applyBookmark: bookmarkName => {
      const bookmark = bookmarks.value.find(item => item.name === bookmarkName);
      if (bookmark) {
        viewerAdapter.applyBookmark(bookmark);
      }
    }
  },
  onLog: pushRuntimeLog,
  onStateChange: payload => runtimeStore.setScriptState(payload)
});

const {
  quality,
  materialTheme,
  showSidePanel,
  showStats,
  activeTool,
  measurementMode,
  roamingEnabled,
  activeSideTab,
  pointMarkersVisible,
  anchorMarkersVisible,
  cameraMarkersVisible,
  selectedDeviceUuid,
  selectedAnchorId,
  selectedCameraId,
  selectedSystemNodeId,
  selectedQuickKks,
  displayMode,
  currentNavNodeKey,
  selectedObjectInfo,
  showObjectPanel,
  videoDialogVisible,
  activeVideoSource,
  realtimeState,
  scriptState,
  backendState,
  runtimeLogs,
  transparentEnabled: transparent,
  clippingEnabled: enableClipping,
  clippingState: runtimeClippingState,
  clippingStats
} = storeToRefs(runtimeStore);

const {
  bookmarks,
  sceneDevices,
  anchors,
  cameraAnchors,
  measurementRecords,
  scriptDefinitions,
  integrationConfigs,
  sceneSchemes,
  deviceKeyword,
  sceneTree,
  layerCheckedKeys,
  clippingState: projectClippingState,
  clippingPresets
} = storeToRefs(projectStore);

const routeModelId = computed(() => {
  const value = route.query?.id;
  return typeof value === "string" ? value.trim() : "";
});
const routeModelUrl = computed(() => {
  const value = route.query?.url;
  if (typeof value !== "string") return "";
  return resolveHandoverModelUrl(value.trim());
});
const routeModelName = computed(() => {
  const value = route.query?.name;
  return typeof value === "string" ? value.trim() : "";
});
const handoverProjectId = computed(() => {
  const value = route.query?.projectId;
  return typeof value === "string" ? value.trim() : "";
});
const handoverProjectName = ref("");
const currentProjectContext = ref(null);
const savingProject = ref(false);
const availableModels = ref([]);
const modelPickerVisible = ref(false);
const modelPickerSelection = ref([]);
const loadingModelOptions = ref(false);
const activeSceneModelId = ref("");
const sceneModels = ref([]);
const systemNodeTree = ref([]);
const savedObjectBindings = ref([]);
const documentDialogVisible = ref(false);
const documentDialogScope = ref("node");
const documentDialogMode = ref("bind");
const documentDialogLoading = ref(false);
const documentDialogKeyword = ref("");
const documentDialogRecords = ref([]);
const documentDialogPagination = ref(createDefaultDocumentBindingPagination());
const documentDialogFolderTreeData = ref(
  createDefaultDocumentBindingFolderTree()
);
const documentDialogFolderId = ref("root");
const documentDialogFolderLoading = ref(false);
const documentDialogTargetId = ref("");
const documentDialogTargetLabel = ref("");
const documentDialogSelectedDocuments = ref([]);
const documentDialogTableRef = ref(null);
const documentDialogSourceId = ref("");
const documentDialogRelationNodeName = ref("");
const boundDocumentPreviewVisible = ref(false);
const boundDocumentPreviewRow = ref(null);
const boundDocumentDetailVisible = ref(false);
const boundDocumentDetailLoading = ref(false);
const boundDocumentDetailRow = ref(null);

const activeModelDetail = ref(null);

const modelId = computed(() => {
  return activeSceneModelId.value || routeModelId.value;
});

const modelUrl = computed(() => {
  return String(
    activeSceneModel.value?.modelUrl ||
      activeModelDetail.value?.url ||
      routeModelUrl.value ||
      ""
  ).trim();
});

const modelName = computed(() => {
  return String(
    activeSceneModel.value?.modelName ||
      activeModelDetail.value?.name ||
      routeModelName.value ||
      ""
  ).trim();
});

function createFullscreenSceneModel(detail = {}, partial = {}) {
  return createViewerSceneModel(detail, partial, {
    buildInstanceId: item =>
      `scene-model-${item.id || Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    includeSystemBinding: true
  });
}

function mapSystemTreeNodes(nodes = [], parentId = "") {
  return nodes
    .map(node => {
      const id = String(node?.id || node?.nodeId || node?.code || "").trim();
      if (!id) return null;
      return {
        ...node,
        id,
        parentId: String(node?.parentId || parentId || "").trim(),
        label: String(node?.name || node?.label || node?.code || id).trim(),
        boundDocuments: normalizeNodeBoundDocuments(
          node?.boundDocuments || node?.documents || node?.documentBindings
        ),
        children: mapSystemTreeNodes(node?.children || [], id)
      };
    })
    .filter(Boolean);
}

function flattenSystemTree(nodes = [], depth = 0, result = []) {
  nodes.forEach(node => {
    result.push({
      ...node,
      depth
    });
    if (Array.isArray(node.children) && node.children.length > 0) {
      flattenSystemTree(node.children, depth + 1, result);
    }
  });
  return result;
}

function buildObjectBindingKey(instanceId = "", objectUuid = "") {
  return `${String(instanceId || "").trim()}::${String(objectUuid || "").trim()}`;
}

function buildObjectBindingPathKey(instanceId = "", path = "") {
  return `${String(instanceId || "").trim()}::${normalizeBindingText(path)}`;
}

function buildObjectBindingNameKey(instanceId = "", name = "") {
  return `${String(instanceId || "").trim()}::${normalizeBindingText(name)}`;
}

const MODEL_OBJECT_SOURCE_KIND = "model";
const MODEL_OBJECT_DOC_RELATION_TYPE = "model_object_doc";
const MODEL_OBJECT_KKS_RELATION_TYPE = "model_object_kks";

function buildModelObjectSourceId({
  instanceId = "",
  objectUuid = "",
  uuid = ""
} = {}) {
  const normalizedInstanceId = String(instanceId || "").trim();
  const normalizedObjectUuid = String(objectUuid || uuid || "").trim();
  if (!normalizedInstanceId || !normalizedObjectUuid) return "";
  return `${normalizedInstanceId}:${normalizedObjectUuid}`;
}

function getSceneModelIdByInstanceId(instanceId = "") {
  const key = String(instanceId || "").trim();
  if (!key) return "";
  return sceneModels.value.find(item => item.instanceId === key)?.modelId || "";
}

function getSceneDeviceModelId(item) {
  return String(
    item?.modelId ||
      item?.sceneModelId ||
      getSceneModelIdByInstanceId(item?.instanceId) ||
      ""
  ).trim();
}

function getSceneDeviceNodeName(item) {
  return String(item?.nodeName || item?.name || item?.objectName || "").trim();
}

function getSceneDeviceRelationNodeName(item) {
  return buildModelNodeRelationName({
    modelId: getSceneDeviceModelId(item),
    nodeName: getSceneDeviceNodeName(item)
  });
}

function getSceneDeviceRelationKey(item) {
  return getModelNodeRelationKey({
    modelId: getSceneDeviceModelId(item),
    nodeName: getSceneDeviceNodeName(item)
  });
}

function normalizeSavedObjectBinding(item) {
  const objectUuid = String(item?.objectUuid || item?.uuid || "").trim();
  const objectName = String(item?.objectName || item?.name || "").trim();
  const path = String(item?.path || "").trim();
  if (!objectUuid && !objectName && !path) return null;
  const businessBinding = item?.businessBinding || {};
  const parsedRelationNode = parseModelNodeRelationName(
    item?.relationNodeName || item?.nodeName
  );
  const modelId = String(
    item?.modelId || parsedRelationNode.modelId || item?.sourceId || ""
  ).trim();
  const nodeName = String(
    parsedRelationNode.nodeName || item?.nodeName || objectName || ""
  ).trim();
  const documentBindings = Array.isArray(item?.documentBindings)
    ? item.documentBindings
    : Array.isArray(item?.documents)
      ? item.documents
      : [];
  return {
    instanceId: String(item?.instanceId || "").trim(),
    modelId,
    sourceId: modelId,
    nodeName,
    relationNodeName:
      String(item?.relationNodeName || "").trim() ||
      buildModelNodeRelationName({ modelId, nodeName }),
    objectUuid,
    objectName,
    path,
    meshUuids: Array.isArray(item?.meshUuids) ? item.meshUuids : [],
    kks: String(businessBinding?.kks || item?.kks || "").trim(),
    nodeId: String(businessBinding?.nodeId || item?.nodeId || "").trim(),
    kksRelationId: String(item?.kksRelationId || item?.relationId || "").trim(),
    documentRelationIds: Array.isArray(item?.documentRelationIds)
      ? item.documentRelationIds
          .map(id => String(id || "").trim())
          .filter(Boolean)
      : [],
    boundDocuments: documentBindings
      .map(normalizeNodeBoundDocument)
      .filter(Boolean)
  };
}

const flatSystemNodes = computed(() =>
  flattenSystemTree(systemNodeTree.value, 0, [])
);

const systemNodeLabelMap = computed(() => {
  const map = new Map();
  flatSystemNodes.value.forEach(node => {
    map.set(node.id, node.label);
  });
  return map;
});

function getSystemNodeLabel(nodeId) {
  const key = String(nodeId || "").trim();
  if (!key) return "";
  return systemNodeLabelMap.value.get(key) || key;
}

function isApiSuccess(response) {
  return (
    response?.success === true || response?.code === 200 || response?.code === 0
  );
}

function unwrapApiData(response, fallbackMessage) {
  if (!isApiSuccess(response)) {
    throw new Error(response?.message || fallbackMessage || "请求失败");
  }
  return response?.data ?? response ?? null;
}

function normalizeNodeBoundDocument(item) {
  const id = String(item?.id || item?.documentId || "").trim();
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

function normalizeNodeBoundDocuments(items) {
  if (!Array.isArray(items)) return [];
  const uniqueMap = new Map();
  items
    .map(normalizeNodeBoundDocument)
    .filter(Boolean)
    .forEach(item => {
      uniqueMap.set(item.id, item);
    });
  return Array.from(uniqueMap.values());
}

function normalizeBoundDocumentRecord(item) {
  const base = normalizeNodeBoundDocument(item);
  if (!base) return null;
  return normalizeHandoverDocumentRecord({
    ...item,
    ...base
  });
}

function formatDocumentSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const fixed = unitIndex === 0 ? 0 : size < 10 ? 2 : 1;
  return `${size.toFixed(fixed)} ${units[unitIndex]}`;
}

function getSceneDeviceSourceId(item) {
  return getSceneDeviceModelId(item);
}

function getSceneDeviceByModelNode(sourceId, relationNodeName = "") {
  const key = String(sourceId || "").trim();
  if (!key) return null;
  const parsed = parseModelNodeRelationName(relationNodeName);
  const relationKey = getModelNodeRelationKey({
    modelId: parsed.modelId || key,
    nodeName: parsed.nodeName
  });
  if (!relationKey) return null;
  return (
    sceneDevices.value.find(
      item => getSceneDeviceRelationKey(item) === relationKey
    ) || null
  );
}

function applySceneDeviceBindingPatch(sourceId, patch = {}) {
  const target = getSceneDeviceByModelNode(
    sourceId,
    patch.relationNodeName || patch.nodeName || ""
  );
  if (!target) return false;
  Object.assign(target, patch);
  if (!Array.isArray(target.boundDocuments)) {
    target.boundDocuments = [];
  }
  if (!Array.isArray(target.documentRelationIds)) {
    target.documentRelationIds = [];
  }
  return true;
}

async function listModelObjectRelationsBySourceAndType(sourceId, type) {
  if (!sourceId || !type) return [];
  const response = await listRelationRecordsBySourceAndType({
    sourceKind: MODEL_OBJECT_SOURCE_KIND,
    sourceId,
    type
  });
  return Array.isArray(response?.data) ? response.data : [];
}

async function listAllRelationRecords(params = {}) {
  const pageSize = 1000;
  const records = [];
  const seenIds = new Set();
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (records.length < total) {
    const data = unwrapApiData(
      await pageQueryRelationRecords({
        ...params,
        page,
        size: pageSize
      }),
      "加载关系记录失败"
    );
    const rows = Array.isArray(data?.records) ? data.records : [];
    rows.forEach(item => {
      const id = String(item?.id || "").trim();
      if (id && seenIds.has(id)) return;
      if (id) seenIds.add(id);
      records.push(item);
    });

    const parsedTotal = Number(data?.total);
    if (Number.isFinite(parsedTotal) && parsedTotal >= 0) {
      total = parsedTotal;
    }

    if (!rows.length || rows.length < pageSize) {
      break;
    }
    page += 1;
  }

  return records;
}

async function fetchDocumentOptionById(id = "") {
  const targetId = String(id || "").trim();
  if (!targetId) return null;
  try {
    const detail = unwrapApiData(
      await getHandoverDocumentDetail(targetId),
      "加载文档详情失败"
    );
    return normalizeDocumentBindingOption(detail);
  } catch (error) {
    console.error("load handover document detail failed", error);
    return null;
  }
}

async function fetchDocumentOptionsByIds(ids = []) {
  const normalizedIds = Array.from(
    new Set(ids.map(id => String(id || "").trim()).filter(Boolean))
  );
  if (!normalizedIds.length) return [];
  const map = new Map();

  try {
    const data = unwrapApiData(
      await getHandoverDocumentList({
        searchMode: "fuzzy",
        recycleBin: false,
        page: 1,
        size: Math.max(100, normalizedIds.length * 2)
      }),
      "加载文档列表失败"
    );
    const records = Array.isArray(data?.records) ? data.records : [];
    records
      .map(item => {
        const normalized = normalizeDocumentBindingOption(item);
        return normalized ? [normalized.id, normalized] : null;
      })
      .filter(Boolean)
      .forEach(([id, item]) => {
        map.set(id, item);
      });
  } catch (error) {
    console.error("load handover document list failed", error);
  }

  const missingIds = normalizedIds.filter(id => !map.has(id));
  if (missingIds.length) {
    const detailOptions = await Promise.all(
      missingIds.map(id => fetchDocumentOptionById(id))
    );
    detailOptions.filter(Boolean).forEach(item => {
      map.set(item.id, item);
    });
  }

  return normalizedIds.map(
    id => map.get(id) || { id, name: id, type: "", updatedAt: "" }
  );
}

async function syncSceneObjectRelationsFromBackend() {
  const sourceIds = Array.from(
    new Set(
      sceneDevices.value
        .map(item => getSceneDeviceSourceId(item))
        .filter(Boolean)
    )
  );
  const deviceRelationKeySet = new Set(
    sceneDevices.value
      .map(item => getSceneDeviceRelationKey(item))
      .filter(Boolean)
  );
  if (!sourceIds.length || !deviceRelationKeySet.size) return;

  try {
    const [kksRecords, documentRecords] = await Promise.all([
      listAllRelationRecords({
        sourceKind: MODEL_OBJECT_SOURCE_KIND,
        type: MODEL_OBJECT_KKS_RELATION_TYPE
      }),
      listAllRelationRecords({
        sourceKind: MODEL_OBJECT_SOURCE_KIND,
        type: MODEL_OBJECT_DOC_RELATION_TYPE
      })
    ]);
    const records = [...kksRecords, ...documentRecords];
    const sourceIdSet = new Set(sourceIds);
    const matched = records.filter(item => {
      const sourceId = String(item?.sourceId || "").trim();
      if (!sourceIdSet.has(sourceId)) return false;
      const relationKey = getRelationRecordModelNodeKey(item);
      return relationKey && deviceRelationKeySet.has(relationKey);
    });

    const documentIds = Array.from(
      new Set(
        matched
          .filter(item => item?.type === MODEL_OBJECT_DOC_RELATION_TYPE)
          .map(item => String(item?.targetId || "").trim())
          .filter(Boolean)
      )
    );
    const documentOptions = await fetchDocumentOptionsByIds(documentIds);
    const documentMap = new Map(documentOptions.map(item => [item.id, item]));

    const relationMap = new Map();
    matched.forEach(item => {
      const relationKey = getRelationRecordModelNodeKey(item);
      if (!relationKey) return;
      const current = relationMap.get(relationKey) || {
        sourceId: String(item?.sourceId || "").trim(),
        relationNodeName: String(item?.nodeName || ""),
        kks: "",
        nodeId: "",
        kksRelationId: "",
        documentRelationIds: [],
        boundDocuments: []
      };

      if (item?.type === MODEL_OBJECT_KKS_RELATION_TYPE) {
        const kks = String(item?.targetId || "").trim();
        current.kks = kks;
        current.nodeId = buildNodeIdByKks(kks) || current.nodeId || "";
        current.kksRelationId = String(item?.id || "").trim();
      }

      if (item?.type === MODEL_OBJECT_DOC_RELATION_TYPE) {
        const documentId = String(item?.targetId || "").trim();
        if (documentId) {
          current.documentRelationIds.push(String(item?.id || "").trim());
          current.boundDocuments.push(
            documentMap.get(documentId) || {
              id: documentId,
              name: documentId,
              type: "",
              updatedAt: ""
            }
          );
        }
      }

      relationMap.set(relationKey, current);
    });

    sceneDevices.value.forEach(item => {
      const sourceId = getSceneDeviceSourceId(item);
      const relationNodeName = getSceneDeviceRelationNodeName(item);
      const backendBinding = relationMap.get(getSceneDeviceRelationKey(item));
      item.modelId = sourceId;
      item.nodeName = getSceneDeviceNodeName(item);
      item.sourceId = sourceId;
      item.relationNodeName = relationNodeName;
      item.kks = backendBinding?.kks || "";
      item.nodeId = backendBinding?.nodeId || buildNodeIdByKks(item.kks) || "";
      item.kksRelationId = backendBinding?.kksRelationId || "";
      item.documentRelationIds = backendBinding?.documentRelationIds || [];
      item.boundDocuments = normalizeNodeBoundDocuments(
        backendBinding?.boundDocuments || []
      );
    });

    syncSavedObjectBindingsFromSceneDevices();
  } catch (error) {
    console.error("sync scene object relations failed", error);
  }
}

function updateSceneModelNodeLabels() {
  sceneModels.value = sceneModels.value.map(item => ({
    ...item,
    systemNodeLabel: getSystemNodeLabel(item.systemNodeId || "")
  }));
}

function persistNavigationTree() {
  systemNodeTree.value = mapSystemTreeNodes(systemNodeTree.value);
  updateSceneModelNodeLabels();
  const nextPackage = patchProjectPackage(currentSceneSchemeScope.value, {
    metadata: getProjectMetadata(),
    scene: {
      navigationTree: systemNodeTree.value
    }
  });
  projectStore.setProjectPackage(nextPackage);
}

function upsertNavigationNode(nodes = [], targetId, updater) {
  return nodes.map(node => {
    if (node.id === targetId) {
      return updater(node);
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      return {
        ...node,
        children: upsertNavigationNode(node.children, targetId, updater)
      };
    }
    return node;
  });
}

function findNavigationNodeById(nodes = [], targetId) {
  for (const node of nodes) {
    if (node.id === targetId) return node;
    if (Array.isArray(node.children) && node.children.length > 0) {
      const matched = findNavigationNodeById(node.children, targetId);
      if (matched) return matched;
    }
  }
  return null;
}

function getNavigationNodeBoundDocuments(nodeId) {
  const targetId = String(nodeId || "").trim();
  if (!targetId) return [];
  return normalizeNodeBoundDocuments(
    findNavigationNodeById(systemNodeTree.value, targetId)?.boundDocuments || []
  );
}

function updateNavigationNodeBoundDocuments(nodeId, documents = []) {
  const targetId = String(nodeId || "").trim();
  if (!targetId) return;
  systemNodeTree.value = upsertNavigationNode(
    systemNodeTree.value,
    targetId,
    node => ({
      ...node,
      boundDocuments: normalizeNodeBoundDocuments(documents)
    })
  );
  persistNavigationTree();
}

const activeSceneModel = computed(() => {
  return (
    sceneModels.value.find(item => item.modelId === activeSceneModelId.value) ||
    sceneModels.value[0] ||
    null
  );
});

async function fetchModelDetail(id) {
  if (!id) return null;
  try {
    const response = await getHandoverModelDetail({ id });
    const rawDetail = response?.data ?? response ?? {};
    const isRouteModel =
      routeModelId.value && String(id).trim() === routeModelId.value;
    const detail = normalizeViewerModelItem({
      ...rawDetail,
      name: rawDetail?.name || (isRouteModel ? routeModelName.value : ""),
      // 从 3d-viewer 进入全屏时，优先沿用上页已验证可用的模型地址。
      url:
        isRouteModel && routeModelUrl.value
          ? routeModelUrl.value
          : rawDetail?.url || ""
    });
    if (!detail.url) {
      message("当前模型缺少可预览地址", { type: "warning" });
    }
    return detail;
  } catch (error) {
    console.error("load fullscreen model detail failed", error);
    message("获取模型详情失败", { type: "error" });
    return null;
  }
}

function syncActiveModelDetail() {
  activeModelDetail.value = activeSceneModel.value?.rawDetail || null;
}

async function loadAvailableModels(showSuccess = false) {
  loadingModelOptions.value = true;
  try {
    const res = await getHandoverModelList({ page: 1, size: 200 });
    const data = res?.data ?? res ?? {};
    availableModels.value = (Array.isArray(data?.records) ? data.records : [])
      .map(normalizeViewerModelItem)
      .filter(item => item.id);
    if (showSuccess) {
      message("模型列表已刷新", { type: "success" });
    }
  } catch (error) {
    console.error("load available models failed", error);
    availableModels.value = [];
    message("获取模型列表失败", { type: "error" });
  } finally {
    loadingModelOptions.value = false;
  }
}

async function initializeSceneModels(projectInfo = null) {
  const projectModels = Array.isArray(projectInfo?.scene?.models)
    ? projectInfo.scene.models
    : [];
  const targetIds = projectModels.length
    ? projectModels.map(item => item.modelId).filter(Boolean)
    : routeModelId.value
      ? [routeModelId.value]
      : [];

  if (!targetIds.length) {
    if (routeModelUrl.value) {
      const routeModel = createFullscreenSceneModel(
        normalizeViewerModelItem({
          id: routeModelId.value,
          name: routeModelName.value || "未命名模型",
          url: routeModelUrl.value
        })
      );
      sceneModels.value = [routeModel];
      activeSceneModelId.value = routeModel.modelId || routeModelId.value || "";
      syncActiveModelDetail();
      return;
    }
    sceneModels.value = [];
    activeSceneModelId.value = "";
    syncActiveModelDetail();
    return;
  }

  const detailList = (
    await Promise.all(targetIds.map(id => fetchModelDetail(id)))
  ).filter(Boolean);

  sceneModels.value = detailList.map(detail => {
    const partial =
      projectModels.find(item => item.modelId === detail.id) || {};
    return createFullscreenSceneModel(detail, partial);
  });

  activeSceneModelId.value =
    projectInfo?.scene?.activeModelId ||
    sceneModels.value[0]?.modelId ||
    routeModelId.value ||
    "";
  syncActiveModelDetail();
}

watch(
  () => [
    modelId.value,
    modelUrl.value,
    modelName.value,
    handoverProjectId.value
  ],
  ([id, url, name, routeProjectId]) => {
    runtimeStore.setModelInfo({
      modelId: id,
      modelUrl: url,
      modelName: name
    });
    projectStore.setProjectInfo({
      projectId: routeProjectId || id,
      projectName: handoverProjectName.value || name
    });
  },
  { immediate: true }
);

const ifcWasmPath = computed(() => `${import.meta.env.BASE_URL || "/"}wasm/`);
const currentSceneSchemeScope = computed(() => {
  if (!handoverProjectId.value) {
    return [modelName.value || "-", modelUrl.value || "-"].join("|");
  }
  return `project:${handoverProjectId.value}`;
});

function getProjectMetadata() {
  return {
    projectId: handoverProjectId.value,
    projectName: handoverProjectName.value,
    modelId: modelId.value,
    modelName: modelName.value,
    modelUrl: modelUrl.value
  };
}

function applyProjectPackagePatch(patch = {}) {
  const nextPackage = patchProjectPackage(
    currentSceneSchemeScope.value,
    patch,
    getProjectMetadata()
  );
  projectStore.setProjectPackage(nextPackage);
  return nextPackage;
}

function patchSceneProjectPackage(scenePatch = {}) {
  return applyProjectPackagePatch({
    metadata: getProjectMetadata(),
    scene: scenePatch
  });
}

function patchAssetsProjectPackage(assetsPatch = {}) {
  return applyProjectPackagePatch({
    assets: assetsPatch
  });
}

async function loadHandoverProjectContext() {
  if (!handoverProjectId.value) {
    handoverProjectName.value = "";
    currentProjectContext.value = null;
    return null;
  }

  try {
    const response = await getHandoverProjectDetail(handoverProjectId.value);
    const project = response?.data ?? response ?? {};
    handoverProjectName.value = project?.projectName || "";
    projectStore.setProjectInfo({
      projectId: handoverProjectId.value,
      projectName: handoverProjectName.value || modelName.value
    });
    currentProjectContext.value = {
      ...project,
      parsedProjectInfo: parseViewerProjectInfo(project?.projectInfo)
    };
    return currentProjectContext.value;
  } catch (error) {
    console.error("load handover project detail failed", error);
    message(error?.message || "获取项目详情失败", { type: "error" });
    currentProjectContext.value = null;
    return null;
  }
}

async function reloadProjectSceneContext() {
  const project = await loadHandoverProjectContext();
  await initializeSceneModels(project?.parsedProjectInfo);
  loadPersistedProjectState(project?.parsedProjectInfo);
  return project;
}

async function initializeRouteSceneModel(modelId) {
  if (sceneModels.value.length > 0) return;
  if (!modelId) {
    if (routeModelUrl.value) {
      const routeModel = createFullscreenSceneModel(
        normalizeViewerModelItem({
          id: routeModelId.value,
          name: routeModelName.value || "未命名模型",
          url: routeModelUrl.value
        })
      );
      sceneModels.value = [routeModel];
      activeSceneModelId.value = routeModel.modelId || routeModelId.value || "";
      syncActiveModelDetail();
      return;
    }
    activeSceneModelId.value = "";
    syncActiveModelDetail();
    return;
  }
  const detail = await fetchModelDetail(modelId);
  if (!detail) return;
  sceneModels.value = [createFullscreenSceneModel(detail)];
  activeSceneModelId.value = detail.id;
  syncActiveModelDetail();
}

const selectableModelOptions = computed(() => {
  const loadedModelMap = new Map(
    sceneModels.value.map(item => [String(item.modelId || ""), item])
  );
  const optionMap = new Map();

  availableModels.value.forEach(item => {
    const id = String(item.id || "").trim();
    if (!id) return;
    const loadedModel = loadedModelMap.get(id);
    optionMap.set(id, {
      label: item.name,
      value: id,
      raw: item,
      loaded: Boolean(loadedModel),
      active: activeSceneModelId.value === id,
      disabled: Boolean(loadedModel)
    });
  });

  sceneModels.value.forEach(item => {
    const id = String(item.modelId || "").trim();
    if (!id || optionMap.has(id)) return;
    optionMap.set(id, {
      label: item.modelName || id,
      value: id,
      raw: item.rawDetail || {
        id,
        name: item.modelName || id,
        lod: item.metadata?.lod || "LOD300",
        updatedAt: item.rawDetail?.updatedAt || "-"
      },
      loaded: true,
      active: activeSceneModelId.value === id,
      disabled: true
    });
  });

  return Array.from(optionMap.values()).sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (a.loaded !== b.loaded) return a.loaded ? -1 : 1;
    return String(a.label || "").localeCompare(
      String(b.label || ""),
      "zh-Hans"
    );
  });
});

const viewerSceneModels = computed(() =>
  sceneModels.value.map(item => ({
    ...item,
    modelUrl:
      item.modelId === activeSceneModelId.value
        ? viewerModelUrl.value
        : item.modelUrl
  }))
);

function openModelPicker() {
  if (guardPlaneUnsupported("添加或切换模型")) return;
  modelPickerSelection.value = [];
  modelPickerVisible.value = true;
}

async function confirmAddModels() {
  if (guardPlaneUnsupported("添加或切换模型")) return;
  const ids = Array.from(new Set(modelPickerSelection.value.filter(Boolean)));
  if (!ids.length) {
    message("请先选择模型", { type: "warning" });
    return;
  }
  const existingIds = new Set(sceneModels.value.map(item => item.modelId));
  const appendIds = ids.filter(id => !existingIds.has(id));
  if (!appendIds.length) {
    modelPickerVisible.value = false;
    return;
  }

  const details = (
    await Promise.all(appendIds.map(id => fetchModelDetail(id)))
  ).filter(Boolean);
  details.forEach(detail => {
    sceneModels.value.push(createFullscreenSceneModel(detail));
  });

  if (!activeSceneModelId.value && sceneModels.value.length > 0) {
    activeSceneModelId.value = sceneModels.value[0].modelId;
  }
  syncActiveModelDetail();
  modelPickerVisible.value = false;
  message(`已添加 ${details.length} 个模型`, { type: "success" });
}

function removeSceneModel(item) {
  if (guardPlaneUnsupported("移除模型")) return;
  if (!item?.instanceId) return;
  sceneModels.value = sceneModels.value.filter(
    entry => entry.instanceId !== item.instanceId
  );
  if (activeSceneModelId.value === item.modelId) {
    activeSceneModelId.value = sceneModels.value[0]?.modelId || "";
  }
  syncActiveModelDetail();
  message(`已移除模型：${item.modelName || item.modelId}`, { type: "success" });
}

function selectSceneModelFromPanel(value) {
  if (guardPlaneUnsupported("添加或切换模型")) return;
  activeSceneModelId.value = value;
}

function refreshModelOptionsFromPanel() {
  if (guardPlaneUnsupported("刷新模型列表")) return;
  void loadAvailableModels(true);
}

const sceneManifest = computed(
  () => projectStore.projectPackage?.assets?.sceneManifest || {}
);
const currentProjectPackage = computed(
  () => projectStore.projectPackage || null
);
const assetGroups = ref([]);
const selectedLodId = ref("");
const qualityModeOptions = [
  { label: "高", value: "high" },
  { label: "中", value: "medium" },
  { label: "低", value: "low" },
  { label: "平面渲染", value: "plane" }
];
const INITIAL_FPS_PROMPT_THRESHOLD = 10;
const INITIAL_FPS_PROMPT_QUALITIES = new Set(["high", "medium"]);
const initialFpsPromptedKeys = new Set();
let initialFpsPromptVisible = false;

const isPlaneRendering = computed(() => quality.value === "plane");
const planeSnapshot = ref(null);
const planeSnapshotLoading = ref(false);
const planeObjectPositionMap = ref({});
const navigationSnapshot = ref(null);
const navigationSnapshotLoading = ref(false);
const navigationObjectPositionMap = ref({});
let planeSnapshotRequestId = 0;
let navigationSnapshotRequestId = 0;

const viewerModelUrl = computed(() => {
  const activeLod = isPlaneRendering.value
    ? null
    : (sceneManifest.value?.lodLevels || []).find(
        item => item.id === selectedLodId.value
      );
  const qualityProfiles = sceneManifest.value?.qualityProfiles || {};
  const qualityProfileKey = isPlaneRendering.value ? "low" : quality.value;
  const qualityMappedUrl = resolveHandoverModelUrl(
    qualityProfiles[qualityProfileKey] || ""
  );
  const manifestDefaultUrl = resolveHandoverModelUrl(
    sceneManifest.value?.defaultModelUrl || ""
  );
  const baseModelUrl = resolveHandoverModelUrl(modelUrl.value || "");
  const activeLodUrl = resolveHandoverModelUrl(activeLod?.modelUrl || "");
  const shouldPreferRouteModelUrl =
    Boolean(routeModelUrl.value) &&
    Boolean(routeModelId.value) &&
    String(activeSceneModel.value?.modelId || modelId.value || "").trim() ===
      routeModelId.value &&
    !activeLodUrl &&
    !isPlaneRendering.value &&
    qualityProfileKey === "high";

  if (activeLodUrl) {
    return activeLodUrl;
  }

  if (shouldPreferRouteModelUrl) {
    return baseModelUrl || qualityMappedUrl || manifestDefaultUrl;
  }

  return qualityMappedUrl || manifestDefaultUrl || baseModelUrl;
});

const runtimeAssetGroups = computed(() =>
  (assetGroups.value || []).map(item => ({
    ...item,
    uuidCount: Array.isArray(item.uuids) ? item.uuids.length : 0
  }))
);

const viewerRef = ref(null);
let sceneAnchorSyncSignature = "";

function handleViewerRefChange(value) {
  sceneAnchorSyncSignature = "";
  viewerRef.value = value;
}

function handleLayerTreeRefChange(value) {
  layerTreeRef.value = value;
}

function handleStructureTreeRefChange(value) {
  treeRef.value = value;
}

function handleVideoElementRefChange(value) {
  videoElementRef.value = value;
}

watch(
  viewerRef,
  value => {
    viewerAdapter.bindViewer(value || null);
  },
  { immediate: true }
);

const layerTreeRef = ref(null);
const schemeName = ref("");
const treeFilterText = ref("");
const treeRef = ref(null);
const selectedTreeNode = ref(null);
const treeDefaultExpandedKeys = ref([]);
const treeNodeIndex = ref(new Map());
const treeParentMap = ref(new Map());
const treeExpandedKeys = ref(new Set());
const treeV2Props = {
  value: "uuid",
  label: "name",
  children: "children"
};
const meshOpacity = ref(0.2);
const structureModelTypeFilter = ref("all");

const anchorDialogVisible = ref(false);
const anchorDialogKind = ref("anchor");
const anchorDialogMode = ref("create");
const anchorForm = ref(createEmptyAnchorForm());
const settingsDialogVisible = ref(false);
const anchorDialogMinimized = ref(false);
const positionPickingState = ref({
  active: false,
  kind: "",
  previousTool: "",
  pickedPosition: null
});
const anchorDetailVisible = ref(false);

const videoElementRef = ref(null);
const videoLoading = ref(false);
const videoErrorText = ref("");
let clippingPersistTimer = null;
let onFullscreenKeydown = null;
const shortcutEditableTags = new Set(["input", "textarea", "select"]);
const measurementShortcutMap = {
  1: { mode: "distance", label: "距离测量" },
  2: { mode: "angle", label: "角度测量" },
  3: { mode: "area", label: "面积测量" },
  4: { mode: "polyline", label: "折线测量" }
};
const clippingShortcutMap = {
  x: { presetId: "section-x", label: "X 平面剖切" },
  y: { presetId: "section-y", label: "Y 平面剖切" },
  z: { presetId: "section-z", label: "Z 平面剖切" },
  m: { presetId: "multi-slab-x", label: "双平面夹层剖切" }
};
const displayModeShortcutMap = {
  1: { mode: "all", label: "显示全部" },
  2: { mode: "business", label: "按业务绑定显示" },
  3: { mode: "system", label: "按系统显示" },
  4: { mode: "selection", label: "仅显示当前选择" }
};
const materialThemeShortcutMap = {
  8: { theme: "wireframe", label: "线框模式" },
  9: { theme: "basic", label: "实体模式" },
  0: { theme: "original", label: "渲染模式" }
};
const clippingAnimationPlaying = ref(false);
const clippingAnimationSpeed = ref(0.6);
const clippingAnimationMode = ref("ping-pong");
const clippingAnimationAxis = ref("auto");
const clippingAnimationModeOptions = [
  { label: "往返", value: "ping-pong" },
  { label: "循环", value: "loop" }
];
const clippingAnimationAxisOptions = [
  { label: "自动", value: "auto" },
  { label: "X 轴", value: "x" },
  { label: "Y 轴", value: "y" },
  { label: "Z 轴", value: "z" }
];

const clippingModeOptions = CLIPPING_MODE_OPTIONS;
const clippingAxisOptions = CLIPPING_AXIS_OPTIONS;
const clippingDirectionOptions = CLIPPING_DIRECTION_OPTIONS;
const clippingTargetOptions = CLIPPING_TARGET_OPTIONS;
const clippingSummaryText = computed(() =>
  getActiveClippingSummary(runtimeClippingState.value)
);
const anchorStyleDefaults = ref({
  anchor: {},
  camera: {}
});

function stopClippingAnimation({ persist = true } = {}) {
  const wasPlaying = clippingAnimationPlaying.value;
  clippingAnimationPlaying.value = false;
  if (viewerAdapter.isReady()) {
    viewerAdapter.stopClippingAnimation?.();
  }
  if (persist && wasPlaying) {
    schedulePersistClippingState();
  }
}

function toggleClippingAnimation() {
  if (guardPlaneUnsupported("剖切动画")) return;
  if (!enableClipping.value) {
    const nextState = ensureVisibleClippingState(runtimeClippingState.value);
    updateClippingState(nextState, { persist: false });
  }

  if (clippingAnimationPlaying.value) {
    stopClippingAnimation();
    message("已暂停剖切动画", { type: "info" });
    return;
  }

  viewerAdapter.setClippingAnimationOptions?.({
    speed: clippingAnimationSpeed.value,
    mode: clippingAnimationMode.value,
    axis: clippingAnimationAxis.value
  });
  viewerAdapter.startClippingAnimation?.({
    speed: clippingAnimationSpeed.value,
    mode: clippingAnimationMode.value,
    axis: clippingAnimationAxis.value
  });
  clippingAnimationPlaying.value = true;
  message("已开始剖切动画", { type: "success" });
}

const projectionMode = ref("perspective");

const {
  toolOptions,
  presetViews,
  measurementModeOptions,
  selectedCount,
  interactionMode,
  syncRoamingState,
  onToolChange,
  setMeasurementMode,
  zoomIn,
  zoomOut,
  resetView,
  toggleTransparent,
  toggleProjection,
  toggleRoaming,
  setPresetView,
  clearMeasurements,
  takeScreenshot,
  saveBookmark,
  applyBookmark
} = useViewerToolbarState({
  modelReady: computed(() => Boolean(modelUrl.value)),
  selectedObjectInfo,
  bookmarks,
  activeTool,
  measurementMode,
  roamingEnabled,
  transparent,
  projectionMode,
  notify: message,
  syncRoamingState: () => {
    roamingEnabled.value = viewerAdapter.getFirstPersonState();
    runtimeStore.setRoamingEnabled(roamingEnabled.value);
  },
  disableRoaming: () => viewerAdapter.toggleFirstPerson(false),
  toggleRoaming: () => viewerAdapter.toggleFirstPerson(),
  zoomIn: () => viewerAdapter.zoomIn(),
  zoomOut: () => viewerAdapter.zoomOut(),
  resetView: () => viewerAdapter.resetView(),
  toggleProjection: () => viewerAdapter.toggleProjection(),
  setPresetView: preset => viewerAdapter.setPresetView(preset),
  setMeasurementMode: mode => {
    runtimeStore.setMeasurementMode(mode);
    viewerAdapter.setMeasurementMode(mode);
  },
  clearMeasurements: () => {
    viewerAdapter.clearMeasurements();
    measurementRecords.value = [];
    projectStore.clearMeasurementRecords();
    persistMeasurementRecords();
  },
  takeScreenshot: () => {
    const filename = `bim-fullscreen-${Date.now()}.png`;
    viewerAdapter.downloadScreenshot(filename);
  },
  addBookmark: name => viewerAdapter.addBookmark(name),
  appendBookmark: bookmark => {
    bookmarks.value.push(bookmark);
    projectStore.setBookmarks(bookmarks.value);
    persistBookmarks();
  },
  applyBookmark: bookmark => viewerAdapter.applyBookmark(bookmark),
  onToolChangeExtra: value => {
    runtimeStore.setActiveTool(value);
    if (value === "measure") {
      activeSideTab.value = "measurements";
      viewerAdapter.setMeasurementMode(measurementMode.value);
    }
  }
});

const sceneAnchorTypeOptions = SCENE_ANCHOR_TYPE_OPTIONS;
const anchorBindingTypeOptions = ANCHOR_BINDING_TYPE_OPTIONS;
const cameraTypeOptions = CAMERA_TYPE_OPTIONS;
const cameraStreamTypeOptions = CAMERA_STREAM_TYPE_OPTIONS;
const cameraWindowModeOptions = CAMERA_WINDOW_MODE_OPTIONS;
const anchorIconOptions = SCENE_ANCHOR_ICON_OPTIONS;
const cameraIconOptions = CAMERA_ANCHOR_ICON_OPTIONS;

function getAnchorStyleDefault(kind = "anchor") {
  const type = kind === "camera" ? "camera-point" : "measurement-point";
  return normalizeAnchorStyle(anchorStyleDefaults.value?.[kind] || {}, type);
}

function getMergedAnchorStyle(kind = "anchor", item = {}) {
  const type =
    kind === "camera" ? "camera-point" : item.type || "measurement-point";
  return normalizeAnchorStyle(
    {
      ...getAnchorStyleDefault(kind),
      ...(item.style || {})
    },
    type
  );
}

function buildStyledAnchorForm(
  kind = "anchor",
  payload = {},
  selectedObject = null
) {
  const form =
    kind === "camera"
      ? payload && Object.keys(payload).length
        ? normalizeCameraForm(payload)
        : createEmptyCameraForm(selectedObject)
      : payload && Object.keys(payload).length
        ? normalizeAnchorForm(payload)
        : createEmptyAnchorForm(selectedObject);

  form.style = pickAnchorIconStyle(payload?.style || form.style) || {};
  return form;
}

function persistAnchorStyleDefaults() {
  patchSceneProjectPackage({
    anchorStyleDefaults: anchorStyleDefaults.value
  });
}

function handleSavePublicStyle({ kind, style }) {
  const type = kind === "camera" ? "camera-point" : "measurement-point";
  anchorStyleDefaults.value = {
    ...anchorStyleDefaults.value,
    [kind]: normalizeAnchorStyle(style, type)
  };
  persistAnchorStyleDefaults();
  syncSceneAnchors();
  message(kind === "camera" ? "已保存摄像头公共样式" : "已保存点位公共样式", {
    type: "success"
  });
}

function openSettingsDialog() {
  settingsDialogVisible.value = true;
}

function applyImportedSceneAnchors({ kind, items = [], mode = "append" }) {
  if (kind === "camera") {
    const next =
      mode === "replace"
        ? items
        : items.reduce(
            (list, item) => upsertItem(list, item),
            [...cameraAnchors.value]
          );
    cameraAnchors.value = next;
    projectStore.setCameraAnchors(next);
  } else {
    const next =
      mode === "replace"
        ? items
        : items.reduce(
            (list, item) => upsertItem(list, item),
            [...anchors.value]
          );
    anchors.value = next;
    projectStore.setAnchors(next);
  }

  persistSceneAnchorData();
  syncSceneAnchors();
}

function handleExportSceneAnchorData({ kind, format }) {
  const items = kind === "camera" ? cameraAnchors.value : anchors.value;
  if (format === "excel") {
    exportSceneAnchorExcel({ kind, items });
  } else {
    exportSceneAnchorJson({ kind, items });
  }
  message(
    kind === "camera"
      ? `已导出摄像头点位${format === "excel" ? " Excel" : " JSON"}`
      : `已导出点位${format === "excel" ? " Excel" : " JSON"}`,
    { type: "success" }
  );
}

async function handleImportSceneAnchorData({ kind, format, mode, file }) {
  try {
    const items = await importSceneAnchorFile({ file, kind, format });
    if (!items.length) {
      message("导入失败：未解析到有效数据", { type: "warning" });
      return;
    }
    applyImportedSceneAnchors({ kind, items, mode });
    message(
      kind === "camera"
        ? `已导入 ${items.length} 条摄像头点位`
        : `已导入 ${items.length} 条点位`,
      { type: "success" }
    );
  } catch (error) {
    message(error?.message || "导入失败，请检查文件格式", { type: "error" });
  }
}

const selectedSceneDevice = computed(() => {
  return (
    sceneDevices.value.find(item => item.uuid === selectedDeviceUuid.value) ||
    null
  );
});

const selectedKksDetailLoading = ref(false);
const selectedKksDetail = ref(null);
const selectedKksDetailError = ref("");

const currentMeasurementPoints = computed(() => {
  const kks = selectedSceneDevice.value?.kks;
  if (!kks) return [];
  return ddStore.getMeasurementPointsByKks(kks).map(point => ({
    ...point,
    targetUuid: selectedSceneDevice.value.uuid
  }));
});

const selectedDeviceProfile = computed(() => {
  const selectedDevice = selectedSceneDevice.value;
  const detail = selectedKksDetail.value || null;
  const kks = String(selectedDevice?.kks || detail?.kks || "").trim();
  const profile = kks ? ddStore.getDeviceProfileByKks(kks) : null;
  const structureParams = Array.isArray(profile?.structureParams)
    ? profile.structureParams
    : Array.isArray(detail?.structureParams)
      ? detail.structureParams
      : [];
  const runningParams = Array.isArray(profile?.runningParams)
    ? profile.runningParams
    : Array.isArray(detail?.runningParams)
      ? detail.runningParams
      : [];
  const hasLedgerFields = [
    profile?.ledgerNo,
    profile?.manufacturer,
    profile?.model,
    profile?.ratedPower,
    profile?.ratedVoltage,
    profile?.medium,
    profile?.functionDesc,
    detail?.ledgerNo,
    detail?.manufacturer,
    detail?.model
  ].some(Boolean);
  if (
    !kks &&
    !hasLedgerFields &&
    !structureParams.length &&
    !runningParams.length
  ) {
    return null;
  }
  return {
    ...(detail || {}),
    ...(profile || {}),
    kks,
    name: profile?.name || detail?.name || selectedDevice?.name || "",
    systemName:
      detail?.systemName ||
      detail?.systemNodeLabel ||
      detail?.systemNodeName ||
      profile?.systemName ||
      selectedDevice?.systemName ||
      "",
    ledgerNo: profile?.ledgerNo || detail?.ledgerNo || "",
    manufacturer: profile?.manufacturer || detail?.manufacturer || "",
    model: profile?.model || detail?.model || "",
    ratedPower: profile?.ratedPower || detail?.ratedPower || "",
    ratedVoltage: profile?.ratedVoltage || detail?.ratedVoltage || "",
    medium: profile?.medium || detail?.medium || "",
    functionDesc: profile?.functionDesc || detail?.functionDesc || "",
    structureParams,
    runningParams,
    updatedAt: detail?.updatedAt || profile?.updatedAt || "",
    dataSourceLabel: hasLedgerFields
      ? "设备台账"
      : detail?.kks
        ? "业务详情"
        : "",
    runningSourceLabel: runningParams.length ? "运行参数" : ""
  };
});

const filteredSceneDevices = computed(() => {
  const keyword = deviceKeyword.value.trim().toLowerCase();
  if (!keyword) return sceneDevices.value;
  return sceneDevices.value.filter(item => {
    return (
      item.name.toLowerCase().includes(keyword) ||
      item.type.toLowerCase().includes(keyword) ||
      item.path.toLowerCase().includes(keyword) ||
      item.kks.toLowerCase().includes(keyword)
    );
  });
});

const DEVICE_STATUS_COLOR_CONFIG = Object.freeze({
  alarm: "#ef4444",
  warning: "#f59e0b",
  offline: "#64748b"
});

function getDeviceStatusLevel(status = "") {
  const text = String(status || "")
    .trim()
    .toLowerCase();
  if (!text || text === "-") return "";
  if (
    ["alarm", "danger", "error", "fault", "告警", "报警", "异常", "故障"].some(
      item => text.includes(item)
    )
  ) {
    return "alarm";
  }
  if (
    ["warning", "warn", "risk", "预警", "警告", "风险"].some(item =>
      text.includes(item)
    )
  ) {
    return "warning";
  }
  if (
    ["offline", "disconnect", "stopped", "离线", "断线", "停机", "停运"].some(
      item => text.includes(item)
    )
  ) {
    return "offline";
  }
  return "";
}

function getDeviceStatusColor(status = "") {
  return DEVICE_STATUS_COLOR_CONFIG[getDeviceStatusLevel(status)] || "";
}

const structureBindingMap = computed(() => {
  const map = {};
  sceneDevices.value.forEach(device => {
    const kks = String(device?.kks || "").trim();
    const status = {
      kks,
      state: String(device?.status || "").trim(),
      documentCount: Array.isArray(device?.boundDocuments)
        ? device.boundDocuments.length
        : 0,
      measurementCount: kks ? ddStore.getMeasurementPointsByKks(kks).length : 0
    };
    [
      device?.uuid,
      ...(Array.isArray(device?.meshUuids) ? device.meshUuids : [])
    ]
      .map(uuid => String(uuid || "").trim())
      .filter(Boolean)
      .forEach(uuid => {
        map[uuid] = status;
      });
  });
  return map;
});

const sceneDeviceStatusColorEntries = computed(() => {
  return sceneDevices.value
    .map(device => {
      const color = getDeviceStatusColor(device?.status);
      if (!color) return null;
      const uuids = getSceneDeviceUuids(device);
      if (!uuids.length) return null;
      return {
        uuids,
        color,
        opacity: 1,
        status: String(device?.status || ""),
        kks: String(device?.kks || "")
      };
    })
    .filter(Boolean);
});

const sceneDeviceStatusColorSignature = computed(() =>
  sceneDeviceStatusColorEntries.value
    .map(
      item =>
        `${item.uuids.join(",")}:${item.color}:${item.opacity}:${item.status}`
    )
    .join("|")
);

const sceneDeviceSystemOptions = computed(() => {
  const grouped = new Map();
  sceneDevices.value.forEach(item => {
    if (!item.nodeId) return;
    const existing = grouped.get(item.nodeId) || {
      label: item.systemName || getSystemNodeLabel(item.nodeId),
      value: item.nodeId,
      count: 0
    };
    existing.count += 1;
    grouped.set(item.nodeId, existing);
  });
  return Array.from(grouped.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "zh-CN")
  );
});

const sceneDeviceKksOptions = computed(() => {
  return sceneDevices.value
    .filter(item => item.kks)
    .map(item => ({
      label: `${item.name}（${item.kks}）`,
      value: item.kks
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
});

const navigationMapSystemItems = computed(() => {
  return sceneDeviceSystemOptions.value
    .map(system => {
      const positions = sceneDevices.value
        .filter(item => item.nodeId === system.value)
        .map(item => navigationObjectPositionMap.value[item.uuid])
        .filter(Boolean);
      const center = averageWorldPositions(positions);
      const percent = projectWorldPositionToSnapshot(center);
      if (!percent) return null;
      return {
        id: `system:${system.value}`,
        type: "system",
        label: system.label,
        shortLabel:
          String(system.label || "")
            .trim()
            .slice(0, 2) || "系统",
        count: system.count || 0,
        nodeId: system.value,
        ...percent
      };
    })
    .filter(Boolean);
});

const navigationMapBookmarkItems = computed(() => {
  return bookmarks.value
    .map((bookmark, index) => {
      const target = normalizeWorldVector(
        bookmark?.camera?.target || bookmark?.camera?.position
      );
      const percent = projectWorldPositionToSnapshot(target);
      if (!percent) return null;
      return {
        id: `bookmark:${index}`,
        type: "bookmark",
        label: bookmark?.name || `视角 ${index + 1}`,
        shortLabel: `${index + 1}`,
        bookmark,
        ...percent
      };
    })
    .filter(Boolean);
});

const navigationMapSelectedDeviceItem = computed(() => {
  const device = selectedSceneDevice.value;
  if (!device?.uuid) return null;
  const percent = projectWorldPositionToSnapshot(
    navigationObjectPositionMap.value[device.uuid]
  );
  if (!percent) return null;
  return {
    id: `device:${device.uuid}`,
    type: "device",
    label: device.kks ? `${device.name}（${device.kks}）` : device.name,
    shortLabel: "当前",
    device,
    ...percent
  };
});

const navigationMapItems = computed(() => {
  const items = [
    ...navigationMapSystemItems.value,
    ...navigationMapBookmarkItems.value
  ];
  if (navigationMapSelectedDeviceItem.value) {
    items.push(navigationMapSelectedDeviceItem.value);
  }
  return items;
});

const navigationMapActiveId = computed(() => {
  if (selectedSceneDevice.value?.uuid) {
    return `device:${selectedSceneDevice.value.uuid}`;
  }
  if (selectedSystemNodeId.value) {
    return `system:${selectedSystemNodeId.value}`;
  }
  return "";
});

const sceneObjectOptions = computed(() => {
  const options = sceneDevices.value
    .filter(item => item.uuid)
    .map(item => ({
      label: `${item.name}（${item.type}）`,
      value: item.uuid
    }));
  const selected = selectedObjectInfo.value;
  if (selected?.uuid && !options.some(item => item.value === selected.uuid)) {
    options.unshift({
      label: `${selected.name || "当前选中构件"}（${selected.type || "Mesh"}）`,
      value: selected.uuid
    });
  }
  return options;
});

const MODEL_TYPE_LABELS = {
  glb: "GLB",
  gltf: "GLTF",
  ifc: "IFC",
  obj: "OBJ"
};

function normalizeModelType(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function walkSceneTree(node, visitor) {
  if (!node) return;
  visitor(node);
  (node.children || []).forEach(child => walkSceneTree(child, visitor));
}

const structureModelTypeOptions = computed(() => {
  const types = new Set();
  walkSceneTree(sceneTree.value, node => {
    const type = normalizeModelType(node.sceneModelType);
    if (type) types.add(type);
  });

  return [
    { label: "全部类型", value: "all" },
    ...Array.from(types)
      .sort()
      .map(type => ({
        label: MODEL_TYPE_LABELS[type] || type.toUpperCase(),
        value: type
      }))
  ];
});

function getStructureFilterPayload(criteria) {
  if (criteria && typeof criteria === "object") {
    return {
      keyword: String(criteria.keyword || "")
        .trim()
        .toLowerCase(),
      modelType: normalizeModelType(criteria.modelType || "all")
    };
  }
  return {
    keyword: String(criteria || "")
      .trim()
      .toLowerCase(),
    modelType: normalizeModelType(structureModelTypeFilter.value || "all")
  };
}

function structureNodeMatchesKeyword(node, keyword) {
  if (!keyword) return true;
  const texts = [
    node?.name,
    node?.type,
    node?.sceneModelName,
    node?.sceneModelId,
    node?.sceneModelType
  ];
  return texts.some(text =>
    String(text || "")
      .trim()
      .toLowerCase()
      .includes(keyword)
  );
}

function structureNodeMatchesModelType(node, modelType) {
  if (!modelType || modelType === "all") return true;
  return normalizeModelType(node?.sceneModelType) === modelType;
}

function structureNodeOrDescendantMatches(node, predicate) {
  if (predicate(node)) return true;
  return (node?.children || []).some(child =>
    structureNodeOrDescendantMatches(child, predicate)
  );
}

function structureFilterMethod(criteria, node) {
  const { keyword, modelType } = getStructureFilterPayload(criteria);
  return structureNodeOrDescendantMatches(node, item => {
    return (
      structureNodeMatchesKeyword(item, keyword) &&
      structureNodeMatchesModelType(item, modelType)
    );
  });
}

const deviceKksOptions = computed(() => {
  return ddStore.kksItems
    .filter(item => item.type === "设备")
    .map(item => ({
      label: `${item.name}（${item.kks}）`,
      value: item.kks
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
});

const renderableAnchors = computed(() => {
  const source = [...anchors.value];
  if (
    positionPickingState.value.active &&
    positionPickingState.value.kind === "anchor" &&
    Array.isArray(positionPickingState.value.pickedPosition)
  ) {
    source.push({
      ...normalizeAnchorForm(anchorForm.value),
      id: "__picking-anchor-preview__",
      type: "custom-point",
      anchorMode: "world",
      worldPosition: [...positionPickingState.value.pickedPosition],
      offset: [0, 0, 0],
      name: anchorForm.value.name || "点位预览",
      visible: true
    });
  }
  return buildRenderableAnchors(source, {
    getMeasurementPointsByKks: kks => ddStore.getMeasurementPointsByKks(kks),
    getDeviceProfileByKks: kks => ddStore.getDeviceProfileByKks(kks),
    getNodeLabel: nodeId => getSystemNodeLabel(nodeId)
  }).map(item => ({
    ...item,
    style: getMergedAnchorStyle("anchor", item)
  }));
});

const renderableCameraAnchors = computed(() => {
  const source = [...cameraAnchors.value];
  if (
    positionPickingState.value.active &&
    positionPickingState.value.kind === "camera" &&
    Array.isArray(positionPickingState.value.pickedPosition)
  ) {
    source.push({
      ...normalizeCameraForm(anchorForm.value),
      id: "__picking-camera-preview__",
      type: "camera-point",
      anchorMode: "world",
      worldPosition: [...positionPickingState.value.pickedPosition],
      offset: [0, 0, 0],
      name:
        anchorForm.value.cameraName || anchorForm.value.name || "摄像头预览",
      visible: true
    });
  }
  return buildRenderableAnchors(source, {
    getMeasurementPointsByKks: kks => ddStore.getMeasurementPointsByKks(kks),
    getDeviceProfileByKks: kks => ddStore.getDeviceProfileByKks(kks),
    getNodeLabel: nodeId => getSystemNodeLabel(nodeId)
  }).map(item => ({
    ...item,
    style: getMergedAnchorStyle("camera", item)
  }));
});

const planeSnapshotSignature = computed(() =>
  JSON.stringify({
    modelUrl: viewerModelUrl.value,
    models: viewerSceneModels.value.map(item => ({
      id: item.modelId,
      instanceId: item.instanceId,
      visible: item.visible !== false,
      transform: item.transform
    })),
    lod: selectedLodId.value,
    materialTheme: materialTheme.value
  })
);

const navigationSnapshotSignature = computed(() =>
  JSON.stringify({
    modelUrl: viewerModelUrl.value,
    models: viewerSceneModels.value.map(item => ({
      id: item.modelId,
      instanceId: item.instanceId,
      visible: item.visible !== false,
      transform: item.transform
    })),
    lod: selectedLodId.value,
    materialTheme: materialTheme.value,
    groups: runtimeAssetGroups.value.map(item => ({
      id: item.id || item.name || "",
      visible: item.visible !== false
    }))
  })
);

function normalizeWorldVector(value) {
  if (Array.isArray(value) && value.length >= 3) {
    const next = value.slice(0, 3).map(Number);
    return next.every(Number.isFinite) ? next : null;
  }
  if (value && typeof value.toArray === "function") {
    return normalizeWorldVector(value.toArray());
  }
  return null;
}

function clampPercent(value) {
  return Math.min(100, Math.max(0, value));
}

function projectWorldPositionToSnapshot(
  position,
  snapshot = navigationSnapshot.value
) {
  const world = normalizeWorldVector(position);
  const bounds = snapshot?.viewBounds;
  if (!world || !bounds) return null;
  const width = Math.max(bounds.maxX - bounds.minX, 0.0001);
  const depth = Math.max(bounds.maxZ - bounds.minZ, 0.0001);
  return {
    xPercent: clampPercent(((world[0] - bounds.minX) / width) * 100),
    yPercent: clampPercent(((bounds.maxZ - world[2]) / depth) * 100)
  };
}

function averageWorldPositions(positions = []) {
  if (!positions.length) return null;
  const total = positions.reduce(
    (result, item) => {
      result.x += item[0];
      result.y += item[1];
      result.z += item[2];
      return result;
    },
    { x: 0, y: 0, z: 0 }
  );
  return [
    total.x / positions.length,
    total.y / positions.length,
    total.z / positions.length
  ];
}

function rebuildPlaneObjectPositionMap() {
  const ids = new Set();
  [...renderableAnchors.value, ...renderableCameraAnchors.value].forEach(
    item => {
      if (item?.objectUuid) ids.add(item.objectUuid);
    }
  );

  const next = {};
  ids.forEach(uuid => {
    const position = normalizeWorldVector(
      viewerAdapter.getObjectWorldPositionByUUID(uuid)
    );
    if (position) next[uuid] = position;
  });
  planeObjectPositionMap.value = next;
}

function rebuildNavigationObjectPositionMap() {
  if (!viewerAdapter.isReady()) return;
  const next = {};
  sceneDevices.value.forEach(item => {
    if (!item?.uuid) return;
    const position = normalizeWorldVector(
      viewerAdapter.getObjectWorldPositionByUUID(item.uuid)
    );
    if (position) next[item.uuid] = position;
  });
  navigationObjectPositionMap.value = next;
}

function guardPlaneUnsupported(action = "该操作") {
  if (!isPlaneRendering.value) return false;
  message(`平面渲染不支持${action}`, { type: "warning" });
  return true;
}

function runWhenNotPlane(action, callback) {
  if (guardPlaneUnsupported(action)) return false;
  return callback?.();
}

async function refreshPlaneSnapshot({ force = false } = {}) {
  if (!isPlaneRendering.value || !viewerAdapter.isReady()) return;
  if (planeSnapshotLoading.value && !force) return;
  const requestId = ++planeSnapshotRequestId;
  planeSnapshotLoading.value = true;
  try {
    await nextTick();
    viewerAdapter.setRenderPaused(false);
    const snapshot = viewerAdapter.captureTopViewSnapshot({
      maxWidth: 1600,
      backgroundColor: "#eef2f6"
    });
    if (requestId !== planeSnapshotRequestId) return;
    planeSnapshot.value = snapshot || null;
    rebuildPlaneObjectPositionMap();
  } catch (error) {
    console.error("capture plane snapshot failed", error);
    if (requestId === planeSnapshotRequestId) {
      planeSnapshot.value = null;
      message("生成平面底图失败", { type: "error" });
    }
  } finally {
    if (requestId === planeSnapshotRequestId) {
      planeSnapshotLoading.value = false;
      if (isPlaneRendering.value) {
        viewerAdapter.setRenderPaused(true);
      }
    }
  }
}

async function refreshNavigationSnapshot({ force = false } = {}) {
  if (!viewerAdapter.isReady()) return;
  if (navigationSnapshotLoading.value && !force) return;
  const requestId = ++navigationSnapshotRequestId;
  const shouldResumeRender = isPlaneRendering.value;
  navigationSnapshotLoading.value = true;
  try {
    await nextTick();
    if (shouldResumeRender) {
      viewerAdapter.setRenderPaused(false);
    }
    const snapshot = viewerAdapter.captureTopViewSnapshot({
      maxWidth: 960,
      backgroundColor: "#eef2f6"
    });
    if (requestId !== navigationSnapshotRequestId) return;
    navigationSnapshot.value = snapshot || null;
    rebuildNavigationObjectPositionMap();
  } catch (error) {
    console.error("capture navigation snapshot failed", error);
    if (requestId === navigationSnapshotRequestId) {
      navigationSnapshot.value = null;
      message("生成导航图失败", { type: "error" });
    }
  } finally {
    if (requestId === navigationSnapshotRequestId) {
      navigationSnapshotLoading.value = false;
      if (shouldResumeRender) {
        viewerAdapter.setRenderPaused(true);
      }
    }
  }
}

const activeAnchorDetail = computed(() => {
  return (
    renderableAnchors.value.find(item => item.id === selectedAnchorId.value) ||
    null
  );
});

const activeCameraDetail = computed(() => {
  return (
    renderableCameraAnchors.value.find(
      item => item.id === selectedCameraId.value
    ) ||
    activeVideoSource.value ||
    null
  );
});

const anchorMeasurementOptions = computed(() => {
  const kks =
    anchorForm.value?.businessBinding?.kks || anchorForm.value?.bindDeviceKks;
  if (!kks) return [];
  return ddStore.getMeasurementPointsByKks(kks).map(item => ({
    label: `${item.tag} ${item.name}`,
    value: item.id
  }));
});

const pickedPositionText = computed(() => {
  const position = positionPickingState.value.pickedPosition;
  if (!Array.isArray(position) || position.length < 3) return "未拾取位置";
  return position.map(item => Number(item || 0).toFixed(3)).join(", ");
});

const anchorDialogTitle = computed(() => {
  const text = anchorDialogKind.value === "camera" ? "摄像头" : "点位";
  return `${anchorDialogMode.value === "edit" ? "编辑" : "新增"}${text}`;
});

const videoPreviewSupported = computed(() => {
  return videoAdapter.canPlay(
    activeCameraDetail.value?.streamType,
    activeCameraDetail.value?.streamUrl
  );
});

const displayModeText = computed(() => {
  if (!modelUrl.value || !sceneDevices.value.length) return "未加载模型";
  const map = {
    all: "全部构件",
    business: "已绑定业务设备",
    system: "当前系统",
    selection: "当前设备",
    model: "当前模型",
    type: "当前类型",
    tree: "分层树筛选"
  };
  return map[displayMode.value] || "全部构件";
});

const configuredObjectBindings = computed(() => {
  const fromViewerConfig = getConfig("Viewer3D.ModelObjectBindings");
  const fromRootConfig = getConfig("ModelObjectBindings");
  const rawBindings = Array.isArray(fromViewerConfig)
    ? fromViewerConfig
    : Array.isArray(fromRootConfig)
      ? fromRootConfig
      : [];
  return buildConfiguredObjectBindings(rawBindings);
});

const navigationTreeData = computed(() => {
  return sceneModels.value.map(item => {
    const devices = sceneDevices.value
      .filter(device => device.instanceId === item.instanceId)
      .map(device => ({
        id: `nav-device:${device.uuid}`,
        label: device.name,
        kind: "device",
        uuid: device.uuid,
        nodeId: device.nodeId,
        kks: device.kks,
        documentCount: Array.isArray(device.boundDocuments)
          ? device.boundDocuments.length
          : 0,
        raw: device
      }));

    return {
      id: `nav-model:${item.instanceId}`,
      label: `${item.modelName || "未命名模型"}${devices.length ? `（${devices.length}）` : ""}`,
      kind: "model",
      instanceId: item.instanceId,
      modelId: item.modelId,
      nodeId: item.instanceId,
      parentId: "",
      deviceCount: devices.length,
      children: devices
    };
  });
});

const layerTreeData = computed(() => {
  return sceneDeviceSystemOptions.value.map(system => ({
    id: `layer-system:${system.value}`,
    label: `${system.label}（${system.count}）`,
    kind: "system",
    nodeId: system.value,
    children: getDevicesBySystem(system.value).map(device => ({
      id: device.uuid,
      label: device.kks ? `${device.name}（${device.kks}）` : device.name,
      kind: "device",
      uuid: device.uuid
    }))
  }));
});

const allLayerLeafKeys = computed(() => {
  return sceneDevices.value.map(item => item.uuid);
});

function persistSceneSchemes() {
  patchSceneProjectPackage({
    schemes: sceneSchemes.value
  });
}

function persistBookmarks() {
  patchSceneProjectPackage({
    bookmarks: bookmarks.value
  });
}

function saveSceneScheme() {
  if (!modelUrl.value) {
    message("请先加载模型后再保存场景方案", { type: "warning" });
    return;
  }
  const name =
    schemeName.value.trim() || `场景方案 ${sceneSchemes.value.length + 1}`;
  const payload = buildCurrentSceneSchemePayload({
    name,
    scope: currentSceneSchemeScope.value,
    displayMode: displayMode.value,
    selectedSystemNodeId: selectedSystemNodeId.value,
    selectedQuickKks: selectedQuickKks.value,
    activeRightTab: activeSideTab.value,
    pointMarkersVisible: pointMarkersVisible.value,
    clippingState: cloneClippingState(runtimeClippingState.value),
    sceneDevices: sceneDevices.value,
    layerCheckedKeys: layerCheckedKeys.value
  });
  sceneSchemes.value.unshift(payload);
  projectStore.setSceneSchemes(sceneSchemes.value);
  persistSceneSchemes();
  schemeName.value = "";
  message(`已保存场景方案：${name}`, { type: "success" });
}

function applySceneScheme(scheme) {
  if (!scheme || !viewerRef.value) return;

  const visibleKeys = resolveSceneSchemeUuids({
    deviceRefs: scheme.visibleDeviceRefs || [],
    sceneDevices: sceneDevices.value
  });
  selectedSystemNodeId.value = scheme.selectedSystemNodeId || "";
  selectedQuickKks.value = scheme.selectedQuickKks || "";
  activeSideTab.value = scheme.activeRightTab || "scene";
  pointMarkersVisible.value = scheme.pointMarkersVisible !== false;

  if (
    !visibleKeys.length ||
    visibleKeys.length === allLayerLeafKeys.value.length
  ) {
    applyDisplayMode("all", false);
  } else {
    syncLayerTreeSelection(visibleKeys);
    applyLayerVisibility(visibleKeys);
  }

  if (scheme.displayMode === "system" && selectedSystemNodeId.value) {
    applyDisplayMode("system", false);
  } else if (scheme.displayMode === "business") {
    applyDisplayMode("business", false);
  } else if (scheme.displayMode === "selection" && selectedQuickKks.value) {
    locateByKks(selectedQuickKks.value);
    applyDisplayMode("selection", false);
  } else if (selectedQuickKks.value) {
    locateByKks(selectedQuickKks.value);
  } else if (selectedSystemNodeId.value) {
    locateSystem(selectedSystemNodeId.value, false);
  }

  if (scheme.clippingState) {
    updateClippingState(scheme.clippingState);
  }

  syncMeasurementPoints();
  message(`已应用场景方案：${scheme.name}`, { type: "success" });
}

function removeSceneScheme(id) {
  sceneSchemes.value = sceneSchemes.value.filter(item => item.id !== id);
  projectStore.setSceneSchemes(sceneSchemes.value);
  persistSceneSchemes();
  message("已删除场景方案", { type: "success" });
}

function formatSchemeTime(value) {
  return formatSceneSchemeTime(value);
}

function serializeAnchorForPersistence(item = {}) {
  return {
    ...item,
    style: pickAnchorIconStyle(item.style)
  };
}

function persistSceneAnchorData() {
  patchSceneProjectPackage({
    anchors: anchors.value.map(serializeAnchorForPersistence),
    cameras: cameraAnchors.value.map(serializeAnchorForPersistence),
    clipping: projectClippingState.value,
    anchorStyleDefaults: anchorStyleDefaults.value
  });
}

function persistClippingState() {
  const normalized = normalizeClippingState(runtimeClippingState.value);
  projectStore.setClippingState(normalized);
  patchSceneProjectPackage({
    clipping: normalized
  });
}

function buildProjectInfoPayload() {
  const serializedSceneModels = serializeSceneModels(sceneModels.value, {
    mapMetadata: item => ({
      ...(item.metadata || {}),
      quality: item.modelId === activeSceneModelId.value ? quality.value : ""
    })
  });
  const serializedObjectBindings = serializeSceneObjectBindings(
    sceneDevices.value,
    {
      bindingIdBuilder: item => `binding-${item.uuid}`,
      resolveInstanceId: item =>
        item.instanceId || activeSceneModel.value?.instanceId || "",
      includeTypeInProperties: true
    }
  );

  return {
    version: "2.0.0",
    schema: "dd-handover-project-scene",
    project: {
      id: handoverProjectId.value || projectStore.projectId || "",
      name: handoverProjectName.value || projectStore.projectName || "",
      updatedAt: Date.now()
    },
    metadata: {
      projectId: handoverProjectId.value || projectStore.projectId || "",
      projectName: handoverProjectName.value || projectStore.projectName || "",
      modelId: modelId.value,
      modelName: modelName.value,
      modelUrl: modelUrl.value
    },
    scene: {
      activeModelId: activeSceneModelId.value || modelId.value,
      navigationTree: systemNodeTree.value,
      models: serializedSceneModels,
      bindings: {
        objectBindings: serializedObjectBindings
      },
      anchors: anchors.value.map(serializeAnchorForPersistence),
      cameras: cameraAnchors.value.map(serializeAnchorForPersistence),
      anchorStyleDefaults: anchorStyleDefaults.value,
      measurements: measurementRecords.value,
      schemes: sceneSchemes.value,
      bookmarks: bookmarks.value,
      assetGroups: assetGroups.value,
      clipping: projectClippingState.value,
      clippingPresets: clippingPresets.value
    },
    runtime: {
      quality: quality.value,
      materialTheme: materialTheme.value,
      activeTool: activeTool.value,
      measurementMode: measurementMode.value,
      displayMode: displayMode.value,
      transparentEnabled: transparent.value,
      roamingEnabled: roamingEnabled.value,
      showStats: showStats.value,
      showSidePanel: showSidePanel.value,
      activeSideTab: activeSideTab.value,
      pointMarkersVisible: pointMarkersVisible.value,
      anchorMarkersVisible: anchorMarkersVisible.value,
      cameraMarkersVisible: cameraMarkersVisible.value,
      selectedObjectRef:
        selectedObjectInfo.value?.objectUuid || selectedObjectInfo.value?.uuid
          ? {
              instanceId:
                selectedObjectInfo.value?.userData?.sceneModelInstanceId ||
                activeSceneModel.value?.instanceId ||
                "",
              objectUuid:
                selectedObjectInfo.value?.objectUuid ||
                selectedObjectInfo.value?.uuid ||
                ""
            }
          : null,
      selectedDeviceUuid: selectedDeviceUuid.value,
      selectedAnchorId: selectedAnchorId.value,
      selectedCameraId: selectedCameraId.value,
      selectedSystemNodeId: selectedSystemNodeId.value,
      selectedQuickKks: selectedQuickKks.value,
      currentNavNodeKey: currentNavNodeKey.value,
      layerCheckedObjectRefs: sceneDevices.value
        .filter(item => layerCheckedKeys.value.includes(item.uuid))
        .map(item => ({
          instanceId:
            item.instanceId || activeSceneModel.value?.instanceId || "",
          objectUuid: item.uuid
        }))
    },
    projectPackage: {
      ...(projectStore.projectPackage || {}),
      metadata: {
        ...(projectStore.projectPackage?.metadata || {}),
        projectId: handoverProjectId.value || projectStore.projectId || "",
        projectName:
          handoverProjectName.value || projectStore.projectName || "",
        modelId: modelId.value,
        modelName: modelName.value,
        modelUrl: modelUrl.value
      },
      scene: {
        ...(projectStore.projectPackage?.scene || {}),
        navigationTree: systemNodeTree.value,
        models: sceneModels.value,
        bindings: {
          ...(projectStore.projectPackage?.scene?.bindings || {}),
          objectBindings: serializedObjectBindings
        },
        anchors: anchors.value.map(serializeAnchorForPersistence),
        cameras: cameraAnchors.value.map(serializeAnchorForPersistence),
        measurements: measurementRecords.value,
        schemes: sceneSchemes.value,
        bookmarks: bookmarks.value,
        clipping: projectClippingState.value,
        clippingPresets: clippingPresets.value
      },
      assets: {
        ...(projectStore.projectPackage?.assets || {}),
        sceneManifest: {
          ...(projectStore.projectPackage?.assets?.sceneManifest || {}),
          groups: assetGroups.value
        }
      },
      scripts: {
        animations: scriptDefinitions.value?.animations || [],
        triggers: scriptDefinitions.value?.triggers || []
      },
      integrations: {
        realtime: integrationConfigs.value?.realtime || {},
        backendBridge: integrationConfigs.value?.backendBridge || {}
      },
      extensions: {
        ...(projectStore.projectPackage?.extensions || {})
      },
      updatedAt: Date.now()
    }
  };
}

async function saveCurrentProject() {
  if (!handoverProjectId.value) {
    message("当前全屏页面未绑定项目，无法保存", { type: "warning" });
    return;
  }

  savingProject.value = true;
  try {
    const project = await loadHandoverProjectContext();
    if (!project?.id) {
      throw new Error("未找到当前项目");
    }
    const payload = buildProjectInfoPayload();
    const response = await updateHandoverProject({
      id: project.id,
      projectName: project.projectName || handoverProjectName.value || "",
      projectInfo: JSON.stringify(payload)
    });
    const success =
      response?.success === true ||
      response?.code === 200 ||
      response?.code === 0;
    if (!success) {
      throw new Error(response?.message || "保存项目失败");
    }
    currentProjectContext.value = project
      ? {
          ...project,
          projectInfo: JSON.stringify(payload),
          parsedProjectInfo: payload
        }
      : {
          id: handoverProjectId.value,
          projectName: handoverProjectName.value,
          projectInfo: JSON.stringify(payload),
          parsedProjectInfo: payload
        };
    message("项目已保存", { type: "success" });
  } catch (error) {
    console.error("save current fullscreen project failed", error);
    message(error?.message || "保存项目失败", { type: "error" });
  } finally {
    savingProject.value = false;
  }
}

function schedulePersistClippingState() {
  if (clippingPersistTimer) clearTimeout(clippingPersistTimer);
  clippingPersistTimer = setTimeout(() => {
    persistClippingState();
  }, 120);
}

function createScopedProjectPackage(scope, rawPackage = null) {
  const metadata = getProjectMetadata();
  const basePackage = loadProjectPackage(scope, metadata);
  if (!rawPackage) return basePackage;

  const parsedPackage = parseImportedProjectPackage(rawPackage, metadata);
  return {
    ...basePackage,
    ...parsedPackage,
    scope,
    metadata: {
      ...basePackage.metadata,
      ...(parsedPackage.metadata || {}),
      ...metadata
    },
    scene: {
      ...basePackage.scene,
      ...(parsedPackage.scene || {})
    },
    scripts: {
      ...basePackage.scripts,
      ...(parsedPackage.scripts || {})
    },
    assets: {
      ...basePackage.assets,
      ...(parsedPackage.assets || {}),
      sceneManifest: {
        ...basePackage.assets?.sceneManifest,
        ...(parsedPackage.assets?.sceneManifest || {})
      }
    },
    integrations: {
      ...basePackage.integrations,
      ...(parsedPackage.integrations || {})
    },
    extensions: {
      ...basePackage.extensions,
      ...(parsedPackage.extensions || {}),
      schedule4d: {
        ...(basePackage.extensions?.schedule4d || {}),
        ...(parsedPackage.extensions?.schedule4d || {})
      },
      cost5d: {
        ...(basePackage.extensions?.cost5d || {}),
        ...(parsedPackage.extensions?.cost5d || {})
      }
    }
  };
}

function resolvePersistedProjectPackage(
  projectInfo = null,
  { preferProjectInfo = true, persistResolvedPackage = preferProjectInfo } = {}
) {
  const backendPackage = projectInfo?.projectPackage
    ? createScopedProjectPackage(
        currentSceneSchemeScope.value,
        projectInfo.projectPackage
      )
    : null;

  if (preferProjectInfo && backendPackage) {
    if (persistResolvedPackage) {
      saveProjectPackage(currentSceneSchemeScope.value, backendPackage);
    }
    return backendPackage;
  }

  const currentPackage = loadProjectPackage(
    currentSceneSchemeScope.value,
    getProjectMetadata()
  );
  if (hasProjectPackageContent(currentPackage) || !backendPackage) {
    return currentPackage;
  }

  if (persistResolvedPackage) {
    saveProjectPackage(currentSceneSchemeScope.value, backendPackage);
  }
  return backendPackage;
}

function loadPersistedProjectState(
  projectInfo = null,
  { preferProjectInfo = true, persistResolvedPackage = preferProjectInfo } = {}
) {
  const projectPackage = resolvePersistedProjectPackage(projectInfo, {
    preferProjectInfo,
    persistResolvedPackage
  });
  const restoredState = resolveRestoredViewerProjectState({
    projectInfo,
    projectPackage,
    preferProjectInfo,
    normalizeSavedObjectBinding,
    mapSystemTreeNodes,
    buildStyledAnchorForm,
    createDefaultClippingState,
    normalizeClippingState,
    currentRuntime: {
      materialTheme: materialTheme.value,
      activeTool: activeTool.value,
      measurementMode: measurementMode.value,
      displayMode: displayMode.value
    }
  });

  applyRestoredViewerProjectState({
    restoredState,
    projectPackage,
    projectStore,
    runtimeStore,
    updateSceneModelNodeLabels,
    setSavedObjectBindings: value => {
      savedObjectBindings.value = value;
    },
    setSystemNodeTree: value => {
      systemNodeTree.value = value;
    },
    setAnchorStyleDefaults: value => {
      anchorStyleDefaults.value = value;
    },
    setAnchors: value => {
      anchors.value = value;
    },
    setCameraAnchors: value => {
      cameraAnchors.value = value;
    },
    setMeasurementRecords: value => {
      measurementRecords.value = value;
    },
    setSceneSchemes: value => {
      sceneSchemes.value = value;
    },
    setBookmarks: value => {
      bookmarks.value = value;
    },
    setAssetGroups: value => {
      assetGroups.value = value;
    },
    setQuality: value => {
      quality.value = value;
    },
    setMaterialTheme: value => {
      materialTheme.value = value;
    },
    setActiveTool: value => {
      activeTool.value = value;
    },
    setMeasurementMode: value => {
      measurementMode.value = value;
    },
    setDisplayMode: value => {
      displayMode.value = value;
    },
    setShowStats: value => {
      showStats.value = value;
    },
    setShowSidePanel: value => {
      showSidePanel.value = value;
    },
    setActiveSideTab: value => {
      activeSideTab.value = value;
    },
    setTransparent: value => {
      transparent.value = value;
    },
    setPointMarkersVisible: value => {
      pointMarkersVisible.value = value;
    },
    setAnchorMarkersVisible: value => {
      anchorMarkersVisible.value = value;
    },
    setCameraMarkersVisible: value => {
      cameraMarkersVisible.value = value;
    },
    setSelectedDeviceUuid: value => {
      selectedDeviceUuid.value = value;
    },
    setSelectedAnchorId: value => {
      selectedAnchorId.value = value;
    },
    setSelectedCameraId: value => {
      selectedCameraId.value = value;
    },
    setSelectedSystemNodeId: value => {
      selectedSystemNodeId.value = value;
    },
    setSelectedQuickKks: value => {
      selectedQuickKks.value = value;
    },
    setCurrentNavNodeKey: value => {
      currentNavNodeKey.value = value;
    }
  });
}

function applyAssetGroupVisibility() {
  const groupsWithUuids = assetGroups.value.filter(
    item => Array.isArray(item.uuids) && item.uuids.length
  );
  if (!groupsWithUuids.length) {
    viewerAdapter.filterVisibleUUIDs(null);
    return;
  }
  const visibleGroups = groupsWithUuids.filter(item => item.visible !== false);
  if (visibleGroups.length === groupsWithUuids.length) {
    viewerAdapter.filterVisibleUUIDs(null);
    return;
  }
  viewerAdapter.filterVisibleUUIDs(
    visibleGroups.flatMap(item => item.uuids || [])
  );
}

function toggleAssetGroupVisibility({ id, visible }) {
  if (guardPlaneUnsupported("按资产组筛选模型")) return;
  assetGroups.value = assetGroups.value.map(item =>
    item.id === id ? { ...item, visible } : item
  );
  patchAssetsProjectPackage({
    sceneManifest: {
      ...sceneManifest.value,
      groups: assetGroups.value
    }
  });
  applyAssetGroupVisibility();
}

function focusSceneObjectSelection(objectUuid) {
  if (isPlaneRendering.value) return false;
  if (!objectUuid) return false;
  viewerAdapter.selectObjectByUUID(objectUuid, { emitEvent: false });
  viewerAdapter.focusObjectByUUID(objectUuid);
  return true;
}

function updateSceneAnchorSelection(item, kind = "anchor") {
  if (kind === "camera") {
    runtimeStore.setSelectedCameraId(item?.id || "");
    runtimeStore.setSelectedAnchorId("");
    return;
  }
  runtimeStore.setSelectedAnchorId(item?.id || "");
  runtimeStore.setSelectedCameraId("");
}

function clearSceneObjectPanels() {
  runtimeStore.setShowObjectPanel(false);
  runtimeStore.setSelectedObject(null);
  viewerAdapter.clearSelection();
}

function applyLodLevel(lod) {
  if (guardPlaneUnsupported("切换 LOD")) return;
  selectedLodId.value = lod?.id || "";
  message(
    selectedLodId.value
      ? `已切换到 ${lod.level || lod.id}`
      : "已恢复默认模型清单",
    { type: "success" }
  );
}

function clearLodOverride() {
  if (guardPlaneUnsupported("切换 LOD")) return;
  selectedLodId.value = "";
  message("已恢复默认模型清单", { type: "success" });
}

function setMaterialTheme(theme) {
  const nextTheme = theme || "original";
  runtimeStore.setMaterialTheme(nextTheme);
  viewerAdapter.setMaterialTheme(nextTheme);
}

function syncSceneDeviceStatusColors() {
  if (!viewerAdapter.isReady()) return;
  if (!sceneDeviceStatusColorEntries.value.length) {
    viewerAdapter.clearObjectStatusColors?.();
    return;
  }
  viewerAdapter.setObjectStatusColors?.(sceneDeviceStatusColorEntries.value);
}

function applyRealtimeDeviceStatusPacket(packet = {}) {
  const status = String(
    packet?.status || (packet?.type === "device-status" ? packet?.value : "")
  ).trim();
  if (!status) return;

  const targetUuid = String(
    packet?.targetUuid || packet?.objectUuid || packet?.uuid || ""
  ).trim();
  const targetKks = String(packet?.kks || "").trim();
  if (!targetUuid && !targetKks) return;

  let changed = false;
  const nextDevices = sceneDevices.value.map(item => {
    const uuids = Array.from(
      new Set([item?.uuid, ...getSceneDeviceUuids(item)].filter(Boolean))
    );
    const matchedByUuid = targetUuid && uuids.includes(targetUuid);
    const matchedByKks =
      targetKks &&
      String(item?.kks || "")
        .trim()
        .toLowerCase() === targetKks.toLowerCase();
    if (!matchedByUuid && !matchedByKks) return item;
    if (item.status === status) return item;
    changed = true;
    return {
      ...item,
      status,
      statusUpdatedAt: packet?.timestamp || Date.now()
    };
  });

  if (!changed) return;
  sceneDevices.value = nextDevices;
  projectStore.setSceneDevices(nextDevices);
}

function setRuntimeDisplayMode(mode) {
  runtimeStore.setDisplayMode(mode || "all");
}

function getSceneDeviceUuids(item) {
  const meshUuids = Array.isArray(item?.meshUuids) ? item.meshUuids : [];
  const uuids = meshUuids.length ? meshUuids : item?.uuid ? [item.uuid] : [];
  return uuids.filter(Boolean);
}

function getSceneDevicesUuids(items = []) {
  return items.flatMap(item => getSceneDeviceUuids(item));
}

function getSelectedObjectUuid() {
  const selected = selectedObjectInfo.value || {};
  return selected.objectUuid || selected.uuid || selectedDeviceUuid.value || "";
}

function getSelectedDisplayUuids() {
  if (selectedSceneDevice.value?.uuid) {
    return getSceneDeviceUuids(selectedSceneDevice.value);
  }

  const selected = selectedObjectInfo.value || {};
  const meshUuids = Array.isArray(selected.meshUuids)
    ? selected.meshUuids.filter(Boolean)
    : [];
  if (meshUuids.length) return meshUuids;

  const uuid = selected.objectUuid || selected.uuid || "";
  return uuid ? [uuid] : [];
}

function getSelectedObjectType() {
  return String(
    selectedSceneDevice.value?.type || selectedObjectInfo.value?.type || ""
  ).trim();
}

function resolveCurrentModelInstanceId() {
  const selected = selectedObjectInfo.value || {};
  const selectedInstanceId =
    selectedSceneDevice.value?.instanceId ||
    selected.userData?.sceneModelInstanceId ||
    selected.sceneModelInstanceId ||
    selected.instanceId ||
    "";
  if (selectedInstanceId) return selectedInstanceId;

  const activeModel = sceneModels.value.find(item => {
    return (
      item.instanceId === activeSceneModelId.value ||
      item.modelId === activeSceneModelId.value
    );
  });
  return activeModel?.instanceId || sceneModels.value[0]?.instanceId || "";
}

function ensureDisplayActionReady() {
  if (viewerAdapter.isReady()) return true;
  message("请先加载模型", { type: "warning" });
  return false;
}

function areSceneOverlaysSuppressed() {
  return Boolean(enableClipping.value || runtimeClippingState.value?.enabled);
}

function buildAnchorSyncItemSignature(item = {}) {
  const position = Array.isArray(item.position) ? item.position : [];
  const style = item.style || {};
  return [
    item.id || "",
    item.type || "",
    item.name || "",
    item.label || "",
    item.displayText || "",
    item.visible === false ? "0" : "1",
    item.status || "",
    position.map(value => Number(value || 0).toFixed(3)).join(","),
    style.color || "",
    style.iconUrl || "",
    style.iconSize || "",
    style.iconWidth || "",
    style.labelWidth || "",
    style.labelHeight || "",
    style.showLabel === true ? "1" : style.showLabel === false ? "0" : ""
  ].join("~");
}

function buildSceneAnchorSyncSignature(suppressed) {
  return [
    viewerModelUrl.value || "",
    suppressed ? "1" : "0",
    anchorMarkersVisible.value ? "1" : "0",
    cameraMarkersVisible.value ? "1" : "0",
    suppressed
      ? ""
      : renderableAnchors.value.map(buildAnchorSyncItemSignature).join("|"),
    suppressed
      ? ""
      : renderableCameraAnchors.value
          .map(buildAnchorSyncItemSignature)
          .join("|")
  ].join("::");
}

function syncSceneAnchors({ force = false } = {}) {
  if (!viewerAdapter.isReady()) {
    sceneAnchorSyncSignature = "";
    return;
  }
  const suppressed = areSceneOverlaysSuppressed();
  const signature = buildSceneAnchorSyncSignature(suppressed);
  if (!force && signature === sceneAnchorSyncSignature) return;

  sceneAnchorSyncSignature = signature;
  viewerAdapter.setAnchors(suppressed ? [] : renderableAnchors.value);
  viewerAdapter.setAnchorsVisible(anchorMarkersVisible.value && !suppressed);
  viewerAdapter.setCameraAnchors(
    suppressed ? [] : renderableCameraAnchors.value
  );
  viewerAdapter.setCameraAnchorsVisible(
    cameraMarkersVisible.value && !suppressed
  );
}

function buildNodeIdByKks(kks) {
  const key = String(kks || "").trim();
  if (!key) return "";
  return sceneDevices.value.find(item => item.kks === key)?.nodeId || "";
}

function stopPositionPicking({ restoreTool = true } = {}) {
  const previousTool = positionPickingState.value.previousTool || "rotate";
  positionPickingState.value = {
    active: false,
    kind: "",
    previousTool: "",
    pickedPosition: null
  };
  anchorDialogMinimized.value = false;
  syncSceneAnchors();
  if (restoreTool) {
    onToolChange(previousTool);
  }
}

function startPositionPicking() {
  if (isPlaneRendering.value) {
    message("平面渲染请在画布中右键添加点位或摄像头", { type: "info" });
    return;
  }
  if (!viewerAdapter.isReady()) {
    message("请先加载模型后再拾取位置", { type: "warning" });
    return;
  }
  anchorForm.value.anchorMode = "world";
  positionPickingState.value = {
    active: true,
    kind: anchorDialogKind.value,
    previousTool: activeTool.value || "rotate",
    pickedPosition: null
  };
  anchorDialogMinimized.value = true;
  onToolChange("pick");
  message("请点击模型表面拾取位置，确认后回填坐标", {
    type: "info"
  });
}

function confirmPickedPosition() {
  const pickedPosition = positionPickingState.value.pickedPosition;
  if (!Array.isArray(pickedPosition) || pickedPosition.length < 3) {
    message("请先点击模型拾取位置", { type: "warning" });
    return;
  }
  anchorForm.value.anchorMode = "world";
  anchorForm.value.worldPosition = [...pickedPosition];
  stopPositionPicking();
}

function cancelPositionPicking() {
  stopPositionPicking();
}

function openCreateAnchorDialog(kind = "anchor", options = {}) {
  stopPositionPicking({ restoreTool: false });
  anchorDialogKind.value = kind;
  anchorDialogMode.value = "create";
  anchorForm.value = buildStyledAnchorForm(
    kind,
    {},
    options.selectedObject || selectedObjectInfo.value
  );
  const worldPosition = normalizeCanvasContextWorldPosition(
    options.worldPosition
  );
  if (worldPosition) {
    anchorForm.value.anchorMode = "world";
    anchorForm.value.worldPosition = [...worldPosition];
  }
  anchorDialogVisible.value = true;
}

function openEditAnchorDialog(item, kind = "anchor") {
  stopPositionPicking({ restoreTool: false });
  anchorDialogKind.value = kind;
  anchorDialogMode.value = "edit";
  anchorForm.value = buildStyledAnchorForm(kind, item);
  anchorDialogVisible.value = true;
}

function selectAndEditSceneAnchor(item, kind = "anchor") {
  updateSceneAnchorSelection(item, kind);
  if (!isPlaneRendering.value) {
    focusSceneObjectSelection(item?.objectUuid);
  }
  openEditAnchorDialog(item, kind);
}

function validateAnchorForm(form, kind) {
  if (!form.name?.trim() && !(kind === "camera" && form.cameraName?.trim())) {
    message(kind === "camera" ? "请输入摄像头名称" : "请输入点位名称", {
      type: "warning"
    });
    return false;
  }
  if (form.anchorMode === "object" && !form.objectUuid) {
    message("请选择绑定构件", { type: "warning" });
    return false;
  }
  if (kind === "anchor" && form.businessBinding?.bindingType !== "custom") {
    if (!form.businessBinding?.kks) {
      message("请选择绑定设备 KKS", { type: "warning" });
      return false;
    }
  }
  if (
    kind === "anchor" &&
    form.businessBinding?.bindingType === "measurement" &&
    !form.businessBinding?.tag
  ) {
    message("请选择绑定测点", { type: "warning" });
    return false;
  }
  if (kind === "camera" && !form.streamUrl?.trim()) {
    message("请输入视频接入地址", { type: "warning" });
    return false;
  }
  return true;
}

function submitAnchorDialog() {
  const kind = anchorDialogKind.value;
  const normalized =
    kind === "camera"
      ? normalizeCameraForm(anchorForm.value)
      : normalizeAnchorForm(anchorForm.value);
  normalized.style = pickAnchorIconStyle(anchorForm.value?.style);

  if (!validateAnchorForm(normalized, kind)) return;

  if (kind === "camera") {
    normalized.objectUuid = normalized.objectUuid || normalized.bindObjectUuid;
    normalized.bindObjectUuid =
      normalized.bindObjectUuid || normalized.objectUuid;
    normalized.businessBinding = {
      ...(normalized.businessBinding || {}),
      kks: normalized.bindDeviceKks || normalized.businessBinding?.kks || "",
      nodeId:
        buildNodeIdByKks(
          normalized.bindDeviceKks || normalized.businessBinding?.kks
        ) ||
        normalized.businessBinding?.nodeId ||
        "",
      bindingType: "camera"
    };
    const next = upsertItem(cameraAnchors.value, normalized);
    cameraAnchors.value = next;
    projectStore.setCameraAnchors(next);
  } else {
    normalized.businessBinding = {
      ...(normalized.businessBinding || {}),
      nodeId:
        buildNodeIdByKks(normalized.businessBinding?.kks) ||
        normalized.businessBinding?.nodeId ||
        ""
    };
    const next = upsertItem(anchors.value, normalized);
    anchors.value = next;
    projectStore.setAnchors(next);
  }

  persistSceneAnchorData();
  syncSceneAnchors();
  anchorDialogVisible.value = false;
  stopPositionPicking({ restoreTool: false });
  message(kind === "camera" ? "摄像头已保存" : "点位已保存", {
    type: "success"
  });
}

function handleAnchorDialogClosed() {
  stopPositionPicking({ restoreTool: true });
}

function removeSceneAnchor(item, kind = "anchor") {
  if (
    !item?.id ||
    !window.confirm(`确认删除${item.name || item.cameraName || "当前项"}？`)
  ) {
    return;
  }
  if (kind === "camera") {
    const next = removeItem(cameraAnchors.value, item.id);
    cameraAnchors.value = next;
    projectStore.setCameraAnchors(next);
    if (selectedCameraId.value === item.id)
      runtimeStore.setSelectedCameraId("");
  } else {
    const next = removeItem(anchors.value, item.id);
    anchors.value = next;
    projectStore.setAnchors(next);
    if (selectedAnchorId.value === item.id)
      runtimeStore.setSelectedAnchorId("");
  }
  persistSceneAnchorData();
  syncSceneAnchors();
}

async function selectSceneAnchor(item, kind = "anchor") {
  if (!item) return;
  updateSceneAnchorSelection(item, kind);
  if (isPlaneRendering.value) return;
  if (focusSceneObjectSelection(item.objectUuid)) {
    await selectTreeNodeByUUID(item.objectUuid, { openPanel: false });
  }
}

function openAnchorDetail(anchor) {
  updateSceneAnchorSelection(anchor, "anchor");
  clearSceneObjectPanels();
  anchorDetailVisible.value = true;
  if (!isPlaneRendering.value) {
    focusSceneObjectSelection(anchor.objectUuid);
  }
}

function openCameraVideo(anchor) {
  updateSceneAnchorSelection(anchor, "camera");
  clearSceneObjectPanels();
  runtimeStore.openVideoDialog(anchor);
  if (!isPlaneRendering.value) {
    focusSceneObjectSelection(anchor.objectUuid);
  }
}

function handleSceneAnchorClick(anchor) {
  hideCanvasContextToolbar();
  if (!anchor) return;
  runtimeEventBus.emit(
    anchor.type === "camera-point" ? "camera.clicked" : "anchor.clicked",
    anchor
  );
  if (anchor.type === "camera-point") {
    openCameraVideo(anchor);
    return;
  }
  openAnchorDetail(anchor);
}

async function refreshSceneTree() {
  await nextTick();
  sceneTree.value = viewerAdapter.getSceneTree() || null;
  projectStore.setSceneTree(sceneTree.value);
  const { nodeMap, parentMap } = buildTreeNodeIndex(sceneTree.value);
  treeNodeIndex.value = nodeMap;
  treeParentMap.value = parentMap;
  treeExpandedKeys.value = new Set();
  treeDefaultExpandedKeys.value = sceneTree.value?.uuid
    ? [sceneTree.value.uuid]
    : [];
  if (sceneTree.value?.uuid) {
    treeExpandedKeys.value.add(sceneTree.value.uuid);
  }
}

function refreshSceneDevices() {
  const tree = viewerAdapter.getSceneTree();
  if (!tree) {
    sceneDevices.value = [];
    projectStore.setSceneDevices([]);
    return;
  }
  const persistedBindings = new Map();
  savedObjectBindings.value.forEach(item => {
    const relationKey = getModelNodeRelationKey({
      modelId: item.modelId || item.sourceId,
      nodeName: item.nodeName || item.objectName
    });
    if (relationKey) {
      persistedBindings.set(relationKey, item);
    }
    const uuidKey = buildObjectBindingKey(item.instanceId, item.objectUuid);
    if (item.objectUuid) {
      persistedBindings.set(uuidKey, item);
      persistedBindings.set(item.objectUuid, item);
    }
    if (item.path) {
      persistedBindings.set(
        buildObjectBindingPathKey(item.instanceId, item.path),
        item
      );
    }
    if (item.objectName) {
      persistedBindings.set(
        buildObjectBindingNameKey(item.instanceId, item.objectName),
        item
      );
    }
  });
  sceneDevices.value.forEach(item => {
    const binding = {
      instanceId: item.instanceId || "",
      modelId: getSceneDeviceModelId(item),
      nodeName: getSceneDeviceNodeName(item),
      sourceId: getSceneDeviceSourceId(item),
      relationNodeName: getSceneDeviceRelationNodeName(item),
      objectUuid: item.uuid,
      meshUuids: Array.isArray(item.meshUuids) ? item.meshUuids : [],
      objectName: item.name || "",
      path: item.path || "",
      kks: item.kks || "",
      nodeId: item.nodeId || ""
    };
    const relationKey = getModelNodeRelationKey({
      modelId: binding.modelId,
      nodeName: binding.nodeName
    });
    if (relationKey) {
      persistedBindings.set(relationKey, binding);
    }
    if (binding.objectUuid) {
      persistedBindings.set(
        buildObjectBindingKey(binding.instanceId, binding.objectUuid),
        binding
      );
      persistedBindings.set(binding.objectUuid, binding);
    }
    if (binding.path) {
      persistedBindings.set(
        buildObjectBindingPathKey(binding.instanceId, binding.path),
        binding
      );
    }
    if (binding.objectName) {
      persistedBindings.set(
        buildObjectBindingNameKey(binding.instanceId, binding.objectName),
        binding
      );
    }
  });
  const modelNodeMap = new Map(
    sceneModels.value.map(item => [
      item.instanceId,
      {
        modelId: item.modelId || "",
        nodeId: item.systemNodeId || "",
        label:
          item.systemNodeLabel || getSystemNodeLabel(item.systemNodeId || "")
      }
    ])
  );
  sceneDevices.value = buildSceneDevices({
    tree,
    businessDevices: [],
    configuredBindings: configuredObjectBindings.value,
    getNodeLabel: nodeId => getSystemNodeLabel(nodeId)
  }).map(item => {
    const modelNode = modelNodeMap.get(item.instanceId) || null;
    const stored =
      persistedBindings.get(
        getModelNodeRelationKey({
          modelId: modelNode?.modelId || item.modelId,
          nodeName: item.nodeName || item.name
        })
      ) ||
      persistedBindings.get(
        buildObjectBindingKey(item.instanceId, item.uuid)
      ) ||
      persistedBindings.get(
        buildObjectBindingPathKey(item.instanceId, item.path)
      ) ||
      persistedBindings.get(
        buildObjectBindingNameKey(item.instanceId, item.name)
      ) ||
      persistedBindings.get(item.uuid) ||
      null;
    const nodeId = stored?.nodeId || item.nodeId || modelNode?.nodeId || "";
    const systemName =
      getSystemNodeLabel(nodeId) || modelNode?.label || item.systemName || "";
    const kks = stored?.kks || item.kks || "";
    const modelId = modelNode?.modelId || getSceneDeviceModelId(item);
    const nodeName = getSceneDeviceNodeName(item);
    const relationNodeName = buildModelNodeRelationName({
      modelId,
      nodeName
    });
    return {
      ...item,
      modelId,
      nodeName,
      sourceId: modelId,
      relationNodeName,
      kks,
      nodeId,
      systemName,
      kksRelationId: stored?.kksRelationId || "",
      documentRelationIds: Array.isArray(stored?.documentRelationIds)
        ? stored.documentRelationIds
        : [],
      boundDocuments: normalizeNodeBoundDocuments(stored?.boundDocuments || [])
    };
  });
  projectStore.setSceneDevices(sceneDevices.value);
}

function syncNavigationSelections(item) {
  syncSceneNavigationSelections(item, {
    setSelectedSystemNodeId: value => {
      selectedSystemNodeId.value = value;
    },
    setSelectedQuickKks: value => {
      selectedQuickKks.value = value;
    }
  });
}

function getDevicesBySystem(nodeId) {
  return getSceneDevicesBySystem(sceneDevices.value, nodeId);
}

function getDevicesByRegion(regionId) {
  return getSceneDevicesByRegion(
    systemNodeTree.value,
    sceneDevices.value,
    regionId
  );
}

function getDevicesByModelInstance(instanceId) {
  if (!instanceId) return [];
  return sceneDevices.value.filter(item => item.instanceId === instanceId);
}

function syncLayerTreeSelection(keys = allLayerLeafKeys.value) {
  syncSceneLayerTreeSelection({
    keys,
    allLayerLeafKeys: allLayerLeafKeys.value,
    setLayerCheckedKeys: value => {
      layerCheckedKeys.value = value;
    },
    layerTreeRef,
    nextTick
  });
}

function syncMeasurementPoints() {
  if (!viewerAdapter.isReady()) return;
  const visible = pointMarkersVisible.value && !areSceneOverlaysSuppressed();
  viewerAdapter.setLinkedPointsVisible(visible);
  if (!visible) {
    viewerAdapter.clearLinkedPoints();
    return;
  }
  viewerAdapter.setLinkedPoints(currentMeasurementPoints.value);
}

function persistMeasurementRecords() {
  patchSceneProjectPackage({
    measurements: measurementRecords.value
  });
}

function syncMeasurementRecordsToViewer() {
  if (!viewerAdapter.isReady()) return;
  viewerAdapter.setMeasurementMode(measurementMode.value);
  viewerAdapter.setMeasurements(measurementRecords.value);
}

function handleMeasurementChange(payload) {
  const records = Array.isArray(payload?.records) ? payload.records : [];
  measurementRecords.value = records;
  projectStore.setMeasurementRecords(records);
  persistMeasurementRecords();
  runtimeEventBus.emit("viewer.measurementChanged", payload);
}

function toggleMeasurementRecordVisible(item, visible) {
  if (!item?.id) return;
  viewerAdapter.setMeasurementVisible(item.id, visible);
  const next = measurementRecords.value.map(record =>
    record.id === item.id ? { ...record, visible } : record
  );
  measurementRecords.value = next;
  projectStore.setMeasurementRecords(next);
  persistMeasurementRecords();
}

function removeMeasurementRecord(item) {
  if (!item?.id) return;
  viewerAdapter.removeMeasurement(item.id);
  const next = measurementRecords.value.filter(record => record.id !== item.id);
  measurementRecords.value = next;
  projectStore.setMeasurementRecords(next);
  persistMeasurementRecords();
  message("已删除测量结果", { type: "success" });
}

function focusMeasurementRecord(item) {
  if (!item?.id) return;
  viewerAdapter.focusMeasurement(item.id);
}

function exportMeasurements() {
  const payload = viewerAdapter.exportMeasurements();
  const blob = new Blob([payload], {
    type: "application/json;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `viewer-measurements-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  message("测量结果已导出", { type: "success" });
}

async function mountActiveVideo() {
  if (
    !videoDialogVisible.value ||
    !activeCameraDetail.value ||
    !videoElementRef.value
  ) {
    return;
  }
  videoLoading.value = true;
  videoErrorText.value = "";
  try {
    await videoAdapter.mount(videoElementRef.value, activeCameraDetail.value);
    await nextTick();
    videoElementRef.value?.play?.().catch(() => {});
  } catch (error) {
    videoErrorText.value = error?.message || String(error);
  } finally {
    videoLoading.value = false;
  }
}

function syncRuntimeServices() {
  const realtimeConfig = {
    enabled: integrationConfigs.value?.realtime?.enabled,
    transport: integrationConfigs.value?.realtime?.transport || "mock",
    interval: integrationConfigs.value?.realtime?.interval || 3000,
    url: integrationConfigs.value?.realtime?.url || "",
    headers: integrationConfigs.value?.realtime?.headers || {},
    points: integrationConfigs.value?.realtime?.points || []
  };
  const backendConfig = {
    enabled: integrationConfigs.value?.backendBridge?.enabled,
    transport: integrationConfigs.value?.backendBridge?.transport || "mock",
    endpoint: integrationConfigs.value?.backendBridge?.endpoint || "",
    headers: integrationConfigs.value?.backendBridge?.headers || {},
    mockDelay: integrationConfigs.value?.backendBridge?.mockDelay || 300
  };

  realtimeAdapter.start(realtimeConfig);
  backendBridge.start(backendConfig);
  scriptEngine.start({
    enabled:
      (scriptDefinitions.value?.animations?.length || 0) > 0 &&
      (scriptDefinitions.value?.triggers?.length || 0) > 0,
    animations: scriptDefinitions.value?.animations || [],
    triggers: scriptDefinitions.value?.triggers || []
  });
}

function stopRuntimeServices() {
  realtimeAdapter.stop();
  scriptEngine.stop();
  backendBridge.stop();
}

function restartRealtime() {
  realtimeAdapter.restart({
    ...(integrationConfigs.value?.realtime || {})
  });
  message("实时数据服务已重启", { type: "success" });
}

function runManualScriptTrigger() {
  const triggerId = scriptDefinitions.value?.triggers?.find(
    item => item.event === "manual"
  )?.id;
  if (!triggerId) {
    message("当前工程包没有可手动触发的脚本", { type: "warning" });
    return;
  }
  scriptEngine.runManualTrigger(triggerId);
  message("已触发手动脚本", { type: "success" });
}

async function sendBackendCommand() {
  try {
    await backendBridge.invoke({
      name: "manual-command",
      payload: {
        modelId: modelId.value,
        modelName: modelName.value
      }
    });
    message("后台命令已发送", { type: "success" });
  } catch (error) {
    message(error?.message || "后台命令执行失败", { type: "warning" });
  }
}

function clearRuntimeLogs() {
  runtimeStore.clearRuntimeLogs();
}

function onQualityChange(val) {
  quality.value = val;
  runtimeStore.setQuality(val);
  viewerAdapter.setQuality(val);
  if (val === "plane") {
    if (roamingEnabled.value) {
      viewerAdapter.toggleFirstPerson(false);
      roamingEnabled.value = false;
      runtimeStore.setRoamingEnabled(false);
    }
    stopClippingAnimation({ persist: false });
    runtimeStore.setShowObjectPanel(false);
    viewerAdapter.clearSelection();
    onToolChange("rotate");
    void refreshPlaneSnapshot({ force: true });
  } else {
    viewerAdapter.setRenderPaused(false);
  }
}

function getQualityModeLabel(value) {
  return qualityModeOptions.find(item => item.value === value)?.label || value;
}

function getInitialFpsPromptKey(payload = {}) {
  const modelKey = (Array.isArray(payload.models) ? payload.models : [])
    .map(
      item =>
        item?.instanceId ||
        item?.modelId ||
        item?.modelUrl ||
        item?.modelName ||
        ""
    )
    .filter(Boolean)
    .join("|");
  return [
    modelKey || viewerModelUrl.value || modelId.value || "default-model",
    payload.quality || quality.value
  ].join("::");
}

async function handleInitialFpsSample(payload = {}) {
  const averageFps = Number(payload.averageFps);
  const sampleQuality = payload.quality || quality.value;
  if (!Number.isFinite(averageFps)) return;
  if (averageFps >= INITIAL_FPS_PROMPT_THRESHOLD) return;
  if (!INITIAL_FPS_PROMPT_QUALITIES.has(sampleQuality)) return;
  if (quality.value !== sampleQuality) return;
  if (initialFpsPromptVisible) return;

  const promptKey = getInitialFpsPromptKey(payload);
  if (initialFpsPromptedKeys.has(promptKey)) return;
  initialFpsPromptedKeys.add(promptKey);
  initialFpsPromptVisible = true;

  try {
    await ElMessageBox.confirm(
      `模型加载完成后的 10 秒平均帧率约 ${averageFps.toFixed(1)} FPS，低于 ${INITIAL_FPS_PROMPT_THRESHOLD} FPS。当前为${getQualityModeLabel(sampleQuality)}画质，可切换到低画质或平面渲染以降低电脑性能压力。关闭弹窗将保持当前画质。`,
      "画质优化建议",
      {
        type: "warning",
        confirmButtonText: "切换到低画质",
        cancelButtonText: "切换到平面渲染",
        distinguishCancelAndClose: true,
        closeOnClickModal: false,
        closeOnPressEscape: true,
        showClose: true
      }
    );
    if (quality.value === sampleQuality) {
      onQualityChange("low");
      message("已切换为低画质", { type: "info" });
    }
  } catch (action) {
    if (action === "cancel" && quality.value === sampleQuality) {
      onQualityChange("plane");
      message("已切换为平面渲染", { type: "info" });
    }
  } finally {
    initialFpsPromptVisible = false;
  }
}

function updateClippingState(
  nextState,
  { persist = true, syncViewer = true } = {}
) {
  const normalized = normalizeClippingState(nextState);
  runtimeStore.setClippingState(normalized);
  projectStore.setClippingState(normalized);
  if (syncViewer && viewerAdapter.isReady()) {
    viewerAdapter.setClippingState(normalized);
    runtimeStore.setClippingStats(
      viewerAdapter.getClippingStats?.() || {
        enabled: normalized.enabled,
        mode: normalized.mode,
        activePlaneCount: 0,
        affectedMeshCount: 0,
        totalMeshCount: 0
      }
    );
  }
  if (persist) {
    schedulePersistClippingState();
  }
}

function syncClippingStateFromViewer(payload = {}) {
  const state = payload?.state || payload;
  const stats = payload?.stats || viewerAdapter.getClippingStats?.() || null;
  const source = payload?.source || "external";
  const normalized = normalizeClippingState(state);
  runtimeStore.setClippingState(normalized);
  projectStore.setClippingState(normalized);
  runtimeStore.setClippingStats(
    stats || {
      enabled: normalized.enabled,
      mode: normalized.mode,
      activePlaneCount: 0,
      affectedMeshCount: 0,
      totalMeshCount: 0
    }
  );
  if (source !== "animation") {
    schedulePersistClippingState();
  }
}

function getSelectedClippingTarget() {
  const selected = selectedObjectInfo.value || {};
  const uuid = selected.objectUuid || selected.uuid || "";
  const name = selected.name || selected.objectName || uuid;
  return { uuid, name };
}

function withSingleObjectClippingPlane(nextState) {
  if (nextState?.mode !== "single-plane") return nextState;
  const firstPlaneId = nextState?.planes?.[0]?.id || nextState?.plane?.id;
  return {
    ...nextState,
    singlePlane: {
      ...(nextState.singlePlane || {}),
      position: 1,
      direction: "positive"
    },
    plane: {
      ...(nextState.plane || {}),
      custom: false,
      normalizedPosition: 1,
      direction: "positive"
    },
    planes: Array.isArray(nextState.planes)
      ? nextState.planes.map(item =>
          item.id === firstPlaneId
            ? {
                ...item,
                custom: false,
                normalizedPosition: 1,
                direction: "positive"
              }
            : item
        )
      : nextState.planes
  };
}

function applyPickModeClippingTarget(nextState) {
  if (activeTool.value !== "pick") return nextState;
  const currentTargets = nextState?.targets || {};
  const currentUuids = Array.isArray(currentTargets.objectUuids)
    ? currentTargets.objectUuids
    : [];
  if (currentTargets.mode === "objects" && currentUuids.length > 1) {
    return nextState;
  }

  const { uuid, name } = getSelectedClippingTarget();
  return withSingleObjectClippingPlane({
    ...nextState,
    targetMode: "object",
    targetObjectUuid: uuid,
    targetObjectName: name,
    targets: {
      mode: "objects",
      objectUuids: uuid ? [uuid] : [],
      objectNames: uuid ? [name || uuid] : []
    }
  });
}

function toggleClipping() {
  if (guardPlaneUnsupported("剖切")) return;
  if (enableClipping.value) {
    stopClippingAnimation({ persist: false });
  }
  const nextState = runtimeClippingState.value.enabled
    ? {
        ...runtimeClippingState.value,
        enabled: false
      }
    : applyPickModeClippingTarget(
        ensureVisibleClippingState(runtimeClippingState.value)
      );
  updateClippingState(nextState);
  message(nextState.enabled ? "已开启剖切模式" : "已关闭剖切模式", {
    type: "info"
  });
}

function onClippingStateChange(nextState) {
  if (guardPlaneUnsupported("剖切")) return;
  stopClippingAnimation({ persist: false });
  updateClippingState(nextState);
}

function onClippingPresetChange(presetId) {
  if (guardPlaneUnsupported("剖切")) return;
  stopClippingAnimation({ persist: false });
  const nextState = applyPickModeClippingTarget(
    applyClippingPreset(runtimeClippingState.value, presetId)
  );
  updateClippingState(nextState);
  const presetLabel =
    Object.values(clippingShortcutMap).find(item => item.presetId === presetId)
      ?.label || presetId;
  message(`已切换剖切：${presetLabel}`, { type: "success" });
}

function resetClipping() {
  if (guardPlaneUnsupported("剖切")) return;
  stopClippingAnimation({ persist: false });
  const nextState = resetClippingState(runtimeClippingState.value);
  updateClippingState(nextState);
  viewerAdapter.resetClipping?.();
  message("已重置剖切状态", { type: "success" });
}

async function locateDevice(item, withMessage = true) {
  if (guardPlaneUnsupported("视角定位")) return;
  await locateSceneDevice({
    item,
    viewerAdapter,
    setSelectedDeviceUuid: value => {
      selectedDeviceUuid.value = value;
    },
    syncNavigationSelections,
    selectTreeNodeByUUID,
    notify: message,
    withMessage
  });
}

async function locateSystem(
  nodeId = selectedSystemNodeId.value,
  withMessage = true
) {
  if (guardPlaneUnsupported("视角定位")) return;
  await locateSceneSystem({
    nodeId,
    sceneDevices: sceneDevices.value,
    viewerAdapter,
    getDevicesBySystem: getSceneDevicesBySystem,
    setSelectedSystemNodeId: value => {
      selectedSystemNodeId.value = value;
    },
    setSelectedDeviceUuid: value => {
      selectedDeviceUuid.value = value;
    },
    syncNavigationSelections,
    selectTreeNodeByUUID,
    getSystemLabel: value => getSystemNodeLabel(value),
    notify: message,
    withMessage
  });
}

async function locateRegion(regionId, withMessage = true) {
  if (guardPlaneUnsupported("视角定位")) return;
  await locateSceneRegion({
    regionId,
    systemTree: systemNodeTree.value,
    sceneDevices: sceneDevices.value,
    viewerAdapter,
    getDevicesByRegion: getSceneDevicesByRegion,
    setCurrentNavNodeKey: value => {
      currentNavNodeKey.value = value;
    },
    setSelectedSystemNodeId: value => {
      selectedSystemNodeId.value = value;
    },
    setSelectedQuickKks: value => {
      selectedQuickKks.value = value;
    },
    setSelectedDeviceUuid: value => {
      selectedDeviceUuid.value = value;
    },
    selectTreeNodeByUUID,
    notify: message,
    withMessage
  });
}

async function locateModelInstance(instanceId, withMessage = true) {
  const devices = getDevicesByModelInstance(instanceId);
  if (!devices.length) {
    const modelNode = findSceneTreeNodeByModelInstanceId(instanceId);
    if (modelNode?.uuid) {
      selectedTreeNode.value = modelNode;
      viewerAdapter.selectObjectByUUID(modelNode.uuid, { emitEvent: false });
      viewerAdapter.focusObjectByUUID(modelNode.uuid);
      currentNavNodeKey.value = `nav-model:${instanceId}`;
      await selectTreeNodeByUUID(modelNode.uuid, { openPanel: false });
      if (withMessage) {
        message(`已定位到模型：${modelNode.sceneModelName || modelNode.name}`, {
          type: "success"
        });
      }
      return true;
    }

    if (withMessage) {
      message("当前模型暂无可定位构件", { type: "warning" });
    }
    return false;
  }

  selectedDeviceUuid.value = devices[0].uuid;
  syncNavigationSelections(devices[0]);
  viewerAdapter.selectObjectByUUID(devices[0].uuid, { emitEvent: false });
  viewerAdapter.focusObjectsByUUIDs(
    devices.flatMap(item =>
      Array.isArray(item.meshUuids) && item.meshUuids.length
        ? item.meshUuids.filter(Boolean)
        : item.uuid
          ? [item.uuid]
          : []
    )
  );
  await selectTreeNodeByUUID(devices[0].uuid, { openPanel: false });

  if (withMessage) {
    const modelLabel =
      sceneModels.value.find(item => item.instanceId === instanceId)
        ?.modelName || "当前模型";
    message(`已定位到模型：${modelLabel}`, { type: "success" });
  }
  return true;
}

async function locateSceneModel(item) {
  if (guardPlaneUnsupported("模型定位")) return false;
  const modelId = typeof item === "string" ? item : item?.modelId;
  const instanceId =
    item?.instanceId ||
    sceneModels.value.find(model => model.modelId === modelId)?.instanceId ||
    "";
  if (!instanceId) {
    message("请先选择一个模型", { type: "warning" });
    return false;
  }
  return await locateModelInstance(instanceId);
}

async function locateByKks(kks = selectedQuickKks.value) {
  if (guardPlaneUnsupported("视角定位")) return;
  await locateSceneByKks({
    kks,
    sceneDevices: sceneDevices.value,
    locateDevice: target => locateDevice(target),
    notify: message
  });
}

async function handleNavigationMapSelect(item) {
  if (!item) return;
  if (item.type === "system") {
    selectedSystemNodeId.value = item.nodeId || "";
    await locateSystem(item.nodeId);
    return;
  }
  if (item.type === "bookmark") {
    if (guardPlaneUnsupported("导航图书签定位")) return;
    applyBookmark(item.bookmark);
    return;
  }
  if (item.type === "device" && item.device) {
    if (guardPlaneUnsupported("导航图设备定位")) return;
    await locateDevice(item.device);
  }
}

async function isolateDevice(
  item = selectedSceneDevice.value,
  withMessage = true
) {
  if (guardPlaneUnsupported("模型隔离显示")) return;
  await isolateSceneDevice({
    item,
    viewerAdapter,
    setSelectedDeviceUuid: value => {
      selectedDeviceUuid.value = value;
    },
    syncNavigationSelections,
    setDisplayMode: value => {
      displayMode.value = value;
    },
    syncLayerTreeSelection,
    selectTreeNodeByUUID,
    notify: message,
    withMessage
  });
}

async function handleNavigationNodeClick(node) {
  if (node?.kind === "model") {
    currentNavNodeKey.value = node.id;
    await locateModelInstance(node.instanceId);
    return;
  }
  await handleSceneNavigationNodeClick({
    node,
    setCurrentNavNodeKey: value => {
      currentNavNodeKey.value = value;
    },
    locateRegion: nodeId => locateRegion(nodeId),
    locateSystem: nodeId => locateSystem(nodeId),
    locateDevice: item => locateDevice(item)
  });
}

// ---- 导航树右键菜单 & 属性编辑 ----
const ctxMenuVisible = ref(false);
const ctxMenuStyle = ref({ top: "0px", left: "0px" });
const ctxMenuNode = ref(null);
const ctxMenuIsDevice = computed(() => ctxMenuNode.value?.kind === "device");
const canvasContextToolbarVisible = ref(false);
const canvasContextToolbarPayload = ref({
  clientX: 0,
  clientY: 0,
  objectInfo: null,
  hitPoint: null
});
let closeCanvasContextToolbarListener = null;

const canvasContextObjectInfo = computed(
  () => canvasContextToolbarPayload.value.objectInfo || null
);
const canvasContextToolbarHasObject = computed(() =>
  Boolean(
    !isPlaneRendering.value &&
    getCanvasContextObjectUuid(canvasContextObjectInfo.value)
  )
);
const canvasContextToolbarStyle = computed(() => {
  const viewportWidth =
    typeof window === "undefined" ? 1280 : window.innerWidth;
  const viewportHeight =
    typeof window === "undefined" ? 720 : window.innerHeight;
  const toolbarWidth = 160;
  const toolbarHeight = 132;
  const margin = 8;
  const x = Number(canvasContextToolbarPayload.value.clientX) || margin;
  const y = Number(canvasContextToolbarPayload.value.clientY) || margin;

  return {
    left: `${Math.max(
      margin,
      Math.min(x, viewportWidth - toolbarWidth - margin)
    )}px`,
    top: `${Math.max(
      margin,
      Math.min(y, viewportHeight - toolbarHeight - margin)
    )}px`
  };
});

function handleNavTreeContextMenu(event, data) {
  hideCanvasContextToolbar();
  openContextMenu({
    event,
    data,
    setNode: value => {
      ctxMenuNode.value = value;
    },
    setStyle: value => {
      ctxMenuStyle.value = value;
    },
    setVisible: value => {
      ctxMenuVisible.value = value;
    }
  });
}

function getCtxMenuSceneDevice() {
  const node = ctxMenuNode.value;
  if (!node) return null;
  const raw = node.raw || node;
  const uuid = String(raw.uuid || node.uuid || "").trim();
  if (!uuid) return null;
  return (
    sceneDevices.value.find(item => item.uuid === uuid) || {
      uuid,
      name: raw.name || node.label || "当前构件",
      path: raw.path || raw.name || node.label || "",
      type: raw.type || node.type || "Mesh",
      kks: raw.kks || "",
      nodeId: raw.nodeId || node.nodeId || "",
      systemName: raw.systemName || ""
    }
  );
}

async function onCtxViewObjectInfo() {
  ctxMenuVisible.value = false;
  const device = getCtxMenuSceneDevice();
  if (!device?.uuid) {
    message("当前节点不是构件节点，无法查看构件属性", {
      type: "warning"
    });
    return;
  }

  selectedDeviceUuid.value = device.uuid;
  syncNavigationSelections(device);
  showObjectPanel.value = true;

  const selected = viewerAdapter.selectObjectByUUID(device.uuid, {
    emitEvent: true
  });
  if (selected) {
    viewerAdapter.focusObjectsByUUIDs(getSceneDeviceUuids(device));
    return;
  }

  await locateDevice(device, false);
  const info = viewerAdapter.getSelectedObject?.();
  if (info) {
    runtimeStore.setSelectedObject(info);
    showObjectPanel.value = true;
    syncMeasurementPoints();
    viewerAdapter.focusObjectsByUUIDs(getSceneDeviceUuids(device));
    return;
  }

  message("当前构件无法查看属性，请确认模型已加载", {
    type: "warning"
  });
}

function normalizeCanvasContextWorldPosition(value) {
  if (!Array.isArray(value) || value.length < 3) return null;
  const position = value.slice(0, 3).map(item => Number(item));
  return position.every(Number.isFinite) ? position : null;
}

function getCanvasContextObjectUuid(info = null) {
  return String(info?.objectUuid || info?.uuid || "").trim();
}

function getCanvasContextSelectedObject(info = null) {
  const uuid = getCanvasContextObjectUuid(info);
  if (!uuid) return null;
  return {
    ...info,
    uuid
  };
}

function cleanupCanvasContextToolbarDismiss() {
  if (!closeCanvasContextToolbarListener) return;
  document.removeEventListener(
    "click",
    closeCanvasContextToolbarListener,
    true
  );
  document.removeEventListener(
    "contextmenu",
    closeCanvasContextToolbarListener,
    true
  );
  window.removeEventListener("resize", closeCanvasContextToolbarListener);
  closeCanvasContextToolbarListener = null;
}

function hideCanvasContextToolbar() {
  canvasContextToolbarVisible.value = false;
  cleanupCanvasContextToolbarDismiss();
}

function registerCanvasContextToolbarDismiss() {
  cleanupCanvasContextToolbarDismiss();
  closeCanvasContextToolbarListener = event => {
    if (event?.target?.closest?.(".dd-canvas-context-toolbar")) return;
    hideCanvasContextToolbar();
  };
  setTimeout(() => {
    if (!closeCanvasContextToolbarListener) return;
    document.addEventListener("click", closeCanvasContextToolbarListener, true);
    document.addEventListener(
      "contextmenu",
      closeCanvasContextToolbarListener,
      true
    );
    window.addEventListener("resize", closeCanvasContextToolbarListener);
  }, 0);
}

function handleCanvasContextMenu(payload = {}) {
  if (positionPickingState.value.active) return;
  ctxMenuVisible.value = false;
  canvasContextToolbarPayload.value = {
    clientX: Number(payload.clientX) || 0,
    clientY: Number(payload.clientY) || 0,
    objectInfo: payload.objectInfo || null,
    hitPoint: normalizeCanvasContextWorldPosition(payload.hitPoint)
  };
  canvasContextToolbarVisible.value = true;
  registerCanvasContextToolbarDismiss();
}

function selectCanvasContextObjectInfo(info, { notifyOnMiss = true } = {}) {
  if (isPlaneRendering.value) {
    if (notifyOnMiss) {
      message("平面渲染不支持选择模型构件", { type: "warning" });
    }
    return false;
  }
  const uuid = getCanvasContextObjectUuid(info);
  if (!uuid) {
    if (notifyOnMiss) {
      message("右键位置未命中模型构件", { type: "warning" });
    }
    return false;
  }
  const selected = viewerAdapter.selectObjectByUUID(uuid, {
    emitEvent: true
  });
  if (!selected && notifyOnMiss) {
    message("当前构件无法选中，请重新右键选择模型表面", {
      type: "warning"
    });
  }
  return Boolean(selected);
}

function selectCanvasContextObject() {
  const info = canvasContextObjectInfo.value;
  hideCanvasContextToolbar();
  selectCanvasContextObjectInfo(info);
}

function openCanvasContextCreateAnchor(kind = "anchor") {
  const payload = canvasContextToolbarPayload.value;
  const selectedObject = getCanvasContextSelectedObject(payload.objectInfo);
  const worldPosition = normalizeCanvasContextWorldPosition(payload.hitPoint);

  hideCanvasContextToolbar();
  openCreateAnchorDialog(kind, {
    selectedObject,
    worldPosition
  });
}

function getDocumentDialogMeta(scope = documentDialogScope.value) {
  if (scope === "object") {
    return {
      sourceKind: MODEL_OBJECT_SOURCE_KIND,
      relationType: MODEL_OBJECT_DOC_RELATION_TYPE,
      targetLabel: "当前构件",
      successMessage: "构件文档绑定已保存",
      errorMessage: "提交构件文档绑定失败"
    };
  }
  return {
    sourceKind: "node",
    relationType: "node_doc",
    targetLabel: "当前节点",
    successMessage: "节点文件绑定已保存",
    errorMessage: "提交节点文件绑定失败"
  };
}

function syncCurrentDocumentTableSelection() {
  syncDocumentBindingTableSelection({
    tableRef: documentDialogTableRef,
    selectedDocuments: documentDialogSelectedDocuments.value,
    records: documentDialogRecords.value
  });
}

async function loadCurrentDocumentFolders() {
  documentDialogFolderLoading.value = true;
  try {
    documentDialogFolderTreeData.value = await loadDocumentBindingFolders({
      getFolderTree: getHandoverDocFolderTree,
      unwrapApiData
    });
  } catch (error) {
    console.error("load document folders failed", error);
    documentDialogFolderTreeData.value =
      createDefaultDocumentBindingFolderTree();
    message(error?.message || "加载文档目录失败", { type: "error" });
  } finally {
    documentDialogFolderLoading.value = false;
  }
}

async function loadCurrentDocumentOptions(keyword = "") {
  documentDialogLoading.value = true;
  try {
    const { records, pagination } = await loadDocumentBindingOptions({
      keyword,
      folderId: documentDialogFolderId.value,
      folderTreeData: documentDialogFolderTreeData.value,
      pagination: documentDialogPagination.value,
      getDocumentList: getHandoverDocumentList,
      unwrapApiData
    });
    documentDialogRecords.value = records;
    documentDialogPagination.value = pagination;
    await nextTick();
    syncCurrentDocumentTableSelection();
  } catch (error) {
    documentDialogRecords.value = [];
    documentDialogPagination.value.total = 0;
    message(error?.message || "加载文档列表失败", { type: "error" });
  } finally {
    documentDialogLoading.value = false;
  }
}

async function loadBoundDocumentDetail(
  row,
  fallbackMessage = "加载文档详情失败"
) {
  const documentId = String(row?.id || row?.documentId || "").trim();
  if (!documentId) {
    throw new Error("当前文档缺少 ID，无法查看");
  }
  const detail = unwrapApiData(
    await getHandoverDocumentDetail(documentId),
    fallbackMessage
  );
  return (
    normalizeBoundDocumentRecord(detail) || normalizeBoundDocumentRecord(row)
  );
}

async function openBoundDocumentDetail(row) {
  if (!row?.id) {
    message("当前文档缺少 ID，无法查看详情", { type: "warning" });
    return;
  }
  boundDocumentDetailVisible.value = true;
  boundDocumentDetailLoading.value = true;
  try {
    boundDocumentDetailRow.value = await loadBoundDocumentDetail(row);
  } catch (error) {
    boundDocumentDetailRow.value = normalizeBoundDocumentRecord(row);
    console.error("load bound document detail failed", error);
    message(error?.message || "加载文档详情失败", { type: "error" });
  } finally {
    boundDocumentDetailLoading.value = false;
  }
}

async function openBoundDocumentPreview(row) {
  if (!row?.id) {
    message("当前文档缺少 ID，无法预览", { type: "warning" });
    return;
  }
  try {
    boundDocumentPreviewRow.value = await loadBoundDocumentDetail(
      row,
      "加载预览文档失败"
    );
  } catch (error) {
    console.error("load preview document detail failed", error);
    boundDocumentPreviewRow.value = normalizeBoundDocumentRecord(row);
  }
  boundDocumentPreviewVisible.value = true;
}

function downloadBoundDocument(row) {
  const documentId = String(row?.id || row?.documentId || "").trim();
  const documentName = String(row?.name || row?.title || "document").trim();
  if (!documentId) {
    message("当前文档缺少 ID，无法下载", { type: "warning" });
    return;
  }
  downloadHandoverDocumentFile(documentId)
    .then(response =>
      unwrapHandoverDocumentFileResponse(response, "下载文件失败")
    )
    .then(blob => {
      if (!triggerHandoverDocumentDownload(blob, documentName)) {
        throw new Error("浏览器不支持当前下载方式");
      }
      message(`已开始下载：${documentName}`, { type: "success" });
    })
    .catch(error => {
      console.error("download bound document failed", error);
      message(error?.message || `下载失败：${documentName}`, { type: "error" });
    });
}

async function fetchDialogBoundDocuments() {
  const meta = getDocumentDialogMeta();
  if (!documentDialogSourceId.value) return [];
  return fetchBoundDocumentsByRelation({
    sourceKind: meta.sourceKind,
    sourceId: documentDialogSourceId.value,
    nodeName: documentDialogRelationNodeName.value,
    relationType: meta.relationType,
    listRelationRecordsBySourceAndType,
    fetchDocumentOptionsByIds
  });
}

function applyFetchedDialogDocuments(items = []) {
  const documents = normalizeNodeBoundDocuments(items);
  documentDialogSelectedDocuments.value = documents;
  if (documentDialogScope.value === "node") {
    updateNavigationNodeBoundDocuments(documentDialogTargetId.value, documents);
    return;
  }
  applySceneDeviceBindingPatch(documentDialogSourceId.value, {
    sourceId: documentDialogSourceId.value,
    relationNodeName: documentDialogRelationNodeName.value,
    boundDocuments: documents
  });
}

async function openDocumentDialog({
  scope = "node",
  mode = "bind",
  targetId = "",
  targetLabel = "",
  sourceId = "",
  relationNodeName = "",
  initialDocuments = []
} = {}) {
  if (!targetId || !sourceId) return;
  documentDialogScope.value = scope;
  documentDialogMode.value = mode;
  documentDialogTargetId.value = String(targetId || "").trim();
  documentDialogTargetLabel.value = String(
    targetLabel || getDocumentDialogMeta(scope).targetLabel
  ).trim();
  documentDialogSourceId.value = String(sourceId || "").trim();
  documentDialogRelationNodeName.value =
    scope === "object" ? String(relationNodeName || "").trim() : "";
  documentDialogKeyword.value = "";
  documentDialogPagination.value = createDefaultDocumentBindingPagination();
  documentDialogFolderId.value = "root";
  documentDialogFolderTreeData.value = createDefaultDocumentBindingFolderTree();
  documentDialogSelectedDocuments.value =
    normalizeNodeBoundDocuments(initialDocuments);
  documentDialogVisible.value = true;
  ctxMenuVisible.value = false;

  try {
    const boundDocuments = await fetchDialogBoundDocuments();
    applyFetchedDialogDocuments(boundDocuments);
  } catch (error) {
    message(error?.message || "加载绑定文件失败", { type: "error" });
  }

  if (mode === "bind") {
    documentDialogRecords.value = [];
    await loadCurrentDocumentFolders();
    void loadCurrentDocumentOptions();
  }
}

function onCtxBindDocuments() {
  const targetId = String(
    ctxMenuNode.value?.nodeId || ctxMenuNode.value?.id || ""
  ).trim();
  if (!targetId) {
    message("请先选择一个导航节点", { type: "warning" });
    return;
  }
  const targetNode = findNavigationNodeById(systemNodeTree.value, targetId);
  void openDocumentDialog({
    scope: "node",
    mode: "bind",
    targetId,
    targetLabel:
      targetNode?.label || ctxMenuNode.value?.label || ctxMenuNode.value?.name,
    sourceId: targetId,
    initialDocuments: getNavigationNodeBoundDocuments(targetId)
  });
}

function onCtxViewDocuments() {
  const targetId = String(
    ctxMenuNode.value?.nodeId || ctxMenuNode.value?.id || ""
  ).trim();
  if (!targetId) {
    message("请先选择一个导航节点", { type: "warning" });
    return;
  }
  const targetNode = findNavigationNodeById(systemNodeTree.value, targetId);
  void openDocumentDialog({
    scope: "node",
    mode: "view",
    targetId,
    targetLabel:
      targetNode?.label || ctxMenuNode.value?.label || ctxMenuNode.value?.name,
    sourceId: targetId,
    initialDocuments: getNavigationNodeBoundDocuments(targetId)
  });
}

function onCtxBindObjectDocuments() {
  const raw = ctxMenuNode.value?.raw || null;
  const targetUuid = String(raw?.uuid || "").trim();
  const sourceId = getSceneDeviceSourceId(raw);
  const relationNodeName = getSceneDeviceRelationNodeName(raw);
  if (!targetUuid || !sourceId || !relationNodeName) {
    message("当前构件缺少绑定标识，无法绑定文件", { type: "warning" });
    return;
  }
  void openDocumentDialog({
    scope: "object",
    mode: "bind",
    targetId: targetUuid,
    targetLabel:
      raw?.name || ctxMenuNode.value?.label || ctxMenuNode.value?.name,
    sourceId,
    relationNodeName,
    initialDocuments: raw?.boundDocuments || []
  });
}

function onCtxViewObjectDocuments() {
  const raw = ctxMenuNode.value?.raw || null;
  const targetUuid = String(raw?.uuid || "").trim();
  const sourceId = getSceneDeviceSourceId(raw);
  const relationNodeName = getSceneDeviceRelationNodeName(raw);
  if (!targetUuid || !sourceId || !relationNodeName) {
    message("当前构件缺少绑定标识，无法查看绑定文件", { type: "warning" });
    return;
  }
  void openDocumentDialog({
    scope: "object",
    mode: "view",
    targetId: targetUuid,
    targetLabel:
      raw?.name || ctxMenuNode.value?.label || ctxMenuNode.value?.name,
    sourceId,
    relationNodeName,
    initialDocuments: raw?.boundDocuments || []
  });
}

function handleDocumentSelectionChange(selection = []) {
  const normalizedSelection = selection
    .map(normalizeDocumentBindingOption)
    .filter(Boolean);
  const currentPageIds = documentDialogRecords.value.map(item => item.id);
  documentDialogSelectedDocuments.value = mergeSelectedDocumentBindings(
    documentDialogSelectedDocuments.value,
    normalizedSelection,
    currentPageIds
  );
}

async function searchDocumentOptions(keyword) {
  documentDialogKeyword.value = String(keyword || "");
  documentDialogPagination.value.page = 1;
  await loadCurrentDocumentOptions(documentDialogKeyword.value);
}

async function onDocumentFolderChange(folderId) {
  documentDialogFolderId.value = String(folderId || "root").trim() || "root";
  documentDialogPagination.value.page = 1;
  await loadCurrentDocumentOptions(documentDialogKeyword.value);
}

async function onDocumentPageChange(page) {
  documentDialogPagination.value.page = Math.max(1, page);
  await loadCurrentDocumentOptions(documentDialogKeyword.value);
}

async function onDocumentSizeChange(size) {
  documentDialogPagination.value.size = size;
  documentDialogPagination.value.page = 1;
  await loadCurrentDocumentOptions(documentDialogKeyword.value);
}

const propDialogVisible = ref(false);
const propDialogMode = ref("bind"); // bind | edit | clear
const propEditForm = ref(createEmptyPropertyForm());
const propertyBindingLoading = ref(false);
const propertyBindingKeyword = ref("");
const propertyBindingRecords = ref([]);
const selectedPropertyBindingKks = ref("");
const propertyBindingPagination = ref({
  page: 1,
  size: 20,
  total: 0
});

function normalizePropertyStatus(value) {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (!text) return "-";
  if (["VALID", "SUCCESS", "已校验"].includes(text)) return "已校验";
  if (["INVALID", "FAILED", "异常"].includes(text)) return "异常";
  if (["PENDING", "待校验"].includes(text)) return "待校验";
  return String(value || "").trim() || "-";
}

async function fetchKksDetailByKks(kks) {
  if (!kks) return null;
  const response = await getHandoverKksList({
    keyword: kks,
    page: 1,
    size: 20
  });
  const data = response?.data ?? response ?? {};
  const records = Array.isArray(data?.records)
    ? data.records
    : Array.isArray(data)
      ? data
      : [];
  const record =
    records.find(item => String(item?.kks || "").trim() === kks) || null;
  if (!record) return null;

  return {
    ...record,
    systemName:
      record?.systemName ||
      record?.systemNodeLabel ||
      record?.systemNodeName ||
      getSystemNodeLabel(record?.systemNodeId || record?.nodeId) ||
      ""
  };
}

function normalizePropertyBindingOption(item) {
  const kks = String(item?.kks || "").trim();
  if (!kks) return null;
  const systemName = String(
    item?.systemName || item?.systemNodeLabel || item?.systemNodeName || ""
  ).trim();
  const status = normalizePropertyStatus(item?.statusText || item?.status);

  return {
    id: String(item?.id || kks),
    kks,
    nodeId: "",
    name: String(item?.name || item?.title || "").trim(),
    type: String(item?.type || "").trim(),
    systemName,
    status,
    label: [kks, String(item?.name || item?.title || "").trim(), systemName]
      .filter(Boolean)
      .join(" / ")
  };
}

async function loadPropertyBindingOptions(keyword = "") {
  propertyBindingLoading.value = true;
  try {
    const { data } = await getHandoverKksList({
      keyword: keyword.trim() || undefined,
      page: propertyBindingPagination.value.page,
      size: propertyBindingPagination.value.size
    });
    const list = Array.isArray(data?.records) ? data.records : [];
    propertyBindingRecords.value = list
      .map(normalizePropertyBindingOption)
      .filter(Boolean);
    propertyBindingPagination.value.total = Number(data?.total ?? 0);
    propertyBindingPagination.value.page = Number(
      data?.page ?? propertyBindingPagination.value.page
    );
    propertyBindingPagination.value.size = Number(
      data?.size ?? propertyBindingPagination.value.size
    );
  } catch (error) {
    propertyBindingRecords.value = [];
    propertyBindingPagination.value.total = 0;
    message(error?.message || "加载数据台账列表失败", { type: "error" });
  } finally {
    propertyBindingLoading.value = false;
  }
}

function applyPropertyBindingOption(option) {
  if (!option) return;
  propEditForm.value = {
    ...propEditForm.value,
    kks: option.kks,
    nodeId: option.nodeId || propEditForm.value.nodeId || ""
  };
}

const currentPropertyTargetName = computed(() => {
  return String(
    ctxMenuNode.value?.raw?.name ||
      ctxMenuNode.value?.label ||
      ctxMenuNode.value?.name ||
      "-"
  ).trim();
});

const documentDialogTitle = computed(() => {
  const scopeLabel = documentDialogScope.value === "object" ? "构件" : "节点";
  return documentDialogMode.value === "view"
    ? `查看${scopeLabel}绑定文件`
    : `绑定${scopeLabel}文件`;
});

const currentDocumentBoundCount = computed(
  () => documentDialogSelectedDocuments.value.length
);

const documentDialogCurrentLabel = computed(() =>
  documentDialogScope.value === "object" ? "当前构件" : "当前节点"
);

const documentDialogEmptyText = computed(() =>
  documentDialogScope.value === "object"
    ? "当前构件尚未绑定文档"
    : "当前节点尚未绑定文档"
);

async function openPropertyDialog(mode) {
  ctxMenuVisible.value = false;
  propDialogMode.value = mode;
  propEditForm.value =
    mode === "bind"
      ? buildBindPropertyForm(ctxMenuNode.value)
      : { ...getContextDeviceProps(ctxMenuNode.value) };
  selectedPropertyBindingKks.value = propEditForm.value.kks || "";
  propertyBindingKeyword.value = "";
  propertyBindingRecords.value = [];
  propertyBindingPagination.value.page = 1;
  propDialogVisible.value = true;
  await loadPropertyBindingOptions();
}

async function onCtxBindProp() {
  await openPropertyDialog("bind");
}

async function onCtxEditProp() {
  await openPropertyDialog("edit");
}

async function onCtxClearProp() {
  ctxMenuVisible.value = false;
  const raw = ctxMenuNode.value?.raw || null;
  const sourceId = getSceneDeviceSourceId(raw);
  const relationNodeName = getSceneDeviceRelationNodeName(raw);
  try {
    if (sourceId && relationNodeName) {
      await upsertSceneObjectKksRelation({
        sourceId,
        relationNodeName,
        kks: "",
        relationId: raw?.kksRelationId || ""
      });
    }
    const cleared = clearNodeProperty(ctxMenuNode.value, sceneDevices.value);
    if (cleared && sourceId && relationNodeName) {
      applySceneDeviceBindingPatch(sourceId, {
        relationNodeName,
        kks: "",
        nodeId: "",
        kksRelationId: ""
      });
    }
    if (cleared) {
      syncSavedObjectBindingsFromSceneDevices();
      message("已清空该构件属性", { type: "success" });
    }
  } catch (error) {
    message(error?.message || "解除业务数据绑定失败", { type: "error" });
  }
}

const propDialogTitle = computed(() => {
  const map = {
    bind: "绑定业务数据",
    edit: "更换业务数据",
    clear: "解除业务数据"
  };
  return map[propDialogMode.value] || "属性";
});

function syncSavedObjectBindingsFromSceneDevices() {
  savedObjectBindings.value = sceneDevices.value
    .filter(
      item =>
        item?.uuid &&
        (item.kks ||
          item.nodeId ||
          (Array.isArray(item.boundDocuments) &&
            item.boundDocuments.length > 0))
    )
    .map(item => ({
      instanceId: item.instanceId || "",
      modelId: getSceneDeviceModelId(item),
      sourceId: getSceneDeviceSourceId(item),
      nodeName: getSceneDeviceNodeName(item),
      relationNodeName: getSceneDeviceRelationNodeName(item),
      objectUuid: item.uuid,
      meshUuids: Array.isArray(item.meshUuids) ? item.meshUuids : [],
      objectName: item.name || "",
      path: item.path || "",
      kks: item.kks || "",
      nodeId: item.nodeId || "",
      kksRelationId: item.kksRelationId || "",
      documentRelationIds: Array.isArray(item.documentRelationIds)
        ? item.documentRelationIds
        : [],
      boundDocuments: normalizeNodeBoundDocuments(item.boundDocuments || [])
    }));

  const nextPackage = patchProjectPackage(
    currentSceneSchemeScope.value,
    {
      metadata: getProjectMetadata(),
      scene: {
        bindings: {
          objectBindings: savedObjectBindings.value.map(item => ({
            bindingId: `binding-${item.objectUuid}`,
            instanceId: item.instanceId || "",
            modelId: item.modelId || "",
            sourceId: item.sourceId || item.modelId || "",
            nodeName: item.nodeName || item.objectName || "",
            relationNodeName: item.relationNodeName || "",
            objectUuid: item.objectUuid,
            meshUuids: Array.isArray(item.meshUuids) ? item.meshUuids : [],
            objectName: item.objectName || "",
            path: item.path || "",
            businessBinding: {
              nodeId: item.nodeId || "",
              kks: item.kks || "",
              tag: "",
              bindingType: item.kks ? "device" : "custom"
            },
            documentBindings: normalizeNodeBoundDocuments(
              item.boundDocuments || []
            ),
            properties: {}
          }))
        }
      }
    },
    getProjectMetadata()
  );
  projectStore.setProjectPackage(nextPackage);
}

async function upsertSceneObjectKksRelation({
  sourceId,
  relationNodeName,
  kks,
  relationId = ""
}) {
  const relationKey = getRelationRecordModelNodeKey({
    sourceId,
    nodeName: relationNodeName
  });
  if (!sourceId || !relationKey) return "";
  const currentRelations = (
    await listModelObjectRelationsBySourceAndType(
      sourceId,
      MODEL_OBJECT_KKS_RELATION_TYPE
    )
  ).filter(item => getRelationRecordModelNodeKey(item) === relationKey);
  const normalizedKks = String(kks || "").trim();

  if (!normalizedKks) {
    await Promise.all(
      currentRelations
        .map(item => String(item?.id || "").trim())
        .filter(Boolean)
        .map(id => deleteRelationRecord(id))
    );
    return "";
  }

  const normalizedRelationId = String(relationId || "").trim();
  let primaryRelationId = currentRelations.some(
    item => String(item?.id || "").trim() === normalizedRelationId
  )
    ? normalizedRelationId
    : String(currentRelations[0]?.id || "").trim();
  const payload = {
    type: MODEL_OBJECT_KKS_RELATION_TYPE,
    sourceKind: MODEL_OBJECT_SOURCE_KIND,
    sourceId,
    targetKind: "kks",
    targetId: normalizedKks
  };

  if (primaryRelationId) {
    await updateRelationRecord({
      id: primaryRelationId,
      ...payload
    });
  } else {
    await createRelationRecord({
      ...payload,
      nodeName: relationNodeName
    });
  }

  const refreshedRelations = await listModelObjectRelationsBySourceAndType(
    sourceId,
    MODEL_OBJECT_KKS_RELATION_TYPE
  );
  const refreshedNodeRelations = refreshedRelations.filter(
    item => getRelationRecordModelNodeKey(item) === relationKey
  );
  const primaryRelation =
    refreshedNodeRelations.find(
      item => String(item?.id || "").trim() === primaryRelationId
    ) ||
    refreshedNodeRelations.find(
      item => String(item?.targetId || "").trim() === normalizedKks
    ) ||
    refreshedNodeRelations[0] ||
    null;
  primaryRelationId = String(primaryRelation?.id || "").trim();

  await Promise.all(
    refreshedNodeRelations
      .filter(item => String(item?.id || "").trim() !== primaryRelationId)
      .map(item => String(item?.id || "").trim())
      .filter(Boolean)
      .map(id => deleteRelationRecord(id))
  );

  return primaryRelationId;
}

async function confirmPropDialog() {
  const confirmed = confirmScenePropertyDialog({
    mode: propDialogMode.value,
    form: propEditForm.value,
    node: ctxMenuNode.value,
    sceneDevices: sceneDevices.value,
    notify: message
  });
  if (!confirmed) return;
  const raw = ctxMenuNode.value?.raw || null;
  const sourceId = getSceneDeviceSourceId(raw);
  const relationNodeName = getSceneDeviceRelationNodeName(raw);
  if (!sourceId || !relationNodeName) {
    message("当前构件缺少绑定标识，无法提交后端", { type: "error" });
    return;
  }
  try {
    const kksRelationId = await upsertSceneObjectKksRelation({
      sourceId,
      relationNodeName,
      kks: propEditForm.value.kks,
      relationId: raw?.kksRelationId || ""
    });
    applySceneDeviceBindingPatch(sourceId, {
      sourceId,
      relationNodeName,
      kks: propEditForm.value.kks || "",
      nodeId:
        propEditForm.value.nodeId ||
        buildNodeIdByKks(propEditForm.value.kks) ||
        "",
      kksRelationId
    });
    message(
      propDialogMode.value === "bind" ? "业务数据已绑定" : "业务数据已更新",
      {
        type: "success"
      }
    );
  } catch (error) {
    message(error?.message || "提交业务数据绑定失败", { type: "error" });
    return;
  }
  syncSavedObjectBindingsFromSceneDevices();
  propDialogVisible.value = false;
}

async function confirmDocumentDialog() {
  const meta = getDocumentDialogMeta();
  if (!documentDialogTargetId.value || !documentDialogSourceId.value) return;
  try {
    const { documents, relationIds } = await replaceDocumentRelations({
      sourceKind: meta.sourceKind,
      sourceId: documentDialogSourceId.value,
      nodeName: documentDialogRelationNodeName.value,
      relationType: meta.relationType,
      documents: documentDialogSelectedDocuments.value,
      listRelationRecordsBySourceAndType,
      deleteRelationRecord,
      createRelationRecord,
      normalizeDocuments: normalizeNodeBoundDocuments
    });

    if (documentDialogScope.value === "object") {
      applySceneDeviceBindingPatch(documentDialogSourceId.value, {
        sourceId: documentDialogSourceId.value,
        relationNodeName: documentDialogRelationNodeName.value,
        boundDocuments: documents,
        documentRelationIds: relationIds
      });
      syncSavedObjectBindingsFromSceneDevices();
    } else {
      updateNavigationNodeBoundDocuments(
        documentDialogTargetId.value,
        documents
      );
    }

    documentDialogVisible.value = false;
    message(meta.successMessage, { type: "success" });
  } catch (error) {
    message(error?.message || meta.errorMessage, { type: "error" });
  }
}

async function searchPropertyBindingRecords(keyword) {
  propertyBindingKeyword.value = String(keyword || "");
  propertyBindingPagination.value.page = 1;
  await loadPropertyBindingOptions(propertyBindingKeyword.value);
}

function handlePropertyBindingRowClick(row) {
  if (!row?.kks) return;
  selectedPropertyBindingKks.value = row.kks;
  applyPropertyBindingOption(row);
}

async function onPropertyBindingPageChange(page) {
  propertyBindingPagination.value.page = Math.max(1, page);
  await loadPropertyBindingOptions(propertyBindingKeyword.value);
}

async function onPropertyBindingSizeChange(size) {
  propertyBindingPagination.value.size = size;
  propertyBindingPagination.value.page = 1;
  await loadPropertyBindingOptions(propertyBindingKeyword.value);
}

watch(
  () => selectedSceneDevice.value?.kks || "",
  async kks => {
    if (!kks) {
      selectedKksDetail.value = null;
      selectedKksDetailError.value = "";
      return;
    }

    selectedKksDetailLoading.value = true;
    selectedKksDetailError.value = "";
    try {
      selectedKksDetail.value = await fetchKksDetailByKks(kks);
      if (!selectedKksDetail.value) {
        selectedKksDetailError.value = "未查询到当前 KKS 的业务数据详情";
      }
    } catch (error) {
      selectedKksDetail.value = null;
      selectedKksDetailError.value = error?.message || "加载业务数据详情失败";
    } finally {
      selectedKksDetailLoading.value = false;
    }
  },
  { immediate: true }
);

function applyLayerVisibility(keys) {
  applySceneLayerVisibility({
    viewerAdapter,
    keys,
    allLayerLeafKeys: allLayerLeafKeys.value,
    sceneDevices: sceneDevices.value,
    setDisplayMode: value => {
      displayMode.value = value;
    }
  });
}

function handleLayerTreeCheck() {
  if (guardPlaneUnsupported("分层筛选模型")) return;
  const keys = layerTreeRef.value?.getCheckedKeys?.(true) || [];
  layerCheckedKeys.value = [...keys];
  applyLayerVisibility(layerCheckedKeys.value);
}

async function applyDisplayMode(mode, withMessage = true) {
  if (guardPlaneUnsupported("模型显示模式切换")) return false;
  return await applySceneDisplayMode({
    mode,
    viewerAdapter,
    sceneDevices: sceneDevices.value,
    selectedSystemNodeId: selectedSystemNodeId.value,
    selectedSceneDevice: selectedSceneDevice.value,
    getDevicesBySystem: getSceneDevicesBySystem,
    isolateDevice: (item, silent = false) => isolateDevice(item, silent),
    setSelectedDeviceUuid: value => {
      selectedDeviceUuid.value = value;
    },
    setDisplayMode: value => {
      displayMode.value = value;
    },
    syncLayerTreeSelection,
    notify: message,
    withMessage
  });
}

async function applySelectionDisplayAction() {
  if (guardPlaneUnsupported("模型显示模式切换")) return false;
  if (selectedSceneDevice.value?.uuid) {
    return await applyDisplayMode("selection", true);
  }

  const uuids = getSelectedDisplayUuids();
  const selectedUuid = getSelectedObjectUuid();
  if (!uuids.length || !selectedUuid) {
    message("请先选择一个构件", { type: "warning" });
    return false;
  }

  viewerAdapter.showOnlyUUIDs(uuids);
  viewerAdapter.focusObjectsByUUIDs(uuids);
  setRuntimeDisplayMode("selection");
  syncLayerTreeSelection([selectedUuid]);
  await selectTreeNodeByUUID(selectedUuid, { openPanel: false });
  message("已切换为仅显示当前构件", { type: "success" });
  return true;
}

async function applyModelDisplayAction() {
  if (guardPlaneUnsupported("模型显示模式切换")) return false;
  const instanceId = resolveCurrentModelInstanceId();
  if (!instanceId) {
    message("请先选择一个模型或构件", { type: "warning" });
    return false;
  }

  const devices = getDevicesByModelInstance(instanceId);
  const uuids = getSceneDevicesUuids(devices);
  if (!uuids.length) {
    message("当前模型暂无可显示构件", { type: "warning" });
    return false;
  }

  viewerAdapter.showOnlyUUIDs(uuids);
  viewerAdapter.focusObjectsByUUIDs(uuids);
  if (devices[0]?.uuid) {
    selectedDeviceUuid.value = devices[0].uuid;
  }
  setRuntimeDisplayMode("model");
  syncLayerTreeSelection(devices.map(item => item.uuid).filter(Boolean));

  const modelLabel =
    sceneModels.value.find(item => item.instanceId === instanceId)?.modelName ||
    "当前模型";
  message(`已切换为仅显示模型：${modelLabel}`, { type: "success" });
  return true;
}

async function applyTypeDisplayAction() {
  if (guardPlaneUnsupported("模型显示模式切换")) return false;
  const type = getSelectedObjectType();
  if (!type) {
    message("请先选择一个构件", { type: "warning" });
    return false;
  }

  const devices = sceneDevices.value.filter(item => item.type === type);
  const uuids = getSceneDevicesUuids(devices);
  if (!uuids.length) {
    message("当前类型暂无可显示构件", { type: "warning" });
    return false;
  }

  viewerAdapter.showOnlyUUIDs(uuids);
  viewerAdapter.focusObjectsByUUIDs(uuids);
  setRuntimeDisplayMode("type");
  syncLayerTreeSelection(devices.map(item => item.uuid).filter(Boolean));
  message(`已切换为仅显示类型：${type}`, { type: "success" });
  return true;
}

function hideCurrentDisplayObject() {
  if (guardPlaneUnsupported("隐藏模型构件")) return false;
  const uuids = getSelectedDisplayUuids();
  if (!uuids.length) {
    message("请先选择一个构件", { type: "warning" });
    return false;
  }

  viewerAdapter.hideUUIDs(uuids);
  message("已隐藏当前构件", { type: "success" });
  return true;
}

function clearHiddenDisplayObjects() {
  if (guardPlaneUnsupported("恢复隐藏模型构件")) return false;
  viewerAdapter.clearHiddenUUIDs();
  message("已恢复隐藏构件", { type: "success" });
  return true;
}

async function applyDisplayAction(action) {
  if (guardPlaneUnsupported("模型显示模式切换")) return false;
  if (!ensureDisplayActionReady()) return false;

  if (action === "all") {
    viewerAdapter.clearHiddenUUIDs();
    viewerAdapter.clearIsolation();
    viewerAdapter.filterVisibleUUIDs(null);
    setRuntimeDisplayMode("all");
    syncLayerTreeSelection();
    message("已恢复全部构件显示", { type: "success" });
    return true;
  }

  if (action === "selection") {
    return applySelectionDisplayAction();
  }

  if (action === "system") {
    return await applyDisplayMode("system", true);
  }

  if (action === "model") {
    return applyModelDisplayAction();
  }

  if (action === "type") {
    return applyTypeDisplayAction();
  }

  if (action === "hide-current") {
    return hideCurrentDisplayObject();
  }

  if (action === "restore-hidden") {
    return clearHiddenDisplayObjects();
  }

  return false;
}

async function onObjectSelect(info) {
  hideCanvasContextToolbar();
  if (isPlaneRendering.value) return;
  if (
    positionPickingState.value.active &&
    Array.isArray(info?.hitPoint) &&
    info.hitPoint.length >= 3
  ) {
    positionPickingState.value = {
      ...positionPickingState.value,
      pickedPosition: info.hitPoint.slice(0, 3).map(item => Number(item) || 0)
    };
    syncSceneAnchors();
    return;
  }
  runtimeStore.setSelectedAnchorId("");
  runtimeStore.setSelectedCameraId("");
  anchorDetailVisible.value = false;
  runtimeStore.closeVideoDialog();
  runtimeEventBus.emit("viewer.objectSelected", info);
  await handleSceneObjectSelect({
    info,
    runtimeStore,
    setSelectedDeviceUuid: value => {
      selectedDeviceUuid.value = value;
    },
    sceneDevices: sceneDevices.value,
    syncNavigationSelections,
    setShowObjectPanel: value => {
      showObjectPanel.value = value;
    },
    syncMeasurementPoints,
    interactionMode: interactionMode.value,
    treeFilterTextRef: treeFilterText,
    clearTreeFilterText: () => {
      treeFilterText.value = "";
    },
    selectTreeNodeByUUID
  });
  const clippingTargetUuid = info?.objectUuid || info?.uuid || "";
  const currentTargetUuid =
    runtimeClippingState.value.targets?.objectUuids?.[0] ||
    runtimeClippingState.value.targetObjectUuid ||
    "";
  if (
    clippingTargetUuid &&
    runtimeClippingState.value.targetMode === "object" &&
    (runtimeClippingState.value.targets?.objectUuids || []).length <= 1
  ) {
    const shouldResetPlane = clippingTargetUuid !== currentTargetUuid;
    const nextState = {
      ...runtimeClippingState.value,
      targetMode: "object",
      targetObjectUuid: clippingTargetUuid,
      targetObjectName: info.name || "",
      targets: {
        mode: "objects",
        objectUuids: [clippingTargetUuid],
        objectNames: [info.name || clippingTargetUuid]
      }
    };
    updateClippingState(
      shouldResetPlane ? withSingleObjectClippingPlane(nextState) : nextState
    );
  }
}

function closeObjectPanel() {
  closeSceneObjectPanel({
    setShowObjectPanel: value => {
      showObjectPanel.value = value;
    },
    viewerAdapter
  });
}

function expandTreeToUUID(uuid) {
  expandSceneTreeToUUID({
    uuid,
    treeRef,
    treeParentMap: treeParentMap.value,
    treeExpandedKeys: treeExpandedKeys.value
  });
}

function scrollCurrentTreeNodeIntoView(uuid) {
  scrollSceneCurrentTreeNodeIntoView({ uuid, treeRef });
}

function collectTreeNodeUuids(node, set = new Set()) {
  if (!node) return set;
  if (node.uuid) set.add(node.uuid);
  (node.children || []).forEach(child => collectTreeNodeUuids(child, set));
  return set;
}

function getLayerKeysForTreeNode(node) {
  const uuids = collectTreeNodeUuids(node);
  if (!uuids.size) return [];
  return sceneDevices.value
    .filter(device => {
      if (uuids.has(device.uuid)) return true;
      const meshUuids = Array.isArray(device.meshUuids) ? device.meshUuids : [];
      return meshUuids.some(uuid => uuids.has(uuid));
    })
    .map(item => item.uuid)
    .filter(Boolean);
}

function findSceneTreeNodeByModelInstanceId(instanceId) {
  const key = String(instanceId || "").trim();
  if (!key) return null;
  let matched = null;
  walkSceneTree(sceneTree.value, node => {
    if (matched) return;
    if (String(node?.sceneModelInstanceId || "").trim() === key) {
      matched = node;
    }
  });
  return matched;
}

async function selectTreeNodeByUUID(uuid, { openPanel = true } = {}) {
  await selectSceneTreeNodeByUUID({
    uuid,
    openPanel,
    activeSideTabRef: activeSideTab,
    sceneTreeRef: sceneTree,
    refreshSceneTree,
    treeNodeIndex: treeNodeIndex.value,
    setSelectedTreeNode: value => {
      selectedTreeNode.value = value;
    },
    nextTick,
    treeRef,
    expandTreeToUUID,
    scrollCurrentTreeNodeIntoView,
    viewerAdapter
  });
}

function handleTreeNodeExpand(data) {
  if (data?.uuid) treeExpandedKeys.value.add(data.uuid);
}

function handleTreeNodeCollapse(data) {
  if (data?.uuid) treeExpandedKeys.value.delete(data.uuid);
}

function applyStructureTreeFilter() {
  treeRef.value?.filter?.({
    keyword: treeFilterText.value,
    modelType: structureModelTypeFilter.value
  });
}

function handleStructureFilterUpdate(value) {
  treeFilterText.value = value || "";
  applyStructureTreeFilter();
}

function handleStructureModelTypeFilterUpdate(value) {
  structureModelTypeFilter.value = value || "all";
  applyStructureTreeFilter();
}

async function handleStructureNodeClick(node) {
  if (guardPlaneUnsupported("结构树选择和定位")) return;
  selectedTreeNode.value = node || null;
  if (!node?.uuid) return;

  const target = sceneDevices.value.find(item => {
    if (item.uuid === node.uuid) return true;
    const meshUuids = Array.isArray(item.meshUuids) ? item.meshUuids : [];
    return meshUuids.includes(node.uuid);
  }) || {
    uuid: node.uuid,
    name: node.name || "未命名构件",
    path: node.name || "",
    type: node.type || "Object3D",
    meshUuids: [node.uuid],
    kks: "",
    nodeId: ""
  };
  await locateDevice(target, false);
}

function focusSelectedNode() {
  if (guardPlaneUnsupported("视角定位")) return;
  if (!selectedTreeNode.value?.uuid) return;
  viewerAdapter.selectObjectByUUID(selectedTreeNode.value.uuid, {
    emitEvent: false
  });
  viewerAdapter.focusObjectByUUID(selectedTreeNode.value.uuid);
}

function makeSelectedMeshTransparent() {
  if (guardPlaneUnsupported("构件透明化")) return;
  if (!selectedTreeNode.value?.isMesh) return;
  viewerAdapter.setMeshOpacityByUUID(
    selectedTreeNode.value.uuid,
    meshOpacity.value
  );
}

function restoreSelectedMeshOpacity() {
  if (guardPlaneUnsupported("构件透明化")) return;
  if (!selectedTreeNode.value?.isMesh) return;
  viewerAdapter.setMeshOpacityByUUID(selectedTreeNode.value.uuid, 1);
}

function handleMeshOpacityUpdate(value) {
  meshOpacity.value = Number(value) || 0.2;
}

async function isolateSelectedNode() {
  if (guardPlaneUnsupported("隔离模型构件")) return;
  if (!selectedTreeNode.value?.uuid) {
    message("请先选择一个结构节点", { type: "warning" });
    return;
  }
  const uuid = selectedTreeNode.value.uuid;
  viewerAdapter.showOnlyUUIDs([uuid]);
  viewerAdapter.focusObjectByUUID(uuid);
  displayMode.value = "selection";
  syncLayerTreeSelection(getLayerKeysForTreeNode(selectedTreeNode.value));
  await nextTick();
  refreshSceneTree();
  message(`已隔离显示：${selectedTreeNode.value.name || uuid}`, {
    type: "success"
  });
}

async function hideSelectedTreeNode() {
  if (guardPlaneUnsupported("隐藏模型构件")) return;
  if (!selectedTreeNode.value?.uuid) {
    message("请先选择一个结构节点", { type: "warning" });
    return;
  }
  viewerAdapter.hideUUIDs([selectedTreeNode.value.uuid]);
  await nextTick();
  refreshSceneTree();
  message(`已隐藏：${selectedTreeNode.value.name || "当前节点"}`, {
    type: "success"
  });
}

async function restoreHiddenTreeNodes() {
  if (guardPlaneUnsupported("恢复隐藏模型构件")) return;
  viewerAdapter.clearHiddenUUIDs();
  await nextTick();
  refreshSceneTree();
  message("已恢复结构树隐藏项", { type: "success" });
}

async function showAllObjects() {
  if (guardPlaneUnsupported("模型显示模式切换")) return;
  viewerAdapter.clearHiddenUUIDs();
  viewerAdapter.clearIsolation();
  viewerAdapter.filterVisibleUUIDs(null);
  displayMode.value = "all";
  syncLayerTreeSelection();
  await nextTick();
  refreshSceneTree();
  message("已恢复全部构件显示", { type: "success" });
}

function handleViewerLoaded() {
  sceneAnchorSyncSignature = "";
  handleViewerLoadedLifecycle({
    runtimeStore,
    viewerAdapter,
    refreshSceneTree,
    refreshSceneDevices,
    syncSceneObjectRelationsFromBackend,
    syncRoamingState,
    syncMeasurementPoints,
    syncMeasurementRecordsToViewer,
    syncSceneAnchors,
    applyAssetGroupVisibility,
    syncLayerTreeSelection,
    quality: quality.value,
    materialTheme: materialTheme.value,
    runtimeClippingState: runtimeClippingState.value,
    clippingAnimationSpeed: clippingAnimationSpeed.value,
    clippingAnimationMode: clippingAnimationMode.value,
    clippingAnimationAxis: clippingAnimationAxis.value,
    syncRuntimeServices
  });
  nextTick(() => {
    syncSceneDeviceStatusColors();
  });
  if (isPlaneRendering.value) {
    void refreshPlaneSnapshot({ force: true });
  }
  void refreshNavigationSnapshot({ force: true });
}

function handleViewerClippingChange(payload) {
  syncClippingStateFromViewer(payload);
}

function goBack() {
  if (window.history.length > 1) router.back();
  else {
    router.push({
      path: "/visualization/3d-viewer",
      query: {
        id: modelId.value,
        name: modelName.value,
        projectId: handoverProjectId.value
      }
    });
  }
}

function isEditableShortcutTarget(target) {
  const tag = target?.tagName?.toLowerCase?.() || "";
  return shortcutEditableTags.has(tag) || Boolean(target?.isContentEditable);
}

function applyMaterialThemeShortcut(theme, label) {
  setMaterialTheme(theme);
  message(`已切换视图模式：${label}`, { type: "info" });
}

function handleFullscreenShortcut(event) {
  if (isEditableShortcutTarget(event.target || document.activeElement)) return;

  const key = event.key?.toLowerCase?.() || "";
  if (key === "escape" && canvasContextToolbarVisible.value) {
    event.preventDefault();
    hideCanvasContextToolbar();
    return;
  }

  if (key === "escape" && positionPickingState.value.active) {
    cancelPositionPicking();
    return;
  }

  if (isPlaneRendering.value) {
    const blocked =
      key === "home" ||
      key === "r" ||
      key === "k" ||
      key === "t" ||
      key === "h" ||
      Boolean(measurementShortcutMap[key]) ||
      Boolean(clippingShortcutMap[key]) ||
      Boolean(displayModeShortcutMap[key]);
    if (blocked) {
      event.preventDefault();
      guardPlaneUnsupported("三维视角和模型选择操作");
      return;
    }
  }

  if (roamingEnabled.value && key !== "r") return;

  if (key === "home") {
    event.preventDefault();
    resetView();
    return;
  }

  if (key === "r" && !event.altKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    toggleRoaming();
    return;
  }

  const measurementShortcut = measurementShortcutMap[key];
  if (
    measurementShortcut &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey
  ) {
    event.preventDefault();
    onToolChange("measure");
    setMeasurementMode(measurementShortcut.mode);
    message(`已切换测量工具：${measurementShortcut.label}`, { type: "info" });
    return;
  }

  const materialShortcut = materialThemeShortcutMap[key];
  if (materialShortcut && !event.altKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    applyMaterialThemeShortcut(materialShortcut.theme, materialShortcut.label);
    return;
  }

  const clippingShortcut = clippingShortcutMap[key];
  if (clippingShortcut && !event.altKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    onClippingPresetChange(clippingShortcut.presetId);
    return;
  }

  if (key === "k" && !event.altKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    toggleClipping();
    return;
  }

  if (key === "t" && !event.altKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    toggleTransparent();
    return;
  }

  if (key === "h" && !event.altKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    void applyDisplayMode("selection");
    return;
  }

  const displayShortcut = displayModeShortcutMap[key];
  if (displayShortcut && event.altKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    void applyDisplayMode(displayShortcut.mode);
  }
}

onMounted(async () => {
  onFullscreenKeydown = handleFullscreenShortcut;
  window.addEventListener("keydown", onFullscreenKeydown);
  await loadAvailableModels();
  await reloadProjectSceneContext();
  refreshSceneTree();
});

watch(
  () => handoverProjectId.value,
  async () => {
    await reloadProjectSceneContext();
  }
);

watch(
  () => routeModelId.value,
  async modelId => {
    await initializeRouteSceneModel(modelId);
  }
);

watch(
  () => activeSceneModelId.value,
  () => {
    syncActiveModelDetail();
  }
);

watch(
  () => modelUrl.value,
  () => {
    resetViewerSceneOnModelChange({
      stopClippingAnimation,
      clearClippingPersistTimer: () => {
        if (clippingPersistTimer) {
          clearTimeout(clippingPersistTimer);
          clippingPersistTimer = null;
        }
      },
      stopRuntimeServices,
      runtimeStore,
      projectStore,
      viewerAdapter,
      setSelectedTreeNode: value => {
        selectedTreeNode.value = value;
      },
      setTreeFilterText: value => {
        treeFilterText.value = value;
        structureModelTypeFilter.value = "all";
      },
      setSceneTree: value => {
        sceneTree.value = value;
      },
      setSceneDevices: value => {
        sceneDevices.value = value;
      },
      setAnchors: value => {
        anchors.value = value;
      },
      setCameraAnchors: value => {
        cameraAnchors.value = value;
      },
      setMeasurementRecords: value => {
        measurementRecords.value = value;
      },
      setSelectedDeviceUuid: value => {
        selectedDeviceUuid.value = value;
      },
      setSelectedAnchorId: value => {
        selectedAnchorId.value = value;
      },
      setSelectedCameraId: value => {
        selectedCameraId.value = value;
      },
      setSelectedSystemNodeId: value => {
        selectedSystemNodeId.value = value;
      },
      setSelectedQuickKks: value => {
        selectedQuickKks.value = value;
      },
      setDisplayMode: value => {
        displayMode.value = value;
      },
      setCurrentNavNodeKey: value => {
        currentNavNodeKey.value = value;
      },
      setLayerCheckedKeys: value => {
        layerCheckedKeys.value = value;
      },
      setShowObjectPanel: value => {
        showObjectPanel.value = value;
      },
      setAnchorDetailVisible: value => {
        anchorDetailVisible.value = value;
      },
      setRoamingEnabled: value => {
        roamingEnabled.value = value;
      },
      setSelectedLodId: value => {
        selectedLodId.value = value;
      },
      resetClippingState: () => {
        runtimeStore.setClippingState(createDefaultClippingState());
        projectStore.setClippingState(createDefaultClippingState());
        runtimeStore.setClippingStats({
          enabled: false,
          mode: "single-plane",
          activePlaneCount: 0,
          affectedMeshCount: 0,
          totalMeshCount: 0
        });
      },
      refreshSceneTree,
      restorePersistedProjectState: () => {
        loadPersistedProjectState(
          currentProjectContext.value?.parsedProjectInfo,
          {
            preferProjectInfo: false,
            persistResolvedPackage: false
          }
        );
      }
    });
  }
);

watch(
  () => [selectedDeviceUuid.value, pointMarkersVisible.value],
  () => {
    syncMeasurementPointsOnWatcher({
      syncMeasurementPoints
    });
  }
);

watch(
  () => Boolean(enableClipping.value || runtimeClippingState.value?.enabled),
  () => {
    syncSceneAnchors();
    syncMeasurementPoints();
  }
);

watch(
  () => measurementMode.value,
  value => {
    syncMeasurementModeOnWatcher({
      value,
      setMeasurementMode
    });
  },
  { immediate: true }
);

watch(
  () => videoDialogVisible.value,
  async value => {
    await handleVideoDialogVisibilityChange({
      visible: value,
      nextTick,
      mountActiveVideo,
      videoAdapter,
      clearVideoError: () => {
        videoErrorText.value = "";
      }
    });
  }
);

watch(
  () => activeCameraDetail.value?.id,
  async () => {
    await handleActiveCameraChange({
      videoDialogVisible: videoDialogVisible.value,
      nextTick,
      mountActiveVideo
    });
  }
);

watch(
  () => quality.value,
  value => {
    syncViewerQuality({
      viewerAdapter,
      value
    });
  }
);

watch(
  () => isPlaneRendering.value,
  value => {
    hideCanvasContextToolbar();
    if (value) {
      runtimeStore.setShowObjectPanel(false);
      viewerAdapter.clearSelection();
      void refreshPlaneSnapshot({ force: true });
      return;
    }
    planeSnapshotRequestId += 1;
    planeSnapshotLoading.value = false;
    viewerAdapter.setRenderPaused(false);
  },
  { immediate: true }
);

watch(
  () => planeSnapshotSignature.value,
  () => {
    if (!isPlaneRendering.value) return;
    planeSnapshot.value = null;
    void refreshPlaneSnapshot({ force: true });
  }
);

watch(
  () => navigationSnapshotSignature.value,
  () => {
    navigationSnapshot.value = null;
    void refreshNavigationSnapshot({ force: true });
  }
);

watch(
  () => sceneDevices.value.map(item => item.uuid).join("|"),
  () => {
    if (!viewerAdapter.isReady()) return;
    rebuildNavigationObjectPositionMap();
    if (!navigationSnapshot.value) {
      void refreshNavigationSnapshot({ force: true });
    }
  }
);

watch(
  () => materialTheme.value,
  value => {
    syncViewerMaterialTheme({
      viewerAdapter,
      value
    });
  }
);

watch(
  () => [
    sceneDeviceStatusColorSignature.value,
    quality.value,
    materialTheme.value,
    modelUrl.value,
    isPlaneRendering.value
  ],
  async () => {
    await nextTick();
    if (isPlaneRendering.value) {
      viewerAdapter.clearObjectStatusColors?.();
      return;
    }
    syncSceneDeviceStatusColors();
  },
  { immediate: true }
);

watch(
  () => [renderableAnchors.value, anchorMarkersVisible.value],
  () => {
    syncSceneAnchorsOnWatcher({
      syncSceneAnchors
    });
  },
  { deep: true }
);

watch(
  () => [renderableCameraAnchors.value, cameraMarkersVisible.value],
  () => {
    syncSceneAnchorsOnWatcher({
      syncSceneAnchors
    });
  },
  { deep: true }
);

watch(
  () => [renderableAnchors.value, renderableCameraAnchors.value],
  () => {
    if (isPlaneRendering.value) rebuildPlaneObjectPositionMap();
  },
  { deep: true }
);

watch(
  () => sceneManifest.value?.groups,
  value => {
    syncAssetGroupsFromManifest({
      groups: value,
      viewerAdapter,
      applyAssetGroupVisibility,
      setAssetGroups: nextGroups => {
        assetGroups.value = nextGroups;
      }
    });
  },
  { deep: true, immediate: true }
);

watch(
  () => scriptDefinitions.value,
  () => {
    syncRuntimeServicesIfReady({
      viewerAdapter,
      syncRuntimeServices
    });
  },
  { deep: true }
);

watch(
  () => integrationConfigs.value,
  () => {
    syncRuntimeServicesIfReady({
      viewerAdapter,
      syncRuntimeServices
    });
  },
  { deep: true }
);

watch(
  () => [
    clippingAnimationSpeed.value,
    clippingAnimationMode.value,
    clippingAnimationAxis.value
  ],
  ([speed, mode, axis]) => {
    syncViewerClippingAnimationOptions({
      viewerAdapter,
      speed,
      mode,
      axis
    });
  }
);

onBeforeUnmount(() => {
  stopClippingAnimation({ persist: false });
  stopRuntimeServices();
  runtimeEventBus.clear();
  cleanupCanvasContextToolbarDismiss();
  viewerAdapter.unbindViewer();
  videoAdapter.destroy();
  if (onFullscreenKeydown) {
    window.removeEventListener("keydown", onFullscreenKeydown);
    onFullscreenKeydown = null;
  }
  if (clippingPersistTimer) {
    clearTimeout(clippingPersistTimer);
    clippingPersistTimer = null;
  }
});
</script>

<template>
  <div class="dd-fullscreen">
    <ViewerTopbar
      :model-name="modelName"
      :project-name="handoverProjectName"
      :quality="quality"
      :show-side-panel="showSidePanel"
      :show-stats="showStats"
      :save-loading="savingProject"
      @back="goBack"
      @open-settings="openSettingsDialog"
      @save-project="saveCurrentProject"
      @update:quality="quality = $event"
      @quality-change="onQualityChange"
      @update:show-side-panel="showSidePanel = $event"
      @update:show-stats="showStats = $event"
    />

    <div class="dd-canvas">
      <div class="relative h-full w-full">
        <Viewer3DWorkspace
          :viewer-model-url="viewerModelUrl"
          :model-name="modelName"
          :viewer-scene-models="viewerSceneModels"
          :transparent="transparent"
          :quality="isPlaneRendering ? 'low' : quality"
          :interaction-mode="isPlaneRendering ? 'pan' : interactionMode"
          :ifc-wasm-path="ifcWasmPath"
          :show-stats="showStats && !isPlaneRendering"
          :enable-clipping="enableClipping && !isPlaneRendering"
          :tool-options="toolOptions"
          :active-tool="activeTool"
          :roaming-enabled="roamingEnabled"
          :preset-views="presetViews"
          :bookmarks="bookmarks"
          :measurement-mode="measurementMode"
          :measurement-mode-options="measurementModeOptions"
          :projection-mode="projectionMode"
          :material-theme="materialTheme"
          :display-mode="displayMode"
          :selected-count="selectedCount"
          :show-side-panel="showSidePanel"
          :runtime-clipping-state="runtimeClippingState"
          :clipping-summary-text="clippingSummaryText"
          :clipping-stats="clippingStats"
          :clipping-target-options="clippingTargetOptions"
          :selected-object-info="selectedObjectInfo"
          :clipping-animation-playing="clippingAnimationPlaying"
          :clipping-animation-speed="clippingAnimationSpeed"
          :clipping-animation-mode="clippingAnimationMode"
          :clipping-animation-mode-options="clippingAnimationModeOptions"
          :clipping-animation-axis="clippingAnimationAxis"
          :clipping-animation-axis-options="clippingAnimationAxisOptions"
          :clipping-mode-options="clippingModeOptions"
          :clipping-axis-options="clippingAxisOptions"
          :clipping-direction-options="clippingDirectionOptions"
          :show-object-panel="showObjectPanel"
          :selected-scene-device="selectedSceneDevice"
          :selected-device-profile="selectedDeviceProfile"
          :selected-kks-detail="selectedKksDetail"
          :selected-kks-detail-loading="selectedKksDetailLoading"
          :selected-kks-detail-error="selectedKksDetailError"
          :current-measurement-points="currentMeasurementPoints"
          :point-markers-visible="pointMarkersVisible"
          @viewer-ref-change="handleViewerRefChange"
          @loaded="handleViewerLoaded"
          @initial-fps-sample="handleInitialFpsSample"
          @object-select="onObjectSelect"
          @measure-change="handleMeasurementChange"
          @measure-complete="handleMeasurementChange"
          @scene-anchor-click="handleSceneAnchorClick"
          @canvas-contextmenu="handleCanvasContextMenu"
          @clipping-change="handleViewerClippingChange"
          @update:active-tool="activeTool = $event"
          @update:measurement-mode="setMeasurementMode"
          @tool-change="
            value => runWhenNotPlane('三维工具切换', () => onToolChange(value))
          "
          @zoom-in="runWhenNotPlane('三维缩放', zoomIn)"
          @zoom-out="runWhenNotPlane('三维缩放', zoomOut)"
          @reset-view="runWhenNotPlane('三维视角重置', resetView)"
          @toggle-roaming="runWhenNotPlane('漫游', toggleRoaming)"
          @toggle-transparent="runWhenNotPlane('模型透明化', toggleTransparent)"
          @toggle-projection="runWhenNotPlane('三维投影切换', toggleProjection)"
          @toggle-clipping="toggleClipping"
          @take-screenshot="runWhenNotPlane('三维截图', takeScreenshot)"
          @save-bookmark="runWhenNotPlane('三维视角书签', saveBookmark)"
          @apply-bookmark="
            value => runWhenNotPlane('三维视角书签', () => applyBookmark(value))
          "
          @clear-measurements="clearMeasurements"
          @export-measurements="exportMeasurements"
          @set-preset-view="
            value => runWhenNotPlane('三维视角切换', () => setPresetView(value))
          "
          @set-material-theme="setMaterialTheme"
          @apply-display-action="applyDisplayAction"
          @update:clipping-state="onClippingStateChange"
          @toggle-animation="toggleClippingAnimation"
          @update:animation-speed="clippingAnimationSpeed = $event"
          @update:animation-mode="clippingAnimationMode = $event"
          @update:animation-axis="clippingAnimationAxis = $event"
          @reset-clipping="resetClipping"
          @close-object-panel="closeObjectPanel"
          @update:point-markers-visible="pointMarkersVisible = $event"
          @document-detail="openBoundDocumentDetail"
          @document-preview="openBoundDocumentPreview"
          @document-download="downloadBoundDocument"
        />

        <ViewerPlaneWorkspace
          v-if="isPlaneRendering"
          :snapshot="planeSnapshot"
          :loading="planeSnapshotLoading"
          :anchors="renderableAnchors"
          :camera-anchors="renderableCameraAnchors"
          :anchor-markers-visible="anchorMarkersVisible"
          :camera-markers-visible="cameraMarkersVisible"
          :selected-anchor-id="selectedAnchorId"
          :selected-camera-id="selectedCameraId"
          :object-position-map="planeObjectPositionMap"
          @canvas-contextmenu="handleCanvasContextMenu"
          @scene-anchor-click="handleSceneAnchorClick"
          @refresh-snapshot="refreshPlaneSnapshot({ force: true })"
        />

        <Viewer2DWorkspace
          :show-side-panel="showSidePanel"
          :active-side-tab="activeSideTab"
          :scene-tree="sceneTree"
          :tree-v2-props="treeV2Props"
          :tree-default-expanded-keys="treeDefaultExpandedKeys"
          :tree-filter-text="treeFilterText"
          :structure-model-type-filter="structureModelTypeFilter"
          :structure-model-type-options="structureModelTypeOptions"
          :structure-filter-method="structureFilterMethod"
          :selected-tree-node="selectedTreeNode"
          :structure-binding-map="structureBindingMap"
          :mesh-opacity="meshOpacity"
          :navigation-tree-data="navigationTreeData"
          :current-nav-node-key="currentNavNodeKey"
          :selected-system-node-id="selectedSystemNodeId"
          :selected-quick-kks="selectedQuickKks"
          :scene-device-system-options="sceneDeviceSystemOptions"
          :scene-device-kks-options="sceneDeviceKksOptions"
          :navigation-snapshot="navigationSnapshot"
          :navigation-snapshot-loading="navigationSnapshotLoading"
          :navigation-map-items="navigationMapItems"
          :navigation-map-active-id="navigationMapActiveId"
          :navigation-map-disabled="isPlaneRendering"
          :layer-tree-data="layerTreeData"
          :layer-checked-keys="layerCheckedKeys"
          :display-mode="displayMode"
          :display-mode-text="displayModeText"
          :scheme-name="schemeName"
          :scene-schemes="sceneSchemes"
          :filtered-scene-devices="filteredSceneDevices"
          :device-keyword="deviceKeyword"
          :selected-device-uuid="selectedDeviceUuid"
          :anchors="anchors"
          :selected-anchor-id="selectedAnchorId"
          :anchor-markers-visible="anchorMarkersVisible"
          :camera-anchors="cameraAnchors"
          :selected-camera-id="selectedCameraId"
          :camera-markers-visible="cameraMarkersVisible"
          :measurement-records="measurementRecords"
          :measurement-mode="measurementMode"
          :measurement-mode-options="measurementModeOptions"
          :scene-models="sceneModels"
          :active-scene-model-id="activeSceneModelId"
          :runtime-asset-groups="runtimeAssetGroups"
          :project-package="currentProjectPackage"
          :selectable-model-options="selectableModelOptions"
          :loading-model-options="loadingModelOptions"
          :quality="quality"
          :quality-mode-options="qualityModeOptions"
          :material-theme="materialTheme"
          :lod-levels="sceneManifest.lodLevels || []"
          :selected-lod-id="selectedLodId"
          :realtime-state="realtimeState"
          :script-state="scriptState"
          :backend-state="backendState"
          :clipping-stats="clippingStats"
          :runtime-logs="runtimeLogs"
          :format-scheme-time="formatSchemeTime"
          @structure-tree-ref-change="handleStructureTreeRefChange"
          @layer-tree-ref-change="handleLayerTreeRefChange"
          @update:active-side-tab="activeSideTab = $event"
          @refresh-tree="refreshSceneTree"
          @update:tree-filter-text="handleStructureFilterUpdate"
          @update:structure-model-type-filter="
            handleStructureModelTypeFilterUpdate
          "
          @tree-node-click="handleStructureNodeClick"
          @tree-node-expand="handleTreeNodeExpand"
          @tree-node-collapse="handleTreeNodeCollapse"
          @focus-selected-node="focusSelectedNode"
          @make-selected-mesh-transparent="makeSelectedMeshTransparent"
          @restore-selected-mesh-opacity="restoreSelectedMeshOpacity"
          @isolate-selected-node="isolateSelectedNode"
          @show-all-objects="showAllObjects"
          @hide-selected-node="hideSelectedTreeNode"
          @restore-hidden-objects="restoreHiddenTreeNodes"
          @update:mesh-opacity="handleMeshOpacityUpdate"
          @navigation-node-click="handleNavigationNodeClick"
          @navigation-node-contextmenu="handleNavTreeContextMenu"
          @update:selected-system-node-id="selectedSystemNodeId = $event"
          @update:selected-quick-kks="selectedQuickKks = $event"
          @navigation-map-select="handleNavigationMapSelect"
          @refresh-navigation-map="refreshNavigationSnapshot({ force: true })"
          @locate-system="locateSystem()"
          @locate-by-kks="locateByKks()"
          @apply-display-mode="applyDisplayMode"
          @layer-tree-check="handleLayerTreeCheck"
          @update:scheme-name="schemeName = $event"
          @save-scheme="saveSceneScheme"
          @apply-scheme="applySceneScheme"
          @remove-scheme="removeSceneScheme"
          @update:device-keyword="deviceKeyword = $event"
          @locate-device="locateDevice"
          @isolate-device="isolateDevice"
          @update:anchor-markers-visible="anchorMarkersVisible = $event"
          @add-anchor="openCreateAnchorDialog('anchor')"
          @select-anchor="selectSceneAnchor($event, 'anchor')"
          @edit-anchor="selectAndEditSceneAnchor($event, 'anchor')"
          @remove-anchor="removeSceneAnchor($event, 'anchor')"
          @update:camera-markers-visible="cameraMarkersVisible = $event"
          @add-camera="openCreateAnchorDialog('camera')"
          @select-camera="openCameraVideo"
          @edit-camera="selectAndEditSceneAnchor($event, 'camera')"
          @remove-camera="removeSceneAnchor($event, 'camera')"
          @update:measurement-mode="setMeasurementMode"
          @focus-record="focusMeasurementRecord"
          @toggle-record-visible="toggleMeasurementRecordVisible"
          @remove-record="removeMeasurementRecord"
          @clear-records="clearMeasurements"
          @export-records="exportMeasurements"
          @add-model="openModelPicker"
          @select-model="selectSceneModelFromPanel"
          @locate-model="locateSceneModel"
          @remove-model="removeSceneModel"
          @refresh-model-options="refreshModelOptionsFromPanel"
          @toggle-group="toggleAssetGroupVisibility"
          @update:quality="onQualityChange"
          @update:material-theme="setMaterialTheme"
          @apply-lod="applyLodLevel"
          @clear-lod="clearLodOverride"
          @restart-realtime="restartRealtime"
          @run-manual-trigger="runManualScriptTrigger"
          @send-backend-command="sendBackendCommand"
          @clear-logs="clearRuntimeLogs"
        />

        <!-- 画布右键工具栏 -->
        <div
          v-show="canvasContextToolbarVisible"
          class="dd-canvas-context-toolbar"
          :style="canvasContextToolbarStyle"
          @click.stop
          @contextmenu.prevent.stop
        >
          <el-tooltip content="选择当前物体" placement="top">
            <button
              type="button"
              class="dd-canvas-context-action"
              :disabled="!canvasContextToolbarHasObject"
              @click.stop="selectCanvasContextObject"
            >
              <el-icon><Pointer /></el-icon>
              <span>选择当前物体</span>
            </button>
          </el-tooltip>
          <el-tooltip content="添加点位" placement="top">
            <button
              type="button"
              class="dd-canvas-context-action"
              @click.stop="openCanvasContextCreateAnchor('anchor')"
            >
              <el-icon><Position /></el-icon>
              <span>添加点位</span>
            </button>
          </el-tooltip>
          <el-tooltip content="添加摄像头" placement="top">
            <button
              type="button"
              class="dd-canvas-context-action"
              @click.stop="openCanvasContextCreateAnchor('camera')"
            >
              <el-icon><Camera /></el-icon>
              <span>添加摄像头</span>
            </button>
          </el-tooltip>
        </div>

        <SceneSettingsDialog
          v-model="settingsDialogVisible"
          :anchor-style="getAnchorStyleDefault('anchor')"
          :camera-style="getAnchorStyleDefault('camera')"
          @save-style="handleSavePublicStyle"
          @export-data="handleExportSceneAnchorData"
          @import-data="handleImportSceneAnchorData"
        />

        <ModelPickerDialog
          v-model="modelPickerVisible"
          :model-picker-selection="modelPickerSelection"
          :selectable-model-options="selectableModelOptions"
          :loading-model-options="loadingModelOptions"
          @update:model-picker-selection="modelPickerSelection = $event"
          @confirm="confirmAddModels"
        />

        <!-- 导航树右键菜单 -->
        <div
          v-show="ctxMenuVisible"
          class="dd-nav-ctx-menu"
          :style="ctxMenuStyle"
          @contextmenu.prevent.stop
        >
          <template v-if="ctxMenuIsDevice">
            <div class="dd-nav-ctx-item" @click.stop="onCtxViewObjectInfo">
              查看构件属性
            </div>
            <div class="dd-nav-ctx-item" @click.stop="onCtxBindProp">
              {{ ctxMenuNode?.raw?.kks ? "更换绑定" : "绑定业务数据" }}
            </div>
            <div class="dd-nav-ctx-item" @click.stop="onCtxBindObjectDocuments">
              绑定文件
            </div>
            <div class="dd-nav-ctx-item" @click.stop="onCtxViewObjectDocuments">
              查看绑定文件
            </div>
            <div
              class="dd-nav-ctx-item dd-nav-ctx-danger"
              @click.stop="onCtxClearProp"
            >
              解除绑定
            </div>
          </template>
          <template v-else>
            <div class="dd-nav-ctx-item" @click.stop="onCtxBindDocuments">
              绑定文件
            </div>
            <div class="dd-nav-ctx-item" @click.stop="onCtxViewDocuments">
              查看绑定文件
            </div>
          </template>
        </div>

        <DocumentBindingDialog
          v-model="documentDialogVisible"
          :title="documentDialogTitle"
          :current-label="documentDialogCurrentLabel"
          :target-label="documentDialogTargetLabel"
          :current-bound-count="currentDocumentBoundCount"
          :mode="documentDialogMode"
          :keyword="documentDialogKeyword"
          :loading="documentDialogLoading"
          :folder-loading="documentDialogFolderLoading"
          :folder-tree-data="documentDialogFolderTreeData"
          :selected-folder-id="documentDialogFolderId"
          :records="documentDialogRecords"
          :pagination="documentDialogPagination"
          :selected-documents="documentDialogSelectedDocuments"
          :empty-text="documentDialogEmptyText"
          @update:keyword="documentDialogKeyword = $event"
          @search="searchDocumentOptions(documentDialogKeyword)"
          @folder-change="onDocumentFolderChange"
          @selection-change="handleDocumentSelectionChange"
          @table-ref-change="documentDialogTableRef = $event"
          @size-change="onDocumentSizeChange"
          @page-change="onDocumentPageChange"
          @document-detail="openBoundDocumentDetail"
          @document-preview="openBoundDocumentPreview"
          @document-download="downloadBoundDocument"
          @confirm="confirmDocumentDialog"
        />

        <FilePreview
          v-model:visible="boundDocumentPreviewVisible"
          :row="boundDocumentPreviewRow"
          @download="downloadBoundDocument"
        />

        <el-drawer
          v-model="boundDocumentDetailVisible"
          title="文档详情"
          size="560px"
        >
          <div v-loading="boundDocumentDetailLoading" class="grid gap-4">
            <template v-if="boundDocumentDetailRow">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-base font-semibold truncate">
                    {{ boundDocumentDetailRow.name }}
                  </div>
                  <div
                    class="text-sm text-[var(--el-text-color-secondary)] mt-1"
                  >
                    类型：{{ boundDocumentDetailRow.type || "-" }} | 大小：{{
                      formatDocumentSize(boundDocumentDetailRow.size)
                    }}
                  </div>
                </div>
                <el-space wrap>
                  <el-button
                    type="primary"
                    @click="openBoundDocumentPreview(boundDocumentDetailRow)"
                  >
                    预览
                  </el-button>
                  <el-button
                    @click="downloadBoundDocument(boundDocumentDetailRow)"
                  >
                    下载
                  </el-button>
                </el-space>
              </div>

              <el-descriptions :column="1" border size="small">
                <el-descriptions-item label="文档ID">
                  {{ boundDocumentDetailRow.id || "-" }}
                </el-descriptions-item>
                <el-descriptions-item label="所属目录">
                  {{ boundDocumentDetailRow.folderId || "root" }}
                </el-descriptions-item>
                <el-descriptions-item label="创建时间">
                  {{ boundDocumentDetailRow.createdAt || "-" }}
                </el-descriptions-item>
                <el-descriptions-item label="创建人">
                  {{ boundDocumentDetailRow.createdBy || "-" }}
                </el-descriptions-item>
                <el-descriptions-item label="更新时间">
                  {{ boundDocumentDetailRow.updatedAt || "-" }}
                </el-descriptions-item>
                <el-descriptions-item label="更新人">
                  {{ boundDocumentDetailRow.updatedBy || "-" }}
                </el-descriptions-item>
              </el-descriptions>

              <div>
                <div class="mb-2 font-semibold">关联系统</div>
                <div class="flex flex-wrap gap-2">
                  <el-tag
                    v-for="nodeId in boundDocumentDetailRow.nodeIds || []"
                    :key="nodeId"
                    effect="plain"
                  >
                    {{ getSystemNodeLabel(nodeId) }}
                  </el-tag>
                  <span
                    v-if="!(boundDocumentDetailRow.nodeIds || []).length"
                    class="text-sm text-[var(--el-text-color-secondary)]"
                  >
                    暂无
                  </span>
                </div>
              </div>

              <div>
                <div class="mb-2 font-semibold">对象编码</div>
                <div class="flex flex-wrap gap-2">
                  <el-tag
                    v-for="kks in boundDocumentDetailRow.kksRefs || []"
                    :key="kks"
                    effect="plain"
                  >
                    {{ kks }}
                  </el-tag>
                  <span
                    v-if="!(boundDocumentDetailRow.kksRefs || []).length"
                    class="text-sm text-[var(--el-text-color-secondary)]"
                  >
                    暂无
                  </span>
                </div>
              </div>
            </template>
            <el-empty v-else description="暂无文档详情" />
          </div>
        </el-drawer>

        <PropertyBindingDialog
          v-model="propDialogVisible"
          :title="propDialogTitle"
          :keyword="propertyBindingKeyword"
          :current-target-name="currentPropertyTargetName"
          :current-kks="propEditForm.kks || '-'"
          :loading="propertyBindingLoading"
          :records="propertyBindingRecords"
          :pagination="propertyBindingPagination"
          :selected-kks="selectedPropertyBindingKks"
          @update:keyword="propertyBindingKeyword = $event"
          @search="searchPropertyBindingRecords(propertyBindingKeyword)"
          @row-click="handlePropertyBindingRowClick"
          @size-change="onPropertyBindingSizeChange"
          @page-change="onPropertyBindingPageChange"
          @confirm="confirmPropDialog"
        />

        <AnchorEditorDialog
          v-model:visible="anchorDialogVisible"
          v-model:form="anchorForm"
          :minimized="anchorDialogMinimized"
          :title="anchorDialogTitle"
          :kind="anchorDialogKind"
          :scene-object-options="sceneObjectOptions"
          :device-kks-options="deviceKksOptions"
          :anchor-measurement-options="anchorMeasurementOptions"
          :camera-type-options="cameraTypeOptions"
          :scene-anchor-type-options="sceneAnchorTypeOptions"
          :camera-stream-type-options="cameraStreamTypeOptions"
          :camera-window-mode-options="cameraWindowModeOptions"
          :anchor-binding-type-options="anchorBindingTypeOptions"
          :anchor-icon-options="anchorIconOptions"
          :camera-icon-options="cameraIconOptions"
          :position-picking-active="positionPickingState.active"
          :picked-position-text="pickedPositionText"
          @closed="handleAnchorDialogClosed"
          @start-position-picking="startPositionPicking"
          @submit="submitAnchorDialog"
          @confirm-picked-position="confirmPickedPosition"
          @cancel-position-picking="cancelPositionPicking"
        />

        <AnchorDetailDialog
          v-model="anchorDetailVisible"
          :anchor-detail="activeAnchorDetail"
          :summarize-anchor-binding="summarizeAnchorBinding"
        />

        <CameraVideoDialog
          v-model="videoDialogVisible"
          :active-camera-detail="activeCameraDetail"
          :video-loading="videoLoading"
          :video-preview-supported="videoPreviewSupported"
          :video-error-text="videoErrorText"
          @closed="runtimeStore.closeVideoDialog()"
          @video-ref-change="handleVideoElementRefChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dd-fullscreen {
  --dd-gap: 16px;
  --dd-topbar-height: 52px;
  --dd-panels-top: 68px;
  --dd-bottom-reserve: 92px;
  --dd-panel-width: 430px;

  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at 38% 30%, rgb(37 99 235 / 8%), transparent 34%),
    linear-gradient(135deg, #f9fbff 0%, #eef4fb 52%, #f8fbff 100%);
}

.dd-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 18px;
  background: rgb(255 255 255 / 86%);
  border-bottom: 1px solid rgb(226 232 240 / 88%);
  box-shadow: 0 8px 28px rgb(15 23 42 / 7%);
  backdrop-filter: blur(18px) saturate(160%);
}

.dd-canvas {
  flex: 1;
  overflow: hidden;
  background:
    linear-gradient(90deg, rgb(15 23 42 / 3%) 1px, transparent 1px),
    linear-gradient(rgb(15 23 42 / 3%) 1px, transparent 1px);
  background-size: 48px 48px;
}

.dd-canvas-context-toolbar {
  position: fixed;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: stretch;
  width: 160px;
  max-width: calc(100vw - 16px);
  padding: 6px;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  box-shadow: var(--el-box-shadow-light);
}

.dd-canvas-context-action {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  font-size: 13px;
  line-height: 1;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 4px;
}

.dd-canvas-context-action:hover:not(:disabled) {
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
}

.dd-canvas-context-action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.dd-nav-ctx-menu {
  position: fixed;
  z-index: 9999;
  min-width: 120px;
  padding: 4px 0;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  box-shadow: var(--el-box-shadow-light);
}

.dd-nav-ctx-item {
  padding: 6px 16px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  cursor: pointer;
}

.dd-nav-ctx-item:hover {
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
}

.dd-nav-ctx-danger:hover {
  color: var(--el-color-danger);
}
</style>
