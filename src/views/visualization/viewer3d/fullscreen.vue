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
import { message } from "@/utils/message";
import { getConfig } from "@/config";
import { getHandoverKksList } from "@/api/handoverData";
import {
  getHandoverDocumentDetail,
  getHandoverDocumentList
} from "@/api/handoverDocuments";
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
  createDefaultDocumentBindingPagination,
  fetchBoundDocumentsByRelation,
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
  removeItem,
  summarizeAnchorBinding,
  upsertItem
} from "./services/sceneAnchorService";
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
import Viewer2DWorkspace from "./components/fullscreen/Viewer2DWorkspace.vue";
import SceneSettingsDialog from "./components/fullscreen/dialogs/SceneSettingsDialog.vue";
import ModelPickerDialog from "./components/fullscreen/dialogs/ModelPickerDialog.vue";
import NavigationNodeDialog from "./components/fullscreen/dialogs/NavigationNodeDialog.vue";
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
      materialTheme.value = theme;
      viewerAdapter.setMaterialTheme(theme);
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
const modelPickerNodeId = ref("");
const loadingModelOptions = ref(false);
const activeSceneModelId = ref("");
const sceneModels = ref([]);
const systemNodeTree = ref([]);
const savedObjectBindings = ref([]);
const navNodeDialogVisible = ref(false);
const navNodeDialogMode = ref("create");
const navNodeDialogParentId = ref("");
const navNodeDialogTargetId = ref("");
const navNodeForm = ref({
  label: ""
});
const documentDialogVisible = ref(false);
const documentDialogScope = ref("node");
const documentDialogMode = ref("bind");
const documentDialogLoading = ref(false);
const documentDialogKeyword = ref("");
const documentDialogRecords = ref([]);
const documentDialogPagination = ref(createDefaultDocumentBindingPagination());
const documentDialogTargetId = ref("");
const documentDialogTargetLabel = ref("");
const documentDialogSelectedDocuments = ref([]);
const documentDialogTableRef = ref(null);
const documentDialogSourceId = ref("");

const activeModelDetail = ref(null);

const modelId = computed(() => {
  return activeSceneModelId.value || routeModelId.value;
});

const modelUrl = computed(() => {
  return String(
    activeSceneModel.value?.modelUrl || activeModelDetail.value?.url || ""
  ).trim();
});

