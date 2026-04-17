import { defineStore } from "pinia";
import { store } from "../utils";
import {
  createDefaultClippingState,
  normalizeClippingState
} from "@/3d/runtime/clipping/clippingState";

function getInitialState() {
  return {
    projectId: "",
    projectName: "",
    projectVersion: "1.0.0",
    sceneSchemes: [],
    bookmarks: [],
    sceneDevices: [],
    anchors: [],
    cameraAnchors: [],
    measurementRecords: [],
    clippingPresets: [],
    projectPackage: null,
    scriptDefinitions: {
      animations: [],
      triggers: []
    },
    integrationConfigs: {
      realtime: {},
      backendBridge: {}
    },
    deviceKeyword: "",
    sceneTree: null,
    layerCheckedKeys: [],
    clippingState: createDefaultClippingState(),
    clippingRanges: {
      x: [0, 1],
      y: [0, 1],
      z: [0, 1]
    },
    clippingPlanesEnabled: {
      x: false,
      y: false,
      z: false
    }
  };
}

export const useViewer3dProjectStore = defineStore("viewer3d-project", {
  state: () => getInitialState(),
  getters: {
    allDeviceUuids(state) {
      return state.sceneDevices.map(item => item.uuid).filter(Boolean);
    }
  },
  actions: {
    setProjectInfo(payload = {}) {
      this.projectId = payload.projectId || "";
      this.projectName = payload.projectName || "";
      this.projectVersion = payload.projectVersion || "1.0.0";
    },
    setSceneSchemes(items = []) {
      this.sceneSchemes = Array.isArray(items) ? items : [];
    },
    setBookmarks(items = []) {
      this.bookmarks = Array.isArray(items) ? items : [];
    },
    setSceneDevices(items = []) {
      this.sceneDevices = Array.isArray(items) ? items : [];
    },
    setAnchors(items = []) {
      this.anchors = Array.isArray(items) ? items : [];
    },
    addAnchor(item) {
      if (!item) return;
      this.anchors.unshift(item);
    },
    updateAnchor(payload = {}) {
      const index = this.anchors.findIndex(item => item.id === payload.id);
      if (index < 0) return;
      this.anchors[index] = {
        ...this.anchors[index],
        ...payload
      };
    },
    removeAnchor(id) {
      this.anchors = this.anchors.filter(item => item.id !== id);
    },
    setCameraAnchors(items = []) {
      this.cameraAnchors = Array.isArray(items) ? items : [];
    },
    setMeasurementRecords(items = []) {
      this.measurementRecords = Array.isArray(items) ? items : [];
    },
    addMeasurementRecord(item) {
      if (!item) return;
      this.measurementRecords.unshift(item);
    },
    removeMeasurementRecord(id) {
      this.measurementRecords = this.measurementRecords.filter(
        item => item.id !== id
      );
    },
    clearMeasurementRecords() {
      this.measurementRecords = [];
    },
    setProjectPackage(payload = null) {
      this.projectPackage = payload || null;
      this.scriptDefinitions = {
        animations: payload?.scripts?.animations || [],
        triggers: payload?.scripts?.triggers || []
      };
      this.integrationConfigs = {
        realtime: payload?.integrations?.realtime || {},
        backendBridge: payload?.integrations?.backendBridge || {}
      };
      this.clippingPresets = payload?.scene?.clippingPresets || [];
      this.setClippingState(
        payload?.scene?.clipping || createDefaultClippingState()
      );
    },
    addCameraAnchor(item) {
      if (!item) return;
      this.cameraAnchors.unshift(item);
    },
    updateCameraAnchor(payload = {}) {
      const index = this.cameraAnchors.findIndex(
        item => item.id === payload.id
      );
      if (index < 0) return;
      this.cameraAnchors[index] = {
        ...this.cameraAnchors[index],
        ...payload
      };
    },
    removeCameraAnchor(id) {
      this.cameraAnchors = this.cameraAnchors.filter(item => item.id !== id);
    },
    setDeviceKeyword(value) {
      this.deviceKeyword = String(value || "");
    },
    setSceneTree(tree = null) {
      this.sceneTree = tree || null;
    },
    setLayerCheckedKeys(keys = []) {
      this.layerCheckedKeys = Array.isArray(keys) ? [...keys] : [];
    },
    setClippingState(payload = {}) {
      const normalized = normalizeClippingState(payload);
      this.clippingState = normalized;
      this.clippingRanges = {
        x: [...normalized.box.x.range],
        y: [...normalized.box.y.range],
        z: [...normalized.box.z.range]
      };
      this.clippingPlanesEnabled = {
        x: Boolean(normalized.box.x.enabled),
        y: Boolean(normalized.box.y.enabled),
        z: Boolean(normalized.box.z.enabled)
      };
    },
    setClippingPresets(items = []) {
      this.clippingPresets = Array.isArray(items) ? items : [];
    },
    setClippingRange(axis, range) {
      if (!["x", "y", "z"].includes(axis)) return;
      this.clippingRanges[axis] = Array.isArray(range) ? [...range] : [0, 1];
      this.clippingState = normalizeClippingState({
        ...this.clippingState,
        box: {
          ...this.clippingState.box,
          [axis]: {
            ...this.clippingState.box[axis],
            range: this.clippingRanges[axis]
          }
        }
      });
    },
    setClippingPlaneEnabled(axis, value) {
      if (!["x", "y", "z"].includes(axis)) return;
      this.clippingPlanesEnabled[axis] = Boolean(value);
      this.clippingState = normalizeClippingState({
        ...this.clippingState,
        box: {
          ...this.clippingState.box,
          [axis]: {
            ...this.clippingState.box[axis],
            enabled: this.clippingPlanesEnabled[axis]
          }
        }
      });
    },
    resetProjectState() {
      Object.assign(this, getInitialState());
    }
  }
});

export function useViewer3dProjectStoreHook() {
  return useViewer3dProjectStore(store);
}
