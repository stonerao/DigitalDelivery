import * as THREE from "three";
import {
  cloneClippingState,
  createDefaultClippingState,
  normalizeClippingState
} from "@/3d/runtime/clipping/clippingState";

const AXES = ["x", "y", "z"];
const AXIS_COLORS = {
  x: 0xff5b5b,
  y: 0x32c26b,
  z: 0x4d8dff
};
const CLIPPING_CAP_OFFSET = -0.0015;
const CLIPPING_HELPER_OFFSET = 0.006;
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
    this.stats = {
      enabled: false,
      mode: "single-plane",
      activePlaneCount: 0,
      affectedMeshCount: 0,
      totalMeshCount: 0
    };
    this.planes = {
      xMin: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),
      xMax: new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),
      yMin: new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
      yMax: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      zMin: new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
      zMax: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    };
  }

  setRoot(root) {
    this.root = root || this.scene;
    this.refreshMaterials();
    this._applyFeedback([]);
  }

  setBounds(box) {
    this.bounds = box?.clone?.() || box || null;
    this._applyState();
  }

  enable() {
    this.setState({
      ...this.state,
      enabled: true
    });
  }

  disable() {
    this.setState({
      ...this.state,
      enabled: false
    });
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
      singlePlane: {
        ...this.state.singlePlane,
        ...(patch.singlePlane || {})
      },
      box: {
        ...this.state.box,
        ...(patch.box || {})
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

  togglePlane(axis) {
    if (!AXES.includes(axis)) return;
    const next = !this.state.box[axis]?.enabled;
    this.setPlaneEnabled(axis, next);
  }

  setPlaneEnabled(axis, enabled) {
    if (!AXES.includes(axis)) return;
    this.setState({
      ...this.state,
      enabled: Boolean(this.state.enabled || enabled),
      mode: "box",
      box: {
        ...this.state.box,
        [axis]: {
          ...this.state.box[axis],
          enabled: Boolean(enabled)
        }
      }
    });
  }

  setPlaneRange(axis, range) {
    if (!AXES.includes(axis)) return;
    this.setState({
      ...this.state,
      enabled: true,
      mode: "box",
      box: {
        ...this.state.box,
        [axis]: {
          ...this.state.box[axis],
          enabled: true,
          range
        }
      }
    });
  }

  setPlanePosition(axis, normalizedValue) {
    if (!AXES.includes(axis)) return;
    this.setState({
      ...this.state,
      enabled: true,
      mode: "single-plane",
      singlePlane: {
        ...this.state.singlePlane,
        axis,
        position: normalizedValue
      }
    });
  }

  refreshMaterials() {
    this._resetFeedbackMaterials();
    const activePlanes = this.state.enabled ? this._getActivePlanes() : [];
    const targetRoot = this.root || this.scene;
    const clippingRoot = this._resolveClippingRoot();
    const objectModeActive =
      this.state.enabled &&
      this.state.targetMode === "object" &&
      Boolean(clippingRoot);

    if (objectModeActive) {
      this._ensureObjectMaterialOverrides(targetRoot);
    } else {
      this._restoreMaterialOverrides();
    }

    targetRoot?.traverse?.(obj => {
      if (!obj?.isMesh || obj.userData?.isHelper || obj.userData?.isMeasure) {
        return;
      }

      const materials = Array.isArray(obj.material)
        ? obj.material
        : [obj.material];
      const shouldClip =
        activePlanes.length > 0 &&
        (this.state.targetMode !== "object" ||
          (clippingRoot && this._isDescendantOf(obj, clippingRoot)));
      materials.filter(Boolean).forEach(material => {
        material.clippingPlanes = shouldClip ? activePlanes : null;
        material.clipShadows = shouldClip;
        material.clipIntersection = false;
        if (objectModeActive && !shouldClip) {
          material.transparent = true;
          material.opacity = Math.min(Number(material.opacity ?? 1), 0.12);
          if (material.depthWrite !== undefined) {
            material.depthWrite = false;
          }
        }
        material.needsUpdate = true;
      });
    });
  }

  beginDrag(event, camera, domElement) {
    if (
      !this.state.enabled ||
      !this._getEffectiveBounds() ||
      !camera ||
      !domElement
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
      .map(item => item?.hitMesh)
      .filter(Boolean);
    if (!targets.length) return false;

    const hit = this.raycaster.intersectObjects(targets, false)[0];
    if (!hit?.object?.userData?.clippingEntry) return false;

    const entry = hit.object.userData.clippingEntry;
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
      axis: entry.axis,
      center: center.clone(),
      point: this.dragPoint.clone(),
      startState: this.getState()
    };
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
    this._applyState();
    this._emitChange("drag");
    return this.getState();
  }

  endDrag() {
    const wasDragging = Boolean(this.dragState);
    this.dragState = null;
    return wasDragging;
  }

  isDragging() {
    return Boolean(this.dragState);
  }

  dispose() {
    this.stopAnimation();
    this.renderer.localClippingEnabled = false;
    this.renderer.clippingPlanes = [];
    this._resetFeedbackMaterials();
    this._restoreMaterialOverrides();
    this.refreshMaterials();
    this._removeHelpers();
    this._removeCaps();
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
    this._applyState();
    this._emitChange("animation");
    return true;
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
    const currentCenter = this._getEntryCenter({
      key: this.dragState.key,
      axis,
      plane: this.planes[this.dragState.key]
    });
    const nextWorld = currentCenter[axis] + axisDelta;
    const nextRatio = this._resolveAxisRatio(axis, nextWorld);

    if (this.state.mode === "single-plane") {
      return {
        ...this.state,
        enabled: true,
        singlePlane: {
          ...this.state.singlePlane,
          axis,
          position: nextRatio
        }
      };
    }

    const currentRange = [...this.state.box[axis].range];
    if (this.dragState.key.endsWith("Min")) {
      currentRange[0] = Math.min(nextRatio, currentRange[1] - 0.01);
    } else {
      currentRange[1] = Math.max(nextRatio, currentRange[0] + 0.01);
    }

    return {
      ...this.state,
      enabled: true,
      mode: "box",
      box: {
        ...this.state.box,
        [axis]: {
          ...this.state.box[axis],
          enabled: true,
          range: currentRange
        }
      }
    };
  }

  _buildAnimatedState(step) {
    const normalized = normalizeClippingState(this.state);
    const animationMode = this.animation.mode;
    const animationAxis = this.animation.axis;

    if (normalized.mode === "single-plane") {
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
        singlePlane: {
          ...normalized.singlePlane,
          axis: activeAxis,
          position: nextPosition
        }
      };
    }

    const activeAxes = AXES.filter(axis => normalized.box?.[axis]?.enabled);
    const targetAxes = activeAxes.length ? activeAxes : ["x"];
    const animatedAxes =
      animationAxis === "auto" ? targetAxes : [animationAxis];
    const nextBox = { ...normalized.box };

    animatedAxes.forEach(axis => {
      const current = normalized.box?.[axis] || {
        enabled: true,
        range: [0.2, 0.8]
      };
      const currentWidth = Math.max(
        0.08,
        (current.range?.[1] || 1) - (current.range?.[0] || 0)
      );
      const width = Math.min(currentWidth, 0.92);
      const travel = Math.max(0, 1 - width);
      if (travel <= 0) return;

      let start = (current.range?.[0] || 0) + step * this.animation.direction;
      if (animationMode === "loop") {
        if (start > travel) start = 0;
        if (start < 0) start = travel;
      } else if (start >= travel) {
        start = travel;
        this.animation.direction = -1;
      } else if (start <= 0) {
        start = 0;
        this.animation.direction = 1;
      }

      nextBox[axis] = {
        ...current,
        enabled: true,
        range: [start, Math.min(1, start + width)]
      };
    });

    return {
      ...normalized,
      enabled: true,
      mode: "box",
      box: nextBox
    };
  }

  _buildActivePlaneEntries() {
    if (!this.state.enabled || !this._getEffectiveBounds()) return [];

    if (this.state.mode === "single-plane") {
      const { axis, position, direction } = this.state.singlePlane;
      const resolved = this._resolveAxisPosition(axis, position);
      const key = `${axis}${direction === "negative" ? "Max" : "Min"}`;
      const plane = this.planes[key];
      plane.constant = direction === "negative" ? -resolved : resolved;
      return [
        {
          key,
          axis,
          plane
        }
      ];
    }

    const entries = [];
    AXES.forEach(axis => {
      if (!this.state.box[axis]?.enabled) return;
      const [minRatio, maxRatio] = this.state.box[axis].range;
      const minPos = this._resolveAxisPosition(axis, minRatio);
      const maxPos = this._resolveAxisPosition(axis, maxRatio);
      this.planes[`${axis}Min`].constant = minPos;
      this.planes[`${axis}Max`].constant = -maxPos;
      entries.push({
        key: `${axis}Min`,
        axis,
        plane: this.planes[`${axis}Min`]
      });
      entries.push({
        key: `${axis}Max`,
        axis,
        plane: this.planes[`${axis}Max`]
      });
    });
    return entries;
  }

  _applyState() {
    this.activeBounds = this._resolveActiveBounds();
    const activeEntries = this._buildActivePlaneEntries();

    this.renderer.localClippingEnabled = Boolean(this.state.enabled);
    this.renderer.clippingPlanes = [];
    this.refreshMaterials();
    this._updateHelpers(activeEntries);
    this._updateCaps(activeEntries);
    const analysis = this._analyzeMeshes(activeEntries);
    this.stats = analysis.stats;
    this._applyFeedback(analysis.meshStates);
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

    const clipRoot = this._resolveClippingRoot();
    if (
      !clipRoot?.traverse ||
      !this._getEffectiveBounds() ||
      !this.state.enabled
    ) {
      return {
        stats: result,
        meshStates
      };
    }

    clipRoot.traverse(obj => {
      if (!obj?.isMesh || obj.userData?.isHelper || obj.userData?.isMeasure) {
        return;
      }

      result.totalMeshCount += 1;
      const box = new THREE.Box3().setFromObject(obj);
      if (box.isEmpty()) return;

      let affected = false;

      if (this.state.mode === "single-plane") {
        const { axis, direction } = this.state.singlePlane;
        const planeValue = this._resolveAxisPosition(
          axis,
          this.state.singlePlane.position
        );
        affected =
          direction === "negative"
            ? box.max[axis] > planeValue
            : box.min[axis] < planeValue;
      } else {
        affected = AXES.some(axis => {
          if (!this.state.box[axis]?.enabled) return false;
          const [minRatio, maxRatio] = this.state.box[axis].range;
          const minValue = this._resolveAxisPosition(axis, minRatio);
          const maxValue = this._resolveAxisPosition(axis, maxRatio);
          return box.min[axis] < minValue || box.max[axis] > maxValue;
        });
      }

      if (affected) {
        result.affectedMeshCount += 1;
      }
      meshStates.push({ object: obj, affected });
    });

    return {
      stats: result,
      meshStates
    };
  }

  _applyFeedback(meshStates = []) {
    this._resetFeedbackMaterials();

    if (
      !this.state.enabled ||
      this.state.feedbackMode === "none" ||
      this.state.targetMode === "object"
    ) {
      return;
    }

    meshStates.forEach(({ object, affected }) => {
      const shouldApply =
        (this.state.feedbackMode === "highlight-affected" && affected) ||
        (this.state.feedbackMode === "dim-unaffected" && !affected);
      if (!shouldApply) return;

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.filter(Boolean).forEach(material => {
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
      if (base.color !== null && material.color) {
        material.color.setHex(base.color);
      }
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
    material.needsUpdate = true;
  }

  _createHelper(entry, size) {
    const helper = new THREE.Group();
    helper.renderOrder = 999;
    helper.userData.isHelper = true;

    const planeGeometry = new THREE.PlaneGeometry(size, size);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: AXIS_COLORS[entry.axis],
      transparent: true,
      opacity: 0.12,
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

    const outlineGeometry = new THREE.EdgesGeometry(planeGeometry);
    const outlineMaterial = new THREE.LineBasicMaterial({
      color: AXIS_COLORS[entry.axis],
      transparent: true,
      opacity: 0.92,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    });
    const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
    outline.renderOrder = 998;
    outline.userData.isHelper = true;
    helper.add(outline);

    const hitGeometry = new THREE.PlaneGeometry(size * 0.28, size * 0.28);
    const hitMaterial = new THREE.MeshBasicMaterial({
      color: AXIS_COLORS[entry.axis],
      transparent: true,
      opacity: 0.02,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6
    });
    const hitMesh = new THREE.Mesh(hitGeometry, hitMaterial);
    hitMesh.renderOrder = 1000;
    hitMesh.userData.isHelper = true;
    hitMesh.userData.clippingEntry = {
      key: entry.key,
      axis: entry.axis
    };
    helper.add(hitMesh);
    helper.userData.planeMesh = planeMesh;
    helper.userData.outline = outline;
    helper.userData.hitMesh = hitMesh;
    return helper;
  }

  _createCap(entry, dimensions) {
    const { width, height } = this._getPlaneDimensions(entry.axis, dimensions);
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({
      color: AXIS_COLORS[entry.axis],
      transparent: true,
      opacity: 0.14,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 995;
    mesh.userData.isHelper = true;
    mesh.userData.isClippingCap = true;

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: AXIS_COLORS[entry.axis],
        transparent: true,
        opacity: 0.48,
        depthTest: false,
        depthWrite: false,
        toneMapped: false
      })
    );
    edges.renderOrder = 996;
    edges.userData.isHelper = true;
    edges.userData.isClippingCap = true;
    mesh.add(edges);

    return mesh;
  }

  _getPlaneDimensions(axis, dimensions) {
    if (axis === "x") {
      return { width: dimensions.z, height: dimensions.y };
    }
    if (axis === "y") {
      return { width: dimensions.x, height: dimensions.z };
    }
    return { width: dimensions.x, height: dimensions.y };
  }

  _updatePlaneTransform(mesh, entry, offset = 0) {
    if (!mesh || !this._getEffectiveBounds()) return;
    const center = this._getEntryCenter(entry);
    const normal = this._getEntryAxisNormal(entry);
    if (offset) {
      center.addScaledVector(normal, offset);
    }
    mesh.position.copy(center);
    if (entry.axis === "x") {
      mesh.rotation.set(0, Math.PI / 2, 0);
    } else if (entry.axis === "y") {
      mesh.rotation.set(-Math.PI / 2, 0, 0);
    } else {
      mesh.rotation.set(0, 0, 0);
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

    const dimensions = this._getEffectiveBounds().getSize(new THREE.Vector3());
    const activeKeys = new Set(activeEntries.map(item => item.key));

    activeEntries.forEach(entry => {
      if (!this.caps[entry.key]) {
        this.caps[entry.key] = this._createCap(entry, dimensions);
        this.scene.add(this.caps[entry.key]);
      }
      const capMesh = this.caps[entry.key];
      this._updatePlaneTransform(capMesh, entry, CLIPPING_CAP_OFFSET);
      capMesh.visible = true;
    });

    Object.keys(this.caps).forEach(key => {
      if (activeKeys.has(key)) return;
      this.scene.remove(this.caps[key]);
      disposeHelper(this.caps[key]);
      this.caps[key] = null;
    });
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

    activeEntries.forEach(entry => {
      if (!this.helpers[entry.key]) {
        this.helpers[entry.key] = this._createHelper(entry, helperSize);
        this.scene.add(this.helpers[entry.key]);
      }
      const helper = this.helpers[entry.key];
      helper.visible = true;
      helper.userData.hitMesh.userData.clippingEntry = {
        key: entry.key,
        axis: entry.axis
      };
      this._updatePlaneTransform(helper, entry, CLIPPING_HELPER_OFFSET);
      helper.updateMatrixWorld?.(true);
    });

    Object.keys(this.helpers).forEach(key => {
      if (activeKeys.has(key)) return;
      this.scene.remove(this.helpers[key]);
      disposeHelper(this.helpers[key]);
      this.helpers[key] = null;
    });
  }

  _removeHelpers() {
    Object.keys(this.helpers).forEach(key => {
      if (!this.helpers[key]) return;
      this.scene.remove(this.helpers[key]);
      disposeHelper(this.helpers[key]);
      this.helpers[key] = null;
    });
  }

  _removeCaps() {
    Object.keys(this.caps).forEach(key => {
      if (!this.caps[key]) return;
      this.scene.remove(this.caps[key]);
      disposeHelper(this.caps[key]);
      this.caps[key] = null;
    });
  }

  _getActivePlanes() {
    return this.state.enabled
      ? this._buildActivePlaneEntries().map(item => item.plane)
      : [];
  }

  _resolveClippingRoot() {
    if (this.state.targetMode !== "object") {
      return this.root || this.scene;
    }
    return this._findObjectByUUID(this.state.targetObjectUuid) || null;
  }

  _resolveActiveBounds() {
    const clippingRoot = this._resolveClippingRoot();
    if (
      this.state.targetMode === "object" &&
      clippingRoot &&
      clippingRoot !== this.root &&
      clippingRoot !== this.scene
    ) {
      const box = new THREE.Box3().setFromObject(clippingRoot);
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
      if (!found && obj?.uuid === uuid) {
        found = obj;
      }
    });
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

  _ensureObjectMaterialOverrides(targetRoot) {
    targetRoot?.traverse?.(obj => {
      if (!obj?.isMesh || obj.userData?.isHelper || obj.userData?.isMeasure) {
        return;
      }
      if (this.materialOverrides.has(obj)) {
        return;
      }
      const originalMaterial = obj.material;
      const overrideMaterial = Array.isArray(originalMaterial)
        ? originalMaterial.map(item => item?.clone?.() || item)
        : originalMaterial?.clone?.() || originalMaterial;
      this.materialOverrides.set(obj, originalMaterial);
      obj.material = overrideMaterial;
    });
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

  _emitChange(source = "external") {
    this.onChange?.({
      state: this.getState(),
      stats: this.getStats(),
      source
    });
  }
}

export default ClippingTool;
