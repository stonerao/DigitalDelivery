import * as THREE from "three";
import {
  CSS2DRenderer,
  CSS2DObject
} from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { getVisibleMeshes } from "./frustumCull";

const MODE_CONFIG = {
  distance: { minPoints: 2, autoCompleteAt: 2 },
  polyline: { minPoints: 2, autoCompleteAt: 0 },
  angle: { minPoints: 3, autoCompleteAt: 3 },
  area: { minPoints: 3, autoCompleteAt: 0 }
};

function createId(prefix = "measurement") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function clonePointList(points = []) {
  return points.map(point => point.clone());
}

function formatMeasurementValue(result) {
  if (!result) return "-";
  if (result.type === "angle")
    return `${Number(result.value || 0).toFixed(2)}°`;
  if (result.type === "area")
    return `${Number(result.value || 0).toFixed(3)} m²`;
  return `${Number(result.value || 0).toFixed(3)} m`;
}

function computeDistance(points = []) {
  if (points.length < 2) return 0;
  return points[0].distanceTo(points[1]);
}

function computePolyline(points = []) {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += points[i - 1].distanceTo(points[i]);
  }
  return total;
}

function computeAngle(points = []) {
  if (points.length < 3) return 0;
  const v1 = points[0].clone().sub(points[1]).normalize();
  const v2 = points[2].clone().sub(points[1]).normalize();
  return THREE.MathUtils.radToDeg(v1.angleTo(v2));
}

function computeArea(points = []) {
  if (points.length < 3) return 0;
  let area = 0;
  const origin = points[0];
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = points[i].clone().sub(origin);
    const b = points[i + 1].clone().sub(origin);
    area += a.clone().cross(b).length() * 0.5;
  }
  return area;
}

function computeCentroid(points = []) {
  const center = new THREE.Vector3();
  if (!points.length) return center;
  points.forEach(point => center.add(point));
  return center.multiplyScalar(1 / points.length);
}

function createLineMaterial(color = 0xef4444) {
  return new THREE.LineBasicMaterial({
    color,
    linewidth: 2,
    depthTest: false
  });
}

function createPointMaterial(color = 0xef4444) {
  return new THREE.PointsMaterial({
    color,
    size: 8,
    sizeAttenuation: false,
    depthTest: false
  });
}

export class MeasureTool {
  constructor({ scene, camera, renderer, container, pickRoot = null }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.container = container;
    this.pickRoot = pickRoot || scene;

    this.enabled = false;
    this.mode = "distance";
    this.measurements = [];
    this.activePoints = [];
    this.previewPoint = null;
    this.tempObjects = [];
    this.pickTargets = [];
    this.pickTargetsDirty = true;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.firstHitOnly = true;
    this.mouse = new THREE.Vector2();
    this.intersections = [];
    this.moveRaf = 0;
    this.lastMovePoint = null;
    this.lastMoveX = Number.NaN;
    this.lastMoveY = Number.NaN;
    this.movePixelThreshold = 1;
    this.minRaycastInterval = 0;
    this.lastRaycastAt = 0;
    this.containerRect = null;
    this.containerRectDirty = true;
    this.onChange = null;
    this.onComplete = null;

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(container.clientWidth, container.clientHeight);
    Object.assign(this.labelRenderer.domElement.style, {
      position: "absolute",
      top: "0",
      left: "0",
      pointerEvents: "none"
    });
    container.appendChild(this.labelRenderer.domElement);

    this._onClick = this._onClick.bind(this);
    this._onDoubleClick = this._onDoubleClick.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._markContainerRectDirty = this._markContainerRectDirty.bind(this);
  }

