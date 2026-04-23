<script setup>
import {
  createApp,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch
} from "vue";
import ElementPlus from "element-plus";

defineOptions({ name: "CadViewer" });

const props = defineProps({
  url: { type: String, default: "" },
  blob: { type: Object, default: null },
  name: { type: String, default: "" }
});

const hostRef = ref(null);
const loading = ref(false);
const errorText = ref("");

const viewerState = reactive({
  localFile: undefined
});

const ROOT_DARK_CLASS = "dark";
const ROOT_ML_THEME_ATTR = "data-ml-ui-theme";
const CAD_GLOBAL_RESET_STYLE_ID = "dd-cad-viewer-global-reset";
const ML_UI_CSS_VARS = [
  "--ml-ui-text",
  "--ml-ui-text-muted",
  "--ml-ui-bg",
  "--ml-ui-border",
  "--ml-ui-shadow",
  "--ml-ui-overlay",
  "--ml-ui-accent",
  "--ml-ui-accent-alt",
  "--ml-ui-danger",
  "--ml-ui-canvas-line",
  "--ml-ui-canvas-fill",
  "--ml-ui-canvas-fill-mix"
];

let cadApp = null;
let loadAbortController = null;
let rootThemeSnapshot = null;
let rootThemeObserver = null;
let restoreRootThemeTimers = [];
let trackedEventBusHandlers = [];
let cadRuntime = null;
let cadRuntimePromise = null;

function loadCadRuntime() {
  if (!cadRuntimePromise) {
    cadRuntimePromise = Promise.all([
      import("@mlightcad/cad-viewer"),
      import("@mlightcad/cad-simple-viewer")
    ]).then(([viewerModule, simpleViewerModule]) => {
      cadRuntime = {
        cadViewerI18n: viewerModule.i18n,
        MlCadViewer: viewerModule.MlCadViewer,
        AcApDocManager: simpleViewerModule.AcApDocManager,
        AcApSettingManager: simpleViewerModule.AcApSettingManager,
        AcEdOpenMode: simpleViewerModule.AcEdOpenMode,
        eventBus: simpleViewerModule.eventBus
      };
      return cadRuntime;
    });
  }
  return cadRuntimePromise;
}

function ensureCadViewerGlobalResetStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(CAD_GLOBAL_RESET_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = CAD_GLOBAL_RESET_STYLE_ID;
  style.textContent = `
body {
  display: block;
}

html,
body {
  height: 100%;
}
`;
  document.head.appendChild(style);
}

function ensureDwgFileName(name = "") {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "drawing.dwg";
  return /\.(dwg|dxf)$/i.test(trimmed) ? trimmed : `${trimmed}.dwg`;
}

function configureCadViewerSettings(runtime) {
  const settings = runtime.AcApSettingManager.instance;
  settings.isShowCommandLine = false;
  settings.isShowCoordinate = true;
  settings.isShowEntityInfo = false;
  settings.isShowFileName = false;
  settings.isShowLanguageSelector = false;
  settings.isShowMainMenu = true;
  settings.isShowStats = false;
  settings.isShowToolbar = true;
}

function captureRootThemeState() {
  if (typeof document === "undefined") return null;
  const root = document.documentElement;
  return {
    hadDarkClass: root.classList.contains(ROOT_DARK_CLASS),
    mlTheme: root.getAttribute(ROOT_ML_THEME_ATTR),
    mlVars: ML_UI_CSS_VARS.map(name => ({
      name,
      value: root.style.getPropertyValue(name),
      priority: root.style.getPropertyPriority(name)
    }))
  };
}

function clearRootThemeRestoreTimers() {
  if (typeof window !== "undefined") {
    restoreRootThemeTimers.forEach(timer => window.clearTimeout(timer));
  }
  restoreRootThemeTimers = [];
}

