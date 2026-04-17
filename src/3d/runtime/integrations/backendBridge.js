function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export function createBackendBridge({ eventBus, onLog, onStateChange } = {}) {
  let config = {};
  let running = false;
  let requestId = 0;

  function log(message, payload) {
    onLog?.({
      type: "backend",
      message,
      payload,
      timestamp: Date.now()
    });
  }

  function emitState(partial = {}) {
    onStateChange?.({
      running,
      transport: config.transport || "mock",
      ...partial
    });
  }

  function start(nextConfig = {}) {
    config = { transport: "mock", timeout: 5000, ...nextConfig };
    if (config.enabled === false) {
      running = false;
      emitState({ disabled: true });
      return;
    }
    running = true;
    log("Backend bridge started", {
      transport: config.transport,
      endpoint: config.endpoint || ""
    });
    emitState();
  }

  function stop() {
    if (running) log("Backend bridge stopped");
    running = false;
    emitState();
  }

  async function invoke(command = {}) {
    requestId += 1;
    const payload = {
      requestId,
      command: command.name || command.command || "unknown",
      body: command.payload || {},
      timestamp: Date.now()
    };

    log("Backend command dispatched", payload);

    if (!running) {
      const error = new Error("Backend bridge is not running");
      log("Backend command rejected", error.message);
      throw error;
    }

    if (config.transport === "http" && config.endpoint) {
      try {
        const response = await fetch(config.endpoint, {
          method: command.method || "POST",
          headers: {
            "Content-Type": "application/json",
            ...(config.headers || {})
          },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        eventBus?.emit("backend.commandCompleted", result);
        emitState({ lastCommandAt: Date.now() });
        return result;
      } catch (error) {
        log("Backend command failed", error?.message || String(error));
        throw error;
      }
    }

    await delay(Number(command.delay ?? config.mockDelay ?? 300));
    const result = {
      ok: true,
      requestId,
      command: payload.command,
      acceptedAt: Date.now(),
      echoedPayload: payload.body
    };
    eventBus?.emit("backend.commandCompleted", result);
    emitState({ lastCommandAt: Date.now() });
    log("Backend command completed", result);
    return result;
  }

  return {
    start,
    stop,
    invoke,
    isRunning: () => running,
    getConfig: () => config
  };
}

export default createBackendBridge;
