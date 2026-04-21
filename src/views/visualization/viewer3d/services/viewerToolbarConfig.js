export const VIEWER_TOOL_OPTIONS = [
  { label: "旋转(Q)", value: "rotate" },
  { label: "平移(W)", value: "pan" },
  { label: "缩放(S)", value: "zoom" },
  { label: "测量(C)", value: "measure" },
  { label: "拾取(F)", value: "pick" }
];

export const VIEWER_TOOL_SHORTCUT_MAP = {
  q: "rotate",
  w: "pan",
  s: "zoom",
  c: "measure",
  f: "pick"
};

export const VIEWER_PRESET_VIEWS = [
  { label: "等轴测", value: "iso" },
  { label: "顶视图", value: "top" },
  { label: "前视图", value: "front" },
  { label: "左视图", value: "left" },
  { label: "右视图", value: "right" },
  { label: "后视图", value: "back" }
];

export const VIEWER_MEASUREMENT_MODE_OPTIONS = [
  { label: "点距", value: "distance" },
  { label: "折线", value: "polyline" },
  { label: "夹角", value: "angle" },
  { label: "面积", value: "area" }
];
