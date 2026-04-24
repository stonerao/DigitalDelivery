<script setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { message } from "@/utils/message";
import { ThreeModelViewer } from "@/3d";
import { getConfig } from "@/config";
import { useDdLinkageStoreHook } from "@/store/modules/ddLinkage";
import ModelPreviewUploadDialog from "@/views/handover/components/ModelPreviewUploadDialog.vue";
import {
  getHandoverModelDetail,
  getHandoverModelList,
  getHandoverModelUploadTask,
  uploadHandoverModel
} from "@/api/handoverModels";
import {
  getHandoverProjectDetail,
  updateHandoverProject
} from "@/api/handoverProjects";
import ViewerBottomToolbar from "./toolbars/ViewerBottomToolbar.vue";
import StructurePanel from "./panels/StructurePanel.vue";
import { buildTreeNodeIndex } from "./services/sceneTreeService";
import {
  createViewerSceneModel,
  normalizeViewerModelItem,
  parseViewerProjectInfo,
  readViewerApiRecords,
  serializeSceneModels,
  serializeSceneObjectBindings,
  unwrapViewerApiData
} from "./services/sceneProjectPersistenceService";
import { useViewerToolbarState } from "./services/useViewerToolbarState";

defineOptions({
  name: "Viewer3D"
});

const router = useRouter();
const route = useRoute();
const ddStore = useDdLinkageStoreHook();
const projectId = computed(() =>
  typeof route.query?.projectId === "string" ? route.query.projectId.trim() : ""
);

const modelOptions = ref([]);
const modelListLoading = ref(false);
const currentModel = ref("");
const selectedModelIds = ref([]);
const sceneModels = ref([]);
const projectRecord = ref(null);
const projectLoading = ref(false);
const projectSaving = ref(false);
const pendingProjectPayload = ref(null);
const persistedObjectBindings = ref([]);
const uploadVisible = ref(false);

const viewerRef = ref(null);
const ifcWasmPath = computed(() => `${import.meta.env.BASE_URL || "/"}wasm/`);

const activeSceneModel = computed(() => {
  return (
    sceneModels.value.find(item => item.instanceId === currentModel.value) ||
    sceneModels.value[0] ||
    null
  );
});

const currentModelUrl = computed(() => activeSceneModel.value?.modelUrl || "");
const currentModelName = computed(
  () => activeSceneModel.value?.modelName || ""
);

async function loadModels(showSuccess = false) {
  modelListLoading.value = true;
  try {
    const res = await getHandoverModelList({ page: 1, size: 100 });
    const data = unwrapViewerApiData(res);
    const rows = readViewerApiRecords(data).map(normalizeViewerModelItem);
    modelOptions.value = rows.map(item => ({
      label: item.name,
      value: item.id,
      raw: item
    }));
    if (showSuccess) {
      message("模型列表已刷新", { type: "success" });
    }
  } catch (error) {
    console.error("load viewer models failed", error);
    modelOptions.value = [];
    message("获取模型列表失败", { type: "error" });
  } finally {
    modelListLoading.value = false;
  }
}

async function loadModelDetailById(id) {
  if (!id) return null;

  try {
    const detailRes = await getHandoverModelDetail({ id });
    const detail = normalizeViewerModelItem(unwrapViewerApiData(detailRes));
    if (!detail.url) {
      message("当前模型缺少可预览地址", { type: "warning" });
    }
    return detail;
  } catch (error) {
    console.error("get viewer model detail failed", error);
    message("获取模型详情失败", { type: "error" });
    return null;
  }
}

async function syncSceneModelsByIds(ids = [], scenePayload = null) {
  const uniqueIds = Array.from(
    new Set((Array.isArray(ids) ? ids : []).filter(Boolean))
  );
  selectedModelIds.value = [...uniqueIds];

  if (uniqueIds.length === 0) {
    sceneModels.value = [];
    currentModel.value = "";
    return;
  }

  const detailList = (
    await Promise.all(uniqueIds.map(id => loadModelDetailById(id)))
  ).filter(Boolean);

  const nextSceneModels = detailList.map((detail, index) => {
    const partial =
      scenePayload?.models?.find(item => item.modelId === detail.id) || {};
    return createViewerSceneModel(
      detail,
      {
        ...partial,
        instanceId:
          partial.instanceId || `scene-model-${detail.id || index + 1}-${index}`
      },
      {
        defaultMetadata: {
          source: "handover-model"
        }
      }
    );
  });

  sceneModels.value = nextSceneModels;
  const preferredActiveId =
    scenePayload?.activeModelId &&
    nextSceneModels.find(item => item.modelId === scenePayload.activeModelId)
      ? nextSceneModels.find(
          item => item.modelId === scenePayload.activeModelId
        )?.instanceId
      : nextSceneModels[0]?.instanceId || "";
  currentModel.value = preferredActiveId;
}

async function applyModelFromRoute() {
  const id = typeof route.query?.id === "string" ? route.query.id.trim() : "";
  if (!id) return false;
  await syncSceneModelsByIds([id]);
  return true;
}

function normalizeActiveRightTab(value) {
  return value === "navigation" || !value ? "structure" : value;
}

function buildProjectInfoPayload() {
  const objectBindings = serializeSceneObjectBindings(sceneDevices.value);

  return {
    version: "2.0.0",
    schema: "dd-handover-project-scene",
    project: {
      id: projectId.value,
      name: projectRecord.value?.projectName || "",
      updatedAt: Date.now()
    },
    scene: {
      activeModelId: activeSceneModel.value?.modelId || "",
      models: serializeSceneModels(sceneModels.value),
      bindings: {
        objectBindings
      },
      anchors: [],
      cameras: [],
      measurements: [],
      schemes: sceneSchemes.value,
      bookmarks: bookmarks.value,
      assetGroups: [],
      clipping: null,
      clippingPresets: []
    },
    runtime: {
      activeTool: activeTool.value,
      measurementMode: measurementMode.value,
      displayMode: displayMode.value,
      transparentEnabled: transparent.value,
      roamingEnabled: roamingEnabled.value,
      showStats: showStats.value,
      activeSideTab: activeRightTab.value,
      pointMarkersVisible: pointMarkersVisible.value,
      selectedObjectRef:
        selectedObjectInfo.value?.objectUuid || selectedObjectInfo.value?.uuid
          ? {
              instanceId:
                selectedObjectInfo.value?.userData?.sceneModelInstanceId || "",
              objectUuid:
                selectedObjectInfo.value?.objectUuid ||
                selectedObjectInfo.value?.uuid ||
                ""
            }
          : null,
      selectedDeviceUuid: selectedDeviceUuid.value,
      selectedSystemNodeId: selectedSystemNodeId.value,
      selectedQuickKks: selectedQuickKks.value,
      currentNavNodeKey: currentNavNodeKey.value,
      layerCheckedObjectRefs: sceneDevices.value
        .filter(item => layerCheckedKeys.value.includes(item.uuid))
        .map(item => ({
          instanceId: item.instanceId || "",
          objectUuid: item.uuid
        }))
    },
    scripts: pendingProjectPayload.value?.scripts || {
      animations: [],
      triggers: []
    },
    integrations: pendingProjectPayload.value?.integrations || {
      realtime: {},
      backendBridge: {}
    }
  };
}

function applyPersistedBindings() {
  const bindings =
    pendingProjectPayload.value?.scene?.bindings?.objectBindings ||
    persistedObjectBindings.value ||
    [];
  if (!Array.isArray(bindings) || bindings.length === 0) return;

  sceneDevices.value.forEach(item => {
    const hit = bindings.find(binding => {
      return (
        binding?.instanceId === (item.instanceId || "") &&
        (binding?.objectUuid === item.uuid ||
          (binding?.path === item.path && binding?.objectName === item.name))
      );
    });
    if (!hit) return;
    item.kks = hit.businessBinding?.kks || "";
    item.nodeId = hit.businessBinding?.nodeId || "";
    item.systemName =
      hit.properties?.systemName || ddStore.getNodeLabel(item.nodeId) || "";
    item.status = hit.properties?.status || item.status || "-";
    item.name = hit.properties?.customName || hit.objectName || item.name;
  });
}

