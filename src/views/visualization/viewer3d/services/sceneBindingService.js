export function normalizeBindingText(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
}

export function buildConfiguredObjectBindings(items = []) {
  return (Array.isArray(items) ? items : [])
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
}

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

  return nodeName || firstName || String(node?.type || "Mesh").trim();
}

export function flattenSceneMeshes(
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

function matchConfiguredBinding(
  binding,
  normalizedTexts = [],
  rawTexts = [],
  item
) {
  if (!binding?.kks) return false;

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

  if (!binding.matchRegex) return false;

  try {
    const regex = new RegExp(binding.matchRegex, "i");
    return rawTexts.some(text => regex.test(String(text || "")));
  } catch {
    return false;
  }
}

export function resolveBusinessBinding({
  item,
  businessDevices = [],
  configuredBindings = [],
  usedKks = new Set()
}) {
  if (!item || !businessDevices.length) return null;

  const rawTexts = [item.name, item.path, `${item.name} ${item.path}`];
  const normalizedTexts = rawTexts.map(normalizeBindingText);

  const configuredBinding = configuredBindings.find(binding => {
    if (!binding?.kks || usedKks.has(binding.kks)) return false;
    return matchConfiguredBinding(binding, normalizedTexts, rawTexts, item);
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
    return {
      kks: configuredBinding.kks,
      nodeId: configuredBinding.nodeId || ""
    };
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
  return null;
}

export function buildSceneDevices({
  tree,
  businessDevices = [],
  configuredBindings = [],
  getDeviceProfileByKks,
  getNodeLabel
}) {
  if (!tree) return [];

  const usedKks = new Set();
  return flattenSceneMeshes(tree)
    .filter(item => item.uuid)
    .map(item => {
      const binding = resolveBusinessBinding({
        item,
        businessDevices,
        configuredBindings,
        usedKks
      });
      const profile = binding ? getDeviceProfileByKks?.(binding.kks) : null;

      return {
        ...item,
        kks: binding?.kks || "",
        nodeId: binding?.nodeId || "",
        status: binding?.status || "-",
        systemName:
          profile?.systemName || getNodeLabel?.(binding?.nodeId || "") || ""
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}