function restoreRootThemeSideEffects(snapshot = rootThemeSnapshot) {
  if (!snapshot || typeof document === "undefined") return;

  const root = document.documentElement;
  root.classList.toggle(ROOT_DARK_CLASS, snapshot.hadDarkClass);

  if (snapshot.mlTheme === null) {
    if (root.hasAttribute(ROOT_ML_THEME_ATTR)) {
      root.removeAttribute(ROOT_ML_THEME_ATTR);
    }
  } else if (root.getAttribute(ROOT_ML_THEME_ATTR) !== snapshot.mlTheme) {
    root.setAttribute(ROOT_ML_THEME_ATTR, snapshot.mlTheme);
  }

  snapshot.mlVars.forEach(({ name, value, priority }) => {
    if (value) {
      const currentValue = root.style.getPropertyValue(name);
      const currentPriority = root.style.getPropertyPriority(name);
      if (currentValue !== value || currentPriority !== priority) {
        root.style.setProperty(name, value, priority);
      }
    } else if (root.style.getPropertyValue(name)) {
      root.style.removeProperty(name);
    }
  });
}

function scheduleRootThemeRestore(snapshot = rootThemeSnapshot, delays = [0]) {
  restoreRootThemeSideEffects(snapshot);
  if (typeof window === "undefined") return;

  clearRootThemeRestoreTimers();
  delays.forEach(delay => {
    const timer = window.setTimeout(() => {
      restoreRootThemeTimers = restoreRootThemeTimers.filter(
        item => item !== timer
      );
      restoreRootThemeSideEffects(snapshot);
    }, delay);
    restoreRootThemeTimers.push(timer);
  });
}

function startRootThemeGuard() {
  if (rootThemeSnapshot || typeof document === "undefined") return;

  clearRootThemeRestoreTimers();
  rootThemeSnapshot = captureRootThemeState();
  if (!rootThemeSnapshot || typeof MutationObserver === "undefined") return;

  rootThemeObserver = new MutationObserver(() => {
    scheduleRootThemeRestore();
  });
  rootThemeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", ROOT_ML_THEME_ATTR]
  });
}

function stopRootThemeGuard() {
  const snapshot = rootThemeSnapshot;

  if (rootThemeObserver) {
    rootThemeObserver.disconnect();
    rootThemeObserver = null;
  }

  clearRootThemeRestoreTimers();
  scheduleRootThemeRestore(snapshot, [0, 16, 64, 250, 1000, 3000]);
  rootThemeSnapshot = null;
}

function trackEventBusHandlers(runtime, run) {
  const { eventBus } = runtime;
  const originalOn = eventBus.on;
  eventBus.on = function trackedOn(type, handler) {
    trackedEventBusHandlers.push({ type, handler });
    return originalOn.call(this, type, handler);
  };

  try {
    return run();
  } finally {
    eventBus.on = originalOn;
  }
}

function clearTrackedEventBusHandlers() {
  if (!cadRuntime?.eventBus) {
    trackedEventBusHandlers = [];
    return;
  }

  trackedEventBusHandlers.forEach(({ type, handler }) => {
    cadRuntime.eventBus.off(type, handler);
  });
  trackedEventBusHandlers = [];
}

async function mountCadApp(signal) {
  if (cadApp || !hostRef.value) return;

  startRootThemeGuard();
  let runtime;
  try {
    runtime = await loadCadRuntime();
  } catch (error) {
    stopRootThemeGuard();
    throw error;
  }
  ensureCadViewerGlobalResetStyles();
  if (signal?.aborted || cadApp || !hostRef.value) {
    stopRootThemeGuard();
    return;
  }

  configureCadViewerSettings(runtime);
  const { MlCadViewer, cadViewerI18n, AcEdOpenMode } = runtime;

  cadApp = createApp({
    name: "MlightCadViewerHost",
    setup() {
      return () =>
        h(MlCadViewer, {
          locale: "zh",
          localFile: viewerState.localFile,
          background: 0x0f172a,
          theme: "dark",
          mode: AcEdOpenMode.Read,
          useMainThreadDraw: true
        });
    }
  });
  cadApp.use(cadViewerI18n);
  cadApp.use(ElementPlus);
  try {
    trackEventBusHandlers(runtime, () => {
      cadApp.mount(hostRef.value);
    });
    scheduleRootThemeRestore();
  } catch (error) {
    clearTrackedEventBusHandlers();
    stopRootThemeGuard();
    cadApp = null;
    throw error;
  }
}

