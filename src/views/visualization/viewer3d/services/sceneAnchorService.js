import {
  loadProjectPackage,
  patchProjectPackage
} from "./projectPackageService";

export const VIEWER_ANCHOR_STORAGE_KEY = "dd-viewer-scene-anchors";

export const SCENE_ANCHOR_TYPE_OPTIONS = [
  { label: "测点", value: "measurement-point" },
  { label: "设备点", value: "device-point" },
  { label: "标签点", value: "label-point" },
  { label: "告警点", value: "warning-point" },
  { label: "自定义点", value: "custom-point" }
];

export const CAMERA_TYPE_OPTIONS = [
  { label: "固定枪机", value: "fixed" },
  { label: "云台", value: "ptz" },
  { label: "全景", value: "panoramic" }
];

export const CAMERA_STREAM_TYPE_OPTIONS = [
  { label: "FLV", value: "flv" },
  { label: "HLS", value: "hls" },
  { label: "MP4", value: "mp4" },
  { label: "WebRTC", value: "webrtc" }
];

export const CAMERA_WINDOW_MODE_OPTIONS = [
  { label: "弹窗", value: "dialog" },
  { label: "抽屉", value: "drawer" },
  { label: "面板", value: "panel" }
];

export const ANCHOR_BINDING_TYPE_OPTIONS = [
  { label: "测点数据", value: "measurement" },
  { label: "设备状态", value: "device" },
  { label: "自定义", value: "custom" }
];

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function asText(value) {
  return String(value || "").trim();
}

function normalizeVector3(value, fallback = [0, 0, 0]) {
  if (!Array.isArray(value) || value.length < 3) return [...fallback];
  return value.slice(0, 3).map(item => {
    const num = Number(item);
    return Number.isFinite(num) ? num : 0;
  });
}

function normalizePositiveNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

export function normalizeAnchorStyle(style = {}, type = "measurement-point") {
  const isCamera = type === "camera-point";
  return {
    markerSize: normalizePositiveNumber(
      style.markerSize,
      isCamera ? 0.42 : 0.09
    ),
    labelFontSize: normalizePositiveNumber(style.labelFontSize, 24),
    labelOffsetY: normalizePositiveNumber(
      style.labelOffsetY,
      isCamera ? 0.52 : 0.42
    ),
    iconSizeAttenuation: Boolean(style.iconSizeAttenuation),
    showLabel: style.showLabel !== false,
    color: asText(style.color || (isCamera ? "#0f766e" : "")),
    labelColor: asText(style.labelColor || (isCamera ? "#e6f4ff" : "#ffffff"))
  };
}

function buildBaseAnchor(partial = {}, options = {}) {
  const mergedStyle = {
    ...(options.defaultStyle || {}),
    ...(partial.style || {})
  };
  return {
    id: partial.id || createId("anchor"),
    type: partial.type || "measurement-point",
    name: partial.name || "",
    code: partial.code || "",
    description: partial.description || "",
    anchorMode: partial.anchorMode || "object",
    objectUuid: partial.objectUuid || "",
    worldPosition: normalizeVector3(partial.worldPosition),
    offset: normalizeVector3(partial.offset, [0, 0.45, 0]),
    visible: partial.visible !== false,
    groupId: asText(partial.groupId),
    status: asText(partial.status || "normal"),
    businessBinding: {
      nodeId: asText(partial.businessBinding?.nodeId),
      kks: asText(partial.businessBinding?.kks),
      tag: asText(partial.businessBinding?.tag),
      bindingType: partial.businessBinding?.bindingType || "measurement"
    },
    payload: {
      value: asText(partial.payload?.value),
      unit: asText(partial.payload?.unit),
      displayText: asText(partial.payload?.displayText)
    },
    style: normalizeAnchorStyle(
      mergedStyle,
      partial.type || "measurement-point"
    )
  };
}

function buildCameraAnchor(partial = {}, options = {}) {
  const mergedStyle = {
    ...(options.defaultStyle || {}),
    ...(partial.style || {})
  };
  const base = buildBaseAnchor(
    {
      ...partial,
      style: mergedStyle,
      type: "camera-point",
      offset: partial.offset || [0, 0.8, 0]
    },
    options
  );
  return {
    ...base,
    cameraType: partial.cameraType || "fixed",
    cameraCode: asText(partial.cameraCode || partial.code),
    cameraName: asText(partial.cameraName || partial.name),
    streamType: partial.streamType || "flv",
    streamUrl: asText(partial.streamUrl),
    poster: asText(partial.poster),
    vendor: asText(partial.vendor),
    status: partial.status || "online",
    ptzEnabled: Boolean(partial.ptzEnabled),
    audioEnabled: Boolean(partial.audioEnabled),
    defaultWindowMode: partial.defaultWindowMode || "dialog",
    bindDeviceKks: asText(
      partial.bindDeviceKks || partial.businessBinding?.kks
    ),
    bindObjectUuid: asText(partial.bindObjectUuid || partial.objectUuid),
    style: normalizeAnchorStyle(partial.style, "camera-point")
  };
}

