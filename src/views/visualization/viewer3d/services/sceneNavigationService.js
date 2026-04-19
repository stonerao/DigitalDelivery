export function getDevicesBySystem(sceneDevices = [], nodeId) {
  if (!nodeId) return [];
  return sceneDevices.filter(item => item.nodeId === nodeId);
}

export function getDevicesByRegion(
  systemTree = [],
  sceneDevices = [],
  regionId
) {
  if (!regionId) return [];
  const stack = [...systemTree];
  let region = null;
  while (stack.length > 0 && !region) {
    const current = stack.shift();
    if (!current) continue;
    if (current.id === regionId) {
      region = current;
      break;
    }
    if (Array.isArray(current.children) && current.children.length > 0) {
      stack.unshift(...current.children);
    }
  }
  if (!region) return [];
  const systemIds = new Set();
  const walk = nodes => {
    (nodes || []).forEach(node => {
      if (!node?.id) return;
      systemIds.add(node.id);
      if (Array.isArray(node.children) && node.children.length > 0) {
        walk(node.children);
      }
    });
  };
  walk([region]);
  return sceneDevices.filter(item => systemIds.has(item.nodeId));
}

export function syncNavigationSelections(item, setters = {}) {
  if (!item) return;
  setters.setSelectedSystemNodeId?.(item.nodeId || "");
  setters.setSelectedQuickKks?.(item.kks || "");
}

function getSceneDeviceUuids(item) {
  const uuids = Array.isArray(item?.meshUuids) ? item.meshUuids : [];
  return uuids.length ? uuids.filter(Boolean) : item?.uuid ? [item.uuid] : [];
}

function getSceneDevicesUuids(items = []) {
  return items.flatMap(item => getSceneDeviceUuids(item));
}

export function syncLayerTreeSelection({
  keys,
  allLayerLeafKeys = [],
  setLayerCheckedKeys,
  layerTreeRef,
  nextTick
}) {
  const nextKeys = Array.isArray(keys) ? keys : allLayerLeafKeys;
  setLayerCheckedKeys?.([...nextKeys]);
  nextTick?.(() => {
    layerTreeRef?.value?.setCheckedKeys?.(nextKeys);
  });
}

export function applyLayerVisibility({
  viewerAdapter,
  keys,
  allLayerLeafKeys = [],
  sceneDevices = [],
  setDisplayMode
}) {
  if (!viewerAdapter?.isReady?.()) return false;

  const visibleKeys = Array.isArray(keys) ? keys : [];
  if (visibleKeys.length === allLayerLeafKeys.length) {
    viewerAdapter.filterVisibleUUIDs(null);
    setDisplayMode?.("all");
    return true;
  }

  const visibleUuids = sceneDevices
    .filter(item => visibleKeys.includes(item.uuid))
    .flatMap(item => getSceneDeviceUuids(item));
  viewerAdapter.filterVisibleUUIDs(visibleUuids);
  setDisplayMode?.("tree");
  return true;
}

export async function locateDevice({
  item,
  viewerAdapter,
  setSelectedDeviceUuid,
  syncNavigationSelections: syncSelections,
  selectTreeNodeByUUID,
  notify,
  withMessage = true
}) {
  if (!item?.uuid) return false;

  viewerAdapter.selectObjectByUUID(item.uuid, { emitEvent: false });
  viewerAdapter.focusObjectsByUUIDs(getSceneDeviceUuids(item));
  setSelectedDeviceUuid?.(item.uuid);
  syncSelections?.(item);
  await selectTreeNodeByUUID?.(item.uuid, { openPanel: false });

  if (withMessage) {
    notify?.(`已定位到构件：${item.name}`, { type: "success" });
  }
  return true;
}

export async function locateSystem({
  nodeId,
  sceneDevices = [],
  viewerAdapter,
  getDevicesBySystem: getDevicesBySystemFn,
  setSelectedSystemNodeId,
  setSelectedDeviceUuid,
  syncNavigationSelections: syncSelections,
  selectTreeNodeByUUID,
  getSystemLabel,
  notify,
  withMessage = true
}) {
  const devices = getDevicesBySystemFn(sceneDevices, nodeId);
  if (!devices.length) {
    notify?.("当前系统暂无可定位构件", { type: "warning" });
    return false;
  }

  setSelectedSystemNodeId?.(nodeId);
  setSelectedDeviceUuid?.(devices[0].uuid);
  syncSelections?.(devices[0]);
  viewerAdapter.selectObjectByUUID(devices[0].uuid, { emitEvent: false });
  viewerAdapter.focusObjectsByUUIDs(getSceneDevicesUuids(devices));
  await selectTreeNodeByUUID?.(devices[0].uuid, { openPanel: false });

  if (withMessage) {
    notify?.(
      `已定位到系统：${devices[0].systemName || getSystemLabel?.(nodeId)}`,
      {
        type: "success"
      }
    );
  }
  return true;
}

