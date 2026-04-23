import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import {
  cloneClippingState,
  createDefaultClippingState,
  normalizeClippingState
} from "@/3d/runtime/clipping/clippingState";

const AXES = ["x", "y", "z"];
const AXIS_COLORS = {
  x: 0xff5b5b,
  y: 0x32c26b,
  z: 0x4d8dff,
  custom: 0xffb020
};
const CLIPPING_CAP_OFFSET = -0.0015;
const CLIPPING_HELPER_OFFSET = 0.006;
const CLIPPING_HELPER_OPACITY = 0.12;
const CLIPPING_HELPER_CAP_OPACITY = 0.035;
const SECTION_CAP_PADDING = 1.08;
const SECTION_CAP_RENDER_ORDER = 940;
const SECTION_CAP_MAX_MESHES = 1800;
const SECTION_CAP_FALLBACK_COLOR = 0xb8b4aa;
const NON_TARGET_OPACITY = 0.2;
const STATS_THROTTLE_MS = 200;
const LOCAL_PLANE_NORMAL = new THREE.Vector3(0, 0, 1);

function disposeHelper(helper) {
  if (!helper) return;
  helper.traverse?.(child => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach(item => item?.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  });
}

function getMaterials(obj) {
  return Array.isArray(obj?.material)
    ? obj.material.filter(Boolean)
    : obj?.material
      ? [obj.material]
      : [];
}

function getBoxCorners(box) {
  return [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z)
  ];
}

