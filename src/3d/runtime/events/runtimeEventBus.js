import mitt from "mitt";

export function createRuntimeEventBus() {
  const emitter = mitt();

  return {
    on: (type, handler) => emitter.on(type, handler),
    off: (type, handler) => emitter.off(type, handler),
    emit: (type, payload) => emitter.emit(type, payload),
    clear: () => emitter.all.clear()
  };
}

export default createRuntimeEventBus;