async function loadProjectContext() {
  if (!projectId.value) {
    projectRecord.value = null;
    pendingProjectPayload.value = null;
    persistedObjectBindings.value = [];
    return false;
  }

  projectLoading.value = true;
  try {
    const response = await getHandoverProjectDetail(projectId.value);
    projectRecord.value = unwrapViewerApiData(response);
    const payload = parseViewerProjectInfo(projectRecord.value?.projectInfo);
    pendingProjectPayload.value = payload;
    persistedObjectBindings.value =
      payload?.scene?.bindings?.objectBindings || [];

    if (Array.isArray(payload?.scene?.models) && payload.scene.models.length) {
      await syncSceneModelsByIds(
        payload.scene.models.map(item => item.modelId).filter(Boolean),
        payload.scene
      );
      bookmarks.value = Array.isArray(payload.scene.bookmarks)
        ? payload.scene.bookmarks
        : [];
      sceneSchemes.value = Array.isArray(payload.scene.schemes)
        ? payload.scene.schemes
        : [];
      activeRightTab.value = normalizeActiveRightTab(
        payload.runtime?.activeSideTab
      );
      pointMarkersVisible.value =
        payload.runtime?.pointMarkersVisible !== false;
      displayMode.value = payload.runtime?.displayMode || "all";
      selectedSystemNodeId.value = payload.runtime?.selectedSystemNodeId || "";
      selectedQuickKks.value = payload.runtime?.selectedQuickKks || "";
      currentNavNodeKey.value = payload.runtime?.currentNavNodeKey || "";
      showStats.value = Boolean(payload.runtime?.showStats);
      transparent.value = Boolean(payload.runtime?.transparentEnabled);
      roamingEnabled.value = Boolean(payload.runtime?.roamingEnabled);
      return true;
    }
    return false;
  } catch (error) {
    console.error("load project context failed", error);
    message(error?.message || "获取项目详情失败", { type: "error" });
    return false;
  } finally {
    projectLoading.value = false;
  }
}

async function saveCurrentProject() {
  if (!projectId.value) {
    message("当前页面未绑定项目，无法保存", { type: "warning" });
    return;
  }
  if (sceneModels.value.length === 0) {
    message("请先选择至少一个模型", { type: "warning" });
    return;
  }

  projectSaving.value = true;
  try {
    if (!projectRecord.value?.id) {
      const response = await getHandoverProjectDetail(projectId.value);
      projectRecord.value = unwrapViewerApiData(response);
    }
    const payload = buildProjectInfoPayload();
    await updateHandoverProject({
      id: projectId.value,
      projectName: projectRecord.value?.projectName || "",
      projectInfo: JSON.stringify(payload)
    });
    pendingProjectPayload.value = payload;
    persistedObjectBindings.value = payload.scene.bindings.objectBindings;
    message("已保存到当前项目", { type: "success" });
  } catch (error) {
    console.error("save current project failed", error);
    message(error?.message || "保存项目失败", { type: "error" });
  } finally {
    projectSaving.value = false;
  }
}

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

async function waitUploadTask(taskId) {
  if (!taskId) return;
  const doneStatus = ["done", "success", "completed", "finish", "finished"];
  const failedStatus = ["failed", "error"];

  for (let i = 0; i < 20; i++) {
    const res = await getHandoverModelUploadTask({ taskId });
    const data = unwrapViewerApiData(res);
    const status = String(data?.status || "").toLowerCase();
    if (doneStatus.some(s => status.includes(s))) return;
    if (failedStatus.some(s => status.includes(s))) {
      throw new Error("模型上传任务执行失败");
    }
    await sleep(1200);
  }
}

async function onConfirmUpload(payload) {
  const { file, thumbnail } = payload || {};
  if (!file) return;

  const formData = new FormData();
  formData.append("files", file, file.name || "model");
  formData.append("lod", "LOD300");
  formData.append("thumbnail", thumbnail, "thumbnail.jpg");

  try {
    const uploadRes = await uploadHandoverModel({ data: formData });
    const uploadData = unwrapViewerApiData(uploadRes);
    await waitUploadTask(uploadData?.taskId || "");
    message("模型已上传并完成入库", { type: "success" });
    await loadModels(true);
  } catch (error) {
    console.error("upload viewer model failed", error);
    message(error?.message || "上传模型失败", { type: "error" });
  }
}

onMounted(() => {
  loadModels().then(async () => {
    const loadedFromProject = await loadProjectContext();
    if (!loadedFromProject) {
      applyModelFromRoute();
    }
  });
});

watch(
  () => route.query?.id,
  () => {
    applyModelFromRoute();
  }
);

watch(
  () => route.query?.projectId,
  () => {
    loadProjectContext();
  }
);

async function onModelChanged(val) {
  await syncSceneModelsByIds(val);
}

const transparent = ref(false);
const showStats = ref(false);
const enableClipping = ref(false);
const projectionMode = ref("perspective");
const activeTool = ref("rotate");

const currentModelInfo = computed(() => activeSceneModel.value);

const roamingEnabled = ref(false);
const deviceKeyword = ref("");
const sceneDevices = ref([]);
const selectedDeviceUuid = ref("");
const selectedObjectInfo = ref(null);
const showObjectPanel = ref(false);
const bookmarks = ref([]);
const pointMarkersVisible = ref(true);
const selectedSystemNodeId = ref("");
const selectedQuickKks = ref("");
const displayMode = ref("all");
const activeRightTab = ref("structure");
const layerTreeRef = ref(null);
const layerCheckedKeys = ref([]);
const currentNavNodeKey = ref("");
const schemeName = ref("");
const sceneSchemes = ref([]);
const measurementMode = ref("distance");
const sceneTree = ref(null);
const treeFilterText = ref("");
const structureTreeRef = ref(null);
const selectedTreeNode = ref(null);
const treeDefaultExpandedKeys = ref([]);
const treeNodeIndex = ref(new Map());
const treeParentMap = ref(new Map());
const treeExpandedKeys = ref(new Set());
const meshOpacity = ref(0.2);
const treeV2Props = {
  value: "uuid",
  label: "name",
  children: "children"
};

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
  modelReady: computed(() => sceneModels.value.length > 0),
  selectedObjectInfo,
  bookmarks,
  activeTool,
  measurementMode,
  roamingEnabled,
  transparent,
  projectionMode,
  notify: message,
  syncRoamingState: () => {
    const value = viewerRef.value?.isFirstPerson;
    roamingEnabled.value =
      typeof value === "object" ? Boolean(value?.value) : Boolean(value);
  },
  disableRoaming: () => viewerRef.value?.toggleFirstPerson?.(false),
  toggleRoaming: () => viewerRef.value?.toggleFirstPerson?.(),
  zoomIn: () => viewerRef.value?.zoomIn?.(),
  zoomOut: () => viewerRef.value?.zoomOut?.(),
  resetView: () => viewerRef.value?.resetView?.(),
  toggleProjection: () => viewerRef.value?.toggleProjection?.(),
  setPresetView: preset => viewerRef.value?.setPresetView?.(preset),
  setMeasurementMode: mode => viewerRef.value?.setMeasurementMode?.(mode),
  clearMeasurements: () => viewerRef.value?.clearMeasurements?.(),
  takeScreenshot: () => {
    const filename = `bim-screenshot-${Date.now()}.png`;
    viewerRef.value?.downloadScreenshot?.(filename);
  },
  addBookmark: name => viewerRef.value?.addBookmark?.(name),
  appendBookmark: bookmark => {
    bookmarks.value.push(bookmark);
  },
  applyBookmark: bookmark => viewerRef.value?.applyBookmark?.(bookmark)
});

const VIEWER_SCHEME_STORAGE_KEY = "dd-viewer-scene-schemes";

function normalizeBindingText(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
}

function buildSceneDeviceRef(item) {
  if (!item) return null;
  return {
    uuid: item.uuid,
    kks: item.kks || "",
    name: item.name || "",
    path: item.path || "",
    nodeId: item.nodeId || ""
  };
}

const currentSceneSchemeScope = computed(() => {
  if (projectId.value) return `project:${projectId.value}`;
  return sceneModels.value
    .map(item => item.modelId || item.instanceId)
    .join("|");
});