function releaseCadRuntimeResources() {
  const docManager = cadRuntime?.AcApDocManager?._instance;
  const view = docManager?.curView;
  if (!view) return;

  try {
    view.stopAnimationLoop?.();
    view.clear?.();

    const statsDom = view._stats?.dom;
    if (statsDom?.parentNode) {
      statsDom.parentNode.removeChild(statsDom);
    }
  } catch {
    // The third-party viewer exposes cleanup methods inconsistently; ignore
    // teardown failures so closing the preview never blocks the host page.
  }
}

function unmountCadApp() {
  if (!cadApp) {
    stopRootThemeGuard();
    ensureCadViewerGlobalResetStyles();
    return;
  }
  releaseCadRuntimeResources();
  cadApp.unmount();
  clearTrackedEventBusHandlers();
  cadApp = null;
  stopRootThemeGuard();
  ensureCadViewerGlobalResetStyles();
}

async function createLocalFile(url, signal) {
  if (props.blob) {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    return new File([props.blob], ensureDwgFileName(props.name), {
      type: props.blob.type || "application/acad"
    });
  }

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`DWG 文件加载失败（HTTP ${response.status}）`);
  }
  const blob = await response.blob();
  if (signal.aborted) throw new DOMException("aborted", "AbortError");

  return new File([blob], ensureDwgFileName(props.name), {
    type: blob.type || "application/acad"
  });
}

async function loadDocument(url) {
  if (loadAbortController) {
    loadAbortController.abort();
  }

  errorText.value = "";
  viewerState.localFile = undefined;

  if (!url && !props.blob) {
    loading.value = false;
    unmountCadApp();
    return;
  }

  const controller = new AbortController();
  loadAbortController = controller;
  loading.value = true;

  try {
    const file = await createLocalFile(url, controller.signal);
    if (controller.signal.aborted) return;

    viewerState.localFile = file;
    await nextTick();
    await mountCadApp(controller.signal);
  } catch (error) {
    if (error?.name === "AbortError") return;
    errorText.value = error?.message || "DWG 文件预览失败";
  } finally {
    if (loadAbortController === controller) {
      loadAbortController = null;
      loading.value = false;
    }
  }
}

watch(
  () => [props.url, props.blob, props.name],
  ([url]) => {
    if (hostRef.value) loadDocument(url);
  }
);

onMounted(() => {
  loadDocument(props.url);
});

onBeforeUnmount(() => {
  if (loadAbortController) {
    loadAbortController.abort();
    loadAbortController = null;
  }
  viewerState.localFile = undefined;
  unmountCadApp();
});
</script>

<template>
  <div class="dd-cad-viewer">
    <div class="dd-cad-stage">
      <div ref="hostRef" class="dd-ml-cad-host dark" />
      <div
        v-if="loading"
        class="dd-cad-tip text-[var(--el-text-color-secondary)]"
      >
        正在加载 DWG 文件与 WebGL 预览器...
      </div>
      <div
        v-else-if="errorText"
        class="dd-cad-tip text-[var(--el-color-danger)]"
      >
        {{ errorText }}
      </div>
    </div>
  </div>
</template>

<style scoped>
:global(body) {
  display: block;
}

.dd-cad-viewer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.dd-cad-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.dd-cad-title {
  min-width: 0;
}

.dd-cad-name {
  font-size: 14px;
  font-weight: 600;
}

