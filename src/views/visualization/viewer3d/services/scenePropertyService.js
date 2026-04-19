export function createEmptyPropertyForm() {
  return {
    kks: "",
    nodeId: ""
  };
}

export function openContextMenu({
  event,
  data,
  setNode,
  setStyle,
  setVisible
}) {
  event.preventDefault();
  event.stopPropagation();

  setNode?.(data);
  setStyle?.({
    top: `${event.clientY}px`,
    left: `${event.clientX}px`
  });
  setVisible?.(true);

  const closeMenu = () => {
    setVisible?.(false);
    document.removeEventListener("click", closeMenu, true);
    document.removeEventListener("contextmenu", closeMenu, true);
  };

  setTimeout(() => {
    document.addEventListener("click", closeMenu, true);
    document.addEventListener("contextmenu", closeMenu, true);
  }, 0);
}

export function getContextDeviceProps(node) {
  if (!node) return createEmptyPropertyForm();
  const raw = node.raw || node;
  return {
    kks: raw.kks || "",
    nodeId: raw.nodeId || ""
  };
}

export function buildBindPropertyForm(_node) {
  return {
    ...createEmptyPropertyForm()
  };
}

export function clearNodeProperty(node, sceneDevices = []) {
  const raw = node?.raw;
  if (!raw) return false;

  raw.kks = "";
  raw.type = "";
  raw.status = "-";

  const device = sceneDevices.find(item => item.uuid === raw.uuid);
  if (device) {
    device.kks = "";
    device.type = "";
    device.status = "-";
  }

  return true;
}

export function confirmPropertyDialog({
  mode,
  form,
  node,
  sceneDevices = [],
  notify
}) {
  if (mode === "bind" && !form?.kks) {
    notify?.("请输入 KKS 编码", { type: "warning" });
    return false;
  }

  const raw = node?.raw;
  if (raw) {
    raw.kks = form.kks;
    raw.nodeId = form.nodeId || raw.nodeId || "";
    raw.status = "-";
    raw.type = "";

    const device = sceneDevices.find(item => item.uuid === raw.uuid);
    if (device) {
      device.kks = form.kks;
      device.nodeId = form.nodeId || device.nodeId || "";
      device.status = "-";
      device.type = "";
    }
  }
  return true;
}
