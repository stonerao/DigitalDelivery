const CLIPPING_AXES = ["x", "y", "z"];

export const CLIPPING_MODE_OPTIONS = [
  { label: "单平面", value: "single-plane" },
  { label: "盒状剖切", value: "box" }
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
  { label: "中心切盒", value: "box-center" },
  { label: "纵向切盒", value: "box-tunnel-x" }
];

function clamp01(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(1, num));
}

function normalizeRange(input, fallback = [0, 1]) {
  const pair = Array.isArray(input) ? input : fallback;
  let min = clamp01(pair[0], fallback[0]);
  let max = clamp01(pair[1], fallback[1]);
  if (min > max) [min, max] = [max, min];

  if (max - min < 0.01) {
    const center = (min + max) * 0.5;
    min = Math.max(0, center - 0.005);
    max = Math.min(1, center + 0.005);
  }

  return [min, max];
}

function createDefaultBoxAxisState() {
  return {
    enabled: false,
    range: [0.2, 0.8]
  };
}

export function createDefaultClippingState() {
  return {
    enabled: false,
    mode: "single-plane",
    helpersVisible: true,
    capEnabled: false,
    feedbackMode: "highlight-affected",
    presetId: "",
    singlePlane: {
      axis: "x",
      position: 0.5,
      direction: "positive"
    },
    box: {
      x: createDefaultBoxAxisState(),
      y: createDefaultBoxAxisState(),
      z: createDefaultBoxAxisState()
    }
  };
}

export function cloneClippingState(state) {
  return JSON.parse(
    JSON.stringify(
      normalizeClippingState(state || createDefaultClippingState())
    )
  );
}

export function normalizeClippingState(input = {}) {
  const fallback = createDefaultClippingState();
  const singlePlane = input.singlePlane || {};
  const box = input.box || {};

  return {
    enabled: Boolean(input.enabled),
    mode:
      input.mode === "box" || input.mode === "single-plane"
        ? input.mode
        : fallback.mode,
    helpersVisible:
      input.helpersVisible === undefined
        ? fallback.helpersVisible
        : Boolean(input.helpersVisible),
    capEnabled:
      input.capEnabled === undefined
        ? fallback.capEnabled
        : Boolean(input.capEnabled),
    feedbackMode: CLIPPING_FEEDBACK_OPTIONS.some(
      item => item.value === input.feedbackMode
    )
      ? input.feedbackMode
      : fallback.feedbackMode,
    presetId: String(input.presetId || ""),
    singlePlane: {
      axis: CLIPPING_AXES.includes(singlePlane.axis)
        ? singlePlane.axis
        : fallback.singlePlane.axis,
      position: clamp01(singlePlane.position, fallback.singlePlane.position),
      direction: singlePlane.direction === "negative" ? "negative" : "positive"
    },
    box: {
      x: {
        enabled:
          box.x?.enabled === undefined
            ? fallback.box.x.enabled
            : Boolean(box.x.enabled),
        range: normalizeRange(box.x?.range, fallback.box.x.range)
      },
      y: {
        enabled:
          box.y?.enabled === undefined
            ? fallback.box.y.enabled
            : Boolean(box.y.enabled),
        range: normalizeRange(box.y?.range, fallback.box.y.range)
      },
      z: {
        enabled:
          box.z?.enabled === undefined
            ? fallback.box.z.enabled
            : Boolean(box.z.enabled),
        range: normalizeRange(box.z?.range, fallback.box.z.range)
      }
    }
  };
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
      next.singlePlane = { axis: "y", position: 0.5, direction: "positive" };
      break;
    case "section-z":
      next.mode = "single-plane";
      next.singlePlane = { axis: "z", position: 0.5, direction: "positive" };
      break;
    case "box-center":
      next.mode = "box";
      next.box = {
        x: { enabled: true, range: [0.18, 0.82] },
        y: { enabled: true, range: [0.18, 0.82] },
        z: { enabled: true, range: [0.18, 0.82] }
      };
      break;
    case "box-tunnel-x":
      next.mode = "box";
      next.box = {
        x: { enabled: false, range: [0, 1] },
        y: { enabled: true, range: [0.2, 0.8] },
        z: { enabled: true, range: [0.2, 0.8] }
      };
      break;
    case "section-x":
    default:
      next.mode = "single-plane";
      next.singlePlane = { axis: "x", position: 0.5, direction: "positive" };
      break;
  }

  return normalizeClippingState(next);
}

export function resetClippingState(state) {
  const current = normalizeClippingState(state);
  return {
    ...createDefaultClippingState(),
    helpersVisible: current.helpersVisible,
    capEnabled: current.capEnabled,
    feedbackMode: current.feedbackMode
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

  const hasEnabledAxis = CLIPPING_AXES.some(
    axis => normalized.box[axis].enabled
  );
  if (hasEnabledAxis) {
    return {
      ...normalized,
      enabled: true
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
    }
  };
}

export function getActiveClippingSummary(state) {
  const normalized = normalizeClippingState(state);
  if (!normalized.enabled) return "未启用";
  if (normalized.mode === "single-plane") {
    const axisText = normalized.singlePlane.axis.toUpperCase();
    const directionText =
      normalized.singlePlane.direction === "negative" ? "负向" : "正向";
    return `${axisText} 轴单平面 / ${directionText}`;
  }

  const axes = CLIPPING_AXES.filter(axis => normalized.box[axis].enabled).map(
    axis => axis.toUpperCase()
  );
  return axes.length ? `盒状剖切 / ${axes.join("/")}` : "盒状剖切";
}