const configuredObjectBindings = computed(() => {
  const fromViewerConfig = getConfig("Viewer3D.ModelObjectBindings");
  const fromRootConfig = getConfig("ModelObjectBindings");
  const bindings = Array.isArray(fromViewerConfig)
    ? fromViewerConfig
    : Array.isArray(fromRootConfig)
      ? fromRootConfig
      : [];

  return bindings
    .filter(item => item && item.kks)
    .map(item => ({
      kks: String(item.kks || "").trim(),
      nodeId: String(item.nodeId || "").trim(),
      matchAny: Array.isArray(item.matchAny)
        ? item.matchAny
            .map(entry => normalizeBindingText(entry))
            .filter(Boolean)
        : [],
      matchName: normalizeBindingText(item.matchName),
      matchPath: normalizeBindingText(item.matchPath),
      matchRegex: item.matchRegex ? String(item.matchRegex) : ""
    }));
});

const filteredSceneDevices = computed(() => {
  const keyword = deviceKeyword.value.trim().toLowerCase();
  if (!keyword) return sceneDevices.value;
  return sceneDevices.value.filter(item => {
    return (
      item.name.toLowerCase().includes(keyword) ||
      item.type.toLowerCase().includes(keyword) ||
      item.path.toLowerCase().includes(keyword)
    );
  });
});

const selectedSceneDevice = computed(() => {
  return (
    sceneDevices.value.find(item => item.uuid === selectedDeviceUuid.value) ||
    null
  );
});

const currentDeviceProfile = computed(() => {
  const kks = selectedSceneDevice.value?.kks;
  return kks ? ddStore.getDeviceProfileByKks(kks) : null;
});

const currentMeasurementPoints = computed(() => {
  const kks = selectedSceneDevice.value?.kks;
  if (!kks) return [];
  return ddStore.getMeasurementPointsByKks(kks).map(point => ({
    ...point,
    targetUuid: selectedSceneDevice.value.uuid
  }));
});

