import { defineStore } from "pinia";
import { store } from "../utils";
import {
  createDefaultClippingState,
  normalizeClippingState
} from "@/3d/runtime/clipping/clippingState";

function getInitialState() {
  return {
    modelId: "",
    modelUrl: "",
    modelName: "",
    viewerReady: false,
    loading: false,
    errorText: "",
    quality: "high",
    materialTheme: "textured-basic",
    activeTool: "rotate",
    interactionMode: "rotate",
    measurementMode: "distance",
    showSidePanel: true,
    showStats: false,
    showObjectPanel: false,
    activeSideTab: "navigation",
    displayMode: "all",
    transparentEnabled: false,
    clippingEnabled: false,
    clippingState: createDefaultClippingState(),
    clippingStats: {
      enabled: false,
      mode: "single-plane",
      activePlaneCount: 0,
      affectedMeshCount: 0,
      totalMeshCount: 0
    },
    roamingEnabled: false,
    pointMarkersVisible: true,
    anchorMarkersVisible: true,
    cameraMarkersVisible: true,
    selectedObjectUuid: "",
    selectedObjectInfo: null,
    selectedDeviceUuid: "",
    selectedAnchorId: "",
    selectedCameraId: "",
    selectedSystemNodeId: "",
    selectedQuickKks: "",
    currentNavNodeKey: "",
    videoDialogVisible: false,
    activeVideoSource: null,
    realtimeState: {
      running: false,
      transport: "mock",
      tick: 0
    },
    scriptState: {
      running: false,
      triggerCount: 0,
      animationCount: 0
    },
    backendState: {
      running: false,
      transport: "mock"
    },
    runtimeLogs: []
  };
}

export const useViewer3dRuntimeStore = defineStore("viewer3d-runtime", {
  state: () => getInitialState(),
  getters: {
    hasModel(state) {
      return Boolean(state.modelUrl);
    },
    hasSelection(state) {
      return Boolean(state.selectedObjectUuid);
    },
    displayModeText(state) {
      const map = {
        all: "全部构件",
        business: "已绑定业务设备",
        system: "当前系统",
        selection: "当前设备",
        model: "当前模型",
        type: "当前类型",
        tree: "分层树筛选"
      };
      return map[state.displayMode] || "全部构件";
    }
  },
  actions: {
    setModelInfo(payload = {}) {
      this.modelId = payload.modelId || "";
      this.modelUrl = payload.modelUrl || "";
      this.modelName = payload.modelName || "";
    },
    setViewerReady(value) {
      this.viewerReady = Boolean(value);
    },
    setLoading(value) {
      this.loading = Boolean(value);
    },
    setErrorText(value) {
      this.errorText = String(value || "");
    },
    setQuality(value) {
      this.quality = value || "high";
    },
    setMaterialTheme(value) {
      this.materialTheme = value || "textured-basic";
    },
    setActiveTool(value) {
      this.activeTool = value || "rotate";
    },
    setInteractionMode(value) {
      this.interactionMode = value || "rotate";
    },
    setMeasurementMode(value) {
      this.measurementMode = value || "distance";
    },
    setShowSidePanel(value) {
      this.showSidePanel = Boolean(value);
    },
    setShowStats(value) {
      this.showStats = Boolean(value);
    },
    setShowObjectPanel(value) {
      this.showObjectPanel = Boolean(value);
    },
    setActiveSideTab(value) {
      this.activeSideTab = value || "navigation";
    },
    setDisplayMode(value) {
      this.displayMode = value || "all";
    },
    setTransparentEnabled(value) {
      this.transparentEnabled = Boolean(value);
    },
    setClippingEnabled(value) {
      this.clippingEnabled = Boolean(value);
      this.clippingState = normalizeClippingState({
        ...this.clippingState,
        enabled: this.clippingEnabled
      });
    },
    setClippingState(payload = {}) {
      this.clippingState = normalizeClippingState(payload);
      this.clippingEnabled = this.clippingState.enabled;
    },
    setClippingStats(payload = {}) {
      this.clippingStats = {
        ...this.clippingStats,
        ...payload
      };
    },
    setRoamingEnabled(value) {
      this.roamingEnabled = Boolean(value);
    },
    setPointMarkersVisible(value) {
      this.pointMarkersVisible = Boolean(value);
    },
    setAnchorMarkersVisible(value) {
      this.anchorMarkersVisible = Boolean(value);
    },
    setCameraMarkersVisible(value) {
      this.cameraMarkersVisible = Boolean(value);
    },
    setSelectedObject(payload) {
      this.selectedObjectInfo = payload || null;
      this.selectedObjectUuid = payload?.uuid || "";
    },
    setSelectedDeviceUuid(value) {
      this.selectedDeviceUuid = value || "";
    },
    setSelectedAnchorId(value) {
      this.selectedAnchorId = value || "";
    },
    setSelectedCameraId(value) {
      this.selectedCameraId = value || "";
    },
    setSelectedSystemNodeId(value) {
      this.selectedSystemNodeId = value || "";
    },
    setSelectedQuickKks(value) {
      this.selectedQuickKks = value || "";
    },
    setCurrentNavNodeKey(value) {
      this.currentNavNodeKey = value || "";
    },
    openVideoDialog(payload = null) {
      this.videoDialogVisible = true;
      this.activeVideoSource = payload;
    },
    closeVideoDialog() {
      this.videoDialogVisible = false;
      this.activeVideoSource = null;
    },
    setRealtimeState(payload = {}) {
      this.realtimeState = {
        ...this.realtimeState,
        ...payload
      };
    },
    setScriptState(payload = {}) {
      this.scriptState = {
        ...this.scriptState,
        ...payload
      };
    },
    setBackendState(payload = {}) {
      this.backendState = {
        ...this.backendState,
        ...payload
      };
    },
    addRuntimeLog(item) {
      if (!item) return;
      this.runtimeLogs.unshift(item);
      this.runtimeLogs = this.runtimeLogs.slice(0, 60);
    },
    clearRuntimeLogs() {
      this.runtimeLogs = [];
    },
    resetSelectionState() {
      this.selectedObjectUuid = "";
      this.selectedObjectInfo = null;
      this.selectedDeviceUuid = "";
      this.selectedAnchorId = "";
      this.selectedCameraId = "";
      this.selectedSystemNodeId = "";
      this.selectedQuickKks = "";
      this.currentNavNodeKey = "";
      this.showObjectPanel = false;
    },
    resetRuntimeState() {
      Object.assign(this, getInitialState());
    }
  }
});

export function useViewer3dRuntimeStoreHook() {
  return useViewer3dRuntimeStore(store);
}