export async function locateRegion({
  regionId,
  systemTree = [],
  sceneDevices = [],
  viewerAdapter,
  getDevicesByRegion: getDevicesByRegionFn,
  setCurrentNavNodeKey,
  setSelectedSystemNodeId,
  setSelectedQuickKks,
  setSelectedDeviceUuid,
  selectTreeNodeByUUID,
  notify,
  withMessage = true
}) {
  const devices = getDevicesByRegionFn(systemTree, sceneDevices, regionId);
  if (!devices.length) {
    notify?.("当前区域暂无可定位构件", { type: "warning" });
    return false;
  }

  setCurrentNavNodeKey?.(`nav-region:${regionId}`);
  setSelectedSystemNodeId?.(devices[0].nodeId || "");
  setSelectedQuickKks?.(devices[0].kks || "");
  setSelectedDeviceUuid?.(devices[0].uuid);
  viewerAdapter.selectObjectByUUID(devices[0].uuid, { emitEvent: false });
  viewerAdapter.focusObjectsByUUIDs(getSceneDevicesUuids(devices));
  await selectTreeNodeByUUID?.(devices[0].uuid, { openPanel: false });

  if (withMessage) {
    notify?.(`已定位到区域：${devices[0].systemName || "厂区分组"}`, {
      type: "success"
    });
  }
  return true;
}

export async function locateByKks({
  kks,
  sceneDevices = [],
  locateDevice: locateDeviceFn,
  notify
}) {
  if (!kks) {
    notify?.("请先选择一个 KKS 设备", { type: "warning" });
    return false;
  }

  const target = sceneDevices.find(item => item.kks === kks);
  if (!target) {
    notify?.("当前模型中未找到该 KKS 对应构件", { type: "warning" });
    return false;
  }

  await locateDeviceFn(target);
  return true;
}

export async function isolateDevice({
  item,
  viewerAdapter,
  setSelectedDeviceUuid,
  syncNavigationSelections: syncSelections,
  setDisplayMode,
  syncLayerTreeSelection: syncLayerSelection,
  selectTreeNodeByUUID,
  notify,
  withMessage = true
}) {
  if (!item?.uuid) {
    notify?.("请先选择一个构件", { type: "warning" });
    return false;
  }

  viewerAdapter.selectObjectByUUID(item.uuid, { emitEvent: false });
  viewerAdapter.showOnlyUUIDs(getSceneDeviceUuids(item));
  viewerAdapter.focusObjectsByUUIDs(getSceneDeviceUuids(item));
  setSelectedDeviceUuid?.(item.uuid);
  syncSelections?.(item);
  setDisplayMode?.("selection");
  syncLayerSelection?.([item.uuid]);
  await selectTreeNodeByUUID?.(item.uuid, { openPanel: false });

  if (withMessage) {
    notify?.(`已隔离显示：${item.name}`, { type: "success" });
  }
  return true;
}

export async function applyDisplayMode({
  mode,
  viewerAdapter,
  sceneDevices = [],
  selectedSystemNodeId,
  selectedSceneDevice,
  getDevicesBySystem: getDevicesBySystemFn,
  isolateDevice: isolateDeviceFn,
  setSelectedDeviceUuid,
  setDisplayMode,
  syncLayerTreeSelection: syncLayerSelection,
  notify,
  withMessage = true
}) {
  if (!viewerAdapter?.isReady?.()) return false;

  if (mode === "all") {
    viewerAdapter.clearIsolation();
    setDisplayMode?.("all");
    syncLayerSelection?.();
    if (withMessage) {
      notify?.("已恢复全部构件显示", { type: "success" });
    }
    return true;
  }

  if (mode === "business") {
    const devices = sceneDevices.filter(item => item.kks);
    if (!devices.length) {
      notify?.("当前模型暂无已绑定业务设备", { type: "warning" });
      return false;
    }
    viewerAdapter.showOnlyUUIDs(getSceneDevicesUuids(devices));
    viewerAdapter.focusObjectsByUUIDs(getSceneDevicesUuids(devices));
    setDisplayMode?.("business");
    syncLayerSelection?.(devices.map(item => item.uuid));
    if (withMessage) {
      notify?.(`已切换为仅显示已绑定设备，共 ${devices.length} 个`, {
        type: "success"
      });
    }
    return true;
  }

  if (mode === "system") {
    const devices = getDevicesBySystemFn(sceneDevices, selectedSystemNodeId);
    if (!devices.length) {
      notify?.("请先选择一个系统", { type: "warning" });
      return false;
    }
    viewerAdapter.showOnlyUUIDs(getSceneDevicesUuids(devices));
    viewerAdapter.focusObjectsByUUIDs(getSceneDevicesUuids(devices));
    setSelectedDeviceUuid?.(devices[0].uuid);
    setDisplayMode?.("system");
    syncLayerSelection?.(devices.map(item => item.uuid));
    if (withMessage) {
      notify?.(`已切换为仅显示系统：${devices[0].systemName}`, {
        type: "success"
      });
    }
    return true;
  }

  if (mode === "selection") {
    if (!selectedSceneDevice?.uuid) {
      notify?.("请先在场景或列表中选择一个构件", { type: "warning" });
      return false;
    }
    await isolateDeviceFn(selectedSceneDevice, false);
    setDisplayMode?.("selection");
    syncLayerSelection?.([selectedSceneDevice.uuid]);
    if (withMessage) {
      notify?.(`已切换为仅显示当前设备：${selectedSceneDevice.name}`, {
        type: "success"
      });
    }
    return true;
  }

  return false;
}

export async function handleNavigationNodeClick({
  node,
  setCurrentNavNodeKey,
  locateRegion,
  locateSystem,
  locateDevice
}) {
  if (!node) return false;
  setCurrentNavNodeKey?.(node.id);

  if (node.kind === "region") {
    await locateRegion(node.nodeId);
    return true;
  }
  if (node.kind === "system") {
    await locateSystem(node.nodeId);
    return true;
  }
  if (node.kind === "device" && node.raw) {
    await locateDevice(node.raw);
    return true;
  }

  return false;
}
