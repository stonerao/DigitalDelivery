function createPacket(point = {}, tick = 0) {
  const mode = point.mode || "random";
  let value = point.baseValue ?? 0;

  if (mode === "toggle") {
    const values =
      Array.isArray(point.values) && point.values.length
        ? point.values
        : ["normal", "warning"];
    value = values[tick % values.length];
  } else if (mode === "sequence") {
    const values =
      Array.isArray(point.values) && point.values.length ? point.values : [0];
    value = values[tick % values.length];
  } else {
    const min = Number(point.min ?? 0);
    const max = Number(point.max ?? 100);
    const fixed = Number(point.fixed ?? 2);
    value = Number((Math.random() * (max - min) + min).toFixed(fixed));
  }

  return {
    id: point.id || point.key || `rt-${tick}`,
    key: point.key || point.id || `rt-${tick}`,
    type: point.type || "measurement",
    value,
    unit: point.unit || "",
    status:
      point.type === "device-status"
        ? String(value)
        : value > Number(point.warningThreshold ?? Infinity)
          ? "warning"
          : "normal",
    targetUuid: point.targetUuid || "",
    kks: point.kks || "",
    timestamp: Date.now()
  };
}

export function createRealtimeDataAdapter({
  eventBus,
  onPacket,
  onStateChange,
  onLog
} = {}) {
  let timer = null;
  let config = {};
  let tick = 0;
  let running = false;

  function log(message, payload) {
    onLog?.({
      type: "realtime",
      message,
      payload,
      timestamp: Date.now()
    });
  }

  function emitState(partial = {}) {
    onStateChange?.({
      running,
      transport: config.transport || "mock",
      tick,
      ...partial
    });
  }

  function dispatchPacket(packet) {
    onPacket?.(packet);
    eventBus?.emit("runtime.realtimeUpdated", packet);
  }

  function runMockTick() {
    tick += 1;
    const points = Array.isArray(config.points) ? config.points : [];
    points.forEach(point => {
      const packet = createPacket(point, tick);
      dispatchPacket(packet);
    });
    emitState();
  }

  async function runHttpPoll() {
    tick += 1;
    const url = String(config.url || "").trim();
    if (!url) {
      log("HTTP polling skipped because url is empty");
      emitState({ errorText: "Missing realtime url" });
      return;
    }
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: config.headers || {}
      });
      const payload = await response.json();
      const packets = Array.isArray(payload) ? payload : [payload];
      packets.filter(Boolean).forEach(dispatchPacket);
      emitState();
    } catch (error) {
      log("HTTP polling failed", error?.message || String(error));
      emitState({ errorText: error?.message || String(error) });
    }
  }

  function schedule() {
    const interval = Math.max(500, Number(config.interval ?? 3000));
    timer = setInterval(() => {
      if (config.transport === "http") {
        runHttpPoll();
        return;
      }
      runMockTick();
    }, interval);
  }

  function start(nextConfig = {}) {
    stop();
    config = { transport: "mock", interval: 3000, ...nextConfig };
    if (config.enabled === false) {
      emitState({ disabled: true });
      return;
    }
    running = true;
    log("Realtime adapter started", {
      transport: config.transport,
      interval: config.interval
    });
    emitState();
    schedule();
    if (config.transport === "http") {
      runHttpPoll();
      return;
    }
    runMockTick();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    if (running) log("Realtime adapter stopped");
    running = false;
    emitState();
  }

  return {
    start,
    stop,
    restart: nextConfig => start({ ...config, ...nextConfig }),
    isRunning: () => running,
    getConfig: () => config,
    pushPacket: packet => {
      dispatchPacket(packet);
      emitState();
    }
  };
}

export default createRealtimeDataAdapter;
