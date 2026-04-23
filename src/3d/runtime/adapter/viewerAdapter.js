function getExposeValue(value) {
  if (value && typeof value === "object" && "value" in value) {
    return value.value;
  }
  return value;
}

export function createViewerAdapter() {
  let viewer = null;

  function bindViewer(instance) {
    viewer = instance || null;
  }

  function unbindViewer() {
    viewer = null;
  }

  function isReady() {
    return Boolean(viewer);
  }

  function invoke(method, ...args) {
    const fn = viewer?.[method];
    if (typeof fn !== "function") return null;
    try {
      return fn(...args);
    } catch (error) {
      console.warn(`[viewerAdapter] ${method} failed`, error);
      return null;
    }
  }

  return {
    bindViewer,
    unbindViewer,
    isReady,
    loadModel: () => invoke("loadModel"),
    resetView: () => invoke("resetView"),
    zoomIn: () => invoke("zoomIn"),
    zoomOut: () => invoke("zoomOut"),
    setQuality: quality => invoke("setQuality", quality),
    setMaterialTheme: theme => invoke("setMaterialTheme", theme),
    toggleProjection: () => invoke("toggleProjection"),
    setPresetView: preset => invoke("setPresetView", preset),
    selectObjectByUUID: (uuid, options) =>
      invoke("selectByUUID", uuid, options),
    clearSelection: () => invoke("clearSelection"),
    getSelectedObject: () => invoke("getSelectedObject"),
    highlightObjectByUUID: (uuid, options) =>
      invoke("selectByUUID", uuid, options),
    focusObjectByUUID: uuid => invoke("focusByUUID", uuid),
    focusObjectsByUUIDs: uuids => invoke("focusByUUIDs", uuids),
    getSceneTree: () => invoke("getSceneTree"),
    isolateObjectByUUID: uuid => invoke("isolateByUUID", uuid),
    showOnlyUUIDs: uuids => invoke("showOnlyUUIDs", uuids),
    filterVisibleUUIDs: uuidsOrNull =>
      invoke("filterVisibleUUIDs", uuidsOrNull),
    clearIsolation: () => invoke("clearIsolation"),
    hideUUIDs: uuids => invoke("hideUUIDs", uuids),
    clearHiddenUUIDs: () => invoke("clearHiddenUUIDs"),
    setMeshOpacityByUUID: (uuid, opacity) =>
      invoke("setMeshOpacityByUUID", uuid, opacity),
    toggleFirstPerson: force => invoke("toggleFirstPerson", force),
    getFirstPersonState: () => Boolean(getExposeValue(viewer?.isFirstPerson)),
    setClippingState: state => invoke("setClippingState", state),
    resetClipping: () => invoke("resetClipping"),
    setClippingPosition: (axis, value) =>
      invoke("setClippingPosition", axis, value),
    setClippingEditMode: mode => invoke("setClippingEditMode", mode),
    getClippingState: () => invoke("getClippingState"),
    getClippingStats: () => invoke("getClippingStats"),
    setClippingAnimationOptions: options =>
      invoke("setClippingAnimationOptions", options),
    startClippingAnimation: options =>
      invoke("startClippingAnimation", options),
    stopClippingAnimation: () => invoke("stopClippingAnimation"),
    getClippingAnimationState: () => invoke("getClippingAnimationState"),
    clearMeasurements: () => invoke("clearMeasurements"),
    getMeasurements: () => invoke("getMeasurements"),
    setMeasurementMode: mode => invoke("setMeasurementMode", mode),
    setMeasurements: records => invoke("setMeasurements", records),
    removeMeasurement: id => invoke("removeMeasurement", id),
    setMeasurementVisible: (id, visible) =>
      invoke("setMeasurementVisible", id, visible),
    exportMeasurements: () => invoke("exportMeasurements"),
    focusMeasurement: id => invoke("focusMeasurement", id),
    setAnchors: anchors => invoke("setAnchors", anchors),
    clearAnchors: () => invoke("clearAnchors"),
    setAnchorsVisible: visible => invoke("setAnchorsVisible", visible),
    setCameraAnchors: anchors => invoke("setCameraAnchors", anchors),
    clearCameraAnchors: () => invoke("clearCameraAnchors"),
    setCameraAnchorsVisible: visible =>
      invoke("setCameraAnchorsVisible", visible),
    setLinkedPoints: points => invoke("setLinkedPoints", points),
    clearLinkedPoints: () => invoke("clearLinkedPoints"),
    setLinkedPointsVisible: visible =>
      invoke("setLinkedPointsVisible", visible),
    captureScreenshot: options => invoke("captureScreenshot", options),
    captureTopViewSnapshot: options =>
      invoke("captureTopViewSnapshot", options),
    downloadScreenshot: (filename, options) =>
      invoke("downloadScreenshot", filename, options),
    setRenderPaused: value => invoke("setRenderPaused", value),
    addBookmark: name => invoke("addBookmark", name),
    getBookmarks: () => invoke("getBookmarks"),
    applyBookmark: bookmark => invoke("applyBookmark", bookmark),
    getObjectWorldPositionByUUID: uuid =>
      invoke("getObjectWorldPositionByUUID", uuid),
    getModelStats: () => getExposeValue(viewer?.modelStats) || null,
    getViewerCapabilities: () => ({
      clippingRange: true,
      firstPerson: true,
      measurements: ["distance", "polyline", "angle", "area"],
      bookmarks: true,
      anchors: true,
      cameraOverlay: true
    })
  };
}
