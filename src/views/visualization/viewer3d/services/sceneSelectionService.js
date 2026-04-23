export function onTreeNodeExpand(data, treeExpandedKeys) {
  if (data?.uuid) treeExpandedKeys.add(data.uuid);
}

export function onTreeNodeCollapse(data, treeExpandedKeys) {
  if (data?.uuid) treeExpandedKeys.delete(data.uuid);
}

export function expandTreeToUUID({
  uuid,
  treeRef,
  treeParentMap,
  treeExpandedKeys
}) {
  const tree = treeRef?.value;
  if (!tree || !uuid) return;

  let current = uuid;
  while (current) {
    const parentUuid = treeParentMap.get(current);
    if (parentUuid) treeExpandedKeys.add(parentUuid);
    current = parentUuid;
  }

  tree.setExpandedKeys?.([...treeExpandedKeys]);
}

export function scrollCurrentTreeNodeIntoView({ uuid, treeRef }) {
  const tree = treeRef?.value;
  if (!tree || !uuid) return;
  if (typeof tree.scrollToNode === "function") {
    tree.scrollToNode(uuid, "smart");
    return;
  }
  tree.scrollTo?.(uuid);
}

export async function selectTreeNodeByUUID({
  uuid,
  openPanel = true,
  activeSideTabRef,
  sceneTreeRef,
  refreshSceneTree,
  treeNodeIndex,
  setSelectedTreeNode,
  nextTick,
  treeRef,
  expandTreeToUUID,
  scrollCurrentTreeNodeIntoView,
  viewerAdapter
}) {
  if (!uuid) return false;
  if (openPanel && activeSideTabRef) {
    activeSideTabRef.value = "structure";
  }

  if (!sceneTreeRef?.value) {
    await refreshSceneTree?.();
  }

  const nodeData = treeNodeIndex.get(uuid) || null;
  if (nodeData) {
    setSelectedTreeNode?.(nodeData);
  }

  await nextTick?.();
  treeRef?.value?.setCurrentKey?.(uuid);
  expandTreeToUUID?.(uuid);
  await nextTick?.();
  scrollCurrentTreeNodeIntoView?.(uuid);
  viewerAdapter?.selectObjectByUUID?.(uuid, { emitEvent: false });
  return true;
}

export async function onObjectSelect({
  info,
  runtimeStore,
  setSelectedDeviceUuid,
  sceneDevices = [],
  syncNavigationSelections,
  setShowObjectPanel,
  syncMeasurementPoints,
  interactionMode,
  treeFilterTextRef,
  clearTreeFilterText,
  selectTreeNodeByUUID
}) {
  runtimeStore?.setSelectedObject?.(info);

  const device = sceneDevices.find(item => {
    if (!item) return false;
    if (item.uuid === info?.uuid) return true;
    const meshUuids = Array.isArray(item.meshUuids) ? item.meshUuids : [];
    return meshUuids.includes(info?.uuid);
  });
  setSelectedDeviceUuid?.(device?.uuid || info?.uuid || "");
  syncNavigationSelections?.(device);
  setShowObjectPanel?.(true);
  syncMeasurementPoints?.();

  const targetUuid = info?.objectUuid || info?.uuid || "";
  if (interactionMode === "pick" && targetUuid) {
    if (treeFilterTextRef?.value) clearTreeFilterText?.();
    await selectTreeNodeByUUID?.(targetUuid, { openPanel: false });
  }
}

export function closeObjectPanel({ setShowObjectPanel, viewerAdapter }) {
  setShowObjectPanel?.(false);
  viewerAdapter?.clearSelection?.();
}

export async function onTreeNodeClick({
  data,
  setSelectedTreeNode,
  sceneDevices = [],
  locateDevice
}) {
  setSelectedTreeNode?.(data);
  if (!data?.uuid) return false;

  await locateDevice?.(
    sceneDevices.find(item => item.uuid === data.uuid) || {
      uuid: data.uuid,
      name: data.name,
      path: data.name,
      type: data.type || "Mesh",
      kks: "",
      nodeId: ""
    },
    false
  );
  return true;
}

export function focusSelectedNode({ selectedTreeNode, viewerAdapter }) {
  if (!selectedTreeNode?.uuid) return false;
  viewerAdapter?.focusObjectByUUID?.(selectedTreeNode.uuid);
  return true;
}

export function makeSelectedMeshTransparent({
  selectedTreeNode,
  meshOpacity,
  viewerAdapter
}) {
  if (!selectedTreeNode?.isMesh) return false;
  viewerAdapter?.setMeshOpacityByUUID?.(selectedTreeNode.uuid, meshOpacity);
  return true;
}

export function restoreSelectedMeshOpacity({
  selectedTreeNode,
  viewerAdapter
}) {
  if (!selectedTreeNode?.isMesh) return false;
  viewerAdapter?.setMeshOpacityByUUID?.(selectedTreeNode.uuid, 1);
  return true;
}

export async function isolateSelectedNode({
  selectedTreeNode,
  viewerAdapter,
  syncLayerTreeSelection,
  refreshSceneTree
}) {
  if (!selectedTreeNode?.uuid) return false;
  viewerAdapter?.isolateObjectByUUID?.(selectedTreeNode.uuid);
  syncLayerTreeSelection?.([selectedTreeNode.uuid]);
  await refreshSceneTree?.();
  return true;
}

export async function showAllObjects({
  viewerAdapter,
  syncLayerTreeSelection,
  refreshSceneTree
}) {
  viewerAdapter?.clearIsolation?.();
  syncLayerTreeSelection?.();
  await refreshSceneTree?.();
  return true;
}
