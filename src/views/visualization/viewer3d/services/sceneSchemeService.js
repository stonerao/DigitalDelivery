import {
  loadProjectPackage,
  patchProjectPackage
} from "./projectPackageService";

export function buildSceneDeviceRef(item) {
  if (!item) return null;
  return {
    uuid: item.uuid,
    kks: item.kks || "",
    name: item.name || "",
    path: item.path || "",
    nodeId: item.nodeId || ""
  };
}

export function getStoredSceneSchemeMap(_storageKey) {
  return {};
}

export function persistSceneSchemes({
  storageKey: _storageKey,
  scope,
  sceneSchemes = []
}) {
  if (!scope) return;
  patchProjectPackage(scope, {
    scene: {
      schemes: Array.isArray(sceneSchemes) ? sceneSchemes : []
    }
  });
}

export function loadSceneSchemes({ storageKey: _storageKey, scope, modelUrl }) {
  if (!modelUrl) return [];
  const projectPackage = loadProjectPackage(scope, {
    modelUrl
  });
  return Array.isArray(projectPackage.scene?.schemes)
    ? projectPackage.scene.schemes
    : [];
}

export function resolveSceneSchemeUuids({
  deviceRefs = [],
  sceneDevices = []
}) {
  return deviceRefs
    .map(refItem => {
      if (!refItem) return null;
      if (refItem.kks) {
        const byKks = sceneDevices.find(item => item.kks === refItem.kks);
        if (byKks) return byKks.uuid;
      }
      return (
        sceneDevices.find(item => {
          return item.name === refItem.name && item.path === refItem.path;
        })?.uuid || null
      );
    })
    .filter(Boolean);
}

export function buildCurrentSceneSchemePayload({
  name,
  scope,
  displayMode,
  selectedSystemNodeId,
  selectedQuickKks,
  activeRightTab,
  pointMarkersVisible,
  clippingState,
  sceneDevices = [],
  layerCheckedKeys = []
}) {
  const visibleRefs = sceneDevices
    .filter(item => layerCheckedKeys.includes(item.uuid))
    .map(buildSceneDeviceRef)
    .filter(Boolean);

  return {
    id: `scene-scheme-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    name,
    scope,
    savedAt: Date.now(),
    displayMode,
    selectedSystemNodeId: selectedSystemNodeId || "",
    selectedQuickKks: selectedQuickKks || "",
    activeRightTab: activeRightTab || "navigation",
    pointMarkersVisible: pointMarkersVisible !== false,
    visibleDeviceRefs: visibleRefs,
    clippingState: clippingState || null
  };
}

export function formatSceneSchemeTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = num => String(num).padStart(2, "0");
  return `${date.getMonth() + 1}-${date.getDate()} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}