  enable(mode = this.mode) {
    this.mode = MODE_CONFIG[mode] ? mode : "distance";
    if (this.enabled) {
      this._resetDraft();
      this._notifyChange();
      return;
    }
    this.enabled = true;
    this.refreshPickTargets();
    this.containerRectDirty = true;
    this.container.addEventListener("click", this._onClick);
    this.container.addEventListener("dblclick", this._onDoubleClick);
    this.container.addEventListener("contextmenu", this._onContextMenu);
    this.container.addEventListener("mousemove", this._onMouseMove);
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("resize", this._markContainerRectDirty, {
      passive: true
    });
    window.addEventListener("scroll", this._markContainerRectDirty, true);
    this.container.style.cursor = "crosshair";
    this._notifyChange();
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.container.removeEventListener("click", this._onClick);
    this.container.removeEventListener("dblclick", this._onDoubleClick);
    this.container.removeEventListener("contextmenu", this._onContextMenu);
    this.container.removeEventListener("mousemove", this._onMouseMove);
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("resize", this._markContainerRectDirty);
    window.removeEventListener("scroll", this._markContainerRectDirty, true);
    if (this.moveRaf) {
      cancelAnimationFrame(this.moveRaf);
      this.moveRaf = 0;
    }
    this.lastMovePoint = null;
    this.containerRect = null;
    this.containerRectDirty = true;
    this.container.style.cursor = "";
    this._resetDraft();
    this._notifyChange();
  }

  setMode(mode = "distance") {
    this.mode = MODE_CONFIG[mode] ? mode : "distance";
    this._resetDraft();
    if (this.enabled) this.container.style.cursor = "crosshair";
    this._notifyChange();
  }

  getMode() {
    return this.mode;
  }

  setPickRoot(root) {
    this.pickRoot = root || this.scene;
    this.pickTargetsDirty = true;
    this.refreshPickTargets();
  }

  refreshPickTargets() {
    const root = this.pickRoot || this.scene;
    const list = [];
    root?.traverse?.(obj => {
      if (!obj?.isMesh) return;
      if (obj.userData?.isMeasure || obj.userData?.isHelper) return;
      list.push(obj);
    });
    this.pickTargets = list;
    this.pickTargetsDirty = false;
  }

  setAdaptiveLevel(level = "normal") {
    if (level === "low-fps") {
      this.movePixelThreshold = 2.5;
      this.minRaycastInterval = 34;
      return;
    }
    if (level === "constrained") {
      this.movePixelThreshold = 1.5;
      this.minRaycastInterval = 16;
      return;
    }
    this.movePixelThreshold = 1;
    this.minRaycastInterval = 0;
  }

  update() {
    this.labelRenderer?.render?.(this.scene, this.camera);
  }

  resize(width, height) {
    this.labelRenderer?.setSize?.(width, height);
  }

  clearAll() {
    this.measurements.forEach(item => this._disposeMeasurement(item));
    this.measurements = [];
    this._resetDraft();
    this._notifyChange();
  }

  removeMeasurement(id) {
    const index = this.measurements.findIndex(item => item.id === id);
    if (index < 0) return false;
    const [removed] = this.measurements.splice(index, 1);
    this._disposeMeasurement(removed);
    this._notifyChange();
    return true;
  }

  setMeasurementVisible(id, visible) {
    const item = this.measurements.find(entry => entry.id === id);
    if (!item) return false;
    item.visible = Boolean(visible);
    item.objects.forEach(obj => {
      if (obj) obj.visible = item.visible;
    });
    this._notifyChange();
    return true;
  }

  exportResults() {
    return JSON.stringify(this.getResults(), null, 2);
  }

  setResults(records = []) {
    this.clearAll();
    records.forEach(record => {
      const result = {
        id: record.id || createId(),
        type: MODE_CONFIG[record.type] ? record.type : "distance",
        name: record.name || "",
        points: Array.isArray(record.points)
          ? record.points.map(point => new THREE.Vector3().fromArray(point))
          : [],
        value: Number(record.value || 0),
        unit: record.unit || "m",
        visible: record.visible !== false,
        createdAt: record.createdAt || Date.now()
      };
      if (!result.points.length) return;
      const objects = this._buildMeasurementObjects(result);
      objects.forEach(obj => {
        obj.visible = result.visible;
        this.scene.add(obj);
      });
      result.objects = objects;
      this.measurements.push(result);
    });
    this._notifyChange();
  }

  getResults() {
    return this.measurements.map(item => ({
      id: item.id,
      type: item.type,
      name: item.name,
      points: item.points.map(point => point.toArray()),
      value: item.value,
      unit: item.unit,
      visible: item.visible !== false,
      createdAt: item.createdAt
    }));
  }

  dispose() {
    this.disable();
    this.clearAll();
    if (this.labelRenderer?.domElement?.parentNode) {
      this.labelRenderer.domElement.parentNode.removeChild(
        this.labelRenderer.domElement
      );
    }
    this.labelRenderer = null;
  }