.dd-cad-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.dd-cad-stage {
  position: relative;
  height: min(68vh, 720px);
  min-height: 520px;
  overflow: hidden;
  background: #0f172a;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
}

.dd-ml-cad-host {
  --el-color-primary: #409eff;
  --el-color-info: #909399;
  --el-color-danger: #f56c6c;
  --el-bg-color-page: #0a0a0a;
  --el-bg-color: #141414;
  --el-bg-color-overlay: #1d1e1f;
  --el-text-color-primary: #e5eaf3;
  --el-text-color-regular: #cfd3dc;
  --el-text-color-secondary: #a3a6ad;
  --el-text-color-placeholder: #8d9095;
  --el-border-color: #4c4d4f;
  --el-border-color-light: #414243;
  --el-border-color-lighter: #363637;
  --el-fill-color-darker: #424243;
  --el-fill-color-dark: #39393a;
  --el-fill-color: #303030;
  --el-fill-color-light: #262727;
  --el-fill-color-lighter: #1d1d1d;
  --el-fill-color-blank: #141414;
  --el-mask-color: rgb(0 0 0 / 80%);
  --el-mask-color-extra-light: rgb(0 0 0 / 30%);
  --el-box-shadow:
    0 12px 32px 4px rgb(0 0 0 / 36%), 0 8px 20px rgb(0 0 0 / 72%);
  --ml-ui-text: var(--el-text-color-primary);
  --ml-ui-text-muted: var(--el-text-color-regular);
  --ml-ui-bg: var(--el-bg-color-overlay);
  --ml-ui-border: var(--el-border-color);
  --ml-ui-shadow: var(--el-box-shadow);
  --ml-ui-overlay: rgb(0 0 0 / 50%);
  --ml-ui-accent: var(--el-color-primary);
  --ml-ui-accent-alt: var(--el-color-info);
  --ml-ui-danger: var(--el-color-danger);
  --ml-ui-canvas-line: var(--el-color-primary);
  --ml-ui-canvas-fill: rgb(64 158 255 / 20%);
  --ml-ui-canvas-fill-mix: color-mix(
    in srgb,
    var(--el-color-primary) 20%,
    transparent
  );

  position: absolute;
  inset: 0;
  overflow: hidden;
  color: var(--el-text-color-regular);
  color-scheme: dark;
}

.dd-cad-tip {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  background: rgb(15 23 42 / 88%);
}

.dd-ml-cad-host :deep(.ml-cad-container) {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  outline: none;
}

.dd-ml-cad-host :deep(.ml-cad-viewer-container) {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.dd-ml-cad-host :deep(.ml-main-menu-container),
.dd-ml-cad-host :deep(.ml-vertical-toolbar-container),
.dd-ml-cad-host :deep(.ml-status-bar),
.dd-ml-cad-host :deep(.ml-notification-center),
.dd-ml-cad-host :deep(.ml-base-dialog),
.dd-ml-cad-host :deep(.ml-tool-palette-dialog),
.dd-ml-cad-host :deep(.ml-cli-container),
.dd-ml-cad-host :deep(.el-popper) {
  pointer-events: auto;
}

.dd-ml-cad-host :deep(.ml-main-menu-container) {
  position: absolute;
  top: 12px;
  left: 12px;
}

.dd-ml-cad-host :deep(.ml-language-selector) {
  display: none;
}

.dd-ml-cad-host :deep(.ml-vertical-toolbar-container) {
  position: absolute;
  top: 50%;
  right: 18px;
}

.dd-ml-cad-host :deep(.ml-file-name) {
  position: absolute;
  top: 12px;
}

.dd-ml-cad-host :deep(.ml-notification-center) {
  position: absolute;
  right: 12px;
  bottom: 48px;
}

.dd-ml-cad-host :deep(.ml-status-bar) {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
}

.dd-ml-cad-host :deep(.ml-base-dialog) {
  position: absolute;
}
</style>
