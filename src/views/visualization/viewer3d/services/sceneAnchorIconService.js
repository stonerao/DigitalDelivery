const IMAGE_BASE_URL = "/images/";

function createIcon({ key, label, file, kinds }) {
  return {
    key,
    value: key,
    label,
    file,
    url: `${IMAGE_BASE_URL}${file}`,
    kinds
  };
}

export const BUILTIN_SCENE_ANCHOR_ICONS = [
  createIcon({
    key: "alert",
    label: "告警",
    file: "icon-alert.png",
    kinds: ["anchor"]
  }),
  createIcon({
    key: "assembly",
    label: "装配",
    file: "icon-assembly.png",
    kinds: ["anchor"]
  }),
  createIcon({
    key: "open",
    label: "开启",
    file: "icon-open.png",
    kinds: ["anchor"]
  }),
  createIcon({
    key: "close",
    label: "关闭",
    file: "icon-close.png",
    kinds: ["anchor"]
  }),
  createIcon({
    key: "people",
    label: "人员",
    file: "icon-people.png",
    kinds: ["anchor"]
  }),
  createIcon({
    key: "exit",
    label: "安全出口",
    file: "icon-exit.png",
    kinds: ["anchor"]
  }),
  createIcon({
    key: "exit-horizontal",
    label: "安全出口横牌",
    file: "icon-exit1.png",
    kinds: ["anchor"]
  }),
  createIcon({
    key: "extinguisher",
    label: "灭火器",
    file: "icon-extinguisher.png",
    kinds: ["anchor"]
  }),
  createIcon({
    key: "hydrant",
    label: "消防栓",
    file: "icon-hydrant.png",
    kinds: ["anchor"]
  }),
  createIcon({
    key: "emergency",
    label: "应急",
    file: "icon-jj.png",
    kinds: ["anchor"]
  }),
  createIcon({
    key: "marker-blue",
    label: "蓝色标记",
    file: "icon1.png",
    kinds: ["anchor"]
  }),
  createIcon({
    key: "camera-selected",
    label: "摄像头选中",
    file: "camera-selected.png",
    kinds: ["camera"]
  }),
  createIcon({
    key: "camera-pin",
    label: "摄像头点位",
    file: "icon-camera.png",
    kinds: ["camera"]
  }),
  createIcon({
    key: "camera-shield",
    label: "监控",
    file: "icon-cameras.png",
    kinds: ["camera"]
  }),
  createIcon({
    key: "camera-hex",
    label: "六边形摄像头",
    file: "ic_camera02.png",
    kinds: ["camera"]
  }),
  createIcon({
    key: "camera-round",
    label: "圆形摄像头",
    file: "ic_camera021.png",
    kinds: ["camera"]
  })
];

export const SCENE_ANCHOR_ICON_OPTIONS = BUILTIN_SCENE_ANCHOR_ICONS.filter(
  item => item.kinds.includes("anchor")
);

export const CAMERA_ANCHOR_ICON_OPTIONS = BUILTIN_SCENE_ANCHOR_ICONS.filter(
  item => item.kinds.includes("camera")
);

const iconLookup = new Map();

BUILTIN_SCENE_ANCHOR_ICONS.forEach(item => {
  [item.key, item.file, item.url, item.url.replace(/^\//, "")].forEach(key => {
    iconLookup.set(String(key).toLowerCase(), item);
  });
});

function asText(value) {
  return String(value || "").trim();
}

function getFileLabel(url = "") {
  const file = asText(url).split("/").filter(Boolean).pop() || "";
  return file.replace(/\.[^.]+$/, "") || "内置图标";
}

export function resolveSceneAnchorIcon(value) {
  const text = asText(value);
  if (!text) return null;

  const normalized = text.toLowerCase();
  const matched =
    iconLookup.get(normalized) ||
    iconLookup.get(normalized.replace(/^\/?images\//, ""));
  if (matched) return matched;

  if (/\.png$/i.test(text)) {
    const file = text.split("/").filter(Boolean).pop();
    return {
      key: "",
      value: "",
      label: getFileLabel(file),
      file,
      url: text.startsWith("/") ? text : `${IMAGE_BASE_URL}${file}`,
      kinds: ["anchor", "camera"]
    };
  }

  return null;
}

export function normalizeSceneAnchorIconStyle(style = {}) {
  const icon = resolveSceneAnchorIcon(
    style.iconKey || style.iconUrl || style.icon || style.iconFile
  );
  const iconUrl = icon?.url || asText(style.iconUrl);
  if (!iconUrl) {
    return {
      iconKey: "",
      iconUrl: "",
      iconLabel: ""
    };
  }

  return {
    iconKey: icon?.key || asText(style.iconKey),
    iconUrl,
    iconLabel: icon?.label || asText(style.iconLabel) || getFileLabel(iconUrl)
  };
}

export function pickPersistedSceneAnchorIconStyle(style = {}) {
  const normalized = normalizeSceneAnchorIconStyle(style);
  if (!normalized.iconUrl) return undefined;
  return normalized;
}
