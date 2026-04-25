function normalizeRuntimeQuality(value) {
  return value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "plane"
    ? value
    : "high";
}

export function pickPersistedArray(
  projectValue,
  packageValue,
  preferProjectInfo = true
) {
  const candidates = preferProjectInfo
    ? [projectValue, packageValue]
    : [packageValue, projectValue];
  if (Array.isArray(candidates[0])) return candidates[0];
  if (Array.isArray(candidates[1])) return candidates[1];
  return [];
}

export function pickPersistedObject(
  projectValue,
  packageValue,
  fallbackValue,
  preferProjectInfo = true
) {
  const candidates = preferProjectInfo
    ? [projectValue, packageValue]
    : [packageValue, projectValue];
  const selected = candidates.find(
    item => item && typeof item === "object" && !Array.isArray(item)
  );
  return selected || fallbackValue;
}

export function resolveRestoredViewerProjectState({
  projectInfo = null,
  projectPackage = {},
  preferProjectInfo = true,
  normalizeSavedObjectBinding,
  mapSystemTreeNodes,
  buildStyledAnchorForm,
  createDefaultClippingState,
  normalizeClippingState,
  currentRuntime = {}
}) {
  const savedScene = projectInfo?.scene || {};
  const savedRuntime = projectInfo?.runtime || {};

  return {
    savedObjectBindings: pickPersistedArray(
      savedScene.bindings?.objectBindings,
      projectPackage.scene?.bindings?.objectBindings,
      preferProjectInfo
    )
      .map(normalizeSavedObjectBinding)
      .filter(Boolean),
    systemNodeTree: mapSystemTreeNodes(
      pickPersistedArray(
        savedScene.navigationTree,
        projectPackage.scene?.navigationTree,
        preferProjectInfo
      )
    ),
    anchorStyleDefaults: {
      anchor: pickPersistedObject(
        savedScene.anchorStyleDefaults?.anchor,
        projectPackage.scene?.anchorStyleDefaults?.anchor,
        {},
        preferProjectInfo
      ),
      camera: pickPersistedObject(
        savedScene.anchorStyleDefaults?.camera,
        projectPackage.scene?.anchorStyleDefaults?.camera,
        {},
        preferProjectInfo
      )
    },
    anchors: pickPersistedArray(
      savedScene.anchors,
      projectPackage.scene?.anchors,
      preferProjectInfo
    ).map(item => buildStyledAnchorForm("anchor", item)),
    cameraAnchors: pickPersistedArray(
      savedScene.cameras,
      projectPackage.scene?.cameras,
      preferProjectInfo
    ).map(item => buildStyledAnchorForm("camera", item)),
    measurementRecords: pickPersistedArray(
      savedScene.measurements,
      projectPackage.scene?.measurements,
      preferProjectInfo
    ),
    sceneSchemes: pickPersistedArray(
      savedScene.schemes,
      projectPackage.scene?.schemes,
      preferProjectInfo
    ),
    bookmarks: pickPersistedArray(
      savedScene.bookmarks,
      projectPackage.scene?.bookmarks,
      preferProjectInfo
    ),
    clippingState: normalizeClippingState(
      pickPersistedObject(
        savedScene.clipping,
        projectPackage.scene?.clipping,
        createDefaultClippingState(),
        preferProjectInfo
      )
    ),
    clippingPresets: pickPersistedArray(
      savedScene.clippingPresets,
      projectPackage.scene?.clippingPresets,
      preferProjectInfo
    ),
    assetGroups: pickPersistedArray(
      savedScene.assetGroups,
      projectPackage.assets?.sceneManifest?.groups,
      preferProjectInfo
    ).map(item => ({
      ...item,
      visible: item.visible !== false
    })),
    runtimeState: {
      quality: normalizeRuntimeQuality(savedRuntime.quality),
      materialTheme: String(
        savedRuntime.materialTheme || currentRuntime.materialTheme || ""
      ),
      activeTool: String(
        savedRuntime.activeTool || currentRuntime.activeTool || "rotate"
      ),
      measurementMode: String(
        savedRuntime.measurementMode ||
          currentRuntime.measurementMode ||
          "distance"
      ),
      displayMode: String(
        savedRuntime.displayMode || currentRuntime.displayMode || ""
      ),
      showStats: Boolean(savedRuntime.showStats),
      showSidePanel: savedRuntime.showSidePanel !== false,
      activeSideTab: String(
        savedRuntime.activeSideTab || currentRuntime.activeSideTab || "scene"
      ),
      transparent: Boolean(savedRuntime.transparentEnabled),
      pointMarkersVisible: savedRuntime.pointMarkersVisible !== false,
      anchorMarkersVisible: savedRuntime.anchorMarkersVisible !== false,
      cameraMarkersVisible: savedRuntime.cameraMarkersVisible !== false,
      selectedDeviceUuid: String(savedRuntime.selectedDeviceUuid || ""),
      selectedAnchorId: String(savedRuntime.selectedAnchorId || ""),
      selectedCameraId: String(savedRuntime.selectedCameraId || ""),
      selectedSystemNodeId: String(savedRuntime.selectedSystemNodeId || ""),
      selectedQuickKks: String(savedRuntime.selectedQuickKks || ""),
      currentNavNodeKey: String(savedRuntime.currentNavNodeKey || "")
    }
  };
}

