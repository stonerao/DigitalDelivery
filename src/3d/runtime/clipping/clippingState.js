const CLIPPING_AXES = ["x", "y", "z"];
const CLIPPING_TARGET_MODES = ["scene", "object", "objects"];
const CLIPPING_EDIT_MODES = ["translate", "rotate"];

export const CLIPPING_MODE_OPTIONS = [
  { label: "单平面", value: "single-plane" },
  { label: "多平面", value: "multi-plane" }
];

export const CLIPPING_TARGET_OPTIONS = [
  { label: "整体场景", value: "scene" },
  { label: "当前物体", value: "object" },
  { label: "多选物体", value: "objects" }
];

export const CLIPPING_AXIS_OPTIONS = [
  { label: "X 轴", value: "x" },
  { label: "Y 轴", value: "y" },
  { label: "Z 轴", value: "z" }
];

export const CLIPPING_DIRECTION_OPTIONS = [
  { label: "保留正向", value: "positive" },
  { label: "保留负向", value: "negative" }
];

export const CLIPPING_FEEDBACK_OPTIONS = [
  { label: "无强调", value: "none" },
  { label: "高亮受影响构件", value: "highlight-affected" },
  { label: "淡化未受影响构件", value: "dim-unaffected" }
];

export const CLIPPING_PRESET_OPTIONS = [
  { label: "X 轴剖面", value: "section-x" },
  { label: "Y 轴剖面", value: "section-y" },
  { label: "Z 轴剖面", value: "section-z" },
  { label: "双平面夹层", value: "multi-slab-x" }
];

export const CLIPPING_EDIT_MODE_OPTIONS = [
  { label: "移动剖切面", value: "translate" },
  { label: "旋转剖切面", value: "rotate" }
];

function clamp01(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(1, num));
}

function clampNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeVector(input, fallback, length) {
  const values = Array.isArray(input) ? input : fallback;
  return Array.from({ length }, (_, index) =>
    clampNumber(values[index], fallback[index] ?? 0)
  );
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map(item => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

function getAxisNormal(axis, direction = "positive") {
  const sign = direction === "negative" ? -1 : 1;
  if (axis === "y") return [0, sign, 0];
  if (axis === "z") return [0, 0, sign];
  return [sign, 0, 0];
}

function getAxisQuaternion(axis) {
  if (axis === "x") return [0, Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4)];
  if (axis === "y")
    return [Math.sin(-Math.PI / 4), 0, 0, Math.cos(Math.PI / 4)];
  return [0, 0, 0, 1];
}

function createDefaultPlaneState(axis = "x", direction = "positive") {
  return {
    id: `plane-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    name: "剖切面",
    enabled: true,
    custom: false,
    axis,
    normal: getAxisNormal(axis, direction),
    constant: 0,
    position: [0, 0, 0],
    quaternion: getAxisQuaternion(axis),
    size: [1, 1],
    direction
  };
}

function createPlaneState({
  id = "",
  name = "",
  axis = "x",
  direction = "positive",
  position = 0.5
} = {}) {
  return {
    ...createDefaultPlaneState(axis, direction),
    id: id || `plane-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    name: name || "剖切面",
    axis,
    normalizedPosition: clamp01(position, 0.5)
  };
}

export function createDefaultClippingState() {
  return {
    enabled: false,
    mode: "single-plane",
    targetMode: "scene",
    targetObjectUuid: "",
    targetObjectName: "",
    targets: {
      mode: "scene",
      objectUuids: [],
      objectNames: []
    },
    helpersVisible: true,
    capEnabled: false,
    feedbackMode: "none",
    editMode: "translate",
    nonTargetOpacity: 0.2,
    presetId: "",
    singlePlane: {
      axis: "x",
      position: 0.5,
      direction: "positive"
    },
    plane: createPlaneState({ id: "plane-primary", name: "剖切面 1" }),
    planes: [createPlaneState({ id: "plane-primary", name: "剖切面 1" })],
    activePlaneId: "plane-primary"
  };
}

export function cloneClippingState(state) {
  return JSON.parse(
    JSON.stringify(
      normalizeClippingState(state || createDefaultClippingState())
    )
  );
}

function normalizeTargets(input = {}, legacy = {}) {
  const explicitMode = CLIPPING_TARGET_MODES.includes(input.mode)
    ? input.mode
    : "";
  const legacyMode =
    legacy.targetMode === "object" || legacy.targetMode === "objects"
      ? legacy.targetMode
      : "scene";
  const mode = explicitMode || legacyMode;
  const objectUuids = uniqueStrings(
    input.objectUuids?.length
      ? input.objectUuids
      : legacy.targetObjectUuid
        ? [legacy.targetObjectUuid]
        : []
  );
  const objectNames = uniqueStrings(
    input.objectNames?.length
      ? input.objectNames
      : legacy.targetObjectName
        ? [legacy.targetObjectName]
        : []
  );

  if (mode === "scene") {
    return {
      mode: "scene",
      objectUuids: [],
      objectNames: []
    };
  }

  return {
    mode: mode === "object" ? "objects" : "objects",
    objectUuids,
    objectNames
  };
}

function normalizePlane(input = {}, singlePlane) {
  const fallback = createDefaultPlaneState(
    input.axis || singlePlane.axis,
    singlePlane.direction
  );
  const normal = normalizeVector(input.normal, fallback.normal, 3);
  const length = Math.hypot(normal[0], normal[1], normal[2]);
  const normalizedNormal =
    length > 0.000001
      ? normal.map(item => item / length)
      : [...fallback.normal];

  return {
    id: String(input.id || fallback.id),
    name: String(input.name || fallback.name),
    enabled:
      input.enabled === undefined ? fallback.enabled : Boolean(input.enabled),
    custom: Boolean(input.custom),
    axis: CLIPPING_AXES.includes(input.axis) ? input.axis : singlePlane.axis,
    normalizedPosition: clamp01(
      input.normalizedPosition ?? singlePlane.position,
      singlePlane.position
    ),
    normal: normalizedNormal,
    constant: clampNumber(input.constant, fallback.constant),
    position: normalizeVector(input.position, fallback.position, 3),
    quaternion: normalizeVector(input.quaternion, fallback.quaternion, 4),
    size: normalizeVector(input.size, fallback.size, 2).map(item =>
      Math.max(0.1, item)
    ),
    direction: input.direction === "negative" ? "negative" : "positive"
  };
}

function normalizePlanes(input, singlePlane, fallbackPlane) {
  const rawPlanes =
    Array.isArray(input) && input.length ? input : [fallbackPlane];
  return rawPlanes.slice(0, 6).map((item, index) => {
    const normalized = normalizePlane(
      {
        ...item,
        id: item?.id || `plane-${index + 1}`,
        name: item?.name || `剖切面 ${index + 1}`
      },
      singlePlane
    );
    return {
      ...normalized,
      id: normalized.id || `plane-${index + 1}`,
      name: normalized.name || `剖切面 ${index + 1}`
    };
  });
}

export function normalizeClippingState(input = {}) {
  const fallback = createDefaultClippingState();
  const singlePlane = input.singlePlane || {};
  const normalizedSinglePlane = {
    axis: CLIPPING_AXES.includes(singlePlane.axis)
      ? singlePlane.axis
      : fallback.singlePlane.axis,
    position: clamp01(singlePlane.position, fallback.singlePlane.position),
    direction: singlePlane.direction === "negative" ? "negative" : "positive"
  };
  const targets = normalizeTargets(input.targets, input);
  const targetObjectUuid =
    targets.objectUuids[0] || String(input.targetObjectUuid || "");
  const targetObjectName =
    targets.objectNames[0] || String(input.targetObjectName || "");
  const normalizedPlane = normalizePlane(input.plane, normalizedSinglePlane);
  const normalizedPlanes = normalizePlanes(
    input.planes,
    normalizedSinglePlane,
    normalizedPlane
  );
  const activePlaneId = normalizedPlanes.some(
    item => item.id === input.activePlaneId
  )
    ? String(input.activePlaneId)
    : normalizedPlanes[0]?.id || normalizedPlane.id;

  return {
    enabled: Boolean(input.enabled),
    mode: ["single-plane", "multi-plane"].includes(input.mode)
      ? input.mode
      : fallback.mode,
    targetMode: targets.mode === "scene" ? "scene" : "object",
    targetObjectUuid,
    targetObjectName,
    targets,
    helpersVisible:
      input.helpersVisible === undefined
        ? fallback.helpersVisible
        : Boolean(input.helpersVisible),
    capEnabled:
      input.capEnabled === undefined
        ? fallback.capEnabled
        : Boolean(input.capEnabled),
    feedbackMode: "none",
    editMode: CLIPPING_EDIT_MODES.includes(input.editMode)
      ? input.editMode
      : fallback.editMode,
    nonTargetOpacity: Math.max(
      0.02,
      Math.min(
        0.8,
        clampNumber(input.nonTargetOpacity, fallback.nonTargetOpacity)
      )
    ),
    presetId: String(input.presetId || ""),
    singlePlane: normalizedSinglePlane,
    plane: normalizedPlane,
    planes: normalizedPlanes,
    activePlaneId
  };
}

function resetPlaneForAxis(next, axis, direction = "positive") {
  next.singlePlane = { axis, position: 0.5, direction };
  next.plane = createPlaneState({
    id: "plane-primary",
    name: "剖切面 1",
    axis,
    direction
  });
  next.planes = [next.plane];
  next.activePlaneId = next.plane.id;
}

function buildSlabPlanes(axis = "x") {
  return [
    createPlaneState({
      id: "plane-slab-a",
      name: "夹层面 A",
      axis,
      direction: "positive",
      position: 0.35
    }),
    createPlaneState({
      id: "plane-slab-b",
      name: "夹层面 B",
      axis,
      direction: "negative",
      position: 0.65
    })
  ];
}

export function applyClippingPreset(state, presetId) {
  const current = normalizeClippingState(state);
  const next = cloneClippingState(current);
  next.enabled = true;
  next.helpersVisible = true;
  next.presetId = presetId || "";

  switch (presetId) {
    case "section-y":
      next.mode = "single-plane";
      resetPlaneForAxis(next, "y");
      break;
    case "section-z":
      next.mode = "single-plane";
      resetPlaneForAxis(next, "z");
      break;
    case "multi-slab-x":
      next.mode = "multi-plane";
      next.planes = buildSlabPlanes("x");
      next.activePlaneId = next.planes[0].id;
      next.plane = next.planes[0];
      break;
    case "section-x":
    default:
      next.mode = "single-plane";
      resetPlaneForAxis(next, "x");
      break;
  }

  return normalizeClippingState(next);
}

export function resetClippingState(state) {
  const current = normalizeClippingState(state);
  return {
    ...createDefaultClippingState(),
    targetMode: current.targetMode,
    targetObjectUuid: current.targetObjectUuid,
    targetObjectName: current.targetObjectName,
    targets: current.targets,
    helpersVisible: current.helpersVisible,
    capEnabled: current.capEnabled,
    feedbackMode: current.feedbackMode,
    editMode: current.editMode,
    nonTargetOpacity: current.nonTargetOpacity,
    activePlaneId: current.activePlaneId
  };
}

export function ensureVisibleClippingState(state) {
  const normalized = normalizeClippingState(state);
  if (normalized.mode === "single-plane") {
    return {
      ...normalized,
      enabled: true
    };
  }

  if (normalized.mode === "multi-plane") {
    return {
      ...normalized,
      enabled: true,
      planes: normalized.planes.some(item => item.enabled)
        ? normalized.planes
        : normalized.planes.map((item, index) => ({
            ...item,
            enabled: index === 0
          }))
    };
  }

  return {
    ...normalized,
    enabled: true,
    mode: "single-plane",
    singlePlane: {
      axis: "x",
      position: 0.5,
      direction: "positive"
    },
    plane: createPlaneState({ id: "plane-primary", name: "剖切面 1" }),
    planes: [createPlaneState({ id: "plane-primary", name: "剖切面 1" })],
    activePlaneId: "plane-primary"
  };
}

function getTargetText(normalized) {
  if (normalized.targets.mode === "scene") return "整体场景";
  const count = normalized.targets.objectUuids.length;
  if (count > 1) return `${count} 个物体`;
  return normalized.targetObjectName || "当前物体";
}

export function getActiveClippingSummary(state) {
  const normalized = normalizeClippingState(state);
  if (!normalized.enabled) return "未启用";
  const targetText = getTargetText(normalized);
  if (normalized.mode === "single-plane") {
    if (normalized.plane.custom) {
      const [x, y, z] = normalized.plane.normal;
      return `任意角度单平面 / 法线 ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)} / ${targetText}`;
    }
    const axisText = normalized.singlePlane.axis.toUpperCase();
    const directionText =
      normalized.singlePlane.direction === "negative" ? "负向" : "正向";
    return `${axisText} 轴单平面 / ${directionText} / ${targetText}`;
  }

  if (normalized.mode === "multi-plane") {
    const count = normalized.planes.filter(item => item.enabled).length;
    return `多平面剖切 / ${count || 0} 个平面 / ${targetText}`;
  }

  return `单平面剖切 / ${targetText}`;
}
