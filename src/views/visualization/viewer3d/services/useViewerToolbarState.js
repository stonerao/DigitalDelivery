import { computed, onBeforeUnmount, onMounted, unref } from "vue";
import {
  VIEWER_MEASUREMENT_MODE_OPTIONS,
  VIEWER_PRESET_VIEWS,
  VIEWER_TOOL_OPTIONS,
  VIEWER_TOOL_SHORTCUT_MAP
} from "./viewerToolbarConfig";

export function useViewerToolbarState(options) {
  const {
    modelReady,
    selectedObjectInfo,
    bookmarks,
    activeTool,
    measurementMode,
    roamingEnabled,
    transparent,
    projectionMode,
    notify,
    syncRoamingState: syncRoamingStateImpl,
    disableRoaming,
    toggleRoaming: toggleRoamingImpl,
    zoomIn: zoomInImpl,
    zoomOut: zoomOutImpl,
    resetView: resetViewImpl,
    toggleProjection: toggleProjectionImpl,
    setPresetView: setPresetViewImpl,
    setMeasurementMode: setMeasurementModeImpl,
    clearMeasurements: clearMeasurementsImpl,
    takeScreenshot: takeScreenshotImpl,
    addBookmark: addBookmarkImpl,
    appendBookmark,
    applyBookmark: applyBookmarkImpl,
    onToolChangeExtra
  } = options;

  const toolOptions = VIEWER_TOOL_OPTIONS;
  const presetViews = VIEWER_PRESET_VIEWS;
  const measurementModeOptions = VIEWER_MEASUREMENT_MODE_OPTIONS;

  const selectedCount = computed(() => (unref(selectedObjectInfo) ? 1 : 0));

  const interactionMode = computed(() => {
    if (activeTool.value === "rotate") return "rotate";
    if (activeTool.value === "pan") return "pan";
    if (activeTool.value === "zoom") return "zoom";
    if (activeTool.value === "measure") return "measure";
    if (activeTool.value === "pick") return "pick";
    return "all";
  });

  function syncRoamingState() {
    syncRoamingStateImpl?.();
  }

  function handleToolShortcut(e) {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (
      tag === "input" ||
      tag === "textarea" ||
      document.activeElement?.isContentEditable
    ) {
      return;
    }

    if (roamingEnabled.value) return;

    const key = e.key?.toLowerCase();
    const toolValue = VIEWER_TOOL_SHORTCUT_MAP[key];
    if (toolValue && toolValue !== activeTool.value) {
      onToolChange(toolValue);
    }
  }

  function onToolChange(value) {
    if (roamingEnabled.value && value !== "rotate") {
      disableRoaming?.();
      syncRoamingState();
    }

    activeTool.value = value;
    onToolChangeExtra?.(value);

    const label = toolOptions.find(item => item.value === value)?.label;
    notify?.(`已切换工具：${label || value}`, { type: "info" });
  }

  function setMeasurementMode(mode) {
    measurementMode.value = mode || "distance";
    setMeasurementModeImpl?.(measurementMode.value);
  }

  function zoomIn() {
    zoomInImpl?.();
  }

  function zoomOut() {
    zoomOutImpl?.();
  }

  function resetView() {
    resetViewImpl?.();
    notify?.("视图已重置", { type: "success" });
  }

  function toggleTransparent() {
    transparent.value = !transparent.value;
    notify?.(transparent.value ? "已开启透明化" : "已关闭透明化", {
      type: "success"
    });
  }

  function toggleProjection() {
    const isOrtho = toggleProjectionImpl?.();
    projectionMode.value = isOrtho ? "orthographic" : "perspective";
    notify?.(isOrtho ? "已切换到正交投影" : "已切换到透视投影", {
      type: "info"
    });
  }

  function toggleRoaming() {
    if (!unref(modelReady)) {
      notify?.("请先加载模型", { type: "warning" });
      return;
    }

    if (activeTool.value !== "rotate") {
      activeTool.value = "rotate";
      onToolChangeExtra?.("rotate");
    }

    toggleRoamingImpl?.();
    syncRoamingState();
    notify?.(
      roamingEnabled.value
        ? "已开启第一人称漫游，点击场景后可用鼠标查看，WASDQE 移动，Shift 加速，Esc 退出"
        : "已退出第一人称漫游",
      { type: "info" }
    );
  }

  function setPresetView(preset) {
    setPresetViewImpl?.(preset);
    const label =
      presetViews.find(item => item.value === preset)?.label || preset;
    notify?.(`已切换到${label}`, { type: "info" });
  }

  function clearMeasurements() {
    clearMeasurementsImpl?.();
    notify?.("已清除所有测量", { type: "success" });
  }

  function takeScreenshot() {
    takeScreenshotImpl?.();
    notify?.("截图已下载", { type: "success" });
  }

  function saveBookmark() {
    const name = `视角 ${(unref(bookmarks) || []).length + 1}`;
    const bookmark = addBookmarkImpl?.(name);
    if (!bookmark) return;

    if (appendBookmark) {
      appendBookmark(bookmark);
    } else if (Array.isArray(bookmarks?.value)) {
      bookmarks.value.push(bookmark);
    }

    notify?.(`已保存视角书签：${name}`, { type: "success" });
  }

  function applyBookmark(bookmark) {
    applyBookmarkImpl?.(bookmark);
    notify?.(`已切换到书签视角：${bookmark.name}`, { type: "info" });
  }

  onMounted(() => {
    window.addEventListener("keydown", handleToolShortcut);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", handleToolShortcut);
  });

  return {
    toolOptions,
    presetViews,
    measurementModeOptions,
    selectedCount,
    interactionMode,
    syncRoamingState,
    onToolChange,
    setMeasurementMode,
    zoomIn,
    zoomOut,
    resetView,
    toggleTransparent,
    toggleProjection,
    toggleRoaming,
    setPresetView,
    clearMeasurements,
    takeScreenshot,
    saveBookmark,
    applyBookmark
  };
}