const modelName = computed(() => {
  return String(
    activeSceneModel.value?.modelName || activeModelDetail.value?.name || ""
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

const MODEL_OBJECT_SOURCE_KIND = "model_object";
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

function normalizeSavedObjectBinding(item) {
  const objectUuid = String(item?.objectUuid || item?.uuid || "").trim();
  const objectName = String(item?.objectName || item?.name || "").trim();
  const path = String(item?.path || "").trim();
  if (!objectUuid && !objectName && !path) return null;
  const businessBinding = item?.businessBinding || {};
  const documentBindings = Array.isArray(item?.documentBindings)
    ? item.documentBindings
    : Array.isArray(item?.documents)
      ? item.documents
      : [];
  return {
    instanceId: String(item?.instanceId || "").trim(),
    sourceId:
      String(item?.sourceId || "").trim() ||
      buildModelObjectSourceId({
        instanceId: item?.instanceId,
        objectUuid
      }),
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

const systemNodeSelectOptions = computed(() => {
  return flatSystemNodes.value.map(node => ({
    label: `${"\u3000".repeat(node.depth)}${node.label}`,
    value: node.id
  }));
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

function getSceneDeviceSourceId(item) {
  return buildModelObjectSourceId({
    instanceId: item?.instanceId,
    objectUuid: item?.objectUuid || item?.uuid
  });
}

function getSceneDeviceBySourceId(sourceId) {
  const key = String(sourceId || "").trim();
  if (!key) return null;
  return (
    sceneDevices.value.find(item => getSceneDeviceSourceId(item) === key) ||
    null
  );
}

function applySceneDeviceBindingPatch(sourceId, patch = {}) {
  const target = getSceneDeviceBySourceId(sourceId);
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
  const sourceIds = sceneDevices.value
    .map(item => getSceneDeviceSourceId(item))
    .filter(Boolean);
  if (!sourceIds.length) return;

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
    const matched = records.filter(item =>
      sourceIdSet.has(String(item?.sourceId || "").trim())
    );

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
      const sourceId = String(item?.sourceId || "").trim();
      if (!sourceId) return;
      const current = relationMap.get(sourceId) || {
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

      relationMap.set(sourceId, current);
    });

    sceneDevices.value.forEach(item => {
      const sourceId = getSceneDeviceSourceId(item);
      const backendBinding = relationMap.get(sourceId);
      item.sourceId = sourceId;
      item.kks = backendBinding?.kks || item.kks || "";
      item.nodeId =
        backendBinding?.nodeId ||
        item.nodeId ||
        buildNodeIdByKks(item.kks || "") ||
        "";
      item.kksRelationId = backendBinding?.kksRelationId || "";
      item.documentRelationIds = backendBinding?.documentRelationIds || [];
      item.boundDocuments = normalizeNodeBoundDocuments(
        backendBinding?.boundDocuments || item.boundDocuments || []
      );
    });

    syncSavedObjectBindingsFromSceneDevices();
  } catch (error) {
    console.error("sync scene object relations failed", error);
  }
}

function createNavigationNode(label, parentId = "") {
  return {
    id: `nav-node-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    parentId: String(parentId || "").trim(),
    label: String(label || "").trim(),
    children: []
  };
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

function openCreateNavigationNodeDialog(parentId = "") {
  navNodeDialogMode.value = "create";
  navNodeDialogParentId.value = String(parentId || "").trim();
  navNodeDialogTargetId.value = "";
  navNodeForm.value = {
    label: ""
  };
  ctxMenuVisible.value = false;
  navNodeDialogVisible.value = true;
}

function openEditNavigationNodeDialog(node) {
  const targetId = String(node?.nodeId || node?.id || "").trim();
  if (!targetId) return;
  navNodeDialogMode.value = "edit";
  navNodeDialogParentId.value = String(node?.parentId || "").trim();
  navNodeDialogTargetId.value = targetId;
  navNodeForm.value = {
    label: String(node?.label || "").trim()
  };
  ctxMenuVisible.value = false;
  navNodeDialogVisible.value = true;
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

function appendNavigationChild(nodes = [], parentId, childNode) {
  if (!parentId) return [...nodes, childNode];
  return nodes.map(node => {
    if (node.id === parentId) {
      return {
        ...node,
        children: [...(node.children || []), childNode]
      };
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      return {
        ...node,
        children: appendNavigationChild(node.children, parentId, childNode)
      };
    }
    return node;
  });
}

function removeNavigationNode(nodes = [], targetId) {
  return nodes
    .filter(node => node.id !== targetId)
    .map(node => ({
      ...node,
      children: removeNavigationNode(node.children || [], targetId)
    }));
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

function confirmNavigationNodeDialog() {
  const label = String(navNodeForm.value.label || "").trim();
  if (!label) {
    message("请输入导航节点名称", { type: "warning" });
    return;
  }
  if (navNodeDialogMode.value === "create") {
    systemNodeTree.value = appendNavigationChild(
      systemNodeTree.value,
      navNodeDialogParentId.value,
      createNavigationNode(label, navNodeDialogParentId.value)
    );
  } else if (navNodeDialogTargetId.value) {
    systemNodeTree.value = upsertNavigationNode(
      systemNodeTree.value,
      navNodeDialogTargetId.value,
      node => ({
        ...node,
        label
      })
    );
  }
  persistNavigationTree();
  navNodeDialogVisible.value = false;
}

function removeNavigationNodeById(nodeId) {
  const targetId = String(nodeId || "").trim();
  if (!targetId) return;
  if (!window.confirm("确认删除当前导航节点？")) return;
  const hasMountedModels = sceneModels.value.some(
    item => String(item.systemNodeId || "").trim() === targetId
  );
  const hasDevices = sceneDevices.value.some(
    item => String(item.nodeId || "").trim() === targetId
  );
  if (hasMountedModels || hasDevices) {
    message("该导航节点下仍有关联模型或构件，暂不能删除", {
      type: "warning"
    });
    return;
  }
  systemNodeTree.value = removeNavigationNode(systemNodeTree.value, targetId);
  persistNavigationTree();
  ctxMenuVisible.value = false;
  if (currentNavNodeKey.value.endsWith(`:${targetId}`)) {
    currentNavNodeKey.value = "";
  }
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
    const detail = normalizeViewerModelItem(response?.data ?? response ?? {});
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

const loadedModelOptions = computed(() =>
  sceneModels.value.map(item => ({
    label: item.modelName,
    value: item.modelId
  }))
);

const selectableModelOptions = computed(() => {
  const loadedIds = new Set(sceneModels.value.map(item => item.modelId));
  return availableModels.value
    .filter(item => !loadedIds.has(item.id))
    .map(item => ({
      label: item.name,
      value: item.id
    }));
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
  modelPickerSelection.value = [];
  modelPickerNodeId.value = selectedSystemNodeId.value || "";
  modelPickerVisible.value = true;
}

async function confirmAddModels() {
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
  const selectedNodeLabel = getSystemNodeLabel(modelPickerNodeId.value);
  details.forEach(detail => {
    sceneModels.value.push(
      createFullscreenSceneModel(detail, {
        systemNodeId: modelPickerNodeId.value || "",
        systemNodeLabel: selectedNodeLabel
      })
    );
  });

  if (!activeSceneModelId.value && sceneModels.value.length > 0) {
    activeSceneModelId.value = sceneModels.value[0].modelId;
  }
  syncActiveModelDetail();
  modelPickerVisible.value = false;
  message(`已添加 ${details.length} 个模型`, { type: "success" });
}

function removeSceneModel(item) {
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

const sceneManifest = computed(
  () => projectStore.projectPackage?.assets?.sceneManifest || {}
);
const assetGroups = ref([]);
const selectedLodId = ref("");
const qualityModeOptions = [
  { label: "高", value: "high" },
  { label: "中", value: "medium" },
  { label: "低", value: "low" }
];

const viewerModelUrl = computed(() => {
  const activeLod = (sceneManifest.value?.lodLevels || []).find(
    item => item.id === selectedLodId.value
  );
  const qualityProfiles = sceneManifest.value?.qualityProfiles || {};
  const qualityMappedUrl = qualityProfiles[quality.value];
  return (
    String(activeLod?.modelUrl || "").trim() ||
    String(qualityMappedUrl || "").trim() ||
    String(sceneManifest.value?.defaultModelUrl || "").trim() ||
    modelUrl.value
  );
});

const runtimeAssetGroups = computed(() =>
  (assetGroups.value || []).map(item => ({
    ...item,
    uuidCount: Array.isArray(item.uuids) ? item.uuids.length : 0
  }))
);

const viewerRef = ref(null);
function handleViewerRefChange(value) {
  viewerRef.value = value;
}

function handleLayerTreeRefChange(value) {
  layerTreeRef.value = value;
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

function getAnchorStyleDefault(kind = "anchor") {
  const type = kind === "camera" ? "camera-point" : "measurement-point";
  return normalizeAnchorStyle(anchorStyleDefaults.value?.[kind] || {}, type);
}

function buildStyledAnchorForm(
  kind = "anchor",
  payload = {},
  selectedObject = null
) {
  const defaultStyle = getAnchorStyleDefault(kind);
  const form =
    kind === "camera"
      ? payload && Object.keys(payload).length
        ? normalizeCameraForm(payload)
        : createEmptyCameraForm(selectedObject)
      : payload && Object.keys(payload).length
        ? normalizeAnchorForm(payload)
        : createEmptyAnchorForm(selectedObject);

  form.style = normalizeAnchorStyle(
    defaultStyle,
    kind === "camera" ? "camera-point" : form.type || "measurement-point"
  );
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
    style: normalizeAnchorStyle(
      getAnchorStyleDefault("anchor"),
      item.type || "measurement-point"
    )
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
    style: normalizeAnchorStyle(getAnchorStyleDefault("camera"), "camera-point")
  }));
});

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
  const buildNodes = (nodes = [], level = 0) => {
    return nodes
      .map(node => {
        const childNodes = buildNodes(node.children || [], level + 1);
        const devices = getDevicesBySystem(node.id).map(device => ({
          id: `nav-device:${device.uuid}`,
          label: device.kks ? `${device.name}（${device.kks}）` : device.name,
          kind: "device",
          uuid: device.uuid,
          nodeId: device.nodeId,
          kks: device.kks,
          raw: device
        }));
        const children = [...childNodes, ...devices];
        const deviceCount = children.reduce((sum, item) => {
          if (item.kind === "device") return sum + 1;
          return sum + Number(item.deviceCount || 0);
        }, 0);
        return {
          id: `nav-${level === 0 ? "region" : "system"}:${node.id}`,
          label: `${node.label}${deviceCount ? `（${deviceCount}）` : ""}`,
          kind: level === 0 ? "region" : "system",
          nodeId: node.id,
          parentId: node.parentId || "",
          deviceCount,
          children
        };
      })
      .filter(Boolean);
  };

  const mountedTree = buildNodes(systemNodeTree.value);
  const unmountedModels = sceneModels.value
    .filter(item => !String(item.systemNodeId || "").trim())
    .map(item => {
      const devices = sceneDevices.value
        .filter(device => device.instanceId === item.instanceId)
        .map(device => ({
          id: `nav-device:${device.uuid}`,
          label: device.kks ? `${device.name}（${device.kks}）` : device.name,
          kind: "device",
          uuid: device.uuid,
          nodeId: device.nodeId,
          kks: device.kks,
          raw: device
        }));

      return {
        id: `nav-model:${item.instanceId}`,
        label: `${item.modelName || "未命名模型"}${devices.length ? `（${devices.length}）` : ""}`,
        kind: "model",
        instanceId: item.instanceId,
        deviceCount: devices.length,
        children: devices
      };
    });

  if (unmountedModels.length > 0) {
    mountedTree.push({
      id: "nav-unmounted-models",
      label: "未挂载模型",
      kind: "group",
      nodeId: "",
      parentId: "",
      deviceCount: unmountedModels.reduce(
        (sum, item) => sum + Number(item.deviceCount || 0),
        0
      ),
      children: unmountedModels
    });
  }

  return mountedTree;
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
  activeSideTab.value = scheme.activeRightTab || "navigation";
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

function persistSceneAnchorData() {
  patchSceneProjectPackage({
    anchors: anchors.value,
    cameras: cameraAnchors.value,
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
      anchors: anchors.value,
      cameras: cameraAnchors.value,
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
        anchors: anchors.value,
        cameras: cameraAnchors.value,
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
  selectedLodId.value = lod?.id || "";
  message(
    selectedLodId.value
      ? `已切换到 ${lod.level || lod.id}`
      : "已恢复默认模型清单",
    { type: "success" }
  );
}

function clearLodOverride() {
  selectedLodId.value = "";
  message("已恢复默认模型清单", { type: "success" });
}

function setMaterialTheme(theme) {
  materialTheme.value = theme;
  viewerAdapter.setMaterialTheme(theme);
}

function areSceneOverlaysSuppressed() {
  return Boolean(enableClipping.value || runtimeClippingState.value?.enabled);
}

function syncSceneAnchors() {
  if (!viewerAdapter.isReady()) return;
  const suppressed = areSceneOverlaysSuppressed();
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

function openCreateAnchorDialog(kind = "anchor") {
  stopPositionPicking({ restoreTool: false });
  anchorDialogKind.value = kind;
  anchorDialogMode.value = "create";
  anchorForm.value = buildStyledAnchorForm(kind, {}, selectedObjectInfo.value);
  anchorDialogVisible.value = true;
}

function openEditAnchorDialog(item, kind = "anchor") {
  stopPositionPicking({ restoreTool: false });
  anchorDialogKind.value = kind;
  anchorDialogMode.value = "edit";
  anchorForm.value = buildStyledAnchorForm(kind, item);
  anchorDialogVisible.value = true;
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
  normalized.style = undefined;

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
  if (focusSceneObjectSelection(item.objectUuid)) {
    await selectTreeNodeByUUID(item.objectUuid, { openPanel: false });
  }
}

function openAnchorDetail(anchor) {
  updateSceneAnchorSelection(anchor, "anchor");
  clearSceneObjectPanels();
  anchorDetailVisible.value = true;
  focusSceneObjectSelection(anchor.objectUuid);
}

function openCameraVideo(anchor) {
  updateSceneAnchorSelection(anchor, "camera");
  clearSceneObjectPanels();
  runtimeStore.openVideoDialog(anchor);
  focusSceneObjectSelection(anchor.objectUuid);
}

function handleSceneAnchorClick(anchor) {
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
      objectUuid: item.uuid,
      meshUuids: Array.isArray(item.meshUuids) ? item.meshUuids : [],
      objectName: item.name || "",
      path: item.path || "",
      kks: item.kks || "",
      nodeId: item.nodeId || ""
    };
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
    const stored =
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
    const modelNode = modelNodeMap.get(item.instanceId) || null;
    const nodeId = stored?.nodeId || item.nodeId || modelNode?.nodeId || "";
    const systemName =
      getSystemNodeLabel(nodeId) || modelNode?.label || item.systemName || "";
    const kks = stored?.kks || item.kks || "";
    return {
      ...item,
      sourceId:
        stored?.sourceId ||
        buildModelObjectSourceId({
          instanceId: item.instanceId,
          objectUuid: item.uuid
        }),
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
  runtimeStore.setQuality(val);
  viewerAdapter.setQuality(val);
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
  stopClippingAnimation({ persist: false });
  updateClippingState(nextState);
}

function onClippingPresetChange(presetId) {
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
  stopClippingAnimation({ persist: false });
  const nextState = resetClippingState(runtimeClippingState.value);
  updateClippingState(nextState);
  viewerAdapter.resetClipping?.();
  message("已重置剖切状态", { type: "success" });
}

async function locateDevice(item, withMessage = true) {
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

async function locateByKks(kks = selectedQuickKks.value) {
  await locateSceneByKks({
    kks,
    sceneDevices: sceneDevices.value,
    locateDevice: target => locateDevice(target),
    notify: message
  });
}

async function isolateDevice(
  item = selectedSceneDevice.value,
  withMessage = true
) {
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

function handleNavTreeContextMenu(event, data) {
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

function onCtxCreateChildNode() {
  openCreateNavigationNodeDialog(ctxMenuNode.value?.nodeId || "");
}

function onCtxEditNode() {
  openEditNavigationNodeDialog(ctxMenuNode.value);
}

function onCtxRemoveNode() {
  removeNavigationNodeById(ctxMenuNode.value?.nodeId || "");
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

async function loadCurrentDocumentOptions(keyword = "") {
  documentDialogLoading.value = true;
  try {
    const { records, pagination } = await loadDocumentBindingOptions({
      keyword,
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

async function fetchDialogBoundDocuments() {
  const meta = getDocumentDialogMeta();
  if (!documentDialogSourceId.value) return [];
  return fetchBoundDocumentsByRelation({
    sourceKind: meta.sourceKind,
    sourceId: documentDialogSourceId.value,
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
    boundDocuments: documents
  });
}

async function openDocumentDialog({
  scope = "node",
  mode = "bind",
  targetId = "",
  targetLabel = "",
  sourceId = "",
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
  documentDialogKeyword.value = "";
  documentDialogPagination.value = createDefaultDocumentBindingPagination();
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
    void loadCurrentDocumentOptions();
  }
}

function onCtxBindDocuments() {
  const targetId = String(
    ctxMenuNode.value?.nodeId || ctxMenuNode.value?.id || ""
  ).trim();
  if (!targetId) return;
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
  if (!targetId) return;
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
  if (!targetUuid || !sourceId) return;
  void openDocumentDialog({
    scope: "object",
    mode: "bind",
    targetId: targetUuid,
    targetLabel:
      raw?.name || ctxMenuNode.value?.label || ctxMenuNode.value?.name,
    sourceId,
    initialDocuments: raw?.boundDocuments || []
  });
}

function onCtxViewObjectDocuments() {
  const raw = ctxMenuNode.value?.raw || null;
  const targetUuid = String(raw?.uuid || "").trim();
  const sourceId = getSceneDeviceSourceId(raw);
  if (!targetUuid || !sourceId) return;
  void openDocumentDialog({
    scope: "object",
    mode: "view",
    targetId: targetUuid,
    targetLabel:
      raw?.name || ctxMenuNode.value?.label || ctxMenuNode.value?.name,
    sourceId,
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
  try {
    if (sourceId) {
      await upsertSceneObjectKksRelation({
        sourceId,
        kks: "",
        relationId: raw?.kksRelationId || ""
      });
    }
    const cleared = clearNodeProperty(ctxMenuNode.value, sceneDevices.value);
    if (cleared && sourceId) {
      applySceneDeviceBindingPatch(sourceId, {
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
      sourceId: getSceneDeviceSourceId(item),
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
  kks,
  relationId = ""
}) {
  const currentRelations = await listModelObjectRelationsBySourceAndType(
    sourceId,
    MODEL_OBJECT_KKS_RELATION_TYPE
  );
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

  let primaryRelationId =
    relationId || String(currentRelations[0]?.id || "").trim();
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
    await createRelationRecord(payload);
  }

  const refreshedRelations = await listModelObjectRelationsBySourceAndType(
    sourceId,
    MODEL_OBJECT_KKS_RELATION_TYPE
  );
  const primaryRelation =
    refreshedRelations.find(
      item => String(item?.id || "").trim() === primaryRelationId
    ) ||
    refreshedRelations.find(
      item => String(item?.targetId || "").trim() === normalizedKks
    ) ||
    refreshedRelations[0] ||
    null;
  primaryRelationId = String(primaryRelation?.id || "").trim();

  await Promise.all(
    refreshedRelations
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
  if (!sourceId) {
    message("当前构件缺少绑定标识，无法提交后端", { type: "error" });
    return;
  }
  try {
    const kksRelationId = await upsertSceneObjectKksRelation({
      sourceId,
      kks: propEditForm.value.kks,
      relationId: raw?.kksRelationId || ""
    });
    applySceneDeviceBindingPatch(sourceId, {
      sourceId,
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
  const keys = layerTreeRef.value?.getCheckedKeys?.(true) || [];
  layerCheckedKeys.value = [...keys];
  applyLayerVisibility(layerCheckedKeys.value);
}

async function applyDisplayMode(mode, withMessage = true) {
  await applySceneDisplayMode({
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

async function onObjectSelect(info) {
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

function handleViewerLoaded() {
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
  if (key === "escape" && positionPickingState.value.active) {
    cancelPositionPicking();
    return;
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
  () => materialTheme.value,
  value => {
    syncViewerMaterialTheme({
      viewerAdapter,
      value
    });
  }
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
          :quality="quality"
          :interaction-mode="interactionMode"
          :ifc-wasm-path="ifcWasmPath"
          :show-stats="showStats"
          :enable-clipping="enableClipping"
          :tool-options="toolOptions"
          :active-tool="activeTool"
          :roaming-enabled="roamingEnabled"
          :preset-views="presetViews"
          :bookmarks="bookmarks"
          :measurement-mode="measurementMode"
          :measurement-mode-options="measurementModeOptions"
          :projection-mode="projectionMode"
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
          :selected-kks-detail="selectedKksDetail"
          :selected-kks-detail-loading="selectedKksDetailLoading"
          :selected-kks-detail-error="selectedKksDetailError"
          :current-measurement-points="currentMeasurementPoints"
          :point-markers-visible="pointMarkersVisible"
          @viewer-ref-change="handleViewerRefChange"
          @loaded="handleViewerLoaded"
          @object-select="onObjectSelect"
          @measure-change="handleMeasurementChange"
          @measure-complete="handleMeasurementChange"
          @scene-anchor-click="handleSceneAnchorClick"
          @clipping-change="handleViewerClippingChange"
          @update:active-tool="activeTool = $event"
          @update:measurement-mode="setMeasurementMode"
          @tool-change="onToolChange"
          @zoom-in="zoomIn"
          @zoom-out="zoomOut"
          @reset-view="resetView"
          @toggle-roaming="toggleRoaming"
          @toggle-transparent="toggleTransparent"
          @toggle-projection="toggleProjection"
          @toggle-clipping="toggleClipping"
          @take-screenshot="takeScreenshot"
          @save-bookmark="saveBookmark"
          @apply-bookmark="applyBookmark"
          @clear-measurements="clearMeasurements"
          @export-measurements="exportMeasurements"
          @set-preset-view="setPresetView"
          @update:clipping-state="onClippingStateChange"
          @toggle-animation="toggleClippingAnimation"
          @update:animation-speed="clippingAnimationSpeed = $event"
          @update:animation-mode="clippingAnimationMode = $event"
          @update:animation-axis="clippingAnimationAxis = $event"
          @reset-clipping="resetClipping"
          @close-object-panel="closeObjectPanel"
          @update:point-markers-visible="pointMarkersVisible = $event"
        />

        <Viewer2DWorkspace
          :show-side-panel="showSidePanel"
          :active-side-tab="activeSideTab"
          :navigation-tree-data="navigationTreeData"
          :current-nav-node-key="currentNavNodeKey"
          :selected-system-node-id="selectedSystemNodeId"
          :selected-quick-kks="selectedQuickKks"
          :scene-device-system-options="sceneDeviceSystemOptions"
          :scene-device-kks-options="sceneDeviceKksOptions"
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
          :runtime-logs="runtimeLogs"
          :format-scheme-time="formatSchemeTime"
          @layer-tree-ref-change="handleLayerTreeRefChange"
          @update:active-side-tab="activeSideTab = $event"
          @create-root-node="openCreateNavigationNodeDialog()"
          @navigation-node-click="handleNavigationNodeClick"
          @navigation-node-contextmenu="handleNavTreeContextMenu"
          @update:selected-system-node-id="selectedSystemNodeId = $event"
          @update:selected-quick-kks="selectedQuickKks = $event"
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
          @edit-anchor="openEditAnchorDialog($event, 'anchor')"
          @remove-anchor="removeSceneAnchor($event, 'anchor')"
          @update:camera-markers-visible="cameraMarkersVisible = $event"
          @add-camera="openCreateAnchorDialog('camera')"
          @select-camera="openCameraVideo"
          @edit-camera="openEditAnchorDialog($event, 'camera')"
          @remove-camera="removeSceneAnchor($event, 'camera')"
          @update:measurement-mode="setMeasurementMode"
          @focus-record="focusMeasurementRecord"
          @toggle-record-visible="toggleMeasurementRecordVisible"
          @remove-record="removeMeasurementRecord"
          @clear-records="clearMeasurements"
          @export-records="exportMeasurements"
          @add-model="openModelPicker"
          @select-model="activeSceneModelId = $event"
          @remove-model="removeSceneModel"
          @refresh-model-options="loadAvailableModels(true)"
          @toggle-group="toggleAssetGroupVisibility"
          @update:quality="quality = $event"
          @update:material-theme="setMaterialTheme"
          @apply-lod="applyLodLevel"
          @clear-lod="clearLodOverride"
          @restart-realtime="restartRealtime"
          @run-manual-trigger="runManualScriptTrigger"
          @send-backend-command="sendBackendCommand"
          @clear-logs="clearRuntimeLogs"
        />

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
          :model-picker-node-id="modelPickerNodeId"
          :model-picker-selection="modelPickerSelection"
          :system-node-select-options="systemNodeSelectOptions"
          :selectable-model-options="selectableModelOptions"
          :loading-model-options="loadingModelOptions"
          @update:model-picker-node-id="modelPickerNodeId = $event"
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
            <div class="dd-nav-ctx-item" @click.stop="onCtxCreateChildNode">
              新增子节点
            </div>
            <div class="dd-nav-ctx-item" @click.stop="onCtxEditNode">
              重命名节点
            </div>
            <div class="dd-nav-ctx-item" @click.stop="onCtxBindDocuments">
              绑定文件
            </div>
            <div class="dd-nav-ctx-item" @click.stop="onCtxViewDocuments">
              查看绑定文件
            </div>
            <div
              class="dd-nav-ctx-item dd-nav-ctx-danger"
              @click.stop="onCtxRemoveNode"
            >
              删除节点
            </div>
          </template>
        </div>

        <NavigationNodeDialog
          v-model="navNodeDialogVisible"
          :mode="navNodeDialogMode"
          :label="navNodeForm.label"
          @update:label="navNodeForm.label = $event"
          @confirm="confirmNavigationNodeDialog"
        />

        <DocumentBindingDialog
          v-model="documentDialogVisible"
          :title="documentDialogTitle"
          :current-label="documentDialogCurrentLabel"
          :target-label="documentDialogTargetLabel"
          :current-bound-count="currentDocumentBoundCount"
          :mode="documentDialogMode"
          :keyword="documentDialogKeyword"
          :loading="documentDialogLoading"
          :records="documentDialogRecords"
          :pagination="documentDialogPagination"
          :selected-documents="documentDialogSelectedDocuments"
          :empty-text="documentDialogEmptyText"
          @update:keyword="documentDialogKeyword = $event"
          @search="searchDocumentOptions(documentDialogKeyword)"
          @selection-change="handleDocumentSelectionChange"
          @table-ref-change="documentDialogTableRef = $event"
          @size-change="onDocumentSizeChange"
          @page-change="onDocumentPageChange"
          @confirm="confirmDocumentDialog"
        />

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
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  --dd-gap: 12px;
  --dd-topbar-height: 52px;
  --dd-panels-top: 64px;
  --dd-bottom-reserve: 120px;
  --dd-panel-width: 420px; /* 原本360px，由于增加了垂直标签栏，拓宽以防止内容挤压 */
}

.dd-topbar {
  display: flex;
  gap: 12px;
  align-items: center;
  height: 52px;
  padding: 0 16px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
}

.dd-canvas {
  flex: 1;
  overflow: hidden;
}

.dd-nav-ctx-menu {
  position: fixed;
  z-index: 9999;
  min-width: 120px;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  box-shadow: var(--el-box-shadow-light);
  padding: 4px 0;
}

.dd-nav-ctx-item {
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  color: var(--el-text-color-regular);
}

.dd-nav-ctx-item:hover {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}

.dd-nav-ctx-danger:hover {
  color: var(--el-color-danger);
}
</style>