  _notifyChange() {
    this.onChange?.({
      mode: this.mode,
      enabled: this.enabled,
      records: this.getResults(),
      draftPoints: this.activePoints.map(point => point.toArray())
    });
  }

  _markContainerRectDirty() {
    this.containerRectDirty = true;
  }

  _getContainerRect() {
    if (!this.container) return null;
    if (this.containerRectDirty || !this.containerRect) {
      this.containerRect = this.container.getBoundingClientRect();
      this.containerRectDirty = false;
    }
    if (!this.containerRect?.width || !this.containerRect?.height) return null;
    return this.containerRect;
  }

  _getHitPoint(event) {
    if (!this.enabled) return null;
    if (this.pickTargetsDirty) this.refreshPickTargets();
    if (!this.pickTargets.length) return null;
    const rect = this._getContainerRect();
    if (!rect) return null;
    if (
      event.clientX < rect.left ||
      event.clientX > rect.left + rect.width ||
      event.clientY < rect.top ||
      event.clientY > rect.top + rect.height
    ) {
      return null;
    }

    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    this.intersections.length = 0;
    const visibleTargets = getVisibleMeshes(this.pickTargets, this.camera);
    const intersects = this.raycaster.intersectObjects(
      visibleTargets,
      false,
      this.intersections
    );
    return intersects[0]?.point?.clone() || null;
  }

