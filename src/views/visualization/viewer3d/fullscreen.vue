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
import { ThreeModelViewer } from "@/3d";
import { getHandoverKksList } from "@/api/handoverData";
import { getHandoverDocumentList } from "@/api/handoverDocuments";
import {
  getHandoverModelDetail,
  getHandoverModelList
} from "@/api/handoverModels";
import {
  getHandoverProjectDetail,
  updateHandoverProject
} from "@/api/handoverProjects";
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
import ViewerBottomToolbar from "./toolbars/ViewerBottomToolbar.vue";
import ClippingPanel from "./panels/ClippingPanel.vue";
import ObjectInfoPanel from "./panels/ObjectInfoPanel.vue";
import SceneSchemePanel from "./panels/SceneSchemePanel.vue";
import DevicePanel from "./panels/DevicePanel.vue";
import NavigationPanel from "./panels/NavigationPanel.vue";
import SceneAnchorPanel from "./panels/SceneAnchorPanel.vue";
import MeasurementPanel from "./panels/MeasurementPanel.vue";
import RuntimeLinkagePanel from "./panels/RuntimeLinkagePanel.vue";
import AssetGroupPanel from "./panels/AssetGroupPanel.vue";
import {
  applyClippingPreset,
  CLIPPING_AXIS_OPTIONS,
  CLIPPING_DIRECTION_OPTIONS,
  CLIPPING_FEEDBACK_OPTIONS,
  CLIPPING_MODE_OPTIONS,
  CLIPPING_PRESET_OPTIONS,
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
  ANCHOR_BINDING_TYPE_OPTIONS,
  CAMERA_STREAM_TYPE_OPTIONS,
  CAMERA_TYPE_OPTIONS,
  CAMERA_WINDOW_MODE_OPTIONS,
  SCENE_ANCHOR_TYPE_OPTIONS,
  buildRenderableAnchors,
  createEmptyAnchorForm,
  createEmptyCameraForm,
  normalizeAnchorForm,
  normalizeCameraForm,
  removeItem,
  summarizeAnchorBinding,
  upsertItem
} from "./services/sceneAnchorService";
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
  loadProjectPackage,
  parseImportedProjectPackage,
  saveProjectPackage,
  patchProjectPackage
} from "./services/projectPackageService";
import { useViewerToolbarState } from "./services/useViewerToolbarState";

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
const nodeDocumentDialogVisible = ref(false);
const nodeDocumentDialogMode = ref("bind");
const nodeDocumentDialogLoading = ref(false);
const nodeDocumentDialogKeyword = ref("");
const nodeDocumentDialogRecords = ref([]);
const nodeDocumentDialogPagination = ref({
  page: 1,
  size: 20,
  total: 0
});
const nodeDocumentTargetId = ref("");
const nodeDocumentTargetLabel = ref("");
const nodeDocumentSelectedDocuments = ref([]);
const nodeDocumentTableRef = ref(null);

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