export function applyRestoredViewerProjectState({
  restoredState,
  projectPackage,
  projectStore,
  runtimeStore,
  updateSceneModelNodeLabels,
  setSavedObjectBindings,
  setSystemNodeTree,
  setAnchorStyleDefaults,
  setAnchors,
  setCameraAnchors,
  setMeasurementRecords,
  setSceneSchemes,
  setBookmarks,
  setAssetGroups,
  setQuality,
  setMaterialTheme,
  setActiveTool,
  setMeasurementMode,
  setDisplayMode,
  setShowStats,
  setShowSidePanel,
  setActiveSideTab,
  setTransparent,
  setPointMarkersVisible,
  setAnchorMarkersVisible,
  setCameraMarkersVisible,
  setSelectedDeviceUuid,
  setSelectedAnchorId,
  setSelectedCameraId,
  setSelectedSystemNodeId,
  setSelectedQuickKks,
  setCurrentNavNodeKey
}) {
  setSavedObjectBindings(restoredState.savedObjectBindings);
  setSystemNodeTree(restoredState.systemNodeTree);
  updateSceneModelNodeLabels();

  projectStore.setProjectPackage(projectPackage);

  setAnchorStyleDefaults(restoredState.anchorStyleDefaults);
  setAnchors(restoredState.anchors);
  setCameraAnchors(restoredState.cameraAnchors);
  setMeasurementRecords(restoredState.measurementRecords);
  setSceneSchemes(restoredState.sceneSchemes);
  setBookmarks(restoredState.bookmarks);
  setAssetGroups(restoredState.assetGroups);

  projectStore.setAnchors(restoredState.anchors);
  projectStore.setCameraAnchors(restoredState.cameraAnchors);
  projectStore.setMeasurementRecords(restoredState.measurementRecords);
  projectStore.setSceneSchemes(restoredState.sceneSchemes);
  projectStore.setBookmarks(restoredState.bookmarks);
  projectStore.setClippingState(restoredState.clippingState);
  projectStore.setClippingPresets(restoredState.clippingPresets);

  runtimeStore.setClippingState(restoredState.clippingState);

  const runtimeState = restoredState.runtimeState;
  setQuality(runtimeState.quality);
  runtimeStore.setQuality(runtimeState.quality);

  if (runtimeState.materialTheme) {
    setMaterialTheme(runtimeState.materialTheme);
    runtimeStore.setMaterialTheme(runtimeState.materialTheme);
  }

  setActiveTool(runtimeState.activeTool);
  runtimeStore.setActiveTool(runtimeState.activeTool);

  setMeasurementMode(runtimeState.measurementMode);
  runtimeStore.setMeasurementMode(runtimeState.measurementMode);

  if (runtimeState.displayMode) {
    setDisplayMode(runtimeState.displayMode);
    runtimeStore.setDisplayMode(runtimeState.displayMode);
  }

  setShowStats(runtimeState.showStats);
  runtimeStore.setShowStats(runtimeState.showStats);

  setShowSidePanel(runtimeState.showSidePanel);
  runtimeStore.setShowSidePanel(runtimeState.showSidePanel);

  setActiveSideTab(runtimeState.activeSideTab);
  runtimeStore.setActiveSideTab(runtimeState.activeSideTab);

  setTransparent(runtimeState.transparent);
  runtimeStore.setTransparentEnabled(runtimeState.transparent);

  setPointMarkersVisible(runtimeState.pointMarkersVisible);
  runtimeStore.setPointMarkersVisible(runtimeState.pointMarkersVisible);

  setAnchorMarkersVisible(runtimeState.anchorMarkersVisible);
  runtimeStore.setAnchorMarkersVisible(runtimeState.anchorMarkersVisible);

  setCameraMarkersVisible(runtimeState.cameraMarkersVisible);
  runtimeStore.setCameraMarkersVisible(runtimeState.cameraMarkersVisible);

  setSelectedDeviceUuid(runtimeState.selectedDeviceUuid);
  runtimeStore.setSelectedDeviceUuid(runtimeState.selectedDeviceUuid);

  setSelectedAnchorId(runtimeState.selectedAnchorId);
  runtimeStore.setSelectedAnchorId(runtimeState.selectedAnchorId);

  setSelectedCameraId(runtimeState.selectedCameraId);
  runtimeStore.setSelectedCameraId(runtimeState.selectedCameraId);

  setSelectedSystemNodeId(runtimeState.selectedSystemNodeId);
  runtimeStore.setSelectedSystemNodeId(runtimeState.selectedSystemNodeId);

  setSelectedQuickKks(runtimeState.selectedQuickKks);
  runtimeStore.setSelectedQuickKks(runtimeState.selectedQuickKks);

  setCurrentNavNodeKey(runtimeState.currentNavNodeKey);
  runtimeStore.setCurrentNavNodeKey(runtimeState.currentNavNodeKey);
}