  _onClick(event) {
    const point = this._getHitPoint(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    this.activePoints.push(point);
    this._rebuildDraft(point);

    const config = MODE_CONFIG[this.mode] || MODE_CONFIG.distance;
    if (
      config.autoCompleteAt &&
      this.activePoints.length >= config.autoCompleteAt
    ) {
      this._completeMeasurement();
      return;
    }
    this._notifyChange();
  }

  _onDoubleClick(event) {
    if (!this.enabled) return;
    if (!["polyline", "area"].includes(this.mode)) return;
    if (this.activePoints.length < (MODE_CONFIG[this.mode]?.minPoints || 2))
      return;
    event.preventDefault();
    event.stopPropagation();
    this._completeMeasurement();
  }

  _onContextMenu(event) {
    if (!this.enabled) return;
    if (this.activePoints.length) {
      event.preventDefault();
      event.stopPropagation();
      this._completeMeasurement();
    }
  }

  _onKeyDown(event) {
    if (!this.enabled) return;
    if (event.key === "Escape") {
      this._resetDraft();
      this._notifyChange();
      return;
    }
    if (
      (event.key === "Enter" || event.key === " ") &&
      this.activePoints.length
    ) {
      this._completeMeasurement();
    }
  }

  _onMouseMove(event) {
    if (!this.enabled || !this.activePoints.length) return;
    this.lastMovePoint = { x: event.clientX, y: event.clientY };
    if (this.moveRaf) return;

    this.moveRaf = requestAnimationFrame(() => {
      this.moveRaf = 0;
      const pointLike = this.lastMovePoint;
      this.lastMovePoint = null;
      if (!pointLike || !this.enabled || !this.activePoints.length) return;
      const now = performance.now();
      if (now - this.lastRaycastAt < this.minRaycastInterval) return;
      if (
        Math.abs(pointLike.x - this.lastMoveX) < this.movePixelThreshold &&
        Math.abs(pointLike.y - this.lastMoveY) < this.movePixelThreshold
      ) {
        return;
      }
      this.lastRaycastAt = now;
      this.lastMoveX = pointLike.x;
      this.lastMoveY = pointLike.y;
      const point = this._getHitPoint(pointLike);
      if (!point) return;
      this.previewPoint = point;
      this._rebuildDraft(point);
    });
  }

  _resetDraft() {
    this.activePoints = [];
    this.previewPoint = null;
    this.tempObjects.forEach(obj => {
      if (!obj) return;
      this.scene.remove(obj);
      obj.geometry?.dispose?.();
      obj.material?.dispose?.();
      obj.element?.remove?.();
    });
    this.tempObjects = [];
  }

  _createLabel(text, color = "#ef4444") {
    const div = document.createElement("div");
    Object.assign(div.style, {
      background: "rgba(255,255,255,0.92)",
      color: "#111827",
      padding: "2px 8px",
      borderRadius: "4px",
      fontSize: "12px",
      fontFamily: "monospace",
      border: `1px solid ${color}`,
      whiteSpace: "nowrap",
      boxShadow: "0 2px 8px rgba(15, 23, 42, 0.16)"
    });
    div.textContent = text;
    const label = new CSS2DObject(div);
    label.userData.isMeasure = true;
    return label;
  }

  _createPointsObject(points, color) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        points.flatMap(point => point.toArray()),
        3
      )
    );
    const object = new THREE.Points(geometry, createPointMaterial(color));
    object.userData.isMeasure = true;
    object.renderOrder = 999;
    return object;
  }

  _createLineObject(points, color, closed = false) {
    const vertices = closed ? [...points, points[0]] : points;
    const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
    const line = new THREE.Line(geometry, createLineMaterial(color));
    line.userData.isMeasure = true;
    line.renderOrder = 999;
    return line;
  }

  _rebuildDraft(hoverPoint = null) {
    this.tempObjects.forEach(obj => {
      this.scene.remove(obj);
      obj.geometry?.dispose?.();
      obj.material?.dispose?.();
      obj.element?.remove?.();
    });
    this.tempObjects = [];

    const drawPoints = [...this.activePoints];
    if (
      hoverPoint &&
      ["distance", "polyline", "area", "angle"].includes(this.mode)
    ) {
      if (
        this.mode === "distance" ||
        this.mode === "polyline" ||
        this.mode === "area" ||
        (this.mode === "angle" && this.activePoints.length < 3)
      ) {
        drawPoints.push(hoverPoint);
      }
    }
    if (!drawPoints.length) return;

    const color =
      this.mode === "area"
        ? 0xf59e0b
        : this.mode === "angle"
          ? 0x3b82f6
          : 0xef4444;
    const pointsObj = this._createPointsObject(drawPoints, color);
    this.scene.add(pointsObj);
    this.tempObjects.push(pointsObj);

    if (drawPoints.length > 1) {
      const line = this._createLineObject(
        drawPoints,
        color,
        this.mode === "area" && this.activePoints.length >= 2
      );
      this.scene.add(line);
      this.tempObjects.push(line);
    }
  }

  _buildMeasurementResult(points) {
    const clonedPoints = clonePointList(points);
    let value = 0;
    let unit = "m";
    if (this.mode === "distance") value = computeDistance(clonedPoints);
    else if (this.mode === "polyline") value = computePolyline(clonedPoints);
    else if (this.mode === "angle") {
      value = computeAngle(clonedPoints);
      unit = "deg";
    } else if (this.mode === "area") {
      value = computeArea(clonedPoints);
      unit = "m2";
    }

    const id = createId();
    return {
      id,
      type: this.mode,
      name: `${this.mode}-${this.measurements.length + 1}`,
      points: clonedPoints,
      value,
      unit,
      visible: true,
      createdAt: Date.now()
    };
  }

  _buildMeasurementObjects(result) {
    const color =
      result.type === "area"
        ? 0xf59e0b
        : result.type === "angle"
          ? 0x3b82f6
          : 0xef4444;

    const pointsObj = this._createPointsObject(result.points, color);
    const line = this._createLineObject(
      result.points,
      color,
      result.type === "area"
    );
    const label = this._createLabel(formatMeasurementValue(result));
    label.position.copy(computeCentroid(result.points));

    return [line, pointsObj, label];
  }

  _disposeMeasurement(result) {
    result?.objects?.forEach(obj => {
      if (!obj) return;
      this.scene.remove(obj);
      obj.geometry?.dispose?.();
      obj.material?.dispose?.();
      obj.element?.remove?.();
    });
  }

  _completeMeasurement() {
    const config = MODE_CONFIG[this.mode] || MODE_CONFIG.distance;
    if (this.activePoints.length < config.minPoints) {
      this._resetDraft();
      this._notifyChange();
      return;
    }
    const result = this._buildMeasurementResult(this.activePoints);
    const objects = this._buildMeasurementObjects(result);
    objects.forEach(obj => this.scene.add(obj));
    result.objects = objects;
    this.measurements.push(result);
    this._resetDraft();
    this.onComplete?.(this.getResults(), result);
    this._notifyChange();
  }
}

export default MeasureTool;
