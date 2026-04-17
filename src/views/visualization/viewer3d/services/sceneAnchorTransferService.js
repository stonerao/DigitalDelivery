import * as XLSX from "xlsx";
import { normalizeAnchorForm, normalizeCameraForm } from "./sceneAnchorService";

function toText(value) {
  return String(value ?? "").trim();
}

function toBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  const text = toText(value).toLowerCase();
  if (!text) return fallback;
  if (["true", "1", "yes", "y", "是"].includes(text)) return true;
  if (["false", "0", "no", "n", "否"].includes(text)) return false;
  return fallback;
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildAnchorExcelRows(items = []) {
  return items.map(item => ({
    ID: item.id || "",
    点位类型: item.type || "",
    名称: item.name || "",
    编码: item.code || "",
    描述: item.description || "",
    定位方式: item.anchorMode || "",
    绑定构件UUID: item.objectUuid || "",
    世界坐标X: item.worldPosition?.[0] ?? "",
    世界坐标Y: item.worldPosition?.[1] ?? "",
    世界坐标Z: item.worldPosition?.[2] ?? "",
    偏移X: item.offset?.[0] ?? "",
    偏移Y: item.offset?.[1] ?? "",
    偏移Z: item.offset?.[2] ?? "",
    是否可见: item.visible !== false,
    状态: item.status || "",
    绑定类型: item.businessBinding?.bindingType || "",
    绑定KKS: item.businessBinding?.kks || "",
    绑定测点: item.businessBinding?.tag || "",
    显示文本: item.payload?.displayText || "",
    数值: item.payload?.value || "",
    单位: item.payload?.unit || ""
  }));
}

function buildCameraExcelRows(items = []) {
  return items.map(item => ({
    ID: item.id || "",
    摄像头类型: item.cameraType || "",
    名称: item.name || "",
    摄像头名称: item.cameraName || "",
    编码: item.code || "",
    摄像头编码: item.cameraCode || "",
    描述: item.description || "",
    定位方式: item.anchorMode || "",
    绑定构件UUID: item.objectUuid || "",
    世界坐标X: item.worldPosition?.[0] ?? "",
    世界坐标Y: item.worldPosition?.[1] ?? "",
    世界坐标Z: item.worldPosition?.[2] ?? "",
    偏移X: item.offset?.[0] ?? "",
    偏移Y: item.offset?.[1] ?? "",
    偏移Z: item.offset?.[2] ?? "",
    是否可见: item.visible !== false,
    状态: item.status || "",
    绑定设备KKS: item.bindDeviceKks || "",
    流类型: item.streamType || "",
    流地址: item.streamUrl || "",
    打开方式: item.defaultWindowMode || ""
  }));
}

function normalizeAnchorExcelRow(row = {}) {
  return normalizeAnchorForm({
    id: toText(row.ID),
    type: toText(row.点位类型) || "measurement-point",
    name: toText(row.名称),
    code: toText(row.编码),
    description: toText(row.描述),
    anchorMode: toText(row.定位方式) || "object",
    objectUuid: toText(row.绑定构件UUID),
    worldPosition: [
      toNumber(row.世界坐标X),
      toNumber(row.世界坐标Y),
      toNumber(row.世界坐标Z)
    ],
    offset: [
      toNumber(row.偏移X),
      toNumber(row.偏移Y, 0.45),
      toNumber(row.偏移Z)
    ],
    visible: toBoolean(row.是否可见, true),
    status: toText(row.状态) || "normal",
    businessBinding: {
      bindingType: toText(row.绑定类型) || "measurement",
      kks: toText(row.绑定KKS),
      tag: toText(row.绑定测点)
    },
    payload: {
      displayText: toText(row.显示文本),
      value: toText(row.数值),
      unit: toText(row.单位)
    }
  });
}

function normalizeCameraExcelRow(row = {}) {
  return normalizeCameraForm({
    id: toText(row.ID),
    cameraType: toText(row.摄像头类型) || "fixed",
    name: toText(row.名称) || toText(row.摄像头名称),
    cameraName: toText(row.摄像头名称) || toText(row.名称),
    code: toText(row.编码),
    cameraCode: toText(row.摄像头编码) || toText(row.编码),
    description: toText(row.描述),
    anchorMode: toText(row.定位方式) || "object",
    objectUuid: toText(row.绑定构件UUID),
    bindObjectUuid: toText(row.绑定构件UUID),
    worldPosition: [
      toNumber(row.世界坐标X),
      toNumber(row.世界坐标Y),
      toNumber(row.世界坐标Z)
    ],
    offset: [
      toNumber(row.偏移X),
      toNumber(row.偏移Y, 0.8),
      toNumber(row.偏移Z)
    ],
    visible: toBoolean(row.是否可见, true),
    status: toText(row.状态) || "online",
    bindDeviceKks: toText(row.绑定设备KKS),
    streamType: toText(row.流类型) || "flv",
    streamUrl: toText(row.流地址),
    defaultWindowMode: toText(row.打开方式) || "dialog"
  });
}

export function exportSceneAnchorJson({ kind, items = [] }) {
  const payload = {
    kind,
    exportedAt: new Date().toISOString(),
    items
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  downloadBlob(
    blob,
    `${kind === "camera" ? "camera-anchors" : "anchors"}-${new Date().toISOString().slice(0, 10)}.json`
  );
}

export function exportSceneAnchorExcel({ kind, items = [] }) {
  const rows =
    kind === "camera"
      ? buildCameraExcelRows(items)
      : buildAnchorExcelRows(items);
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    kind === "camera" ? "摄像头点位" : "普通点位"
  );
  const output = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const blob = new Blob([output], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  downloadBlob(
    blob,
    `${kind === "camera" ? "camera-anchors" : "anchors"}-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

export async function importSceneAnchorFile({ file, kind, format }) {
  if (!file) return [];

  if (format === "json") {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const source = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.items)
        ? parsed.items
        : Array.isArray(parsed?.[kind === "camera" ? "cameras" : "anchors"])
          ? parsed[kind === "camera" ? "cameras" : "anchors"]
          : [];
    return source.map(item =>
      kind === "camera" ? normalizeCameraForm(item) : normalizeAnchorForm(item)
    );
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames?.[0];
  const worksheet = workbook.Sheets?.[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    raw: false,
    defval: ""
  });
  return rows.map(row =>
    kind === "camera"
      ? normalizeCameraExcelRow(row)
      : normalizeAnchorExcelRow(row)
  );
}