function normalizeModelItem(item) {
  return {
    id: item?.id || "",
    name: item?.name || "未命名模型",
    lod: item?.lod || "LOD300",
    components: Number(item?.components || 0),
    updatedAt: item?.updatedAt || "-",
    nodeIds: Array.isArray(item?.nodeIds) ? item.nodeIds : [],
    kksRefs: Array.isArray(item?.kksRefs) ? item.kksRefs : [],
    url: item?.url || ""
  };
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

function normalizeSavedObjectBinding(item) {
  const objectUuid = String(item?.objectUuid || item?.uuid || "").trim();
  const objectName = String(item?.objectName || item?.name || "").trim();
  const path = String(item?.path || "").trim();
  if (!objectUuid && !objectName && !path) return null;
  const businessBinding = item?.businessBinding || {};
  return {
    instanceId: String(item?.instanceId || "").trim(),
    objectUuid,
    objectName,
    path,
    meshUuids: Array.isArray(item?.meshUuids) ? item.meshUuids : [],
    kks: String(businessBinding?.kks || item?.kks || "").trim(),
    nodeId: String(businessBinding?.nodeId || item?.nodeId || "").trim()
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

function createSceneModel(detail = {}, partial = {}) {
  return {
    instanceId:
      partial.instanceId ||
      `scene-model-${detail.id || Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    modelId: detail.id || partial.modelId || "",
    modelName: detail.name || partial.modelName || "未命名模型",
    modelUrl: detail.url || partial.modelUrl || "",
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
    systemNodeId: String(
      partial.systemNodeId || partial.nodeId || detail.systemNodeId || ""
    ).trim(),
    systemNodeLabel: String(
      partial.systemNodeLabel ||
        partial.nodeLabel ||
        detail.systemNodeLabel ||
        detail.systemNodeName ||
        ""
    ).trim(),
    metadata: {
      lod: detail.lod || partial.metadata?.lod || "LOD300",
      ...(partial.metadata || {})
    },
    rawDetail: detail
  };
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
    const detail = normalizeModelItem(response?.data ?? response ?? {});
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
      .map(normalizeModelItem)
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
    return createSceneModel(detail, partial);
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

function parseProjectInfo(rawValue) {
  if (!rawValue) return null;
  if (typeof rawValue === "object") return rawValue;
  try {
    return JSON.parse(String(rawValue));
  } catch (error) {
    console.error("parse projectInfo failed", error);
    return null;
  }
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
      parsedProjectInfo: parseProjectInfo(project?.projectInfo)
    };
    return currentProjectContext.value;
  } catch (error) {
    console.error("load handover project detail failed", error);
    message(error?.message || "获取项目详情失败", { type: "error" });
    currentProjectContext.value = null;
    return null;
  }
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
  modelPickerNodeId.value =
    selectedSystemNodeId.value || systemNodeSelectOptions.value[0]?.value || "";
  modelPickerVisible.value = true;
}

async function confirmAddModels() {
  const ids = Array.from(new Set(modelPickerSelection.value.filter(Boolean)));
  if (!ids.length) {
    message("请先选择模型", { type: "warning" });
    return;
  }
  if (!modelPickerNodeId.value) {
    message("请选择模型挂载的系统节点", { type: "warning" });
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
      createSceneModel(detail, {
        systemNodeId: modelPickerNodeId.value,
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
const clippingFeedbackOptions = CLIPPING_FEEDBACK_OPTIONS;
const clippingPresetOptions = CLIPPING_PRESET_OPTIONS;
const clippingSummaryText = computed(() =>
  getActiveClippingSummary(runtimeClippingState.value)
);

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
  });
});

const renderableCameraAnchors = computed(() => {
  const source = [...cameraAnchors.value];
  if (
    positionPickingState.value.active &&
    positionPickingState.value.kind === "camera" &&
    Array.isArray(positionPickingState.value.pickedPosition)
  ) {
    source.push({
      ...normalizeAnchorForm(anchorForm.value),
      id: "__picking-camera-preview__",
      type: "custom-point",
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
  });
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

  return buildNodes(systemNodeTree.value);
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
  patchProjectPackage(currentSceneSchemeScope.value, {
    metadata: getProjectMetadata(),
    scene: {
      schemes: sceneSchemes.value
    }
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
  patchProjectPackage(currentSceneSchemeScope.value, {
    metadata: getProjectMetadata(),
    scene: {
      anchors: anchors.value,
      cameras: cameraAnchors.value,
      clipping: projectClippingState.value
    }
  });
}

function persistClippingState() {
  const normalized = normalizeClippingState(runtimeClippingState.value);
  projectStore.setClippingState(normalized);
  const nextPackage = patchProjectPackage(
    currentSceneSchemeScope.value,
    {
      metadata: getProjectMetadata(),
      scene: {
        clipping: normalized
      }
    },
    getProjectMetadata()
  );
  projectStore.setProjectPackage(nextPackage);
}

function persistClippingPresets() {
  const nextPackage = patchProjectPackage(
    currentSceneSchemeScope.value,
    {
      metadata: getProjectMetadata(),
      scene: {
        clippingPresets: clippingPresets.value
      }
    },
    getProjectMetadata()
  );
  projectStore.setProjectPackage(nextPackage);
}

function buildProjectInfoPayload() {
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
      models: sceneModels.value.map(item => ({
        instanceId: item.instanceId,
        modelId: item.modelId,
        modelName: item.modelName,
        modelUrl: item.modelUrl,
        systemNodeId: item.systemNodeId || "",
        systemNodeLabel: item.systemNodeLabel || "",
        visible: item.visible !== false,
        locked: Boolean(item.locked),
        opacity: item.opacity ?? 1,
        transform: item.transform || {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        },
        metadata: {
          ...(item.metadata || {}),
          quality:
            item.modelId === activeSceneModelId.value ? quality.value : ""
        }
      })),
      bindings: {
        objectBindings: sceneDevices.value
          .filter(item => item?.uuid)
          .map(item => ({
            bindingId: `binding-${item.uuid}`,
            instanceId:
              item.instanceId || activeSceneModel.value?.instanceId || "",
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
              type: item.type || ""
            }
          }))
      },
      anchors: anchors.value,
      cameras: cameraAnchors.value,
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
      selectedObjectRef: selectedObjectInfo.value?.uuid
        ? {
            instanceId:
              selectedObjectInfo.value?.userData?.sceneModelInstanceId ||
              activeSceneModel.value?.instanceId ||
              "",
            objectUuid: selectedObjectInfo.value.uuid
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
          objectBindings: sceneDevices.value
            .filter(item => item?.uuid)
            .map(item => ({
              bindingId: `binding-${item.uuid}`,
              instanceId:
                item.instanceId || activeSceneModel.value?.instanceId || "",
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
                type: item.type || ""
              }
            }))
        },
        anchors: anchors.value,
        cameras: cameraAnchors.value,
        measurements: measurementRecords.value,
        schemes: sceneSchemes.value,
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

function resolvePersistedProjectPackage(projectInfo = null) {
  if (projectInfo?.projectPackage) {
    const backendPackage = createScopedProjectPackage(
      currentSceneSchemeScope.value,
      projectInfo.projectPackage
    );
    saveProjectPackage(currentSceneSchemeScope.value, backendPackage);
    return backendPackage;
  }

  const currentPackage = loadProjectPackage(
    currentSceneSchemeScope.value,
    getProjectMetadata()
  );
  return currentPackage;
}

function applySavedRuntimeState(runtime = {}) {
  const nextQuality =
    runtime.quality === "low" ||
    runtime.quality === "medium" ||
    runtime.quality === "high"
      ? runtime.quality
      : "high";
  quality.value = nextQuality;
  runtimeStore.setQuality(nextQuality);

  const nextTheme = String(runtime.materialTheme || materialTheme.value || "");
  if (nextTheme) {
    materialTheme.value = nextTheme;
    runtimeStore.setMaterialTheme(nextTheme);
  }

  const nextTool = String(runtime.activeTool || activeTool.value || "rotate");
  activeTool.value = nextTool;
  runtimeStore.setActiveTool(nextTool);

  const nextMeasurementMode = String(
    runtime.measurementMode || measurementMode.value || "distance"
  );
  measurementMode.value = nextMeasurementMode;
  runtimeStore.setMeasurementMode(nextMeasurementMode);

  const nextDisplayMode = String(
    runtime.displayMode || displayMode.value || ""
  );
  if (nextDisplayMode) {
    displayMode.value = nextDisplayMode;
    runtimeStore.setDisplayMode(nextDisplayMode);
  }

  showStats.value = Boolean(runtime.showStats);
  runtimeStore.setShowStats(showStats.value);
  showSidePanel.value = runtime.showSidePanel !== false;
  runtimeStore.setShowSidePanel(showSidePanel.value);
  const nextSideTab = String(runtime.activeSideTab || "navigation");
  activeSideTab.value =
    nextSideTab === "structure" ? "navigation" : nextSideTab;
  runtimeStore.setActiveSideTab(activeSideTab.value);

  transparent.value = Boolean(runtime.transparentEnabled);
  runtimeStore.setTransparentEnabled(transparent.value);
  pointMarkersVisible.value = runtime.pointMarkersVisible !== false;
  runtimeStore.setPointMarkersVisible(pointMarkersVisible.value);
  anchorMarkersVisible.value = runtime.anchorMarkersVisible !== false;
  runtimeStore.setAnchorMarkersVisible(anchorMarkersVisible.value);
  cameraMarkersVisible.value = runtime.cameraMarkersVisible !== false;
  runtimeStore.setCameraMarkersVisible(cameraMarkersVisible.value);

  selectedDeviceUuid.value = String(runtime.selectedDeviceUuid || "");
  runtimeStore.setSelectedDeviceUuid(selectedDeviceUuid.value);
  selectedAnchorId.value = String(runtime.selectedAnchorId || "");
  runtimeStore.setSelectedAnchorId(selectedAnchorId.value);
  selectedCameraId.value = String(runtime.selectedCameraId || "");
  runtimeStore.setSelectedCameraId(selectedCameraId.value);
  selectedSystemNodeId.value = String(runtime.selectedSystemNodeId || "");
  runtimeStore.setSelectedSystemNodeId(selectedSystemNodeId.value);
  selectedQuickKks.value = String(runtime.selectedQuickKks || "");
  runtimeStore.setSelectedQuickKks(selectedQuickKks.value);
  currentNavNodeKey.value = String(runtime.currentNavNodeKey || "");
  runtimeStore.setCurrentNavNodeKey(currentNavNodeKey.value);
}

function loadPersistedProjectState(projectInfo = null) {
  const projectPackage = resolvePersistedProjectPackage(projectInfo);
  const savedScene = projectInfo?.scene || {};
  const savedRuntime = projectInfo?.runtime || {};
  savedObjectBindings.value = Array.isArray(
    savedScene.bindings?.objectBindings ||
      projectPackage.scene?.bindings?.objectBindings
  )
    ? (
        savedScene.bindings?.objectBindings ||
        projectPackage.scene?.bindings?.objectBindings
      )
        .map(normalizeSavedObjectBinding)
        .filter(Boolean)
    : [];
  systemNodeTree.value = mapSystemTreeNodes(
    Array.isArray(savedScene.navigationTree)
      ? savedScene.navigationTree
      : projectPackage.scene?.navigationTree || []
  );
  updateSceneModelNodeLabels();

  projectStore.setProjectPackage(projectPackage);

  anchors.value = Array.isArray(savedScene.anchors)
    ? savedScene.anchors
    : projectPackage.scene?.anchors || [];
  cameraAnchors.value = Array.isArray(savedScene.cameras)
    ? savedScene.cameras
    : projectPackage.scene?.cameras || [];
  measurementRecords.value = Array.isArray(savedScene.measurements)
    ? savedScene.measurements
    : projectPackage.scene?.measurements || [];
  sceneSchemes.value = Array.isArray(savedScene.schemes)
    ? savedScene.schemes
    : projectPackage.scene?.schemes || [];
  bookmarks.value = Array.isArray(savedScene.bookmarks)
    ? savedScene.bookmarks
    : [];

  projectStore.setAnchors(anchors.value);
  projectStore.setCameraAnchors(cameraAnchors.value);
  projectStore.setMeasurementRecords(measurementRecords.value);
  projectStore.setSceneSchemes(sceneSchemes.value);
  projectStore.setBookmarks(bookmarks.value);

  const nextClippingState =
    savedScene.clipping ||
    projectPackage.scene?.clipping ||
    createDefaultClippingState();
  runtimeStore.setClippingState(normalizeClippingState(nextClippingState));
  projectStore.setClippingState(nextClippingState);

  const nextClippingPresets = Array.isArray(savedScene.clippingPresets)
    ? savedScene.clippingPresets
    : projectPackage.scene?.clippingPresets || [];
  projectStore.setClippingPresets(nextClippingPresets);

  assetGroups.value = (
    Array.isArray(savedScene.assetGroups)
      ? savedScene.assetGroups
      : projectPackage.assets?.sceneManifest?.groups || []
  ).map(item => ({
    ...item,
    visible: item.visible !== false
  }));

  applySavedRuntimeState(savedRuntime);
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
  const nextPackage = patchProjectPackage(
    currentSceneSchemeScope.value,
    {
      assets: {
        sceneManifest: {
          ...sceneManifest.value,
          groups: assetGroups.value
        }
      }
    },
    getProjectMetadata()
  );
  projectStore.setProjectPackage(nextPackage);
  applyAssetGroupVisibility();
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

function syncSceneAnchors() {
  if (!viewerAdapter.isReady()) return;
  viewerAdapter.setAnchors(renderableAnchors.value);
  viewerAdapter.setAnchorsVisible(anchorMarkersVisible.value);
  viewerAdapter.setCameraAnchors(renderableCameraAnchors.value);
  viewerAdapter.setCameraAnchorsVisible(cameraMarkersVisible.value);
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
  anchorForm.value =
    kind === "camera"
      ? createEmptyCameraForm(selectedObjectInfo.value)
      : createEmptyAnchorForm(selectedObjectInfo.value);
  anchorDialogVisible.value = true;
}

function openEditAnchorDialog(item, kind = "anchor") {
  stopPositionPicking({ restoreTool: false });
  anchorDialogKind.value = kind;
  anchorDialogMode.value = "edit";
  anchorForm.value =
    kind === "camera" ? normalizeCameraForm(item) : normalizeAnchorForm(item);
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
  if (kind === "camera") {
    runtimeStore.setSelectedCameraId(item.id);
    runtimeStore.setSelectedAnchorId("");
  } else {
    runtimeStore.setSelectedAnchorId(item.id);
    runtimeStore.setSelectedCameraId("");
  }
  if (item.objectUuid) {
    viewerAdapter.highlightObjectByUUID(item.objectUuid);
    viewerAdapter.focusObjectByUUID(item.objectUuid);
    await selectTreeNodeByUUID(item.objectUuid, { openPanel: false });
  }
}

function openAnchorDetail(anchor) {
  runtimeStore.setSelectedAnchorId(anchor.id);
  runtimeStore.setSelectedCameraId("");
  runtimeStore.setShowObjectPanel(false);
  runtimeStore.setSelectedObject(null);
  viewerAdapter.clearSelection();
  anchorDetailVisible.value = true;
  if (anchor.objectUuid) {
    viewerAdapter.highlightObjectByUUID(anchor.objectUuid);
    viewerAdapter.focusObjectByUUID(anchor.objectUuid);
  }
}

function openCameraVideo(anchor) {
  runtimeStore.setSelectedCameraId(anchor.id);
  runtimeStore.setSelectedAnchorId("");
  runtimeStore.setShowObjectPanel(false);
  runtimeStore.setSelectedObject(null);
  viewerAdapter.clearSelection();
  runtimeStore.openVideoDialog(anchor);
  if (anchor.objectUuid) {
    viewerAdapter.highlightObjectByUUID(anchor.objectUuid);
    viewerAdapter.focusObjectByUUID(anchor.objectUuid);
  }
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
      kks,
      nodeId,
      systemName
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
  viewerAdapter.setLinkedPointsVisible(pointMarkersVisible.value);
  if (!pointMarkersVisible.value) {
    viewerAdapter.clearLinkedPoints();
    return;
  }
  viewerAdapter.setLinkedPoints(currentMeasurementPoints.value);
}

function persistMeasurementRecords() {
  patchProjectPackage(currentSceneSchemeScope.value, {
    metadata: getProjectMetadata(),
    scene: {
      measurements: measurementRecords.value
    }
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

function toggleClipping() {
  if (enableClipping.value) {
    stopClippingAnimation({ persist: false });
  }
  const nextState = runtimeClippingState.value.enabled
    ? {
        ...runtimeClippingState.value,
        enabled: false
      }
    : ensureVisibleClippingState(runtimeClippingState.value);
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
  const nextState = applyClippingPreset(runtimeClippingState.value, presetId);
  updateClippingState(nextState);
  const presetLabel =
    clippingPresetOptions.find(item => item.value === presetId)?.label ||
    presetId;
  message(`已应用剖切预设：${presetLabel}`, { type: "success" });
}

function saveCurrentClippingPreset() {
  const nextIndex = clippingPresets.value.length + 1;
  const item = {
    id: `clip-preset-${Date.now()}`,
    name: `剖切预设 ${nextIndex}`,
    state: cloneClippingState(runtimeClippingState.value),
    createdAt: Date.now()
  };
  const next = [item, ...clippingPresets.value];
  projectStore.setClippingPresets(next);
  persistClippingPresets();
  message(`已保存剖切预设：${item.name}`, { type: "success" });
}

function applySavedClippingPreset(item) {
  if (!item?.state) return;
  stopClippingAnimation({ persist: false });
  updateClippingState({
    ...cloneClippingState(item.state),
    enabled: true
  });
  message(`已应用剖切预设：${item.name}`, { type: "success" });
}

function removeSavedClippingPreset(id) {
  const target = clippingPresets.value.find(item => item.id === id);
  const next = clippingPresets.value.filter(item => item.id !== id);
  projectStore.setClippingPresets(next);
  persistClippingPresets();
  message(`已删除剖切预设：${target?.name || id}`, { type: "success" });
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

function normalizeNodeDocumentOption(item) {
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

function mergeSelectedNodeDocuments(current = [], next = [], replaceIds = []) {
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

function syncNodeDocumentTableSelection() {
  const table = nodeDocumentTableRef.value;
  if (!table) return;
  const selectedIdSet = new Set(
    nodeDocumentSelectedDocuments.value.map(item => item.id)
  );
  table.clearSelection();
  nodeDocumentDialogRecords.value.forEach(row => {
    if (selectedIdSet.has(row.id)) {
      table.toggleRowSelection(row, true);
    }
  });
}

async function loadNodeDocumentOptions(keyword = "") {
  nodeDocumentDialogLoading.value = true;
  try {
    const data = unwrapApiData(
      await getHandoverDocumentList({
        searchMode: "fuzzy",
        keyword: keyword.trim() || undefined,
        recycleBin: false,
        page: nodeDocumentDialogPagination.value.page,
        size: nodeDocumentDialogPagination.value.size
      }),
      "加载文档列表失败"
    );
    const records = Array.isArray(data?.records) ? data.records : [];
    nodeDocumentDialogRecords.value = records
      .map(normalizeNodeDocumentOption)
      .filter(Boolean);
    nodeDocumentDialogPagination.value.total = Number(data?.total ?? 0);
    nodeDocumentDialogPagination.value.page = Number(
      data?.page ?? nodeDocumentDialogPagination.value.page
    );
    nodeDocumentDialogPagination.value.size = Number(
      data?.size ?? nodeDocumentDialogPagination.value.size
    );
    await nextTick();
    syncNodeDocumentTableSelection();
  } catch (error) {
    nodeDocumentDialogRecords.value = [];
    nodeDocumentDialogPagination.value.total = 0;
    message(error?.message || "加载文档列表失败", { type: "error" });
  } finally {
    nodeDocumentDialogLoading.value = false;
  }
}

function openNodeDocumentDialog(mode = "bind") {
  const targetId = String(
    ctxMenuNode.value?.nodeId || ctxMenuNode.value?.id || ""
  ).trim();
  if (!targetId) return;
  const targetNode = findNavigationNodeById(systemNodeTree.value, targetId);
  nodeDocumentDialogMode.value = mode;
  nodeDocumentTargetId.value = targetId;
  nodeDocumentTargetLabel.value = String(
    targetNode?.label ||
      ctxMenuNode.value?.label ||
      ctxMenuNode.value?.name ||
      "当前节点"
  ).trim();
  nodeDocumentDialogKeyword.value = "";
  nodeDocumentDialogPagination.value.page = 1;
  nodeDocumentSelectedDocuments.value =
    getNavigationNodeBoundDocuments(targetId);
  nodeDocumentDialogVisible.value = true;
  ctxMenuVisible.value = false;

  if (mode === "bind") {
    nodeDocumentDialogRecords.value = [];
    loadNodeDocumentOptions();
  }
}

function onCtxBindDocuments() {
  openNodeDocumentDialog("bind");
}

function onCtxViewDocuments() {
  openNodeDocumentDialog("view");
}

function handleNodeDocumentSelectionChange(selection = []) {
  const normalizedSelection = selection
    .map(normalizeNodeDocumentOption)
    .filter(Boolean);
  const currentPageIds = nodeDocumentDialogRecords.value.map(item => item.id);
  nodeDocumentSelectedDocuments.value = mergeSelectedNodeDocuments(
    nodeDocumentSelectedDocuments.value,
    normalizedSelection,
    currentPageIds
  );
}

async function searchNodeDocuments(keyword) {
  nodeDocumentDialogKeyword.value = String(keyword || "");
  nodeDocumentDialogPagination.value.page = 1;
  await loadNodeDocumentOptions(nodeDocumentDialogKeyword.value);
}

async function onNodeDocumentPageChange(page) {
  nodeDocumentDialogPagination.value.page = Math.max(1, page);
  await loadNodeDocumentOptions(nodeDocumentDialogKeyword.value);
}

async function onNodeDocumentSizeChange(size) {
  nodeDocumentDialogPagination.value.size = size;
  nodeDocumentDialogPagination.value.page = 1;
  await loadNodeDocumentOptions(nodeDocumentDialogKeyword.value);
}

function confirmNodeDocumentDialog() {
  if (!nodeDocumentTargetId.value) return;
  updateNavigationNodeBoundDocuments(
    nodeDocumentTargetId.value,
    nodeDocumentSelectedDocuments.value
  );
  nodeDocumentDialogVisible.value = false;
  message("文件绑定已保存", { type: "success" });
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

const nodeDocumentDialogTitle = computed(() => {
  return nodeDocumentDialogMode.value === "view" ? "查看绑定文件" : "绑定文件";
});

const currentNodeBoundDocumentCount = computed(
  () => nodeDocumentSelectedDocuments.value.length
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

function onCtxClearProp() {
  ctxMenuVisible.value = false;
  const cleared = clearNodeProperty(ctxMenuNode.value, sceneDevices.value);
  if (cleared) {
    syncSavedObjectBindingsFromSceneDevices();
    message("已清空该构件属性", { type: "success" });
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
    .filter(item => item?.uuid && (item.kks || item.nodeId))
    .map(item => ({
      instanceId: item.instanceId || "",
      objectUuid: item.uuid,
      meshUuids: Array.isArray(item.meshUuids) ? item.meshUuids : [],
      objectName: item.name || "",
      path: item.path || "",
      kks: item.kks || "",
      nodeId: item.nodeId || ""
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
            properties: {}
          }))
        }
      }
    },
    getProjectMetadata()
  );
  projectStore.setProjectPackage(nextPackage);
}

function confirmPropDialog() {
  const confirmed = confirmScenePropertyDialog({
    mode: propDialogMode.value,
    form: propEditForm.value,
    node: ctxMenuNode.value,
    sceneDevices: sceneDevices.value,
    notify: message
  });
  if (!confirmed) return;
  syncSavedObjectBindingsFromSceneDevices();
  propDialogVisible.value = false;
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
  runtimeStore.setViewerReady(true);
  nextTick(() => {
    viewerAdapter.resetView?.();
  });
  refreshSceneTree();
  refreshSceneDevices();
  syncRoamingState();
  syncMeasurementPoints();
  syncMeasurementRecordsToViewer();
  syncSceneAnchors();
  applyAssetGroupVisibility();
  syncLayerTreeSelection();
  viewerAdapter.setQuality(quality.value);
  viewerAdapter.setMaterialTheme(materialTheme.value);
  viewerAdapter.setClippingState(runtimeClippingState.value);
  viewerAdapter.setClippingAnimationOptions?.({
    speed: clippingAnimationSpeed.value,
    mode: clippingAnimationMode.value,
    axis: clippingAnimationAxis.value
  });
  runtimeStore.setClippingStats(
    viewerAdapter.getClippingStats?.() || {
      enabled: runtimeClippingState.value.enabled,
      mode: runtimeClippingState.value.mode,
      activePlaneCount: 0,
      affectedMeshCount: 0,
      totalMeshCount: 0
    }
  );
  syncRuntimeServices();
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

onMounted(async () => {
  onFullscreenKeydown = event => {
    if (event.key === "Escape" && positionPickingState.value.active) {
      cancelPositionPicking();
    }
  };
  window.addEventListener("keydown", onFullscreenKeydown);
  const project = await loadHandoverProjectContext();
  await loadAvailableModels();
  await initializeSceneModels(project?.parsedProjectInfo);
  refreshSceneTree();
  loadPersistedProjectState(project?.parsedProjectInfo);
});

watch(
  () => handoverProjectId.value,
  async () => {
    const project = await loadHandoverProjectContext();
    await initializeSceneModels(project?.parsedProjectInfo);
    loadPersistedProjectState(project?.parsedProjectInfo);
  }
);

watch(
  () => routeModelId.value,
  async value => {
    if (sceneModels.value.length > 0) return;
    if (!value) {
      activeSceneModelId.value = "";
      syncActiveModelDetail();
      return;
    }
    const detail = await fetchModelDetail(value);
    if (!detail) return;
    sceneModels.value = [createSceneModel(detail)];
    activeSceneModelId.value = detail.id;
    syncActiveModelDetail();
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
    stopClippingAnimation({ persist: false });
    if (clippingPersistTimer) {
      clearTimeout(clippingPersistTimer);
      clippingPersistTimer = null;
    }
    stopRuntimeServices();
    runtimeStore.setViewerReady(false);
    selectedTreeNode.value = null;
    treeFilterText.value = "";
    sceneTree.value = null;
    sceneDevices.value = [];
    anchors.value = [];
    cameraAnchors.value = [];
    measurementRecords.value = [];
    projectStore.setAnchors([]);
    projectStore.setCameraAnchors([]);
    projectStore.clearMeasurementRecords();
    selectedDeviceUuid.value = "";
    selectedAnchorId.value = "";
    selectedCameraId.value = "";
    selectedSystemNodeId.value = "";
    selectedQuickKks.value = "";
    displayMode.value = "all";
    currentNavNodeKey.value = "";
    layerCheckedKeys.value = [];
    runtimeStore.setSelectedObject(null);
    showObjectPanel.value = false;
    anchorDetailVisible.value = false;
    runtimeStore.closeVideoDialog();
    viewerAdapter.toggleFirstPerson(false);
    roamingEnabled.value = false;
    viewerAdapter.clearIsolation();
    viewerAdapter.clearLinkedPoints();
    viewerAdapter.clearAnchors();
    viewerAdapter.clearCameraAnchors();
    viewerAdapter.clearMeasurements();
    viewerAdapter.filterVisibleUUIDs(null);
    runtimeStore.setClippingState(createDefaultClippingState());
    projectStore.setClippingState(createDefaultClippingState());
    runtimeStore.setClippingStats({
      enabled: false,
      mode: "single-plane",
      activePlaneCount: 0,
      affectedMeshCount: 0,
      totalMeshCount: 0
    });
    projectStore.setClippingPresets([]);
    selectedLodId.value = "";
    refreshSceneTree();
    loadPersistedProjectState(currentProjectContext.value?.parsedProjectInfo);
  }
);

watch(
  () => [selectedDeviceUuid.value, pointMarkersVisible.value],
  () => {
    syncMeasurementPoints();
  }
);

watch(
  () => measurementMode.value,
  value => {
    setMeasurementMode(value);
  },
  { immediate: true }
);

watch(
  () => videoDialogVisible.value,
  async value => {
    if (value) {
      await nextTick();
      mountActiveVideo();
      return;
    }
    videoAdapter.destroy();
    videoErrorText.value = "";
  }
);

watch(
  () => activeCameraDetail.value?.id,
  async () => {
    if (!videoDialogVisible.value) return;
    await nextTick();
    mountActiveVideo();
  }
);

watch(
  () => quality.value,
  value => {
    viewerAdapter.setQuality(value);
  }
);

watch(
  () => materialTheme.value,
  value => {
    viewerAdapter.setMaterialTheme(value);
  }
);

watch(
  () => [renderableAnchors.value, anchorMarkersVisible.value],
  () => {
    syncSceneAnchors();
  },
  { deep: true }
);

watch(
  () => [renderableCameraAnchors.value, cameraMarkersVisible.value],
  () => {
    syncSceneAnchors();
  },
  { deep: true }
);

watch(
  () => sceneManifest.value?.groups,
  value => {
    assetGroups.value = Array.isArray(value)
      ? value.map(item => ({
          ...item,
          visible: item.visible !== false
        }))
      : [];
    if (viewerAdapter.isReady()) {
      applyAssetGroupVisibility();
    }
  },
  { deep: true, immediate: true }
);

watch(
  () => scriptDefinitions.value,
  () => {
    if (!viewerAdapter.isReady()) return;
    syncRuntimeServices();
  },
  { deep: true }
);

watch(
  () => integrationConfigs.value,
  () => {
    if (!viewerAdapter.isReady()) return;
    syncRuntimeServices();
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
    if (!viewerAdapter.isReady()) return;
    viewerAdapter.setClippingAnimationOptions?.({
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
      @save-project="saveCurrentProject"
      @update:quality="quality = $event"
      @quality-change="onQualityChange"
      @update:show-side-panel="showSidePanel = $event"
      @update:show-stats="showStats = $event"
    />

    <div class="dd-canvas">
      <div class="relative h-full w-full">
        <ThreeModelViewer
          ref="viewerRef"
          :model-url="viewerModelUrl"
          :model-name="modelName"
          :scene-models="viewerSceneModels"
          :transparent="transparent"
          :use-basic-material="true"
          :quality="quality"
          :interaction-mode="interactionMode"
          :ifc-wasm-path="ifcWasmPath"
          :show-stats="showStats"
          :enable-clipping="enableClipping"
          @loaded="handleViewerLoaded"
          @object-select="onObjectSelect"
          @measure-change="handleMeasurementChange"
          @measure-complete="handleMeasurementChange"
          @scene-anchor-click="handleSceneAnchorClick"
          @clipping-change="handleViewerClippingChange"
        />

        <div v-show="showSidePanel" class="dd-side-panel">
          <el-card shadow="never" class="h-full">
            <el-tabs v-model="activeSideTab" class="dd-side-tabs h-full">
              <el-tab-pane label="导航" name="navigation">
                <NavigationPanel
                  ref="layerTreeRef"
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
                  @create-root-node="openCreateNavigationNodeDialog()"
                  @navigation-node-click="handleNavigationNodeClick"
                  @navigation-node-contextmenu="handleNavTreeContextMenu"
                  @update:selected-system-node-id="
                    selectedSystemNodeId = $event
                  "
                  @update:selected-quick-kks="selectedQuickKks = $event"
                  @locate-system="locateSystem()"
                  @locate-by-kks="locateByKks()"
                  @apply-display-mode="applyDisplayMode"
                  @layer-tree-check="handleLayerTreeCheck"
                />

                <div class="mt-3 px-1">
                  <SceneSchemePanel
                    :scheme-name="schemeName"
                    :scene-schemes="sceneSchemes"
                    :format-scheme-time="formatSchemeTime"
                    @update:scheme-name="schemeName = $event"
                    @save-scheme="saveSceneScheme"
                    @apply-scheme="applySceneScheme"
                    @remove-scheme="removeSceneScheme"
                  />
                </div>
              </el-tab-pane>

              <el-tab-pane label="设备" name="devices">
                <DevicePanel
                  :device-keyword="deviceKeyword"
                  :filtered-scene-devices="filteredSceneDevices"
                  :selected-device-uuid="selectedDeviceUuid"
                  @update:device-keyword="deviceKeyword = $event"
                  @locate-device="locateDevice"
                  @isolate-device="isolateDevice"
                />
              </el-tab-pane>

              <el-tab-pane label="点位" name="anchors">
                <SceneAnchorPanel
                  title="场景点位"
                  kind="anchor"
                  :items="anchors"
                  :selected-id="selectedAnchorId"
                  :visible="anchorMarkersVisible"
                  empty-text="当前模型暂无点位"
                  @toggle-visible="anchorMarkersVisible = $event"
                  @add-item="openCreateAnchorDialog('anchor')"
                  @select-item="selectSceneAnchor($event, 'anchor')"
                  @edit-item="openEditAnchorDialog($event, 'anchor')"
                  @remove-item="removeSceneAnchor($event, 'anchor')"
                />
              </el-tab-pane>

              <el-tab-pane label="摄像头" name="cameras">
                <SceneAnchorPanel
                  title="摄像头点位"
                  kind="camera"
                  :items="cameraAnchors"
                  :selected-id="selectedCameraId"
                  :visible="cameraMarkersVisible"
                  empty-text="当前模型暂无摄像头点位"
                  @toggle-visible="cameraMarkersVisible = $event"
                  @add-item="openCreateAnchorDialog('camera')"
                  @select-item="selectSceneAnchor($event, 'camera')"
                  @edit-item="openEditAnchorDialog($event, 'camera')"
                  @remove-item="removeSceneAnchor($event, 'camera')"
                />
              </el-tab-pane>

              <el-tab-pane label="测量" name="measurements">
                <MeasurementPanel
                  :measurement-records="measurementRecords"
                  :measurement-mode="measurementMode"
                  :measurement-mode-options="measurementModeOptions"
                  @update:measurement-mode="setMeasurementMode"
                  @focus-record="focusMeasurementRecord"
                  @toggle-record-visible="toggleMeasurementRecordVisible"
                  @remove-record="removeMeasurementRecord"
                  @clear-records="clearMeasurements"
                  @export-records="exportMeasurements"
                />
              </el-tab-pane>

              <el-tab-pane label="资产" name="assets">
                <AssetGroupPanel
                  :scene-models="sceneModels"
                  :active-model-id="activeSceneModelId"
                  :groups="runtimeAssetGroups"
                  :available-model-options="selectableModelOptions"
                  :loading-model-options="loadingModelOptions"
                  :quality="quality"
                  :quality-options="qualityModeOptions"
                  :material-theme="materialTheme"
                  :lod-levels="sceneManifest.lodLevels || []"
                  :active-lod-id="selectedLodId"
                  @add-model="openModelPicker"
                  @select-model="activeSceneModelId = $event"
                  @remove-model="removeSceneModel"
                  @refresh-model-options="loadAvailableModels(true)"
                  @toggle-group="toggleAssetGroupVisibility"
                  @update:quality="quality = $event"
                  @update:material-theme="setMaterialTheme"
                  @apply-lod="applyLodLevel"
                  @clear-lod="clearLodOverride"
                />
              </el-tab-pane>

              <el-tab-pane label="联动" name="runtime">
                <RuntimeLinkagePanel
                  :realtime-state="realtimeState"
                  :script-state="scriptState"
                  :backend-state="backendState"
                  :runtime-logs="runtimeLogs"
                  @restart-realtime="restartRealtime"
                  @run-manual-trigger="runManualScriptTrigger"
                  @send-backend-command="sendBackendCommand"
                  @clear-logs="clearRuntimeLogs"
                />
              </el-tab-pane>
            </el-tabs>
          </el-card>
        </div>

        <el-dialog
          v-model="modelPickerVisible"
          title="添加模型到场景"
          width="560px"
          destroy-on-close
        >
          <el-form label-width="108px">
            <el-form-item label="挂载系统节点">
              <el-select
                v-model="modelPickerNodeId"
                filterable
                class="w-full"
                placeholder="请选择模型挂载的导航节点"
              >
                <el-option
                  v-for="item in systemNodeSelectOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="模型列表">
              <el-select
                v-model="modelPickerSelection"
                multiple
                filterable
                class="w-full"
                :loading="loadingModelOptions"
                placeholder="请选择要添加的模型"
              >
                <el-option
                  v-for="item in selectableModelOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="modelPickerVisible = false">取消</el-button>
            <el-button type="primary" @click="confirmAddModels">添加</el-button>
          </template>
        </el-dialog>

        <ViewerBottomToolbar
          :tool-options="toolOptions"
          :active-tool="activeTool"
          :roaming-enabled="roamingEnabled"
          :transparent="transparent"
          :enable-clipping="enableClipping"
          :preset-views="presetViews"
          :bookmarks="bookmarks"
          :measurement-mode="measurementMode"
          :measurement-mode-options="measurementModeOptions"
          :projection-mode="projectionMode"
          :selected-count="selectedCount"
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
        />

        <ClippingPanel
          :enable-clipping="enableClipping"
          :show-side-panel="showSidePanel"
          :clipping-state="runtimeClippingState"
          :clipping-summary="clippingSummaryText"
          :clipping-stats="clippingStats"
          :animation-playing="clippingAnimationPlaying"
          :animation-speed="clippingAnimationSpeed"
          :animation-mode="clippingAnimationMode"
          :animation-mode-options="clippingAnimationModeOptions"
          :animation-axis="clippingAnimationAxis"
          :animation-axis-options="clippingAnimationAxisOptions"
          :mode-options="clippingModeOptions"
          :axis-options="clippingAxisOptions"
          :direction-options="clippingDirectionOptions"
          :feedback-options="clippingFeedbackOptions"
          :preset-options="clippingPresetOptions"
          :saved-presets="clippingPresets"
          @update:clipping-state="onClippingStateChange"
          @apply-preset="onClippingPresetChange"
          @save-preset="saveCurrentClippingPreset"
          @apply-saved-preset="applySavedClippingPreset"
          @remove-saved-preset="removeSavedClippingPreset"
          @toggle-animation="toggleClippingAnimation"
          @update:animation-speed="clippingAnimationSpeed = $event"
          @update:animation-mode="clippingAnimationMode = $event"
          @update:animation-axis="clippingAnimationAxis = $event"
          @reset="resetClipping"
        />

        <ObjectInfoPanel
          :visible="showObjectPanel"
          :selected-object-info="selectedObjectInfo"
          :selected-scene-device="selectedSceneDevice"
          :selected-kks-detail="selectedKksDetail"
          :selected-kks-detail-loading="selectedKksDetailLoading"
          :selected-kks-detail-error="selectedKksDetailError"
          :current-measurement-points="currentMeasurementPoints"
          :point-markers-visible="pointMarkersVisible"
          @close="closeObjectPanel"
          @update:point-markers-visible="pointMarkersVisible = $event"
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

        <el-dialog
          v-model="navNodeDialogVisible"
          :title="
            navNodeDialogMode === 'create' ? '新增导航节点' : '重命名导航节点'
          "
          width="420px"
          destroy-on-close
        >
          <el-form label-width="88px">
            <el-form-item label="节点名称">
              <el-input
                v-model="navNodeForm.label"
                placeholder="请输入导航节点名称"
              />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="navNodeDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="confirmNavigationNodeDialog">
              确定
            </el-button>
          </template>
        </el-dialog>

        <el-dialog
          v-model="nodeDocumentDialogVisible"
          :title="nodeDocumentDialogTitle"
          width="80vw"
          destroy-on-close
        >
          <el-form label-width="90px" class="pr-4">
            <el-form-item label="当前节点">
              <el-input
                :model-value="nodeDocumentTargetLabel || '-'"
                readonly
              />
            </el-form-item>
            <el-form-item label="已绑文档">
              <div class="w-full text-sm text-gray-500">
                当前共绑定 {{ currentNodeBoundDocumentCount }} 个文档
              </div>
            </el-form-item>
            <template v-if="nodeDocumentDialogMode === 'bind'">
              <el-form-item label="文档搜索">
                <el-input
                  v-model="nodeDocumentDialogKeyword"
                  clearable
                  placeholder="搜索文档名称"
                  @input="searchNodeDocuments(nodeDocumentDialogKeyword)"
                />
              </el-form-item>
              <el-form-item label="文档列表">
                <div class="w-full">
                  <el-table
                    ref="nodeDocumentTableRef"
                    v-loading="nodeDocumentDialogLoading"
                    :data="nodeDocumentDialogRecords"
                    row-key="id"
                    height="45vh"
                    @selection-change="handleNodeDocumentSelectionChange"
                  >
                    <el-table-column type="selection" width="52" />
                    <el-table-column
                      prop="name"
                      label="文档名称"
                      min-width="260"
                      show-overflow-tooltip
                    />
                    <el-table-column prop="type" label="类型" width="120" />
                    <el-table-column
                      prop="updatedAt"
                      label="更新时间"
                      min-width="180"
                    />
                  </el-table>
                  <div class="mt-3 flex justify-end">
                    <el-pagination
                      background
                      layout="total, sizes, prev, pager, next"
                      :total="nodeDocumentDialogPagination.total"
                      :current-page="nodeDocumentDialogPagination.page"
                      :page-size="nodeDocumentDialogPagination.size"
                      :page-sizes="[20, 50, 100]"
                      @size-change="onNodeDocumentSizeChange"
                      @current-change="onNodeDocumentPageChange"
                    />
                  </div>
                </div>
              </el-form-item>
            </template>
            <el-form-item
              :label="
                nodeDocumentDialogMode === 'view' ? '绑定结果' : '已选文件'
              "
            >
              <div class="w-full">
                <el-table
                  :data="nodeDocumentSelectedDocuments"
                  row-key="id"
                  height="28vh"
                  empty-text="当前节点尚未绑定文档"
                >
                  <el-table-column
                    prop="name"
                    label="文档名称"
                    min-width="260"
                    show-overflow-tooltip
                  />
                  <el-table-column prop="type" label="类型" width="120" />
                  <el-table-column
                    prop="updatedAt"
                    label="更新时间"
                    min-width="180"
                  />
                </el-table>
              </div>
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="nodeDocumentDialogVisible = false">
              {{ nodeDocumentDialogMode === "view" ? "关闭" : "取消" }}
            </el-button>
            <el-button
              v-if="nodeDocumentDialogMode === 'bind'"
              type="primary"
              @click="confirmNodeDocumentDialog"
            >
              确定
            </el-button>
          </template>
        </el-dialog>

        <!-- 业务数据绑定弹窗 -->
        <el-dialog
          v-model="propDialogVisible"
          :title="propDialogTitle"
          width="80vw"
          destroy-on-close
        >
          <el-form label-width="90px" class="pr-4">
            <el-form-item label="业务数据">
              <el-input
                v-model="propertyBindingKeyword"
                clearable
                placeholder="搜索数据移交中的 KKS / 名称 / 系统"
                @input="searchPropertyBindingRecords(propertyBindingKeyword)"
              />
            </el-form-item>
            <el-form-item label="当前构件">
              <el-input :model-value="currentPropertyTargetName" readonly />
            </el-form-item>
            <el-form-item label="KKS 编码">
              <el-input :model-value="propEditForm.kks || '-'" readonly />
            </el-form-item>
            <el-form-item label="KKS 列表">
              <div class="w-full">
                <el-table
                  v-loading="propertyBindingLoading"
                  :data="propertyBindingRecords"
                  height="50vh"
                  highlight-current-row
                  @row-click="handlePropertyBindingRowClick"
                >
                  <el-table-column prop="kks" label="KKS编码" min-width="150" />
                  <el-table-column prop="name" label="名称" min-width="180" />
                  <el-table-column prop="type" label="类型" width="100" />
                  <el-table-column
                    prop="systemName"
                    label="所属系统"
                    min-width="160"
                    show-overflow-tooltip
                  />
                  <el-table-column prop="status" label="状态" width="100" />
                </el-table>
                <div class="mt-3 flex justify-end">
                  <el-pagination
                    background
                    layout="total, sizes, prev, pager, next"
                    :total="propertyBindingPagination.total"
                    :current-page="propertyBindingPagination.page"
                    :page-size="propertyBindingPagination.size"
                    :page-sizes="[20, 50, 100]"
                    @size-change="onPropertyBindingSizeChange"
                    @current-change="onPropertyBindingPageChange"
                  />
                </div>
              </div>
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="propDialogVisible = false">取消</el-button>
            <el-button
              type="primary"
              :disabled="!selectedPropertyBindingKks"
              @click="confirmPropDialog"
              >确定</el-button
            >
          </template>
        </el-dialog>

        <el-dialog
          v-if="anchorDialogVisible && !anchorDialogMinimized"
          v-model="anchorDialogVisible"
          :title="anchorDialogTitle"
          width="560px"
          :close-on-click-modal="true"
          class="dd-anchor-dialog"
          destroy-on-close
          @closed="handleAnchorDialogClosed"
        >
          <el-form label-width="108px" class="pr-4">
            <el-form-item
              :label="anchorDialogKind === 'camera' ? '名称' : '点位名称'"
            >
              <el-input
                v-model="anchorForm.name"
                :placeholder="
                  anchorDialogKind === 'camera'
                    ? '摄像头点位名称'
                    : '请输入点位名称'
                "
              />
            </el-form-item>
            <el-form-item label="编码">
              <el-input v-model="anchorForm.code" placeholder="可选编码" />
            </el-form-item>
            <template v-if="anchorDialogKind === 'camera'">
              <el-form-item label="摄像头类型">
                <el-select v-model="anchorForm.cameraType" class="w-full">
                  <el-option
                    v-for="item in cameraTypeOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="摄像头编码">
                <el-input
                  v-model="anchorForm.cameraCode"
                  placeholder="摄像头编码"
                />
              </el-form-item>
            </template>
            <template v-else>
              <el-form-item label="点位类型">
                <el-select v-model="anchorForm.type" class="w-full">
                  <el-option
                    v-for="item in sceneAnchorTypeOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
            </template>

            <el-form-item label="定位方式">
              <el-radio-group v-model="anchorForm.anchorMode">
                <el-radio label="object">绑定构件</el-radio>
                <el-radio label="world">世界坐标</el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item
              v-if="anchorForm.anchorMode === 'object'"
              label="绑定构件"
            >
              <el-select
                v-model="anchorForm.objectUuid"
                class="w-full"
                filterable
              >
                <el-option
                  v-for="item in sceneObjectOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>

            <el-form-item v-else label="世界坐标">
              <div class="w-full space-y-2">
                <div class="grid grid-cols-3 gap-2">
                  <el-input-number
                    v-model="anchorForm.worldPosition[0]"
                    :step="0.1"
                    controls-position="right"
                  />
                  <el-input-number
                    v-model="anchorForm.worldPosition[1]"
                    :step="0.1"
                    controls-position="right"
                  />
                  <el-input-number
                    v-model="anchorForm.worldPosition[2]"
                    :step="0.1"
                    controls-position="right"
                  />
                </div>
                <div class="flex flex-wrap gap-2">
                  <el-button size="small" @click="startPositionPicking">
                    {{ positionPickingState.active ? "继续拾取" : "模型拾取" }}
                  </el-button>
                  <span class="text-xs text-[var(--el-text-color-secondary)]">
                    未知坐标时可点击模型表面取点
                  </span>
                </div>
              </div>
            </el-form-item>

            <el-form-item v-if="anchorDialogKind !== 'camera'" label="显示偏移">
              <div class="grid w-full grid-cols-3 gap-2">
                <el-input-number
                  v-model="anchorForm.offset[0]"
                  :step="0.05"
                  controls-position="right"
                />
                <el-input-number
                  v-model="anchorForm.offset[1]"
                  :step="0.05"
                  controls-position="right"
                />
                <el-input-number
                  v-model="anchorForm.offset[2]"
                  :step="0.05"
                  controls-position="right"
                />
              </div>
            </el-form-item>

            <template v-if="anchorDialogKind === 'camera'">
              <el-form-item label="绑定设备">
                <el-select
                  v-model="anchorForm.bindDeviceKks"
                  class="w-full"
                  clearable
                  filterable
                >
                  <el-option
                    v-for="item in deviceKksOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="流类型">
                <el-select v-model="anchorForm.streamType" class="w-full">
                  <el-option
                    v-for="item in cameraStreamTypeOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="接入地址">
                <el-input
                  v-model="anchorForm.streamUrl"
                  placeholder="请输入视频流地址"
                />
              </el-form-item>
              <el-form-item label="打开方式">
                <el-select
                  v-model="anchorForm.defaultWindowMode"
                  class="w-full"
                >
                  <el-option
                    v-for="item in cameraWindowModeOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
            </template>

            <template v-else>
              <el-form-item label="绑定类型">
                <el-select
                  v-model="anchorForm.businessBinding.bindingType"
                  class="w-full"
                >
                  <el-option
                    v-for="item in anchorBindingTypeOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
              <el-form-item
                v-if="anchorForm.businessBinding.bindingType !== 'custom'"
                label="绑定设备"
              >
                <el-select
                  v-model="anchorForm.businessBinding.kks"
                  class="w-full"
                  clearable
                  filterable
                >
                  <el-option
                    v-for="item in deviceKksOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
              <el-form-item
                v-if="anchorForm.businessBinding.bindingType === 'measurement'"
                label="绑定测点"
              >
                <el-select
                  v-model="anchorForm.businessBinding.tag"
                  class="w-full"
                  clearable
                  filterable
                >
                  <el-option
                    v-for="item in anchorMeasurementOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
              <el-form-item
                v-if="anchorForm.businessBinding.bindingType === 'custom'"
                label="显示文本"
              >
                <el-input
                  v-model="anchorForm.payload.displayText"
                  placeholder="自定义显示文本"
                />
              </el-form-item>
              <el-form-item
                v-if="anchorForm.businessBinding.bindingType === 'custom'"
                label="数值"
              >
                <div class="grid w-full grid-cols-[minmax(0,1fr)_120px] gap-2">
                  <el-input
                    v-model="anchorForm.payload.value"
                    placeholder="值"
                  />
                  <el-input
                    v-model="anchorForm.payload.unit"
                    placeholder="单位"
                  />
                </div>
              </el-form-item>
            </template>

            <el-form-item label="描述">
              <el-input
                v-model="anchorForm.description"
                type="textarea"
                :rows="3"
                placeholder="可选描述"
              />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="anchorDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="submitAnchorDialog">
              确定
            </el-button>
          </template>
        </el-dialog>

        <div
          v-if="anchorDialogVisible && anchorDialogMinimized"
          class="dd-anchor-picking-panel"
        >
          <div class="text-sm text-[var(--el-text-color-secondary)]">
            {{ anchorDialogKind === "camera" ? "摄像头" : "点位" }}位置拾取中
          </div>
          <div
            class="rounded border border-[var(--el-border-color)] px-3 py-2 text-sm"
          >
            {{ pickedPositionText }}
          </div>
          <div class="flex flex-wrap gap-2">
            <el-button type="primary" @click="confirmPickedPosition">
              确认位置
            </el-button>
            <el-button @click="startPositionPicking">重新拾取</el-button>
            <el-button @click="cancelPositionPicking">取消拾取</el-button>
          </div>
          <div class="text-xs text-[var(--el-text-color-secondary)]">
            点击模型表面拾取坐标，确认后会回填到世界坐标。
          </div>
        </div>

        <el-dialog
          v-model="anchorDetailVisible"
          title="点位当前数据"
          width="520px"
          destroy-on-close
        >
          <div v-if="activeAnchorDetail" class="space-y-4">
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="点位名称">
                {{ activeAnchorDetail.name }}
              </el-descriptions-item>
              <el-descriptions-item label="点位类型">
                {{ activeAnchorDetail.type }}
              </el-descriptions-item>
              <el-descriptions-item label="数据绑定">
                {{ summarizeAnchorBinding(activeAnchorDetail) }}
              </el-descriptions-item>
              <el-descriptions-item label="当前值">
                {{
                  `${activeAnchorDetail.runtimeState?.value ?? "-"}${activeAnchorDetail.runtimeState?.unit || ""}`
                }}
              </el-descriptions-item>
              <el-descriptions-item label="展示文本">
                {{ activeAnchorDetail.runtimeState?.displayText || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="状态">
                {{ activeAnchorDetail.runtimeState?.status || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="来源">
                {{ activeAnchorDetail.runtimeState?.sourceName || "-" }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-dialog>

        <el-dialog
          v-model="videoDialogVisible"
          title="视频接入"
          width="640px"
          destroy-on-close
          @closed="runtimeStore.closeVideoDialog()"
        >
          <div v-if="activeCameraDetail" class="space-y-4">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="摄像头名称">
                {{ activeCameraDetail.cameraName || activeCameraDetail.name }}
              </el-descriptions-item>
              <el-descriptions-item label="摄像头类型">
                {{ activeCameraDetail.cameraType || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="流类型">
                {{ activeCameraDetail.streamType || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="接入状态">
                {{ activeCameraDetail.status || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="绑定设备">
                {{ activeCameraDetail.bindDeviceKks || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="打开方式">
                {{ activeCameraDetail.defaultWindowMode || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="接入地址" :span="2">
                <span class="break-all">{{
                  activeCameraDetail.streamUrl || "-"
                }}</span>
              </el-descriptions-item>
            </el-descriptions>

            <div
              v-loading="videoLoading"
              class="flex min-h-[260px] items-center justify-center rounded border border-[var(--el-border-color)] bg-[var(--el-fill-color-light)]"
            >
              <video
                v-if="videoPreviewSupported"
                ref="videoElementRef"
                controls
                playsinline
                class="max-h-[320px] w-full rounded"
              />
              <div
                v-else
                class="px-6 text-center text-sm text-[var(--el-text-color-secondary)]"
              >
                当前流类型暂不支持直接播放，可查看接入信息后切换到兼容播放器。
              </div>
            </div>
            <el-alert
              v-if="videoErrorText"
              :title="videoErrorText"
              type="error"
              :closable="false"
            />
          </div>
        </el-dialog>
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
  --dd-panel-width: 360px;
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

.dd-side-panel {
  position: fixed;
  top: var(--dd-panels-top);
  right: var(--dd-gap);
  bottom: var(--dd-bottom-reserve);
  z-index: 1100;
  width: var(--dd-panel-width);
  box-shadow: var(--el-box-shadow-light);
}

.dd-side-tabs :deep(.el-tabs__content) {
  height: calc(100% - 40px);
}

.dd-side-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.dd-quality-select {
  width: 110px;
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

.dd-anchor-picking-panel {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 3001;
  width: 360px;
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color-overlay);
  box-shadow: var(--el-box-shadow-light);
}

/* 底部工具栏：贴近“编辑器页”按钮风格（更紧凑、无多余间距、4px 圆角） */
.dd-bottombar-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: var(--el-bg-color-overlay);
}

@supports (backdrop-filter: blur(1px)) {
  .dd-bottombar-card {
    backdrop-filter: blur(10px) saturate(160%);
  }
}

.dd-bottombar-card :deep(.el-card__body) {
  padding: 10px 12px;
}

.dd-bottombar-card :deep(.el-button) {
  border-radius: 4px;
}

.dd-bottombar-card :deep(.el-button + .el-button) {
  margin-left: 0 !important;
}
</style>