export function createEmptyAnchorForm(selectedObject = null) {
  return buildBaseAnchor({
    name: "",
    objectUuid: selectedObject?.uuid || "",
    anchorMode: selectedObject?.uuid ? "object" : "world"
  });
}

export function createEmptyCameraForm(selectedObject = null) {
  return buildCameraAnchor({
    name: "",
    cameraName: "",
    objectUuid: selectedObject?.uuid || "",
    bindObjectUuid: selectedObject?.uuid || "",
    anchorMode: selectedObject?.uuid ? "object" : "world"
  });
}

export function normalizeAnchorForm(form = {}) {
  return buildBaseAnchor(form);
}

export function normalizeCameraForm(form = {}) {
  return buildCameraAnchor(form);
}

export function loadSceneAnchors({
  storageKey: _storageKey = VIEWER_ANCHOR_STORAGE_KEY,
  scope
}) {
  const payload = loadProjectPackage(scope).scene || {};
  return {
    anchors: Array.isArray(payload.anchors)
      ? payload.anchors.map(item => buildBaseAnchor(item))
      : [],
    cameraAnchors: Array.isArray(payload.cameras || payload.cameraAnchors)
      ? (payload.cameras || payload.cameraAnchors).map(item =>
          buildCameraAnchor(item)
        )
      : []
  };
}

export function persistSceneAnchors({
  storageKey: _storageKey = VIEWER_ANCHOR_STORAGE_KEY,
  scope,
  anchors = [],
  cameraAnchors = []
}) {
  if (!scope) return;
  patchProjectPackage(scope, {
    scene: {
      anchors,
      cameras: cameraAnchors
    }
  });
}

export function summarizeAnchorBinding(anchor) {
  if (!anchor) return "-";
  if (anchor.type === "camera-point") {
    return anchor.bindDeviceKks || anchor.cameraCode || "-";
  }
  const binding = anchor.businessBinding || {};
  if (binding.bindingType === "measurement") {
    return [binding.kks, binding.tag].filter(Boolean).join(" / ") || "测点绑定";
  }
  if (binding.bindingType === "device") {
    return binding.kks || "设备绑定";
  }
  return anchor.payload?.displayText || anchor.payload?.value || "自定义";
}

export function resolveAnchorRuntimeState(anchor, helpers = {}) {
  if (!anchor) return null;

  if (anchor.type === "camera-point") {
    return {
      status: anchor.status || "online",
      displayText: anchor.cameraName || anchor.name || "摄像头",
      value: anchor.streamUrl || "",
      unit: "",
      sourceName: anchor.cameraType || "-"
    };
  }

  const binding = anchor.businessBinding || {};
  if (binding.bindingType === "measurement" && binding.kks) {
    const points = helpers.getMeasurementPointsByKks?.(binding.kks) || [];
    const point =
      points.find(
        item => item.id === binding.tag || item.tag === binding.tag
      ) ||
      points[0] ||
      null;
    if (point) {
      return {
        status: anchor.status || point.status || "normal",
        value: point.value ?? "",
        unit: point.unit || "",
        displayText: `${point.tag || point.name || anchor.name || "测点"} ${point.value ?? "-"}${point.unit || ""}`,
        sourceName: point.name || point.tag || ""
      };
    }
  }

  if (binding.bindingType === "device" && binding.kks) {
    const profile = helpers.getDeviceProfileByKks?.(binding.kks);
    const runningParam = profile?.runningParams?.[0] || null;
    return {
      status: anchor.status || runningParam?.status || "normal",
      value: runningParam?.value ?? profile?.name ?? binding.kks,
      unit: runningParam?.unit || "",
      displayText: runningParam
        ? `${runningParam.label} ${runningParam.value}${runningParam.unit || ""}`
        : profile?.name || binding.kks,
      sourceName:
        profile?.systemName || helpers.getNodeLabel?.(binding.nodeId) || ""
    };
  }

  return {
    status:
      anchor.status || (anchor.type === "warning-point" ? "warning" : "normal"),
    value: anchor.payload?.value || "",
    unit: anchor.payload?.unit || "",
    displayText:
      anchor.payload?.displayText || anchor.name || anchor.code || "点位",
    sourceName: "自定义"
  };
}

export function buildRenderableAnchors(items = [], helpers = {}) {
  return items
    .filter(item => item?.visible !== false)
    .map(item => {
      const normalized =
        item.type === "camera-point"
          ? buildCameraAnchor(item)
          : buildBaseAnchor(item);
      return {
        ...normalized,
        runtimeState: resolveAnchorRuntimeState(normalized, helpers)
      };
    });
}

export function upsertItem(list = [], item) {
  const next = Array.isArray(list) ? [...list] : [];
  const index = next.findIndex(entry => entry.id === item.id);
  if (index >= 0) next[index] = item;
  else next.unshift(item);
  return next;
}

export function removeItem(list = [], id) {
  return (Array.isArray(list) ? list : []).filter(item => item.id !== id);
}
