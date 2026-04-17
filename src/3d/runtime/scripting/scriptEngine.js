function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function matchesRealtimeTrigger(trigger, payload) {
  if (!payload) return false;
  if (trigger.event !== "runtime.realtimeUpdated") return false;
  if (trigger.pointKey && trigger.pointKey !== payload.key) return false;
  if (trigger.kks && trigger.kks !== payload.kks) return false;
  if (trigger.status && trigger.status !== payload.status) return false;
  if (trigger.equals !== undefined && trigger.equals !== payload.value)
    return false;
  if (
    trigger.greaterThan !== undefined &&
    !(Number(payload.value) > Number(trigger.greaterThan))
  ) {
    return false;
  }
  if (
    trigger.lessThan !== undefined &&
    !(Number(payload.value) < Number(trigger.lessThan))
  ) {
    return false;
  }
  return true;
}

function matchesManualTrigger(trigger, payload) {
  return (
    trigger.event === "manual" && (!trigger.id || trigger.id === payload?.id)
  );
}

export function createScriptEngine({
  eventBus,
  viewerAdapter,
  _runtimeStore,
  _projectStore,
  backendBridge,
  notify,
  actions = {},
  onLog,
  onStateChange
} = {}) {
  let config = {};
  let running = false;
  let unsubscribers = [];

  function log(message, payload) {
    onLog?.({
      type: "script",
      message,
      payload,
      timestamp: Date.now()
    });
  }

  function emitState(partial = {}) {
    onStateChange?.({
      running,
      triggerCount: Array.isArray(config.triggers) ? config.triggers.length : 0,
      animationCount: Array.isArray(config.animations)
        ? config.animations.length
        : 0,
      ...partial
    });
  }

  function getAnimationById(id) {
    return (config.animations || []).find(item => item.id === id) || null;
  }

  async function executeAction(action = {}, triggerPayload = null) {
    const type = action.type || "";
    if (action.delay) {
      await delay(Number(action.delay));
    }

    if (type === "focus-object" && action.uuid) {
      viewerAdapter.focusObjectByUUID(action.uuid);
      return;
    }
    if (type === "fly-to-object" && action.uuid) {
      viewerAdapter.focusObjectByUUID(action.uuid);
      return;
    }
    if (type === "highlight-object" && action.uuid) {
      viewerAdapter.highlightObjectByUUID(action.uuid);
      return;
    }
    if (type === "isolate-object" && action.uuid) {
      viewerAdapter.isolateObjectByUUID(action.uuid);
      return;
    }
    if (type === "clear-isolation") {
      viewerAdapter.clearIsolation();
      return;
    }
    if (type === "set-object-opacity" && action.uuid) {
      viewerAdapter.setMeshOpacityByUUID(action.uuid, action.opacity ?? 0.3);
      return;
    }
    if (
      type === "set-preset-view" &&
      typeof action.preset === "string" &&
      action.preset
    ) {
      viewerAdapter.setPresetView(action.preset);
      return;
    }
    if (
      type === "set-transparent-mode" &&
      typeof actions.setTransparentMode === "function"
    ) {
      actions.setTransparentMode(action.enabled !== false);
      return;
    }
    if (
      type === "set-material-theme" &&
      typeof actions.setMaterialTheme === "function"
    ) {
      actions.setMaterialTheme(action.theme || "textured-basic");
      return;
    }
    if (
      type === "apply-bookmark" &&
      typeof actions.applyBookmark === "function"
    ) {
      actions.applyBookmark(action.bookmarkName);
      return;
    }
    if (type === "focus-measurement" && action.measurementId) {
      viewerAdapter.focusMeasurement(action.measurementId);
      return;
    }
    if (
      type === "open-video" &&
      typeof actions.openVideoByCameraId === "function"
    ) {
      actions.openVideoByCameraId(action.cameraId, triggerPayload);
      return;
    }
    if (
      type === "set-display-mode" &&
      typeof actions.setDisplayMode === "function"
    ) {
      await actions.setDisplayMode(action.mode);
      return;
    }
    if (
      type === "set-measurement-mode" &&
      typeof actions.setMeasurementMode === "function"
    ) {
      actions.setMeasurementMode(action.mode);
      return;
    }
    if (
      type === "toggle-anchor-visibility" &&
      typeof actions.setAnchorVisibility === "function"
    ) {
      actions.setAnchorVisibility(
        action.kind || "anchor",
        action.visible !== false
      );
      return;
    }
    if (
      type === "set-anchor-state" &&
      typeof actions.setAnchorState === "function" &&
      action.anchorId
    ) {
      actions.setAnchorState({
        id: action.anchorId,
        status: action.status,
        displayText: action.displayText,
        value: action.value,
        kind: action.kind || "anchor"
      });
      return;
    }
    if (
      type === "toggle-point-markers" &&
      typeof actions.setPointMarkersVisible === "function"
    ) {
      actions.setPointMarkersVisible(action.visible !== false);
      return;
    }
    if (type === "backend-command") {
      await backendBridge?.invoke?.({
        name: action.command,
        payload: {
          ...(action.payload || {}),
          triggerPayload
        }
      });
      return;
    }
    if (type === "message" && action.text) {
      notify?.(action.text, { type: action.level || "info" });
      return;
    }
  }

  async function runAnimation(animation, triggerPayload = null) {
    if (!animation) return;
    log("Script animation started", { id: animation.id, name: animation.name });
    for (const action of animation.actions || []) {
      await executeAction(action, triggerPayload);
      eventBus?.emit("runtime.scriptActionExecuted", {
        animationId: animation.id,
        action,
        triggerPayload,
        timestamp: Date.now()
      });
    }
    emitState({ lastExecutedAt: Date.now(), lastAnimationId: animation.id });
  }

  async function handleEvent(eventName, payload) {
    if (!running) return;
    const triggers = Array.isArray(config.triggers) ? config.triggers : [];
    for (const trigger of triggers) {
      let matched = false;
      if (eventName === "runtime.realtimeUpdated") {
        matched = matchesRealtimeTrigger(trigger, payload);
      } else if (eventName === "manual") {
        matched = matchesManualTrigger(trigger, payload);
      } else {
        matched = trigger.event === eventName;
      }
      if (!matched) continue;
      const animation = getAnimationById(trigger.animationId);
      if (!animation) continue;
      log("Script trigger matched", {
        event: eventName,
        triggerId: trigger.id,
        animationId: animation.id
      });
      await runAnimation(animation, payload);
    }
  }

  function bindEvent(type) {
    const handler = payload => {
      handleEvent(type, payload);
    };
    eventBus?.on(type, handler);
    unsubscribers.push(() => {
      eventBus?.off(type, handler);
    });
  }

  function start(nextConfig = {}) {
    stop();
    config = {
      enabled: true,
      animations: [],
      triggers: [],
      ...nextConfig
    };
    if (config.enabled === false) {
      emitState({ disabled: true });
      return;
    }
    running = true;
    bindEvent("runtime.realtimeUpdated");
    bindEvent("viewer.objectSelected");
    bindEvent("viewer.measurementChanged");
    bindEvent("anchor.clicked");
    bindEvent("camera.clicked");
    emitState();
    log("Script engine started", {
      triggerCount: config.triggers.length,
      animationCount: config.animations.length
    });
  }

  function stop() {
    unsubscribers.forEach(dispose => dispose());
    unsubscribers = [];
    if (running) log("Script engine stopped");
    running = false;
    emitState();
  }

  return {
    start,
    stop,
    isRunning: () => running,
    runManualTrigger: id => handleEvent("manual", { id }),
    getConfig: () => config
  };
}

export default createScriptEngine;
