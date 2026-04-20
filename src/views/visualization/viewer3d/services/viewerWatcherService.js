export async function handleVideoDialogVisibilityChange({
  visible,
  nextTick,
  mountActiveVideo,
  videoAdapter,
  clearVideoError
}) {
  if (visible) {
    await nextTick();
    await mountActiveVideo();
    return;
  }
  videoAdapter.destroy();
  clearVideoError();
}

export async function handleActiveCameraChange({
  videoDialogVisible,
  nextTick,
  mountActiveVideo
}) {
  if (!videoDialogVisible) return;
  await nextTick();
  await mountActiveVideo();
}

export function syncAssetGroupsFromManifest({
  groups,
  viewerAdapter,
  applyAssetGroupVisibility,
  setAssetGroups
}) {
  const nextGroups = Array.isArray(groups)
    ? groups.map(item => ({
        ...item,
        visible: item.visible !== false
      }))
    : [];
  setAssetGroups(nextGroups);
  if (viewerAdapter.isReady()) {
    applyAssetGroupVisibility();
  }
}

export function syncRuntimeServicesIfReady({
  viewerAdapter,
  syncRuntimeServices
}) {
  if (!viewerAdapter.isReady()) return;
  syncRuntimeServices();
}

export function syncMeasurementPointsOnWatcher({ syncMeasurementPoints }) {
  syncMeasurementPoints();
}

export function syncMeasurementModeOnWatcher({ value, setMeasurementMode }) {
  setMeasurementMode(value);
}

export function syncViewerQuality({ viewerAdapter, value }) {
  viewerAdapter.setQuality(value);
}

export function syncViewerMaterialTheme({ viewerAdapter, value }) {
  viewerAdapter.setMaterialTheme(value);
}

export function syncSceneAnchorsOnWatcher({ syncSceneAnchors }) {
  syncSceneAnchors();
}

export function syncViewerClippingAnimationOptions({
  viewerAdapter,
  speed,
  mode,
  axis
}) {
  if (!viewerAdapter.isReady()) return;
  viewerAdapter.setClippingAnimationOptions?.({
    speed,
    mode,
    axis
  });
}
