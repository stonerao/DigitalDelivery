import { nextTick } from "vue";

function scheduleIdleTask(callback) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(callback, { timeout: 1200 });
    return;
  }
  window.setTimeout(callback, 0);
}

function deferViewerStartupWork(tasks) {
  const queue = (Array.isArray(tasks) ? tasks : [tasks]).filter(
    task => typeof task === "function"
  );
  if (!queue.length) return;

  const runBatch = deadline => {
    if (typeof window.requestIdleCallback === "function") {
      while (
        queue.length &&
        (!deadline?.timeRemaining || deadline.timeRemaining() > 6)
      ) {
        queue.shift()?.();
      }
      if (queue.length) scheduleIdleTask(runBatch);
      return;
    }
    queue.shift()?.();
    if (queue.length) scheduleIdleTask(runBatch);
  };

  const runWhenIdle = () => scheduleIdleTask(runBatch);

  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => runWhenIdle());
    return;
  }
  runWhenIdle();
}

export function handleViewerLoadedLifecycle({
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
  quality,
  materialTheme,
  runtimeClippingState,
  clippingAnimationSpeed,
  clippingAnimationMode,
  clippingAnimationAxis,
  syncRuntimeServices
}) {
  runtimeStore.setViewerReady(true);
  nextTick(() => {
    viewerAdapter.resetView?.();
  });
  viewerAdapter.setQuality(quality);
  viewerAdapter.setMaterialTheme(materialTheme);
  viewerAdapter.setClippingState(runtimeClippingState);
  viewerAdapter.setClippingAnimationOptions?.({
    speed: clippingAnimationSpeed,
    mode: clippingAnimationMode,
    axis: clippingAnimationAxis
  });
  runtimeStore.setClippingStats(
    viewerAdapter.getClippingStats?.() || {
      enabled: runtimeClippingState.enabled,
      mode: runtimeClippingState.mode,
      activePlaneCount: 0,
      affectedMeshCount: 0,
      totalMeshCount: 0
    }
  );
  deferViewerStartupWork([
    refreshSceneTree,
    refreshSceneDevices,
    () => void syncSceneObjectRelationsFromBackend(),
    syncRoamingState,
    syncMeasurementPoints,
    syncMeasurementRecordsToViewer,
    syncSceneAnchors,
    applyAssetGroupVisibility,
    syncLayerTreeSelection,
    syncRuntimeServices
  ]);
}

export function resetViewerSceneOnModelChange({
  stopClippingAnimation,
  clearClippingPersistTimer,
  stopRuntimeServices,
  runtimeStore,
  projectStore,
  viewerAdapter,
  setSelectedTreeNode,
  setTreeFilterText,
  setSceneTree,
  setSceneDevices,
  setAnchors,
  setCameraAnchors,
  setMeasurementRecords,
  setSelectedDeviceUuid,
  setSelectedAnchorId,
  setSelectedCameraId,
  setSelectedSystemNodeId,
  setSelectedQuickKks,
  setDisplayMode,
  setCurrentNavNodeKey,
  setLayerCheckedKeys,
  setShowObjectPanel,
  setAnchorDetailVisible,
  setRoamingEnabled,
  setSelectedLodId,
  resetClippingState,
  refreshSceneTree,
  restorePersistedProjectState
}) {
  stopClippingAnimation({ persist: false });
  clearClippingPersistTimer?.();
  stopRuntimeServices();
  runtimeStore.setViewerReady(false);
  setSelectedTreeNode(null);
  setTreeFilterText("");
  setSceneTree(null);
  setSceneDevices([]);
  setAnchors([]);
  setCameraAnchors([]);
  setMeasurementRecords([]);
  projectStore.setAnchors([]);
  projectStore.setCameraAnchors([]);
  projectStore.clearMeasurementRecords();
  setSelectedDeviceUuid("");
  setSelectedAnchorId("");
  setSelectedCameraId("");
  setSelectedSystemNodeId("");
  setSelectedQuickKks("");
  setDisplayMode("all");
  setCurrentNavNodeKey("");
  setLayerCheckedKeys([]);
  runtimeStore.setSelectedObject(null);
  setShowObjectPanel(false);
  setAnchorDetailVisible(false);
  runtimeStore.closeVideoDialog();
  viewerAdapter.toggleFirstPerson(false);
  setRoamingEnabled(false);
  viewerAdapter.clearIsolation();
  viewerAdapter.clearLinkedPoints();
  viewerAdapter.clearAnchors();
  viewerAdapter.clearCameraAnchors();
  viewerAdapter.clearMeasurements();
  viewerAdapter.filterVisibleUUIDs(null);
  resetClippingState();
  projectStore.setClippingPresets([]);
  setSelectedLodId("");
  refreshSceneTree();
  restorePersistedProjectState?.();
}