const sceneDeviceSystemOptions = computed(() => {
  const grouped = new Map();
  sceneDevices.value.forEach(item => {
    if (!item.nodeId) return;
    const existing = grouped.get(item.nodeId) || {
      label: item.systemName || ddStore.getNodeLabel(item.nodeId),
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

const displayModeText = computed(() => {
  const map = {
    all: "全部构件",
    business: "已绑定业务设备",
    system: "当前系统",
    selection: "当前设备",
    tree: "分层树筛选"
  };
  return map[displayMode.value] || "全部构件";
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

const GENERIC_SCENE_NODE_NAMES = new Set(["group", "object3d", "scene"]);

function normalizeSplitMeshName(name) {
  return String(name || "")
    .trim()
    .replace(/([_-]?\d+)+$/g, "")
    .trim();
}

function resolveMergedMeshGroupName(node, meshChildren) {
  const nodeName = String(node?.name || "").trim();
  if (nodeName && !GENERIC_SCENE_NODE_NAMES.has(nodeName.toLowerCase())) {
    return nodeName;
  }

  const childNames = meshChildren
    .map(child => normalizeSplitMeshName(child?.name))
    .filter(Boolean);
  const firstName = childNames[0] || "";
  if (firstName && childNames.every(name => name === firstName)) {
    return firstName;
  }

  return nodeName || firstName || String(node?.type || "构件").trim();
}

function flattenSceneMeshes(
  node,
  parents = [],
  list = [],
  currentInstanceId = ""
) {
  if (!node) return list;
  const nextInstanceId = node.sceneModelInstanceId || currentInstanceId || "";
  const children = Array.isArray(node.children) ? node.children : [];
  const meshChildren = children.filter(child => child?.isMesh);
  const shouldMergeSplitMeshes =
    !node.isMesh &&
    parents.length > 0 &&
    meshChildren.length > 1 &&
    meshChildren.length === children.length &&
    meshChildren.every(child => !child.children?.length && child?.uuid);

  if (shouldMergeSplitMeshes) {
    const mergedName = resolveMergedMeshGroupName(node, meshChildren);
    list.push({
      uuid: meshChildren[0].uuid,
      instanceId: nextInstanceId,
      name: mergedName || `构件 ${list.length + 1}`,
      type: node.type || "Group",
      path: [...parents, mergedName].filter(Boolean).join(" / "),
      meshUuids: meshChildren.map(child => child.uuid)
    });
    return list;
  }

  const baseName = String(node.name || node.type || "未命名构件").trim();
  const nextParents = baseName ? [...parents, baseName] : parents;

  if (node.isMesh) {
    list.push({
      uuid: node.uuid,
      instanceId: nextInstanceId,
      name: baseName || `构件 ${list.length + 1}`,
      type: node.type || "Mesh",
      path: nextParents.join(" / ")
    });
  }

  children.forEach(child => {
    flattenSceneMeshes(child, nextParents, list, nextInstanceId);
  });

  return list;
}

function getBusinessBinding(index) {
  const businessDevices = ddStore.kksItems.filter(item => item.type === "设备");
  if (!businessDevices.length) return null;
  return businessDevices[index % businessDevices.length];
}

function resolveBusinessBinding(item, index, usedKks = new Set()) {
  const businessDevices = ddStore.kksItems.filter(
    device => device.type === "设备"
  );
  if (!businessDevices.length) return null;

  const rawTexts = [item.name, item.path, `${item.name} ${item.path}`];
  const normalizedTexts = rawTexts.map(normalizeBindingText);

  const configuredBinding = configuredObjectBindings.value.find(binding => {
    if (!binding?.kks || usedKks.has(binding.kks)) return false;

    if (binding.matchAny.length) {
      const matched = binding.matchAny.some(keyword => {
        return normalizedTexts.some(
          text => text && keyword && text.includes(keyword)
        );
      });
      if (matched) return true;
    }

    if (
      binding.matchName &&
      normalizedTexts.some(text => text && text.includes(binding.matchName))
    ) {
      return true;
    }

    if (
      binding.matchPath &&
      normalizeBindingText(item.path).includes(binding.matchPath)
    ) {
      return true;
    }

    if (binding.matchRegex) {
      try {
        const regex = new RegExp(binding.matchRegex, "i");
        return rawTexts.some(text => regex.test(String(text || "")));
      } catch {
        return false;
      }
    }

    return false;
  });

  if (configuredBinding) {
    const configuredDevice =
      businessDevices.find(device => device.kks === configuredBinding.kks) ||
      null;
    if (configuredDevice?.kks) {
      usedKks.add(configuredDevice.kks);
      return {
        ...configuredDevice,
        nodeId: configuredBinding.nodeId || configuredDevice.nodeId || ""
      };
    }
  }

  const exactKks = businessDevices.find(device => {
    if (usedKks.has(device.kks)) return false;
    const normalizedKks = normalizeBindingText(device.kks);
    return normalizedTexts.some(text => text && text.includes(normalizedKks));
  });
  if (exactKks) {
    usedKks.add(exactKks.kks);
    return exactKks;
  }

  const byName = businessDevices.find(device => {
    if (usedKks.has(device.kks)) return false;
    const normalizedName = normalizeBindingText(device.name);
    return normalizedTexts.some(text => {
      return (
        text &&
        normalizedName &&
        (text.includes(normalizedName) || normalizedName.includes(text))
      );
    });
  });
  if (byName) {
    usedKks.add(byName.kks);
    return byName;
  }

  const fallback =
    businessDevices.find(device => !usedKks.has(device.kks)) ||
    getBusinessBinding(index);
  if (fallback?.kks) usedKks.add(fallback.kks);
  return fallback || null;
}

function getStoredSceneSchemeMap() {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    return JSON.parse(
      window.localStorage.getItem(VIEWER_SCHEME_STORAGE_KEY) || "{}"
    );
  } catch {
    return {};
  }
}

function persistSceneSchemes() {
  if (typeof window === "undefined" || !window.localStorage) return;
  const allSchemes = getStoredSceneSchemeMap();
  allSchemes[currentSceneSchemeScope.value] = sceneSchemes.value;
  window.localStorage.setItem(
    VIEWER_SCHEME_STORAGE_KEY,
    JSON.stringify(allSchemes)
  );
}

function loadSceneSchemes() {
  if (!currentModelUrl.value) {
    sceneSchemes.value = [];
    return;
  }
  const allSchemes = getStoredSceneSchemeMap();
  sceneSchemes.value = Array.isArray(allSchemes[currentSceneSchemeScope.value])
    ? allSchemes[currentSceneSchemeScope.value]
    : [];
}

function resolveSceneSchemeUuids(deviceRefs = []) {
  return deviceRefs
    .map(ref => {
      if (!ref) return null;
      if (ref.kks) {
        const byKks = sceneDevices.value.find(item => item.kks === ref.kks);
        if (byKks) return byKks.uuid;
      }
      return (
        sceneDevices.value.find(item => {
          return item.name === ref.name && item.path === ref.path;
        })?.uuid || null
      );
    })
    .filter(Boolean);
}

function refreshSceneDevices() {
  const tree = viewerRef.value?.getSceneTree?.();
  if (!tree) {
    sceneDevices.value = [];
    return;
  }
  const usedKks = new Set();
  sceneDevices.value = flattenSceneMeshes(tree)
    .filter(item => item.uuid)
    .map((item, index) => {
      const binding = resolveBusinessBinding(item, index, usedKks);
      const profile = binding
        ? ddStore.getDeviceProfileByKks(binding.kks)
        : null;
      return {
        ...item,
        kks: binding?.kks || "",
        nodeId: binding?.nodeId || "",
        status: binding?.status || "-",
        systemName:
          profile?.systemName || ddStore.getNodeLabel(binding?.nodeId || "")
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  applyPersistedBindings();
}

function refreshSceneTree() {
  const tree = viewerRef.value?.getSceneTree?.() || null;
  sceneTree.value = tree;
  const { nodeMap, parentMap } = buildTreeNodeIndex(tree);
  treeNodeIndex.value = nodeMap;
  treeParentMap.value = parentMap;
  treeExpandedKeys.value = new Set();
  treeDefaultExpandedKeys.value = tree?.uuid ? [tree.uuid] : [];
  if (tree?.uuid) {
    treeExpandedKeys.value.add(tree.uuid);
  }
}

function syncNavigationSelections(item) {
  if (!item) return;
  selectedSystemNodeId.value = item.nodeId || "";
  selectedQuickKks.value = item.kks || "";
}

function getDevicesBySystem(nodeId) {
  if (!nodeId) return [];
  return sceneDevices.value.filter(item => item.nodeId === nodeId);
}

function getSceneDeviceUuids(item) {
  const uuids = Array.isArray(item?.meshUuids) ? item.meshUuids : [];
  return uuids.length ? uuids.filter(Boolean) : item?.uuid ? [item.uuid] : [];
}

function getSceneDevicesUuids(items = []) {
  return items.flatMap(item => getSceneDeviceUuids(item));
}

function syncLayerTreeSelection(keys = allLayerLeafKeys.value) {
  layerCheckedKeys.value = [...keys];
  nextTick(() => {
    layerTreeRef.value?.setCheckedKeys?.(layerCheckedKeys.value);
  });
}

function buildCurrentSceneSchemePayload(name) {
  const visibleRefs = sceneDevices.value
    .filter(item => layerCheckedKeys.value.includes(item.uuid))
    .map(buildSceneDeviceRef)
    .filter(Boolean);

  return {
    id: `scene-scheme-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    name,
    scope: currentSceneSchemeScope.value,
    savedAt: Date.now(),
    displayMode: displayMode.value,
    selectedSystemNodeId: selectedSystemNodeId.value,
    selectedQuickKks: selectedQuickKks.value,
    activeRightTab: activeRightTab.value,
    pointMarkersVisible: pointMarkersVisible.value,
    visibleDeviceRefs: visibleRefs
  };
}

function saveSceneScheme() {
  if (!currentModelUrl.value) {
    message("请先加载模型后再保存场景方案", { type: "warning" });
    return;
  }
  const name =
    schemeName.value.trim() || `场景方案 ${sceneSchemes.value.length + 1}`;
  const payload = buildCurrentSceneSchemePayload(name);
  sceneSchemes.value.unshift(payload);
  persistSceneSchemes();
  schemeName.value = "";
  message(`已保存场景方案：${name}`, { type: "success" });
}

function applySceneScheme(scheme) {
  if (!scheme || !viewerRef.value) return;

  const visibleKeys = resolveSceneSchemeUuids(scheme.visibleDeviceRefs || []);
  selectedSystemNodeId.value = scheme.selectedSystemNodeId || "";
  selectedQuickKks.value = scheme.selectedQuickKks || "";
  activeRightTab.value = normalizeActiveRightTab(scheme.activeRightTab);
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

  syncMeasurementPoints();
  message(`已应用场景方案：${scheme.name}`, { type: "success" });
}

function removeSceneScheme(id) {
  sceneSchemes.value = sceneSchemes.value.filter(item => item.id !== id);
  persistSceneSchemes();
  message("已删除场景方案", { type: "success" });
}

function formatSchemeTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = num => String(num).padStart(2, "0");
  return `${date.getMonth() + 1}-${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function syncMeasurementPoints() {
  if (!viewerRef.value) return;
  viewerRef.value.setLinkedPointsVisible?.(pointMarkersVisible.value);
  if (!pointMarkersVisible.value) {
    viewerRef.value.clearLinkedPoints?.();
    return;
  }
  viewerRef.value.setLinkedPoints?.(currentMeasurementPoints.value);
}

function handleViewerLoaded() {
  nextTick(() => {
    viewerRef.value?.resetView?.();
  });
  refreshSceneTree();
  refreshSceneDevices();
  syncRoamingState();
  syncMeasurementPoints();
  syncLayerTreeSelection();
  loadSceneSchemes();
}

function locateDevice(item, withMessage = true) {
  if (!item?.uuid) return;
  viewerRef.value?.selectByUUID?.(item.uuid);
  viewerRef.value?.highlightByUUID?.(item.uuid);
  viewerRef.value?.focusByUUIDs?.(getSceneDeviceUuids(item));
  selectedDeviceUuid.value = item.uuid;
  syncNavigationSelections(item);
  if (withMessage) {
    message(`已定位到构件：${item.name}`, { type: "success" });
  }
}

function locateSystem(nodeId = selectedSystemNodeId.value, withMessage = true) {
  const devices = getDevicesBySystem(nodeId);
  if (!devices.length) {
    message("当前系统暂无可定位构件", { type: "warning" });
    return;
  }
  selectedSystemNodeId.value = nodeId;
  selectedDeviceUuid.value = devices[0].uuid;
  syncNavigationSelections(devices[0]);
  viewerRef.value?.highlightByUUID?.(devices[0].uuid);
  viewerRef.value?.focusByUUIDs?.(getSceneDevicesUuids(devices));
  if (withMessage) {
    message(
      `已定位到系统：${devices[0].systemName || ddStore.getNodeLabel(nodeId)}`,
      {
        type: "success"
      }
    );
  }
}

function locateByKks(kks = selectedQuickKks.value) {
  if (!kks) {
    message("请先选择一个 KKS 设备", { type: "warning" });
    return;
  }
  const target = sceneDevices.value.find(item => item.kks === kks);
  if (!target) {
    message("当前模型中未找到该 KKS 对应构件", { type: "warning" });
    return;
  }
  locateDevice(target);
}

function isolateDevice(item = selectedSceneDevice.value, withMessage = true) {
  if (!item?.uuid) {
    message("请先选择一个构件", { type: "warning" });
    return;
  }
  viewerRef.value?.selectByUUID?.(item.uuid);
  viewerRef.value?.highlightByUUID?.(item.uuid);
  viewerRef.value?.showOnlyUUIDs?.(getSceneDeviceUuids(item));
  viewerRef.value?.focusByUUIDs?.(getSceneDeviceUuids(item));
  selectedDeviceUuid.value = item.uuid;
  syncNavigationSelections(item);
  displayMode.value = "selection";
  if (withMessage) {
    message(`已隔离显示：${item.name}`, { type: "success" });
  }
}

function structureFilterMethod(query, node) {
  const keyword = String(query || "")
    .trim()
    .toLowerCase();
  if (!keyword) return true;
  return String(node?.name || "")
    .trim()
    .toLowerCase()
    .includes(keyword);
}

function handleTreeNodeExpand(data) {
  if (data?.uuid) treeExpandedKeys.value.add(data.uuid);
}

function handleTreeNodeCollapse(data) {
  if (data?.uuid) treeExpandedKeys.value.delete(data.uuid);
}

function expandTreeToUUID(uuid) {
  const keys = new Set(treeExpandedKeys.value);
  let current = uuid;
  while (current) {
    const parentUuid = treeParentMap.value.get(current);
    if (parentUuid) keys.add(parentUuid);
    current = parentUuid;
  }
  treeExpandedKeys.value = keys;
  structureTreeRef.value?.setExpandedKeys?.([...keys]);
}

function scrollCurrentTreeNodeIntoView(uuid) {
  structureTreeRef.value?.scrollTo?.(uuid);
}

async function selectTreeNodeByUUID(uuid, { openPanel = false } = {}) {
  if (!uuid) return false;
  if (openPanel) {
    activeRightTab.value = "structure";
  }
  if (!sceneTree.value) {
    refreshSceneTree();
  }
  selectedTreeNode.value = treeNodeIndex.value.get(uuid) || null;
  await nextTick();
  structureTreeRef.value?.setCurrentKey?.(uuid);
  expandTreeToUUID(uuid);
  await nextTick();
  scrollCurrentTreeNodeIntoView(uuid);
  return true;
}

function handleStructureNodeClick(node) {
  selectedTreeNode.value = node || null;
  if (!node?.uuid) return;
  const target = sceneDevices.value.find(item => item.uuid === node.uuid) || {
    uuid: node.uuid,
    name: node.name || "未命名构件",
    path: node.name || "",
    type: node.type || "Mesh",
    meshUuids: [node.uuid],
    kks: "",
    nodeId: ""
  };
  locateDevice(target, false);
}

function focusSelectedNode() {
  if (!selectedTreeNode.value?.uuid) return;
  viewerRef.value?.focusByUUID?.(selectedTreeNode.value.uuid);
}

function makeSelectedMeshTransparent() {
  if (!selectedTreeNode.value?.isMesh) return;
  viewerRef.value?.setMeshOpacityByUUID?.(
    selectedTreeNode.value.uuid,
    meshOpacity.value
  );
}

function restoreSelectedMeshOpacity() {
  if (!selectedTreeNode.value?.isMesh) return;
  viewerRef.value?.setMeshOpacityByUUID?.(selectedTreeNode.value.uuid, 1);
}

function handleStructureFilterUpdate(value) {
  treeFilterText.value = value || "";
  structureTreeRef.value?.filter?.(treeFilterText.value);
}

function handleMeshOpacityUpdate(value) {
  meshOpacity.value = Number(value) || 0.2;
}

async function isolateSelectedNode() {
  if (!selectedTreeNode.value?.uuid) return;
  viewerRef.value?.isolateByUUID?.(selectedTreeNode.value.uuid);
  syncLayerTreeSelection([selectedTreeNode.value.uuid]);
  await nextTick();
  refreshSceneTree();
}

async function showAllObjects() {
  viewerRef.value?.clearIsolation?.();
  syncLayerTreeSelection();
  await nextTick();
  refreshSceneTree();
}

// ---- 导航树右键菜单 & 属性编辑 ----
const ctxMenuVisible = ref(false);
const ctxMenuStyle = ref({ top: "0px", left: "0px" });
const ctxMenuNode = ref(null);
const ctxMenuIsDevice = computed(() => ctxMenuNode.value?.kind === "device");

function handleNavTreeContextMenu(event, data) {
  event.preventDefault();
  event.stopPropagation();
  ctxMenuNode.value = data;
  ctxMenuStyle.value = {
    top: `${event.clientY}px`,
    left: `${event.clientX}px`
  };
  ctxMenuVisible.value = true;

  const closeMenu = () => {
    ctxMenuVisible.value = false;
    document.removeEventListener("click", closeMenu, true);
    document.removeEventListener("contextmenu", closeMenu, true);
  };
  setTimeout(() => {
    document.addEventListener("click", closeMenu, true);
    document.addEventListener("contextmenu", closeMenu, true);
  }, 0);
}

function getCtxMenuDevice() {
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

function onCtxViewObjectInfo() {
  ctxMenuVisible.value = false;
  const device = getCtxMenuDevice();
  if (!device?.uuid) {
    message("当前节点不是构件节点，无法查看构件属性", {
      type: "warning"
    });
    return;
  }

  selectedDeviceUuid.value = device.uuid;
  syncNavigationSelections(device);
  viewerRef.value?.focusByUUIDs?.(getSceneDeviceUuids(device));

  const selected = viewerRef.value?.selectByUUID?.(device.uuid, {
    emitEvent: true
  });
  if (selected) {
    showObjectPanel.value = true;
    return;
  }

  const info = viewerRef.value?.getSelectedObject?.();
  if (info) {
    onObjectSelect(info);
    return;
  }

  message("当前构件无法查看属性，请确认模型已加载", {
    type: "warning"
  });
}

const propDialogVisible = ref(false);
const propDialogMode = ref("bind");
const propEditForm = ref({
  kks: "",
  nodeId: "",
  systemName: "",
  name: "",
  status: ""
});

const propKksOptions = computed(() => {
  const rawName = String(
    ctxMenuNode.value?.raw?.name || ctxMenuNode.value?.label || ""
  );
  const normalizedName = normalizeBindingText(rawName);

  return ddStore.kksItems
    .map(item => {
      const systemName = ddStore.getNodeLabel(item.nodeId) || "";
      const optionText = [item.kks, item.name, systemName, item.type]
        .filter(Boolean)
        .join(" ");
      const matchedByName =
        normalizedName &&
        normalizeBindingText(`${item.name} ${item.kks} ${systemName}`).includes(
          normalizedName
        );

      return {
        value: item.kks,
        label: item.kks,
        name: item.name || "",
        type: item.type || "",
        status: item.status || "",
        nodeId: item.nodeId || "",
        systemName,
        optionText,
        score: matchedByName ? 0 : item.type === "设备" ? 1 : 2
      };
    })
    .sort(
      (a, b) => a.score - b.score || a.value.localeCompare(b.value, "zh-CN")
    );
});

function getCtxDeviceProps() {
  const node = ctxMenuNode.value;
  if (!node)
    return { kks: "", nodeId: "", systemName: "", name: "", status: "" };
  const raw = node.raw || node;
  return {
    kks: raw.kks || "",
    nodeId: raw.nodeId || node.nodeId || "",
    systemName: raw.systemName || "",
    name: raw.name || node.label || "",
    status: raw.status || ""
  };
}

function onPropKksChange(kks) {
  const selected = ddStore.kksItems.find(item => item.kks === kks);
  if (!selected) {
    propEditForm.value.nodeId = "";
    propEditForm.value.systemName = "";
    propEditForm.value.status = "";
    return;
  }

  propEditForm.value.nodeId = selected.nodeId || "";
  propEditForm.value.systemName = ddStore.getNodeLabel(selected.nodeId) || "";
  propEditForm.value.status = selected.status || "-";
}

function onCtxBindProp() {
  ctxMenuVisible.value = false;
  propDialogMode.value = "bind";
  const node = ctxMenuNode.value;
  const name = node?.raw?.name || node?.label || "";
  propEditForm.value = {
    kks: "",
    nodeId: node?.nodeId || "",
    systemName: "",
    name,
    status: ""
  };
  propDialogVisible.value = true;
}

function onCtxEditProp() {
  ctxMenuVisible.value = false;
  propDialogMode.value = "edit";
  propEditForm.value = { ...getCtxDeviceProps() };
  propDialogVisible.value = true;
}

function onCtxClearProp() {
  ctxMenuVisible.value = false;
  const node = ctxMenuNode.value;
  const raw = node?.raw;
  if (raw) {
    raw.kks = "";
    raw.nodeId = "";
    raw.systemName = "";
    raw.status = "-";
    const device = sceneDevices.value.find(d => d.uuid === raw.uuid);
    if (device) {
      device.kks = "";
      device.nodeId = "";
      device.systemName = "";
      device.status = "-";
    }
  }
  message("已清空该构件属性", { type: "success" });
}

const propDialogTitle = computed(() => {
  const map = { bind: "绑定属性", edit: "修改属性", clear: "清空属性" };
  return map[propDialogMode.value] || "属性";
});

function confirmPropDialog() {
  const form = propEditForm.value;
  const node = ctxMenuNode.value;
  const raw = node?.raw;

  if (propDialogMode.value === "bind" && !form.kks) {
    message("请输入 KKS 编码", { type: "warning" });
    return;
  }

  if (raw) {
    raw.kks = form.kks;
    raw.nodeId = form.nodeId;
    raw.systemName = form.systemName;
    raw.name = form.name;
    raw.status = form.status || "-";

    const device = sceneDevices.value.find(d => d.uuid === raw.uuid);
    if (device) {
      device.kks = form.kks;
      device.nodeId = form.nodeId;
      device.systemName = form.systemName;
      device.name = form.name;
      device.status = form.status || "-";
    }
  }

  propDialogVisible.value = false;
  message(propDialogMode.value === "bind" ? "属性已绑定" : "属性已更新", {
    type: "success"
  });
}

function applyLayerVisibility(keys) {
  if (!viewerRef.value) return;

  const visibleKeys = Array.isArray(keys) ? keys : [];
  if (visibleKeys.length === allLayerLeafKeys.value.length) {
    viewerRef.value?.filterVisibleUUIDs?.(null);
    displayMode.value = "all";
    return;
  }

  const visibleUuids = sceneDevices.value
    .filter(item => visibleKeys.includes(item.uuid))
    .flatMap(item => getSceneDeviceUuids(item));
  viewerRef.value?.filterVisibleUUIDs?.(visibleUuids);
  displayMode.value = "tree";
}

function handleLayerTreeCheck() {
  const keys = layerTreeRef.value?.getCheckedKeys?.(true) || [];
  layerCheckedKeys.value = [...keys];
  applyLayerVisibility(layerCheckedKeys.value);
}

function applyDisplayMode(mode, withMessage = true) {
  if (!viewerRef.value) return;

  if (mode === "all") {
    viewerRef.value?.clearIsolation?.();
    displayMode.value = "all";
    syncLayerTreeSelection();
    if (withMessage) {
      message("已恢复全部构件显示", { type: "success" });
    }
    return;
  }

  if (mode === "business") {
    const devices = sceneDevices.value.filter(item => item.kks);
    if (!devices.length) {
      message("当前模型暂无已绑定业务设备", { type: "warning" });
      return;
    }
    viewerRef.value?.showOnlyUUIDs?.(getSceneDevicesUuids(devices));
    viewerRef.value?.focusByUUIDs?.(getSceneDevicesUuids(devices));
    displayMode.value = "business";
    syncLayerTreeSelection(devices.map(item => item.uuid));
    if (withMessage) {
      message(`已切换为仅显示已绑定设备，共 ${devices.length} 个`, {
        type: "success"
      });
    }
    return;
  }

  if (mode === "system") {
    const devices = getDevicesBySystem(selectedSystemNodeId.value);
    if (!devices.length) {
      message("请先选择一个系统", { type: "warning" });
      return;
    }
    viewerRef.value?.showOnlyUUIDs?.(getSceneDevicesUuids(devices));
    viewerRef.value?.focusByUUIDs?.(getSceneDevicesUuids(devices));
    selectedDeviceUuid.value = devices[0].uuid;
    displayMode.value = "system";
    syncLayerTreeSelection(devices.map(item => item.uuid));
    if (withMessage) {
      message(`已切换为仅显示系统：${devices[0].systemName}`, {
        type: "success"
      });
    }
    return;
  }

  if (mode === "selection") {
    const target = selectedSceneDevice.value;
    if (!target?.uuid) {
      message("请先在场景或列表中选择一个构件", { type: "warning" });
      return;
    }
    isolateDevice(target, false);
    displayMode.value = "selection";
    syncLayerTreeSelection([target.uuid]);
    if (withMessage) {
      message(`已切换为仅显示当前设备：${target.name}`, { type: "success" });
    }
  }
}

const clippingAxis = ref("x");
const clippingPosition = ref(0.5);

function toggleClipping() {
  enableClipping.value = !enableClipping.value;
  if (enableClipping.value) applyPreviewClipping();
  message(enableClipping.value ? "已开启剖切模式" : "已关闭剖切模式", {
    type: "info"
  });
}

function applyPreviewClipping() {
  viewerRef.value?.setClippingPosition?.(
    clippingAxis.value,
    clippingPosition.value
  );
}

watch(enableClipping, value => {
  if (!value) return;
  applyPreviewClipping();
});

watch([clippingAxis, clippingPosition], () => {
  if (!enableClipping.value) return;
  applyPreviewClipping();
});

function exportMeasurements() {
  message("当前页面暂未接入测量结果导出", { type: "warning" });
}

function onObjectSelect(info) {
  selectedObjectInfo.value = info;
  selectedDeviceUuid.value = info?.uuid || "";
  const device = sceneDevices.value.find(item => item.uuid === info?.uuid);
  syncNavigationSelections(device);
  showObjectPanel.value = true;
  if (info?.uuid) {
    selectTreeNodeByUUID(info.uuid);
  }
  syncMeasurementPoints();
}

function closeObjectPanel() {
  showObjectPanel.value = false;
  viewerRef.value?.clearSelection?.();
}

function openFullscreen() {
  if (!currentModelUrl.value) return;
  if (sceneModels.value.length !== 1) {
    message("多模型场景暂不支持进入全屏编辑，请先保留一个主模型", {
      type: "warning"
    });
    return;
  }
  router.push({
    path: "/visualization/3d-fullscreen",
    query: {
      id: activeSceneModel.value?.modelId || "",
      url: currentModelUrl.value,
      name: currentModelName.value || currentModelInfo.value?.label || "",
      projectId: projectId.value || ""
    }
  });
}

const selectedRegion = ref("all");

function setRegion(value) {
  selectedRegion.value = value;
  const map = {
    boiler: "锅炉区域",
    control: "控制室",
    cooling: "冷却塔",
    all: "全部显示"
  };
  message(`视频联动：${map[value]}`, { type: "info" });
}

function openVideoPage() {
  router.push({
    path: "/visualization/video",
    query: { region: selectedRegion.value }
  });
}

watch(
  () => sceneModels.value.map(item => item.instanceId).join("|"),
  () => {
    viewerRef.value?.toggleFirstPerson?.(false);
    roamingEnabled.value = false;
    sceneDevices.value = [];
    deviceKeyword.value = "";
    selectedDeviceUuid.value = "";
    selectedSystemNodeId.value = "";
    selectedQuickKks.value = "";
    displayMode.value = "all";
    activeRightTab.value = "structure";
    currentNavNodeKey.value = "";
    layerCheckedKeys.value = [];
    sceneTree.value = null;
    treeFilterText.value = "";
    selectedTreeNode.value = null;
    treeDefaultExpandedKeys.value = [];
    treeNodeIndex.value = new Map();
    treeParentMap.value = new Map();
    treeExpandedKeys.value = new Set();
    selectedObjectInfo.value = null;
    showObjectPanel.value = false;
    viewerRef.value?.clearIsolation?.();
    viewerRef.value?.clearLinkedPoints?.();
    if (!pendingProjectPayload.value?.scene?.schemes?.length) {
      loadSceneSchemes();
    }
  }
);

watch(
  () => [selectedDeviceUuid.value, pointMarkersVisible.value],
  () => {
    syncMeasurementPoints();
  }
);
</script>

<template>
  <div class="dd-page">
    <div class="mb-4 overflow-x-auto">
      <div class="flex min-w-max items-center justify-between gap-4">
        <div class="flex items-center gap-2 whitespace-nowrap">
          <el-button type="primary" @click="uploadVisible = true">
            上传模型
          </el-button>
          <el-select
            v-model="selectedModelIds"
            class="viewer-model-select"
            size="default"
            :loading="modelListLoading"
            multiple
            collapse-tags
            collapse-tags-tooltip
            clearable
            placeholder="选择一个或多个模型"
            @change="onModelChanged"
          >
            <el-option
              v-for="m in modelOptions"
              :key="m.value"
              :label="m.label"
              :value="m.value"
            />
          </el-select>
          <el-select
            v-if="sceneModels.length > 0"
            v-model="currentModel"
            class="viewer-model-select"
            size="default"
            placeholder="当前主模型"
          >
            <el-option
              v-for="item in sceneModels"
              :key="item.instanceId"
              :label="item.modelName"
              :value="item.instanceId"
            />
          </el-select>
          <el-button
            type="primary"
            plain
            :loading="projectSaving"
            @click="saveCurrentProject"
          >
            保存到当前项目
          </el-button>
          <el-checkbox v-model="showStats" size="small">性能统计</el-checkbox>
        </div>
        <div
          class="shrink-0 text-xs whitespace-nowrap text-[var(--el-text-color-secondary)]"
        >
          {{
            projectLoading
              ? "项目加载中..."
              : projectRecord?.projectName
                ? `当前项目：${projectRecord.projectName}`
                : "未绑定项目"
          }}
        </div>
      </div>
    </div>

    <div class="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div class="relative rounded overflow-hidden" style="height: 500px">
        <ThreeModelViewer
          ref="viewerRef"
          :model-url="currentModelUrl"
          :model-name="currentModelName"
          :scene-models="sceneModels"
          :transparent="transparent"
          :use-basic-material="true"
          :interaction-mode="interactionMode"
          :ifc-wasm-path="ifcWasmPath"
          :show-stats="showStats"
          :enable-clipping="enableClipping"
          @scene-click="openFullscreen"
          @object-select="onObjectSelect"
          @loaded="handleViewerLoaded"
        />

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

        <el-card
          v-if="enableClipping"
          shadow="never"
          class="absolute right-3 top-3 w-[200px]"
        >
          <template #header>
            <span class="font-semibold text-sm">剖切控制</span>
          </template>
          <div class="space-y-3">
            <div>
              <div class="mb-2 text-xs text-[var(--el-text-color-secondary)]">
                剖切轴向
              </div>
              <el-segmented
                v-model="clippingAxis"
                :options="[
                  { label: 'X', value: 'x' },
                  { label: 'Y', value: 'y' },
                  { label: 'Z', value: 'z' }
                ]"
                size="small"
              />
            </div>
            <div>
              <div class="mb-1 flex items-center justify-between text-xs">
                <span class="text-[var(--el-text-color-secondary)]">位置</span>
                <span>{{ Math.round(clippingPosition * 100) }}%</span>
              </div>
              <el-slider
                v-model="clippingPosition"
                :min="0"
                :max="1"
                :step="0.01"
                size="small"
              />
            </div>
          </div>
        </el-card>
      </div>

      <el-card shadow="never" class="min-h-[500px]">
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <div class="font-semibold">模型结构与设备</div>
            <div class="text-xs text-[var(--el-text-color-secondary)]">
              共 {{ sceneDevices.length }} 个构件
            </div>
          </div>
        </template>

        <el-tabs v-model="activeRightTab" class="viewer-side-tabs">
          <el-tab-pane label="当前模型结构" name="structure">
            <StructurePanel
              ref="structureTreeRef"
              class="h-[420px]"
              :scene-tree="sceneTree"
              :tree-v2-props="treeV2Props"
              :tree-default-expanded-keys="treeDefaultExpandedKeys"
              :tree-filter-text="treeFilterText"
              :filter-method="structureFilterMethod"
              :selected-tree-node="selectedTreeNode"
              :mesh-opacity="meshOpacity"
              :active="activeRightTab === 'structure'"
              @refresh-tree="refreshSceneTree"
              @update:tree-filter-text="handleStructureFilterUpdate"
              @tree-node-click="handleStructureNodeClick"
              @tree-node-expand="handleTreeNodeExpand"
              @tree-node-collapse="handleTreeNodeCollapse"
              @focus-selected-node="focusSelectedNode"
              @make-selected-mesh-transparent="makeSelectedMeshTransparent"
              @restore-selected-mesh-opacity="restoreSelectedMeshOpacity"
              @isolate-selected-node="isolateSelectedNode"
              @show-all-objects="showAllObjects"
              @update:mesh-opacity="handleMeshOpacityUpdate"
            />
          </el-tab-pane>

          <el-tab-pane label="设备" name="devices">
            <el-input
              v-model="deviceKeyword"
              clearable
              placeholder="搜索设备名称/类型/路径"
              class="mb-3"
            />

            <div class="mb-3 text-xs text-[var(--el-text-color-secondary)]">
              点击列表项可在场景中高亮并定位到对应构件。
            </div>

            <el-scrollbar height="360px">
              <div v-if="filteredSceneDevices.length > 0" class="space-y-2">
                <div
                  v-for="item in filteredSceneDevices"
                  :key="item.uuid"
                  class="rounded border px-3 py-2 transition cursor-pointer"
                  :class="
                    item.uuid === selectedDeviceUuid
                      ? 'border-[var(--el-color-primary)] bg-[var(--el-color-primary-light-9)]'
                      : 'border-[var(--el-border-color)] hover:border-[var(--el-color-primary-light-5)]'
                  "
                  @click="locateDevice(item, false)"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <div class="truncate text-sm font-semibold">
                        {{ item.name }}
                      </div>
                      <div
                        class="truncate text-xs text-[var(--el-text-color-secondary)]"
                      >
                        {{
                          item.kks ? `${item.type} · ${item.kks}` : item.type
                        }}
                      </div>
                      <div
                        class="mt-1 line-clamp-2 text-xs text-[var(--el-text-color-secondary)]"
                      >
                        {{ item.path }}
                      </div>
                      <div
                        class="mt-1 text-xs text-[var(--el-text-color-secondary)]"
                      >
                        {{ item.systemName || "未绑定系统" }} /
                        {{ item.status || "-" }}
                      </div>
                    </div>
                    <div class="flex flex-col items-end">
                      <el-button
                        size="small"
                        link
                        @click.stop="locateDevice(item)"
                      >
                        定位
                      </el-button>
                      <el-button
                        size="small"
                        link
                        @click.stop="isolateDevice(item)"
                      >
                        隔离
                      </el-button>
                    </div>
                  </div>
                </div>
              </div>
              <el-empty
                v-else
                description="当前模型暂无可联动构件"
                :image-size="88"
              />
            </el-scrollbar>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </div>

    <el-drawer
      v-model="showObjectPanel"
      title="构件属性"
      direction="rtl"
      size="320px"
      :with-header="true"
      @close="closeObjectPanel"
    >
      <div v-if="selectedObjectInfo" class="space-y-4">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="名称">
            {{ selectedObjectInfo.name }}
          </el-descriptions-item>
          <el-descriptions-item label="KKS">
            {{ selectedSceneDevice?.kks || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="所属系统">
            {{
              currentDeviceProfile?.systemName ||
              selectedSceneDevice?.systemName ||
              "-"
            }}
          </el-descriptions-item>
          <el-descriptions-item label="类型">
            {{ selectedObjectInfo.type }}
          </el-descriptions-item>
          <el-descriptions-item label="UUID">
            <span class="text-xs font-mono">
              {{ selectedObjectInfo.uuid?.slice(0, 8) }}...
            </span>
          </el-descriptions-item>
        </el-descriptions>

        <el-card v-if="selectedObjectInfo.geometry" shadow="never">
          <template #header>
            <span class="text-sm font-semibold">几何信息</span>
          </template>
          <el-descriptions :column="1" size="small">
            <el-descriptions-item label="顶点数">
              {{ selectedObjectInfo.geometry.vertices?.toLocaleString() }}
            </el-descriptions-item>
            <el-descriptions-item label="面数">
              {{ selectedObjectInfo.geometry.faces?.toLocaleString() }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card v-if="selectedObjectInfo.boundingBox" shadow="never">
          <template #header>
            <span class="text-sm font-semibold">边界框</span>
          </template>
          <el-descriptions :column="1" size="small">
            <el-descriptions-item label="尺寸">
              {{
                selectedObjectInfo.boundingBox.size
                  .map(v => v.toFixed(2))
                  .join(" × ")
              }}
            </el-descriptions-item>
            <el-descriptions-item label="中心">
              {{
                selectedObjectInfo.boundingBox.center
                  .map(v => v.toFixed(2))
                  .join(", ")
              }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card
          v-if="
            selectedObjectInfo.userData &&
            Object.keys(selectedObjectInfo.userData).length > 0
          "
          shadow="never"
        >
          <template #header>
            <span class="text-sm font-semibold">自定义属性</span>
          </template>
          <el-descriptions :column="1" size="small">
            <el-descriptions-item
              v-for="(val, key) in selectedObjectInfo.userData"
              :key="key"
              :label="key"
            >
              {{ typeof val === "object" ? JSON.stringify(val) : val }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card v-if="currentDeviceProfile" shadow="never">
          <template #header>
            <span class="text-sm font-semibold">业务属性</span>
          </template>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="设备台账号">
              {{ currentDeviceProfile.ledgerNo }}
            </el-descriptions-item>
            <el-descriptions-item label="制造厂家">
              {{ currentDeviceProfile.manufacturer }}
            </el-descriptions-item>
            <el-descriptions-item label="设备型号">
              {{ currentDeviceProfile.model }}
            </el-descriptions-item>
            <el-descriptions-item label="额定功率">
              {{ currentDeviceProfile.ratedPower }}
            </el-descriptions-item>
            <el-descriptions-item label="额定电压">
              {{ currentDeviceProfile.ratedVoltage }}
            </el-descriptions-item>
            <el-descriptions-item label="介质">
              {{ currentDeviceProfile.medium }}
            </el-descriptions-item>
            <el-descriptions-item label="功能说明">
              {{ currentDeviceProfile.functionDesc }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card
          v-if="currentDeviceProfile?.structureParams?.length"
          shadow="never"
        >
          <template #header>
            <span class="text-sm font-semibold">结构参数</span>
          </template>
          <el-descriptions :column="1" size="small">
            <el-descriptions-item
              v-for="item in currentDeviceProfile.structureParams"
              :key="item.label"
              :label="item.label"
            >
              {{ item.value }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card
          v-if="currentDeviceProfile?.runningParams?.length"
          shadow="never"
        >
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-semibold">实时参数</span>
              <el-tag size="small" type="success">演示数据</el-tag>
            </div>
          </template>
          <div class="space-y-2">
            <div
              v-for="item in currentDeviceProfile.runningParams"
              :key="item.label"
              class="flex items-center justify-between rounded bg-[var(--el-fill-color-light)] px-3 py-2"
            >
              <div class="text-sm">{{ item.label }}</div>
              <div class="flex items-center gap-2">
                <span class="font-semibold"
                  >{{ item.value }}{{ item.unit }}</span
                >
                <el-tag
                  size="small"
                  :type="
                    item.status === 'warning'
                      ? 'warning'
                      : item.status === 'alarm'
                        ? 'danger'
                        : 'success'
                  "
                >
                  {{
                    item.status === "warning"
                      ? "预警"
                      : item.status === "alarm"
                        ? "告警"
                        : "正常"
                  }}
                </el-tag>
              </div>
            </div>
          </div>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-semibold">测点关联</span>
              <el-switch v-model="pointMarkersVisible" />
            </div>
          </template>
          <div class="mb-3 text-xs text-[var(--el-text-color-secondary)]">
            已关联
            {{ currentMeasurementPoints.length }}
            个测点，支持在场景中显示/关闭。
          </div>
          <el-table :data="currentMeasurementPoints" size="small" stripe>
            <el-table-column prop="tag" label="测点" min-width="92" />
            <el-table-column prop="name" label="名称" min-width="120" />
            <el-table-column label="当前值" min-width="100">
              <template #default="scope">
                {{ scope.row.value }}{{ scope.row.unit }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80">
              <template #default="scope">
                <el-tag
                  size="small"
                  :type="
                    scope.row.status === 'warning'
                      ? 'warning'
                      : scope.row.status === 'alarm'
                        ? 'danger'
                        : 'success'
                  "
                >
                  {{
                    scope.row.status === "warning"
                      ? "预警"
                      : scope.row.status === "alarm"
                        ? "告警"
                        : "正常"
                  }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
      <div v-else class="text-center text-gray-400 py-10">
        请在场景中选择一个构件
      </div>
    </el-drawer>

    <el-card shadow="never">
      <template #header>
        <div class="flex items-center gap-2">
          <span class="font-semibold">视频联动</span>
        </div>
      </template>
      <div class="text-sm mb-3">选择设备查看实时监控视频：</div>
      <el-space wrap>
        <el-button
          :type="selectedRegion === 'boiler' ? 'primary' : 'default'"
          @click="setRegion('boiler')"
        >
          锅炉区域
        </el-button>
        <el-button
          :type="selectedRegion === 'control' ? 'primary' : 'default'"
          @click="setRegion('control')"
        >
          控制室
        </el-button>
        <el-button
          :type="selectedRegion === 'cooling' ? 'primary' : 'default'"
          @click="setRegion('cooling')"
        >
          冷却塔
        </el-button>
        <el-button
          :type="selectedRegion === 'all' ? 'primary' : 'default'"
          @click="setRegion('all')"
        >
          全部显示
        </el-button>
        <el-button type="primary" @click="openVideoPage"
          >进入视频联动页</el-button
        >
      </el-space>
      <div class="mt-3 text-xs text-[var(--el-text-color-secondary)]">
        视频区域为原型落地：后续可接入 HLS/FLV/WebRTC。
      </div>
    </el-card>

    <!-- 导航树右键菜单 -->
    <div
      v-show="ctxMenuVisible"
      class="dd-nav-ctx-menu"
      :style="ctxMenuStyle"
      @contextmenu.prevent.stop
    >
      <div
        v-if="ctxMenuIsDevice"
        class="dd-nav-ctx-item"
        @click.stop="onCtxViewObjectInfo"
      >
        查看构件属性
      </div>
      <div class="dd-nav-ctx-item" @click.stop="onCtxBindProp">绑定属性</div>
      <div class="dd-nav-ctx-item" @click.stop="onCtxEditProp">修改属性</div>
      <div
        class="dd-nav-ctx-item dd-nav-ctx-danger"
        @click.stop="onCtxClearProp"
      >
        清空属性
      </div>
    </div>

    <!-- 属性编辑弹窗 -->
    <el-dialog
      v-model="propDialogVisible"
      :title="propDialogTitle"
      width="480px"
      destroy-on-close
    >
      <el-form label-width="90px" class="pr-4">
        <el-form-item label="构件名称">
          <el-input v-model="propEditForm.name" placeholder="构件名称" />
        </el-form-item>
        <el-form-item label="KKS 编码">
          <el-select
            v-model="propEditForm.kks"
            class="w-full"
            filterable
            clearable
            placeholder="搜索 KKS / 设备名称 / 系统名称"
            @change="onPropKksChange"
          >
            <el-option
              v-for="item in propKksOptions"
              :key="item.value"
              :label="item.optionText"
              :value="item.value"
            >
              <div class="flex items-center justify-between gap-3">
                <span class="font-mono text-xs">{{ item.value }}</span>
                <el-tag size="small" effect="plain">
                  {{ item.type || "对象" }}
                </el-tag>
              </div>
              <div
                class="truncate text-xs text-[var(--el-text-color-secondary)]"
              >
                {{ item.name || "-" }} / {{ item.systemName || "未绑定系统" }}
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="系统节点ID">
          <el-input
            v-model="propEditForm.nodeId"
            placeholder="选择 KKS 后自动回填"
          />
        </el-form-item>
        <el-form-item label="所属系统">
          <el-input
            v-model="propEditForm.systemName"
            placeholder="选择 KKS 后自动回填"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-input
            v-model="propEditForm.status"
            placeholder="选择 KKS 后自动回填"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="propDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmPropDialog">确定</el-button>
      </template>
    </el-dialog>

    <ModelPreviewUploadDialog
      v-model="uploadVisible"
      @confirm="onConfirmUpload"
    />
  </div>
</template>

<style scoped>
.viewer-model-select {
  --el-select-width: 200px;

  flex: 0 0 200px;
  width: 200px;
  min-width: 200px;
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