function disposeSectionCapGroup(group) {
  if (!group) return;
  group.traverse?.(child => {
    if (child.userData?.isSectionCapSurface) {
      child.geometry?.dispose?.();
    }
    if (Array.isArray(child.material)) {
      child.material.forEach(item => item?.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  });
}

export class ClippingTool {
  constructor({ renderer, scene, root = null }) {
    this.renderer = renderer;
    this.scene = scene;
    this.root = root || scene;
    this.bounds = null;
    this.activeBounds = null;
    this.state = createDefaultClippingState();
    this.helpers = {};
    this.caps = {};
    this.dragState = null;
    this.animation = {
      playing: false,
      speed: 0.6,
      mode: "ping-pong",
      axis: "auto",
      direction: 1
    };
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.dragPlane = new THREE.Plane();
    this.dragPoint = new THREE.Vector3();
    this.dragCenter = new THREE.Vector3();
    this.dragViewNormal = new THREE.Vector3();
    this.dragAxisNormal = new THREE.Vector3();
    this.onChange = null;
    this.feedbackMaterials = new Set();
    this.materialOverrides = new Map();
    this.targetOpaqueMaterials = new Map();
    this.objectIndex = new Map();
    this.dynamicPlanes = new Map();
    this.lastMaterialSignature = "";
    this.capSignature = "";
    this.capCandidateCache = { signature: "", candidates: [] };
    this.lastStatsAt = 0;
    this.transformControls = null;
    this.transformHelper = null;
    this.transformControlsHelper = null;
    this.orbitControls = null;
    this.transformRafId = 0;
    this.syncingTransform = false;
    this.stats = {
      enabled: false,
      mode: "single-plane",
      activePlaneCount: 0,
      affectedMeshCount: 0,
      totalMeshCount: 0
    };
    this.planes = {
      custom: new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),
      xMin: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),
      xMax: new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),
      yMin: new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
      yMax: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      zMin: new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
      zMax: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    };
    this._rebuildObjectIndex();
  }

  bindTransformControls({ camera, domElement, orbitControls } = {}) {
    this.disposeTransformControls();
    if (!camera || !domElement) return;
    this.orbitControls = orbitControls || null;
    this.transformControls = new TransformControls(camera, domElement);
    this.transformControls.setMode(this.state.editMode || "translate");
    this.transformControls.addEventListener("dragging-changed", event => {
      if (this.orbitControls) this.orbitControls.enabled = !event.value;
      if (!event.value && this.state.enabled) {
        this._applyState();
        this._emitChange("transform-end");
      }
    });
    this.transformControls.addEventListener("objectChange", () => {
      this._scheduleTransformCommit();
    });
    this.transformControlsHelper =
      typeof this.transformControls.getHelper === "function"
        ? this.transformControls.getHelper()
        : this.transformControls;
    this.transformControlsHelper.userData.isHelper = true;
    this.scene.add(this.transformControlsHelper);
    this._syncTransformControls();
  }

  disposeTransformControls() {
    if (this.transformRafId) {
      cancelAnimationFrame(this.transformRafId);
      this.transformRafId = 0;
    }
    this.transformControls?.detach?.();
    this.transformControls?.dispose?.();
    if (this.transformControlsHelper) {
      this.scene.remove(this.transformControlsHelper);
    }
    this.transformControls = null;
    this.transformControlsHelper = null;
    this.transformHelper = null;
    this.orbitControls = null;
  }

  setRoot(root) {
    this.root = root || this.scene;
    this.activeBounds = null;
    this._invalidateCapCandidateCache();
    this._rebuildObjectIndex();
    this.lastMaterialSignature = "";
    this.refreshMaterials();
    this._applyFeedback([]);
  }

  setBounds(box) {
    this.bounds = box?.clone?.() || box || null;
    this.activeBounds = null;
    this._invalidateCapCandidateCache();
    this._applyState();
  }

  enable() {
    this.setState({ ...this.state, enabled: true });
  }

  disable() {
    this.setState({ ...this.state, enabled: false });
  }

  reset() {
    this.setState(createDefaultClippingState());
  }

  setState(nextState = {}) {
    this.state = normalizeClippingState(nextState);
    this._applyState();
    this._emitChange("external");
  }

  patchState(patch = {}) {
    this.setState({
      ...this.state,
      ...patch,
      targets: { ...this.state.targets, ...(patch.targets || {}) },
      plane: { ...this.state.plane, ...(patch.plane || {}) },
      planes: patch.planes || this.state.planes,
      singlePlane: {
        ...this.state.singlePlane,
        ...(patch.singlePlane || {})
      }
    });
  }

  getState() {
    return cloneClippingState(this.state);
  }

  getStats() {
    return { ...this.stats };
  }

  setMode(mode) {
    this.patchState({ mode });
  }

  setHelpersVisible(visible) {
    this.patchState({ helpersVisible: visible });
  }

  setEditMode(mode) {
    const nextMode = mode === "rotate" ? "rotate" : "translate";
    this.patchState({ editMode: nextMode });
    this.transformControls?.setMode?.(nextMode);
  }

  setPlanePosition(axis, normalizedValue) {
    if (!AXES.includes(axis)) return;
    this.setState({
      ...this.state,
      enabled: true,
      mode: "single-plane",
      plane: { ...this.state.plane, custom: false },
      singlePlane: {
        ...this.state.singlePlane,
        axis,
        position: normalizedValue
      }
    });
  }

  refreshMaterials({ lightweight = false } = {}) {
    if (!lightweight) {
      this._resetFeedbackMaterials();
      this._invalidateCapCandidateCache();
    }

    const activePlanes = this.state.enabled ? this._getActivePlanes() : [];
    const targetRoot = this.root || this.scene;
    const targetRoots = this._resolveTargetRoots();
    const objectModeActive =
      this.state.enabled &&
      this.state.targets.mode === "objects" &&
      targetRoots.length > 0;
    const materialSignature = this._getMaterialSignature();

    if (materialSignature !== this.lastMaterialSignature) {
      this._restoreTargetOpaqueMaterials();
      this._restoreMaterialOverrides();
      this.lastMaterialSignature = materialSignature;
      this._invalidateCapCandidateCache();
    }
    if (objectModeActive) {
      this._ensureObjectMaterialOverrides(targetRoot, targetRoots);
      this._applyTargetOpaqueMaterials(targetRoots);
    }

    targetRoot?.traverse?.(obj => {
      if (!obj?.isMesh || obj.userData?.isHelper || obj.userData?.isMeasure) {
        return;
      }

      const shouldClip =
        activePlanes.length > 0 &&
        (!objectModeActive || this._isDescendantOfAny(obj, targetRoots));
      getMaterials(obj).forEach(material => {
        material.clippingPlanes = shouldClip ? activePlanes : null;
        material.clipShadows = shouldClip;
        material.clipIntersection = false;
        material.needsUpdate = true;
      });
    });
  }

  beginDrag(event, camera, domElement) {
    if (
      !this.state.enabled ||
      !this._getEffectiveBounds() ||
      !camera ||
      !domElement ||
      this.transformControls?.dragging
    ) {
      return false;
    }
    this.stopAnimation();

    const rect = domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.pointer, camera);

    const targets = Object.values(this.helpers)
      .map(item => item?.userData?.hitMesh)
      .filter(Boolean);
    if (!targets.length) return false;

    const hit = this.raycaster.intersectObjects(targets, false)[0];
    if (!hit?.object?.userData?.clippingEntry) return false;

    const entry = hit.object.userData.clippingEntry;
    if (entry.key === "custom") return false;

    const center = this._getEntryCenter(entry);
    const axisNormal = this._getEntryAxisNormal(entry);
    const viewNormal = new THREE.Vector3();
    camera.getWorldDirection(viewNormal);
    if (viewNormal.lengthSq() === 0) return false;

    this.dragPlane.setFromNormalAndCoplanarPoint(viewNormal, center);
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, this.dragPoint)) {
      return false;
    }

    this.dragState = {
      key: entry.key,
      planeId: entry.planeId || "",
      axis: entry.axis,
      center: center.clone(),
      point: this.dragPoint.clone(),
      startState: this.getState()
    };
    this.activeBounds = this.activeBounds || this._resolveActiveBounds();
    if (this.state.capEnabled) this._getCapCandidates();
    this.dragCenter.copy(center);
    this.dragViewNormal.copy(viewNormal);
    this.dragAxisNormal.copy(axisNormal);
    return true;
  }

  updateDrag(event, camera, domElement) {
    if (
      !this.dragState ||
      !camera ||
      !domElement ||
      !this._getEffectiveBounds()
    )
      return null;

    const rect = domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.pointer, camera);
    this.dragPlane.setFromNormalAndCoplanarPoint(
      this.dragViewNormal,
      this.dragCenter
    );
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, this.dragPoint)) {
      return null;
    }

    const delta = this.dragPoint.clone().sub(this.dragState.point);
    const axisDelta = delta.dot(this.dragAxisNormal);
    const nextState = this._applyDragDelta(axisDelta);
    if (!nextState) return null;

    this.state = normalizeClippingState(nextState);
    this._applyInteractionState();
    this._emitChange("drag");
    return this.getState();
  }

  endDrag() {
    const wasDragging = Boolean(this.dragState);
    this.dragState = null;
    if (wasDragging) {
      this._applyState();
      this._emitChange("drag-end");
    }
    return wasDragging;
  }

  isDragging() {
    return Boolean(this.dragState);
  }

  isInteractionActive() {
    return Boolean(
      this.dragState ||
      this.transformControls?.dragging ||
      this.transformControls?.axis
    );
  }

  dispose() {
    this.stopAnimation();
    this.disposeTransformControls();
    this.renderer.localClippingEnabled = false;
    this.renderer.clippingPlanes = [];
    this._resetFeedbackMaterials();
    this._restoreTargetOpaqueMaterials();
    this._restoreMaterialOverrides();
    this.refreshMaterials();
    this._removeHelpers();
    this._removeCaps();
    this._invalidateCapCandidateCache();
  }

  setAnimationOptions(options = {}) {
    if (options.speed !== undefined) {
      this.animation.speed = Math.max(0.2, Number(options.speed) || 0.6);
    }
    if (options.mode === "loop" || options.mode === "ping-pong") {
      this.animation.mode = options.mode;
    }
    if (
      options.axis === "auto" ||
      options.axis === "x" ||
      options.axis === "y" ||
      options.axis === "z"
    ) {
      this.animation.axis = options.axis;
    }
    return this.getAnimationState();
  }

  getAnimationState() {
    return { ...this.animation };
  }

  startAnimation(options = {}) {
    this.setAnimationOptions(options);
    this.animation.playing = true;
    this.animation.direction = 1;
    return this.getAnimationState();
  }

  stopAnimation() {
    const wasPlaying = this.animation.playing;
    this.animation.playing = false;
    this.animation.direction = 1;
    return wasPlaying;
  }

  updateAnimation(deltaSeconds = 0) {
    if (
      !this.animation.playing ||
      !this._getEffectiveBounds() ||
      !this.state.enabled
    ) {
      return false;
    }

    const step =
      Math.max(0.2, Number(this.animation.speed) || 0.6) *
      Math.max(0, deltaSeconds) *
      0.22;
    if (!step) return false;

    const nextState = this._buildAnimatedState(step);
    if (!nextState) return false;

    this.state = normalizeClippingState(nextState);
    this._applyState({ lightweight: true, source: "animation" });
    this._emitChange("animation");
    return true;
  }

  _rebuildObjectIndex() {
    this.objectIndex.clear();
    this.root?.traverse?.(obj => {
      if (obj?.uuid) this.objectIndex.set(obj.uuid, obj);
    });
  }

  _resolveAxisPosition(axis, normalizedPosition) {
    const bounds = this._getEffectiveBounds();
    if (!bounds) return 0;
    const min = bounds.min[axis];
    const max = bounds.max[axis];
    const span = max - min || 1;
    return min + span * normalizedPosition;
  }

  _resolveAxisRatio(axis, worldPosition) {
    const bounds = this._getEffectiveBounds();
    if (!bounds) return 0;
    const min = bounds.min[axis];
    const max = bounds.max[axis];
    const span = max - min || 1;
    return Math.max(0, Math.min(1, (worldPosition - min) / span));
  }

  _getEntryCenter(entry) {
    const bounds = this._getEffectiveBounds();
    if (!bounds) return new THREE.Vector3();
    if (entry.center) return entry.center.clone();
    if (entry.key === "custom") {
      return new THREE.Vector3().fromArray(
        this.state.plane.position || [0, 0, 0]
      );
    }
    const center = bounds.getCenter(new THREE.Vector3());
    if (entry.key.endsWith("Min")) {
      center[entry.axis] = this.planes[entry.key].constant;
    } else {
      center[entry.axis] = -this.planes[entry.key].constant;
    }
    return center;
  }

  _getEntryAxisNormal(entry) {
    const normal = new THREE.Vector3();
    normal.copy(entry.plane.normal).normalize();
    return normal;
  }

  _applyDragDelta(axisDelta) {
    if (!this.dragState || !this._getEffectiveBounds()) return null;

    const axis = this.dragState.axis;
    if (!AXES.includes(axis)) return null;
    const nextWorld = this.dragState.center[axis] + axisDelta;
    const nextRatio = this._resolveAxisRatio(axis, nextWorld);

    if (this.state.mode === "single-plane") {
      return {
        ...this.state,
        enabled: true,
        plane: { ...this.state.plane, custom: false },
        singlePlane: {
          ...this.state.singlePlane,
          axis,
          position: nextRatio
        }
      };
    }

    if (this.state.mode === "multi-plane" && this.dragState.planeId) {
      return {
        ...this.state,
        enabled: true,
        activePlaneId: this.dragState.planeId,
        planes: this.state.planes.map(item =>
          item.id === this.dragState.planeId
            ? {
                ...item,
                axis,
                custom: false,
                normalizedPosition: nextRatio
              }
            : item
        )
      };
    }

    return null;
  }

  _buildAnimatedState(step) {
    const normalized = normalizeClippingState(this.state);
    const animationMode = this.animation.mode;
    const animationAxis = this.animation.axis;

    if (normalized.mode !== "single-plane") return normalized;

    const activeAxis =
      animationAxis !== "auto" ? animationAxis : normalized.singlePlane.axis;
    let nextPosition =
      Number(normalized.singlePlane.position || 0.5) +
      step * this.animation.direction;

    if (animationMode === "loop") {
      if (nextPosition > 1) nextPosition = 0;
      if (nextPosition < 0) nextPosition = 1;
    } else if (nextPosition >= 1) {
      nextPosition = 1;
      this.animation.direction = -1;
    } else if (nextPosition <= 0) {
      nextPosition = 0;
      this.animation.direction = 1;
    }

    return {
      ...normalized,
      enabled: true,
      plane: { ...normalized.plane, custom: false },
      singlePlane: {
        ...normalized.singlePlane,
        axis: activeAxis,
        position: nextPosition
      }
    };
  }

  _buildActivePlaneEntries() {
    if (!this.state.enabled || !this._getEffectiveBounds()) return [];

    if (this.state.mode === "single-plane") {
      if (this.state.plane.custom) {
        const normal = new THREE.Vector3().fromArray(this.state.plane.normal);
        if (normal.lengthSq() === 0) normal.set(1, 0, 0);
        normal.normalize();
        this.planes.custom.normal.copy(normal);
        this.planes.custom.constant = Number(this.state.plane.constant) || 0;
        return [{ key: "custom", axis: "custom", plane: this.planes.custom }];
      }

      const { axis, position, direction } = this.state.singlePlane;
      const resolved = this._resolveAxisPosition(axis, position);
      const key = `${axis}${direction === "negative" ? "Max" : "Min"}`;
      const plane = this.planes[key];
      plane.constant = direction === "negative" ? -resolved : resolved;
      return [{ key, axis, plane }];
    }

    if (this.state.mode === "multi-plane") {
      return this.state.planes
        .filter(item => item.enabled !== false)
        .map((item, index) => this._buildPlaneEntryFromConfig(item, index))
        .filter(Boolean);
    }

    return [];
  }

  _getDynamicPlane(key) {
    if (!this.dynamicPlanes.has(key)) {
      this.dynamicPlanes.set(
        key,
        new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)
      );
    }
    return this.dynamicPlanes.get(key);
  }

  _buildPlaneEntryFromConfig(config, index = 0) {
    if (!config?.id) return null;
    const plane = this._getDynamicPlane(config.id);
    let center = null;
    let quaternion = null;
    if (config.custom) {
      const normal = new THREE.Vector3().fromArray(config.normal || [1, 0, 0]);
      if (normal.lengthSq() === 0) normal.set(1, 0, 0);
      normal.normalize();
      plane.normal.copy(normal);
      plane.constant = Number(config.constant) || 0;
      center = new THREE.Vector3().fromArray(config.position || [0, 0, 0]);
      quaternion = new THREE.Quaternion().fromArray(
        config.quaternion || [0, 0, 0, 1]
      );
    } else {
      const axis = AXES.includes(config.axis) ? config.axis : "x";
      const direction =
        config.direction === "negative" ? "negative" : "positive";
      const resolved = this._resolveAxisPosition(
        axis,
        Number(config.normalizedPosition ?? 0.5)
      );
      const sign = direction === "negative" ? 1 : -1;
      plane.normal.set(0, 0, 0);
      plane.normal[axis] = sign;
      plane.constant = direction === "negative" ? -resolved : resolved;
      center = this._getEffectiveBounds().getCenter(new THREE.Vector3());
      center[axis] = resolved;
    }
    return {
      key: config.id,
      planeId: config.id,
      axis: config.custom ? "custom" : config.axis || "x",
      plane,
      center,
      quaternion,
      order: index
    };
  }

  _applyState({ lightweight = false, skipTransformSync = false } = {}) {
    this.activeBounds = this._resolveActiveBounds();
    const activeEntries = this._buildActivePlaneEntries();

    this.renderer.localClippingEnabled = Boolean(this.state.enabled);
    this.renderer.clippingPlanes = [];
    this.refreshMaterials({ lightweight });
    this._updateHelpers(activeEntries);
    this._updateCaps(activeEntries);
    if (!skipTransformSync) this._syncTransformControls(activeEntries);

    const now = performance.now?.() || Date.now();
    if (!lightweight || now - this.lastStatsAt >= STATS_THROTTLE_MS) {
      const analysis = this._analyzeMeshes(activeEntries);
      this.stats = analysis.stats;
      this._applyFeedback(analysis.meshStates);
      this.lastStatsAt = now;
    }
  }

  _applyInteractionState({ skipTransformSync = false } = {}) {
    this.activeBounds = this.activeBounds || this._resolveActiveBounds();
    const activeEntries = this._buildActivePlaneEntries();

    this.renderer.localClippingEnabled = Boolean(this.state.enabled);
    this.renderer.clippingPlanes = [];
    this._updateHelpers(activeEntries);
    this._updateCapsForInteraction(activeEntries);
    if (!skipTransformSync) this._syncTransformControls(activeEntries);
  }

  _analyzeMeshes(activeEntries) {
    const result = {
      enabled: Boolean(this.state.enabled),
      mode: this.state.mode,
      activePlaneCount: activeEntries.length,
      affectedMeshCount: 0,
      totalMeshCount: 0
    };
    const meshStates = [];
    const roots = this._resolveTargetRoots();

    if (!roots.length || !this._getEffectiveBounds() || !this.state.enabled) {
      return { stats: result, meshStates };
    }

    const visited = new Set();
    roots.forEach(root => {
      root.traverse?.(obj => {
        if (
          !obj?.isMesh ||
          visited.has(obj) ||
          obj.userData?.isHelper ||
          obj.userData?.isMeasure
        ) {
          return;
        }
        visited.add(obj);
        result.totalMeshCount += 1;
        const box = new THREE.Box3().setFromObject(obj);
        if (box.isEmpty()) return;
        const affected = this._isBoxAffectedByPlanes(box, activeEntries);
        if (affected) result.affectedMeshCount += 1;
        meshStates.push({ object: obj, affected });
      });
    });

    return { stats: result, meshStates };
  }

  _isBoxAffectedByPlanes(box, activeEntries) {
    if (!activeEntries.length) return false;
    const corners = getBoxCorners(box);
    return activeEntries.some(entry => {
      const distances = corners.map(point =>
        entry.plane.distanceToPoint(point)
      );
      return (
        distances.some(value => value < 0) && distances.some(value => value > 0)
      );
    });
  }

  _applyFeedback(meshStates = []) {
    this._resetFeedbackMaterials();

    if (
      !this.state.enabled ||
      this.state.feedbackMode === "none" ||
      this.state.targets.mode === "objects"
    ) {
      return;
    }

    meshStates.forEach(({ object, affected }) => {
      const shouldApply =
        (this.state.feedbackMode === "highlight-affected" && affected) ||
        (this.state.feedbackMode === "dim-unaffected" && !affected);
      if (!shouldApply) return;

      getMaterials(object).forEach(material => {
        this._storeMaterialFeedbackState(material);
        if (this.state.feedbackMode === "highlight-affected") {
          this._applyHighlightFeedback(material);
        } else if (this.state.feedbackMode === "dim-unaffected") {
          this._applyDimFeedback(material);
        }
      });
    });
  }

  _storeMaterialFeedbackState(material) {
    if (!material?.userData?.__clippingFeedbackBase) {
      material.userData = material.userData || {};
      material.userData.__clippingFeedbackBase = {
        opacity: material.opacity,
        transparent: material.transparent,
        depthWrite: material.depthWrite,
        color:
          material.color && typeof material.color.getHex === "function"
            ? material.color.getHex()
            : null,
        emissive:
          material.emissive && typeof material.emissive.getHex === "function"
            ? material.emissive.getHex()
            : null,
        emissiveIntensity:
          typeof material.emissiveIntensity === "number"
            ? material.emissiveIntensity
            : null
      };
    }
    this.feedbackMaterials.add(material);
  }

  _resetFeedbackMaterials() {
    this.feedbackMaterials.forEach(material => {
      const base = material?.userData?.__clippingFeedbackBase;
      if (!material || !base) return;
      material.opacity = base.opacity;
      material.transparent = base.transparent;
      if (base.depthWrite !== undefined) material.depthWrite = base.depthWrite;
      if (base.color !== null && material.color)
        material.color.setHex(base.color);
      if (base.emissive !== null && material.emissive) {
        material.emissive.setHex(base.emissive);
      }
      if (base.emissiveIntensity !== null) {
        material.emissiveIntensity = base.emissiveIntensity;
      }
      delete material.userData.__clippingFeedbackBase;
      material.needsUpdate = true;
    });
    this.feedbackMaterials.clear();
  }

  _applyHighlightFeedback(material) {
    if (material.emissive) {
      material.emissive.setRGB(0.95, 0.45, 0.08);
      material.emissiveIntensity = Math.max(
        0.6,
        Number(material.emissiveIntensity) || 0
      );
    } else if (material.color) {
      material.color.lerp(new THREE.Color(0xff8a3d), 0.35);
    }
    material.needsUpdate = true;
  }

  _applyDimFeedback(material) {
    material.transparent = true;
    material.opacity = Math.min(Number(material.opacity ?? 1), 0.18);
    material.depthWrite = false;
    material.needsUpdate = true;
  }

  _createHelper(entry, size) {
    const helper = new THREE.Group();
    helper.renderOrder = 999;
    helper.userData.isHelper = true;

    const color = AXIS_COLORS[entry.axis] || AXIS_COLORS.custom;
    const planeGeometry = new THREE.PlaneGeometry(size, size);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: CLIPPING_HELPER_OPACITY,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4
    });
    const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
    planeMesh.renderOrder = 997;
    planeMesh.userData.isHelper = true;
    helper.add(planeMesh);

    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(planeGeometry),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.92,
        depthTest: false,
        depthWrite: false,
        toneMapped: false
      })
    );
    outline.renderOrder = 998;
    outline.userData.isHelper = true;
    helper.add(outline);

    const hitMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 0.28, size * 0.28),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.02,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -6,
        polygonOffsetUnits: -6
      })
    );
    hitMesh.renderOrder = 1000;
    hitMesh.userData.isHelper = true;
    hitMesh.userData.clippingEntry = {
      key: entry.key,
      axis: entry.axis,
      planeId: entry.planeId || ""
    };
    helper.add(hitMesh);
    helper.userData.planeMesh = planeMesh;
    helper.userData.outline = outline;
    helper.userData.hitMesh = hitMesh;
    return helper;
  }

  _createCap(entry, activeEntries, candidates, planeIndex) {
    const group = new THREE.Group();
    group.renderOrder = SECTION_CAP_RENDER_ORDER;
    group.userData.isHelper = true;
    group.userData.isClippingCap = true;

    const stride = Math.max(candidates.length * 3 + 4, 4);
    const planeOrderOffset = Math.max(0, planeIndex) * stride;
    const otherPlanes = activeEntries
      .filter(item => item.key !== entry.key)
      .map(item => item.plane);

    candidates
      .filter(candidate => this._isCandidateAffectedByEntry(candidate, entry))
      .forEach((candidate, index) => {
        const renderOrder =
          SECTION_CAP_RENDER_ORDER + planeOrderOffset + index * 3;
        const stencilGroup = this._createStencilCapMask(
          candidate,
          entry,
          renderOrder
        );
        group.add(stencilGroup);

        const capSurface = this._createCapSurface(
          candidate,
          entry,
          otherPlanes,
          renderOrder + 1
        );
        group.add(capSurface);
      });

    return group;
  }

  _invalidateCapCandidateCache() {
    this.capCandidateCache = { signature: "", candidates: [] };
  }

  _getCapCandidateCacheSignature() {
    const roots = this._resolveTargetRoots();
    return [
      this.root?.uuid || this.scene?.uuid || "",
      roots.map(item => item?.uuid || "").join("|"),
      this.state.targets.mode,
      this.state.targets.objectUuids.join("|"),
      this.lastMaterialSignature
    ].join("::");
  }

  _getCapCandidates() {
    const signature = this._getCapCandidateCacheSignature();
    if (signature === this.capCandidateCache.signature) {
      return this.capCandidateCache.candidates;
    }

    const candidates = this._collectCapCandidates();
    this.capCandidateCache = { signature, candidates };
    return candidates;
  }

  _collectCapCandidates() {
    const roots = this._resolveTargetRoots();
    const candidates = [];
    const visited = new Set();
    roots.forEach(root => {
      root?.traverse?.(obj => {
        if (
          !obj?.isMesh ||
          visited.has(obj) ||
          obj.userData?.isHelper ||
          obj.userData?.isMeasure ||
          obj.visible === false
        ) {
          return;
        }
        const materials = getMaterials(obj);
        if (!materials.length) return;
        obj.updateWorldMatrix?.(true, false);
        const bounds = new THREE.Box3().setFromObject(obj);
        if (bounds.isEmpty()) return;
        visited.add(obj);
        candidates.push({
          object: obj,
          material: materials[0],
          bounds
        });
      });
    });
    return candidates.slice(0, SECTION_CAP_MAX_MESHES);
  }

  _getCapDimensions(entry, bounds) {
    const diagonal = Math.max(
      bounds?.getSize?.(new THREE.Vector3()).length() || 1,
      1
    );
    const minSize = Math.max(diagonal * 0.04, 0.25);
    if (!bounds || bounds.isEmpty?.()) {
      const fallbackSize = Math.max(diagonal, minSize);
      return {
        width: fallbackSize,
        height: fallbackSize,
        sizeKey: `${fallbackSize.toFixed(3)}:${fallbackSize.toFixed(3)}`
      };
    }

    const normal = this._getEntryAxisNormal(entry);
    const center = this._getCapPlaneCenter(entry, bounds);
    const { tangent, bitangent } = this._getPlaneBasis(normal);
    const corners = getBoxCorners(bounds);
    const projected = corners.map(point => {
      const delta = point.clone().sub(center);
      return {
        u: delta.dot(tangent),
        v: delta.dot(bitangent)
      };
    });
    const minU = Math.min(...projected.map(item => item.u));
    const maxU = Math.max(...projected.map(item => item.u));
    const minV = Math.min(...projected.map(item => item.v));
    const maxV = Math.max(...projected.map(item => item.v));
    const width = Math.max((maxU - minU) * SECTION_CAP_PADDING, minSize);
    const height = Math.max((maxV - minV) * SECTION_CAP_PADDING, minSize);
    return {
      width,
      height,
      sizeKey: `${width.toFixed(3)}:${height.toFixed(3)}`
    };
  }

  _isCandidateAffectedByEntry(candidate, entry) {
    return Boolean(
      candidate?.bounds &&
      entry?.plane &&
      this._isBoxAffectedByPlanes(candidate.bounds, [entry])
    );
  }

  _getPlaneBasis(normal) {
    const safeNormal = normal.clone();
    if (safeNormal.lengthSq() === 0) safeNormal.set(0, 0, 1);
    safeNormal.normalize();
    const reference =
      Math.abs(safeNormal.y) < 0.92
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0);
    const tangent = new THREE.Vector3()
      .crossVectors(reference, safeNormal)
      .normalize();
    const bitangent = new THREE.Vector3()
      .crossVectors(safeNormal, tangent)
      .normalize();
    return { tangent, bitangent };
  }

  _getCapPlaneCenter(entry, bounds) {
    const normal = this._getEntryAxisNormal(entry);
    const center =
      bounds?.getCenter?.(new THREE.Vector3()) || this._getEntryCenter(entry);
    const distance = entry.plane.distanceToPoint(center);
    return center.addScaledVector(normal, -distance);
  }

  _syncCapGeometry(cap, entry, bounds) {
    if (!cap) return;
    const { width, height, sizeKey } = this._getCapDimensions(entry, bounds);
    if (cap.userData.capSizeKey === sizeKey) return;

    const nextGeometry = new THREE.PlaneGeometry(width, height);
    cap.geometry?.dispose?.();
    cap.geometry = nextGeometry;
    cap.userData.capSizeKey = sizeKey;

    const edges = cap.userData.edges;
    if (edges) {
      edges.geometry?.dispose?.();
      edges.geometry = new THREE.EdgesGeometry(nextGeometry);
    }
  }

  _createStencilMaterial(entry, side, stencilOp) {
    const material = new THREE.MeshBasicMaterial({
      depthWrite: false,
      depthTest: false,
      colorWrite: false,
      side
    });
    material.clippingPlanes = [entry.plane];
    material.stencilWrite = true;
    material.stencilFunc = THREE.AlwaysStencilFunc;
    material.stencilFail = stencilOp;
    material.stencilZFail = stencilOp;
    material.stencilZPass = stencilOp;
    material.needsUpdate = true;
    return material;
  }

  _createWorldStencilMesh(source, material, renderOrder) {
    const mesh = new THREE.Mesh(source.geometry, material);
    mesh.renderOrder = renderOrder;
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(source.matrixWorld);
    mesh.matrixWorld.copy(source.matrixWorld);
    mesh.frustumCulled = false;
    mesh.userData.isHelper = true;
    mesh.userData.isClippingCap = true;
    mesh.userData.isSectionCapStencil = true;
    mesh.userData.sourceObjectUuid = source.uuid;
    return mesh;
  }

  _createStencilCapMask(candidate, entry, renderOrder) {
    const group = new THREE.Group();
    group.userData.isHelper = true;
    group.userData.isClippingCap = true;
    group.userData.isSectionCapStencilGroup = true;
    group.userData.sourceObjectUuid = candidate.object.uuid;
    group.userData.capEntryKey = entry.key;

    const backMaterial = this._createStencilMaterial(
      entry,
      THREE.BackSide,
      THREE.IncrementWrapStencilOp
    );
    const frontMaterial = this._createStencilMaterial(
      entry,
      THREE.FrontSide,
      THREE.DecrementWrapStencilOp
    );
    group.add(
      this._createWorldStencilMesh(candidate.object, backMaterial, renderOrder),
      this._createWorldStencilMesh(candidate.object, frontMaterial, renderOrder)
    );
    return group;
  }

  _createCapMaterial(sourceMaterial, clippingPlanes = []) {
    const color = new THREE.Color(SECTION_CAP_FALLBACK_COLOR);
    if (sourceMaterial?.color?.isColor) {
      color.copy(sourceMaterial.color);
    } else if (sourceMaterial?.emissive?.isColor) {
      color.copy(sourceMaterial.emissive);
    }

    const material = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      toneMapped: false
    });
    material.clippingPlanes = clippingPlanes;
    material.clipIntersection = false;
    material.stencilWrite = true;
    material.stencilRef = 0;
    material.stencilFunc = THREE.NotEqualStencilFunc;
    material.stencilFail = THREE.ReplaceStencilOp;
    material.stencilZFail = THREE.ReplaceStencilOp;
    material.stencilZPass = THREE.ReplaceStencilOp;
    material.alphaTest = 0;
    material.userData.isSectionCapMaterial = true;
    material.needsUpdate = true;
    return material;
  }

  _createCapSurface(candidate, entry, clippingPlanes, renderOrder) {
    const { width, height, sizeKey } = this._getCapDimensions(
      entry,
      candidate.bounds
    );
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = this._createCapMaterial(
      candidate.material,
      clippingPlanes
    );
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = renderOrder;
    mesh.frustumCulled = false;
    mesh.userData.isHelper = true;
    mesh.userData.isClippingCap = true;
    mesh.userData.isSectionCapSurface = true;
    mesh.userData.sourceObjectUuid = candidate.object.uuid;
    mesh.userData.capEntryKey = entry.key;
    mesh.userData.capSizeKey = sizeKey;
    mesh.userData.sourceBounds = candidate.bounds.clone();
    this._updateCapSurfaceTransform(mesh, entry, candidate.bounds);
    return mesh;
  }

  _updateCapSurfaceTransform(
    mesh,
    entry,
    bounds,
    offset = CLIPPING_CAP_OFFSET
  ) {
    if (!mesh) return;
    const center = this._getCapPlaneCenter(entry, bounds);
    const normal = this._getEntryAxisNormal(entry);
    if (offset) center.addScaledVector(normal, offset);
    mesh.position.copy(center);
    if (entry.quaternion) {
      mesh.quaternion.copy(entry.quaternion);
    } else {
      mesh.quaternion.setFromUnitVectors(LOCAL_PLANE_NORMAL, normal);
    }
    mesh.updateMatrixWorld(true);
  }

  _syncCapGroup(group, entry, activeEntries, candidates) {
    if (!group) return;
    const candidateMap = new Map(
      candidates.map(item => [item.object.uuid, item])
    );
    const otherPlanes = activeEntries
      .filter(item => item.key !== entry.key)
      .map(item => item.plane);

    group.traverse(child => {
      const candidate = candidateMap.get(child.userData?.sourceObjectUuid);
      if (!candidate) return;

      if (child.userData?.isSectionCapStencil) {
        child.visible = this._isCandidateAffectedByEntry(candidate, entry);
        child.matrix.copy(candidate.object.matrixWorld);
        child.matrixWorld.copy(candidate.object.matrixWorld);
        child.material.clippingPlanes = [entry.plane];
        child.material.needsUpdate = true;
      }

      if (child.userData?.isSectionCapSurface) {
        child.visible = this._isCandidateAffectedByEntry(candidate, entry);
        child.material.clippingPlanes = otherPlanes;
        child.material.needsUpdate = true;
        this._syncCapGeometry(child, entry, candidate.bounds);
        this._updateCapSurfaceTransform(child, entry, candidate.bounds);
      }
    });
  }

  _buildCapSignature(activeEntries, candidates) {
    return [
      this.state.mode,
      this.state.targets.mode,
      this.state.targets.objectUuids.join("|"),
      activeEntries
        .map(entry => {
          const affected = candidates
            .filter(candidate =>
              this._isCandidateAffectedByEntry(candidate, entry)
            )
            .map(candidate => candidate.object.uuid)
            .join(",");
          return `${entry.key}[${affected}]`;
        })
        .join("|"),
      candidates
        .map(item => {
          const material = item.material;
          const color =
            material?.color && typeof material.color.getHexString === "function"
              ? material.color.getHexString()
              : "";
          return `${item.object.uuid}:${material?.uuid || ""}:${color}`;
        })
        .join("|")
    ].join("::");
  }

  _updatePlaneTransform(mesh, entry, offset = 0) {
    if (!mesh || !this._getEffectiveBounds()) return;
    const center = this._getEntryCenter(entry);
    const normal = this._getEntryAxisNormal(entry);
    if (offset) center.addScaledVector(normal, offset);
    mesh.position.copy(center);
    if (entry.quaternion) {
      mesh.quaternion.copy(entry.quaternion);
    } else if (entry.key === "custom") {
      mesh.quaternion.fromArray(this.state.plane.quaternion);
    } else {
      mesh.quaternion.setFromUnitVectors(LOCAL_PLANE_NORMAL, normal);
    }
    mesh.updateMatrixWorld(true);
  }

  _updateCaps(activeEntries) {
    const shouldShow =
      this.state.enabled &&
      this.state.capEnabled &&
      this._getEffectiveBounds() &&
      activeEntries.length > 0;
    if (!shouldShow) {
      this._removeCaps();
      return;
    }

    const candidates = this._getCapCandidates();
    if (!candidates.length) {
      this._removeCaps();
      return;
    }

    const signature = this._buildCapSignature(activeEntries, candidates);
    if (signature !== this.capSignature) {
      this._removeCaps();
      this.capSignature = signature;
    }

    const activeKeys = new Set(activeEntries.map(item => item.key));
    activeEntries.forEach((entry, index) => {
      if (!this.caps[entry.key]) {
        this.caps[entry.key] = this._createCap(
          entry,
          activeEntries,
          candidates,
          index
        );
        this.scene.add(this.caps[entry.key]);
      }
      this._syncCapGroup(
        this.caps[entry.key],
        entry,
        activeEntries,
        candidates
      );
      this.caps[entry.key].visible = true;
    });

    Object.keys(this.caps).forEach(key => {
      if (activeKeys.has(key)) return;
      this.scene.remove(this.caps[key]);
      disposeSectionCapGroup(this.caps[key]);
      this.caps[key] = null;
    });
  }

  _updateCapsForInteraction(activeEntries) {
    const shouldShow =
      this.state.enabled &&
      this.state.capEnabled &&
      this._getEffectiveBounds() &&
      activeEntries.length > 0;
    if (!shouldShow) {
      this._removeCaps();
      return;
    }

    const candidates = this._getCapCandidates();
    if (!candidates.length) {
      this._removeCaps();
      return;
    }

    const hasMissingCap = activeEntries.some(entry => !this.caps[entry.key]);
    if (hasMissingCap) {
      this._updateCaps(activeEntries);
      return;
    }

    const activeKeys = new Set(activeEntries.map(item => item.key));
    activeEntries.forEach(entry => {
      this._syncCapGroup(
        this.caps[entry.key],
        entry,
        activeEntries,
        candidates
      );
      this.caps[entry.key].visible = true;
    });

    Object.keys(this.caps).forEach(key => {
      if (activeKeys.has(key)) return;
      this.scene.remove(this.caps[key]);
      disposeSectionCapGroup(this.caps[key]);
      this.caps[key] = null;
    });
  }

  _reuseAttachedSinglePlaneHelper(activeEntries, activeKeys) {
    if (
      this.state.mode !== "single-plane" ||
      !this.transformHelper ||
      this.helpers.custom
    ) {
      return;
    }

    const customEntry = activeEntries.find(item => item.key === "custom");
    if (!customEntry) return;

    const previousKey = Object.keys(this.helpers).find(
      key => this.helpers[key] === this.transformHelper && !activeKeys.has(key)
    );
    if (!previousKey) return;

    this.helpers.custom = this.transformHelper;
    delete this.helpers[previousKey];
  }

  _updateHelpers(activeEntries) {
    const shouldShow =
      this.state.enabled &&
      this.state.helpersVisible &&
      this._getEffectiveBounds() &&
      activeEntries.length > 0;

    if (!shouldShow) {
      this._removeHelpers();
      return;
    }

    const size = new THREE.Vector3();
    this._getEffectiveBounds().getSize(size);
    const helperSize = Math.max(size.x, size.y, size.z) * 1.3;
    const activeKeys = new Set(activeEntries.map(item => item.key));
    this._reuseAttachedSinglePlaneHelper(activeEntries, activeKeys);

    activeEntries.forEach(entry => {
      if (!this.helpers[entry.key]) {
        this.helpers[entry.key] = this._createHelper(entry, helperSize);
        this.scene.add(this.helpers[entry.key]);
      }
      const helper = this.helpers[entry.key];
      helper.visible = true;
      helper.userData.hitMesh.userData.clippingEntry = {
        key: entry.key,
        axis: entry.axis,
        planeId: entry.planeId || ""
      };
      this._syncHelperVisualOpacity(helper);
      this._updatePlaneTransform(helper, entry, CLIPPING_HELPER_OFFSET);
      helper.updateMatrixWorld?.(true);
    });

    Object.keys(this.helpers).forEach(key => {
      if (activeKeys.has(key)) return;
      if (this.transformHelper === this.helpers[key]) {
        this.transformControls?.detach?.();
        this.transformHelper = null;
      }
      this.scene.remove(this.helpers[key]);
      disposeHelper(this.helpers[key]);
      this.helpers[key] = null;
    });
  }

  _syncHelperVisualOpacity(helper) {
    const material = helper?.userData?.planeMesh?.material;
    if (!material) return;
    const opacity = this.state.capEnabled
      ? CLIPPING_HELPER_CAP_OPACITY
      : CLIPPING_HELPER_OPACITY;
    if (Math.abs(Number(material.opacity ?? 0) - opacity) < 0.001) return;
    material.opacity = opacity;
    material.needsUpdate = true;
  }

  _removeHelpers() {
    Object.keys(this.helpers).forEach(key => {
      if (!this.helpers[key]) return;
      if (this.transformHelper === this.helpers[key]) {
        this.transformControls?.detach?.();
        this.transformHelper = null;
      }
      this.scene.remove(this.helpers[key]);
      disposeHelper(this.helpers[key]);
      this.helpers[key] = null;
    });
  }

  _removeCaps() {
    Object.keys(this.caps).forEach(key => {
      if (!this.caps[key]) return;
      this.scene.remove(this.caps[key]);
      disposeSectionCapGroup(this.caps[key]);
      this.caps[key] = null;
    });
    this.capSignature = "";
  }

  _getActivePlanes() {
    return this.state.enabled
      ? this._buildActivePlaneEntries().map(item => item.plane)
      : [];
  }

  _resolveTargetRoots() {
    if (this.state.targets.mode !== "objects") {
      return [this.root || this.scene].filter(Boolean);
    }
    const roots = this.state.targets.objectUuids
      .map(uuid => this.objectIndex.get(uuid) || this._findObjectByUUID(uuid))
      .filter(Boolean);
    return roots.length ? roots : [];
  }

  _resolveClippingRoot() {
    const roots = this._resolveTargetRoots();
    if (this.state.targets.mode === "objects") return roots[0] || null;
    return roots[0] || this.root || this.scene;
  }

  _resolveActiveBounds() {
    const roots = this._resolveTargetRoots();
    if (this.state.targets.mode === "objects" && roots.length) {
      const box = new THREE.Box3();
      roots.forEach(root => box.expandByObject(root));
      if (!box.isEmpty()) return box;
    }
    return this.bounds?.clone?.() || this.bounds || null;
  }

  _getEffectiveBounds() {
    return this.activeBounds || this._resolveActiveBounds();
  }

  _findObjectByUUID(uuid) {
    if (!uuid || !this.root?.traverse) return null;
    let found = null;
    this.root.traverse(obj => {
      if (!found && obj?.uuid === uuid) found = obj;
    });
    if (found?.uuid) this.objectIndex.set(found.uuid, found);
    return found;
  }

  _isDescendantOf(obj, targetRoot) {
    let current = obj;
    while (current) {
      if (current === targetRoot) return true;
      current = current.parent;
    }
    return false;
  }

  _isDescendantOfAny(obj, targetRoots = []) {
    return targetRoots.some(root => this._isDescendantOf(obj, root));
  }

  _getMaterialSignature() {
    if (!this.state.enabled || this.state.targets.mode !== "objects") {
      return "scene";
    }
    return [
      "objects",
      this.state.targets.objectUuids.join("|"),
      Number(this.state.nonTargetOpacity || NON_TARGET_OPACITY).toFixed(3)
    ].join(":");
  }

  _ensureObjectMaterialOverrides(targetRoot, targetRoots) {
    targetRoot?.traverse?.(obj => {
      if (!obj?.isMesh || obj.userData?.isHelper || obj.userData?.isMeasure) {
        return;
      }
      const isTarget = this._isDescendantOfAny(obj, targetRoots);

      if (!this.materialOverrides.has(obj)) {
        const originalMaterial = obj.material;
        const overrideMaterial = Array.isArray(originalMaterial)
          ? originalMaterial.map(item => item?.clone?.() || item)
          : originalMaterial?.clone?.() || originalMaterial;
        this.materialOverrides.set(obj, originalMaterial);
        obj.material = overrideMaterial;
      }

      getMaterials(obj).forEach(material => {
        material.transparent = !isTarget;
        material.opacity = isTarget
          ? 1
          : Number(this.state.nonTargetOpacity || NON_TARGET_OPACITY);
        material.depthWrite = Boolean(isTarget);
        material.clippingPlanes = null;
        material.needsUpdate = true;
      });
    });
  }

  _applyTargetOpaqueMaterials(targetRoots) {
    targetRoots.forEach(root => {
      root?.traverse?.(obj => {
        if (!obj?.isMesh || obj.userData?.isHelper || obj.userData?.isMeasure) {
          return;
        }
        getMaterials(obj).forEach(material => {
          if (!material) return;
          if (!this.targetOpaqueMaterials.has(material)) {
            this.targetOpaqueMaterials.set(material, {
              opacity: material.opacity,
              transparent: material.transparent,
              depthWrite: material.depthWrite
            });
          }
          material.opacity = 1;
          material.transparent = false;
          if (material.depthWrite !== undefined) material.depthWrite = true;
          material.needsUpdate = true;
        });
      });
    });
  }

  _restoreTargetOpaqueMaterials() {
    this.targetOpaqueMaterials.forEach((base, material) => {
      if (!material || !base) return;
      material.opacity = base.opacity;
      material.transparent = base.transparent;
      if (base.depthWrite !== undefined) material.depthWrite = base.depthWrite;
      material.needsUpdate = true;
    });
    this.targetOpaqueMaterials.clear();
  }

  _restoreMaterialOverrides() {
    this.materialOverrides.forEach((originalMaterial, obj) => {
      if (!obj) return;
      const currentMaterial = obj.material;
      obj.material = originalMaterial;
      if (Array.isArray(currentMaterial)) {
        currentMaterial.forEach(item => item?.dispose?.());
      } else {
        currentMaterial?.dispose?.();
      }
    });
    this.materialOverrides.clear();
  }

  _scheduleTransformCommit() {
    if (!this.transformHelper || this.syncingTransform) return;
    if (this.transformRafId) return;
    this.transformRafId = requestAnimationFrame(() => {
      this.transformRafId = 0;
      this._commitTransformHelper();
    });
  }

  _commitTransformHelper() {
    if (!this.transformHelper || this.syncingTransform) return;
    this.stopAnimation();
    this.transformHelper.updateMatrixWorld(true);
    const position = this.transformHelper.position.clone();
    const quaternion = this.transformHelper.quaternion.clone();
    const normal = LOCAL_PLANE_NORMAL.clone()
      .applyQuaternion(quaternion)
      .normalize();
    const constant = -normal.dot(position);
    const entry =
      this.transformHelper.userData?.hitMesh?.userData?.clippingEntry;
    if (this.state.mode === "multi-plane" && entry?.planeId) {
      this.state = normalizeClippingState({
        ...this.state,
        enabled: true,
        activePlaneId: entry.planeId,
        planes: this.state.planes.map(item =>
          item.id === entry.planeId
            ? {
                ...item,
                custom: true,
                normal: normal.toArray(),
                constant,
                position: position.toArray(),
                quaternion: quaternion.toArray()
              }
            : item
        )
      });
      this._applyInteractionState({ skipTransformSync: true });
      this._emitChange("plane-transform");
      return;
    }

    this.state = normalizeClippingState({
      ...this.state,
      enabled: true,
      mode: "single-plane",
      plane: {
        ...this.state.plane,
        custom: true,
        normal: normal.toArray(),
        constant,
        position: position.toArray(),
        quaternion: quaternion.toArray()
      }
    });
    this._applyInteractionState({ skipTransformSync: true });
    this._emitChange("transform");
  }

  _syncTransformControls(activeEntries = null) {
    if (!this.transformControls) return;
    this.transformControls.setMode(this.state.editMode || "translate");
    const entries = activeEntries || this._buildActivePlaneEntries();
    const entry =
      this.state.mode === "single-plane" && this.state.helpersVisible
        ? entries[0]
        : this.state.mode === "multi-plane" && this.state.helpersVisible
          ? entries.find(item => item.planeId === this.state.activePlaneId) ||
            entries[0]
          : null;
    const helper = entry ? this.helpers[entry.key] : null;
    if (!helper || !this.state.enabled) {
      this.transformControls.detach?.();
      this.transformHelper = null;
      return;
    }
    if (this.transformHelper === helper) return;
    this.syncingTransform = true;
    this.transformControls.detach?.();
    this.transformControls.attach(helper);
    this.transformHelper = helper;
    this.syncingTransform = false;
  }

  _emitChange(source = "external") {
    this.onChange?.({
      state: this.getState(),
      stats: this.getStats(),
      source
    });
  }
}

export default ClippingTool;
