/**
 * 构件拾取与高亮工具
 */
import * as THREE from "three";
import { getVisibleMeshes } from "./frustumCull";

export class ObjectPicker {
  constructor({ scene, camera, container, pickRoot = null }) {
    this.scene = scene;
    this.camera = camera;
    this.container = container;
    this.pickRoot = pickRoot || scene;

    this.enabled = false;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.firstHitOnly = true;
    this.mouse = new THREE.Vector2();

    // 高亮状态
    this.highlightedObject = null;
    this.selectedObject = null;
    this.hoverHelper = null;
    this.selectHelper = null;
    this.hoverOriginalMaterial = null;
    this.selectOriginalMaterial = null;
    this.pickTargets = [];
    this.pickTargetsDirty = true;
    this.intersections = [];
    this.hoverRaf = 0;
    this.lastHoverPoint = null;
    this.lastHoverX = Number.NaN;
    this.lastHoverY = Number.NaN;
    this.hoverPixelThreshold = 1;
    this.minRaycastInterval = 0;
    this.lastRaycastAt = 0;
    this.containerRect = null;
    this.containerRectDirty = true;
    this.sceneTreeCache = null;
    this.sceneTreeDirty = true;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._markContainerRectDirty = this._markContainerRectDirty.bind(this);

    // 回调
    this.onHover = null;
    this.onSelect = null;
    this.shouldIgnoreEvent = null;
  }

  /**
   * 启用拾取
   */
  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.refreshPickTargets();
    this.containerRectDirty = true;
    this.container.addEventListener("mousemove", this._onMouseMove);
    this.container.addEventListener("pointerdown", this._onPointerDown);
    window.addEventListener("resize", this._markContainerRectDirty, {
      passive: true
    });
    window.addEventListener("scroll", this._markContainerRectDirty, true);
  }

  /**
   * 禁用拾取
   */
  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.container.removeEventListener("mousemove", this._onMouseMove);
    this.container.removeEventListener("pointerdown", this._onPointerDown);
    if (this.hoverRaf) {
      cancelAnimationFrame(this.hoverRaf);
      this.hoverRaf = 0;
    }
    this.lastHoverPoint = null;
    this.containerRect = null;
    this.containerRectDirty = true;
    window.removeEventListener("resize", this._markContainerRectDirty);
    window.removeEventListener("scroll", this._markContainerRectDirty, true);
    this.clearHighlight();
    this.clearSelection();
  }

  setPickRoot(root) {
    this.pickRoot = root || this.scene;
    this.pickTargetsDirty = true;
    this.markSceneTreeDirty();
    this.refreshPickTargets();
  }

  markSceneTreeDirty() {
    this.sceneTreeDirty = true;
    this.sceneTreeCache = null;
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
    this.markSceneTreeDirty();
  }

  setAdaptiveLevel(level = "normal") {
    if (level === "low-fps") {
      this.hoverPixelThreshold = 2.5;
      this.minRaycastInterval = 34;
      return;
    }
    if (level === "constrained") {
      this.hoverPixelThreshold = 1.5;
      this.minRaycastInterval = 16;
      return;
    }
    this.hoverPixelThreshold = 1;
    this.minRaycastInterval = 0;
  }

  /**
   * 清除悬停高亮
   */
  clearHighlight() {
    if (
      this.highlightedObject &&
      this.highlightedObject !== this.selectedObject
    ) {
      this._removeHoverHelper();
    }
    this.highlightedObject = null;
  }

  /**
   * 清除选中
   */
  clearSelection() {
    if (this.selectedObject) {
      this._removeSelectHelper();
    }
    this.selectedObject = null;
  }

  /**
   * 获取选中对象的属性
   */
  getSelectedProperties() {
    if (!this.selectedObject) return null;
    const meshes = this._collectSelectionMeshes(this.selectedObject);
    const representativeMesh = meshes[0] || this.selectedObject;
    return {
      name: this.selectedObject.name || representativeMesh.name || "未命名",
      uuid: representativeMesh.uuid || this.selectedObject.uuid,
      objectUuid: this.selectedObject.uuid,
      meshUuids: meshes.map(item => item.uuid),
      type: this.selectedObject.type,
      userData: this.selectedObject.userData,
      geometry: this._buildGeometrySummary(
        meshes,
        this.selectedObject.geometry
      ),
      boundingBox: this._getBoundingBox(this.selectedObject),
      position: this.selectedObject.position.toArray(),
      rotation: this.selectedObject.rotation.toArray().slice(0, 3),
      scale: this.selectedObject.scale.toArray()
    };
  }

  /**
   * 构建场景树结构
   */
  buildSceneTree(root = null) {
    const startNode = root || this.scene;
    if (root) {
      return this._buildTreeNode(startNode);
    }
    if (!this.sceneTreeDirty && this.sceneTreeCache) {
      return this.sceneTreeCache;
    }
    this.sceneTreeCache = this._buildTreeNode(startNode);
    this.sceneTreeDirty = false;
    return this.sceneTreeCache;
  }

  /**
   * 通过名称选中对象
   */
  selectByName(name) {
    let found = null;
    this.scene.traverse(obj => {
      if (obj.name === name && obj.isMesh) {
        found = obj;
      }
    });
    if (found) {
      this.clearSelection();
      this._selectObject(found);
    }
    return found;
  }

  /**
   * 通过 UUID 选中对象
   */
  selectByUUID(uuid) {
    let found = null;
    this.scene.traverse(obj => {
      if (obj.uuid === uuid) {
        found = obj;
      }
    });
    if (found) {
      this.clearSelection();
      this._selectObject(found);
    }
    return found;
  }

  /**
   * 销毁
   */
  dispose() {
    this.disable();
    this._removeHoverHelper();
    this._removeSelectHelper();
  }

  // ============ 私有方法 ============

  _onMouseMove(event) {
    if (!this.enabled) return;
    if (event.defaultPrevented || this.shouldIgnoreEvent?.(event)) return;
    this.lastHoverPoint = { x: event.clientX, y: event.clientY };
    if (this.hoverRaf) return;
    this.hoverRaf = requestAnimationFrame(() => {
      this.hoverRaf = 0;
      const p = this.lastHoverPoint;
      this.lastHoverPoint = null;
      if (!p || !this.enabled) return;
      if (!this.pickTargets?.length) {
        this.clearHighlight();
        return;
      }

      const rect = this._getContainerRect();
      if (!rect) return;
      if (
        p.x < rect.left ||
        p.x > rect.left + rect.width ||
        p.y < rect.top ||
        p.y > rect.top + rect.height
      ) {
        return;
      }
      if (this.pickTargetsDirty) this.refreshPickTargets();
      if (!this.pickTargets?.length) {
        this.clearHighlight();
        return;
      }
      const now = performance.now();
      if (now - this.lastRaycastAt < this.minRaycastInterval) return;
      if (
        Math.abs(p.x - this.lastHoverX) < this.hoverPixelThreshold &&
        Math.abs(p.y - this.lastHoverY) < this.hoverPixelThreshold
      ) {
        return;
      }
      this.lastRaycastAt = now;
      this.lastHoverX = p.x;
      this.lastHoverY = p.y;
      this.mouse.x = ((p.x - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((p.y - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      this.intersections.length = 0;
      const visibleTargets = getVisibleMeshes(this.pickTargets, this.camera);
      const intersects = this.raycaster.intersectObjects(
        visibleTargets,
        false,
        this.intersections
      );

      const hit = intersects[0];
      const resolvedTarget = this._resolveSelectionTarget(hit?.object || null);

      this.clearHighlight();
      if (hit && resolvedTarget && resolvedTarget !== this.selectedObject) {
        this.highlightedObject = resolvedTarget;
        this._applyHoverHelper(resolvedTarget);

        if (this.onHover) {
          this.onHover(resolvedTarget, hit.point);
        }
      }
    });
  }

  _onPointerDown(event) {
    if (!this.enabled) return;
    if (event.button !== 0) return;
    if (event.defaultPrevented || this.shouldIgnoreEvent?.(event)) return;
    if (this.pickTargetsDirty) this.refreshPickTargets();
    if (!this.pickTargets?.length) return;

    const rect = this._getContainerRect();
    if (!rect) return;
    if (
      event.clientX < rect.left ||
      event.clientX > rect.left + rect.width ||
      event.clientY < rect.top ||
      event.clientY > rect.top + rect.height
    ) {
      return;
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

    const hit = intersects[0];

    // 先移除悬停材质，再应用选中材质，避免把 hover 克隆材质记成选中的原材质。
    this.clearHighlight();

    // 清除之前的选中
    this.clearSelection();

    if (hit) {
      const resolvedTarget = this._resolveSelectionTarget(hit.object);
      this._selectObject(hit.object);

      if (this.onSelect) {
        this.onSelect(
          resolvedTarget,
          this.getSelectedProperties(),
          hit.point?.clone?.() || null
        );
      }
    }
  }

  _selectObject(obj) {
    const target = this._resolveSelectionTarget(obj);
    this.selectedObject = target;
    this._applySelectHelper(target);
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
    if (!this.containerRect?.width || !this.containerRect?.height) {
      return null;
    }
    return this.containerRect;
  }

  _applyHoverHelper(obj) {
    const target = this._resolveSelectionTarget(obj);
    if (!target) return;
    this._removeHoverHelper();
    this.hoverHelper = target;
    this.hoverOriginalMaterial = new Map();
    this._collectSelectionMeshes(target).forEach(mesh => {
      this.hoverOriginalMaterial.set(mesh, mesh.material);
      mesh.material = this._cloneMaterialSafe(mesh.material);
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      materials.filter(Boolean).forEach(material => {
        this._applyTint(material, 0x00c2ff, 0.22, 0.45);
      });
    });
  }

  _applySelectHelper(obj) {
    if (!obj) return;
    this._removeSelectHelper();
    this.selectHelper = obj;
    this.selectOriginalMaterial = new Map();
    this._collectSelectionMeshes(obj).forEach(mesh => {
      this.selectOriginalMaterial.set(mesh, mesh.material);
      mesh.material = this._cloneMaterialSafe(mesh.material);
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      materials.filter(Boolean).forEach(material => {
        this._applyTint(material, 0xff7a1a, 0.35, 0.9);
      });
    });
  }

  _removeHoverHelper() {
    if (!this.hoverHelper) return;
    this.hoverOriginalMaterial?.forEach((originalMaterial, mesh) => {
      this._disposeClonedMaterialSafe(mesh.material);
      mesh.material = originalMaterial;
    });
    this.hoverHelper = null;
    this.hoverOriginalMaterial = null;
  }

  _removeSelectHelper() {
    if (!this.selectHelper) return;
    this.selectOriginalMaterial?.forEach((originalMaterial, mesh) => {
      this._disposeClonedMaterialSafe(mesh.material);
      mesh.material = originalMaterial;
    });
    this.selectHelper = null;
    this.selectOriginalMaterial = null;
  }

  _cloneMaterialSafe(material) {
    if (!material) return material;
    if (Array.isArray(material)) {
      return material.map(item => item?.clone?.() || item);
    }
    return material?.clone?.() || material;
  }

  _disposeClonedMaterialSafe(material) {
    if (!material) return;
    if (Array.isArray(material)) {
      material.forEach(item => item?.dispose?.());
      return;
    }
    material?.dispose?.();
  }

  _applyTint(material, color, lerpAmount = 0.3, emissiveIntensity = 0.8) {
    if (!material) return;
    if (material.emissive) {
      material.emissive.setHex(color);
      material.emissiveIntensity = Math.max(
        emissiveIntensity,
        Number(material.emissiveIntensity) || 0
      );
    } else if (material.color) {
      material.color.lerp(new THREE.Color(color), lerpAmount);
    }
    material.needsUpdate = true;
  }

  _collectSelectionMeshes(target) {
    const meshes = [];
    if (!target?.traverse) {
      return target?.isMesh ? [target] : meshes;
    }
    target.traverse(obj => {
      if (obj?.isMesh && !obj.userData?.isHelper && !obj.userData?.isMeasure) {
        meshes.push(obj);
      }
    });
    return meshes;
  }

  _resolveSelectionTarget(obj) {
    if (!obj) return null;
    const modelType = String(obj.userData?.sceneModelType || "").toLowerCase();
    const parent = obj.parent;

    if (this._shouldSelectParentGroup({ obj, parent, modelType })) {
      return parent;
    }

    return obj;
  }

  _shouldSelectParentGroup({ obj, parent, modelType }) {
    if (!obj?.isMesh) return false;
    if (!["glb", "gltf"].includes(modelType)) return false;
    if (!parent || parent === this.pickRoot || parent === this.scene) {
      return false;
    }
    if (parent.type !== "Group") return false;
    if (parent.userData?.isHelper || parent.userData?.isMeasure) {
      return false;
    }

    const siblings = parent.children.filter(
      child => !child?.userData?.isHelper && !child?.userData?.isMeasure
    );
    if (siblings.length <= 1) return false;

    return siblings.every(child => child?.isMesh);
  }

  _buildGeometrySummary(meshes = [], fallbackGeometry = null) {
    const targetMeshes = Array.isArray(meshes) ? meshes.filter(Boolean) : [];
    if (!targetMeshes.length) {
      if (!fallbackGeometry) return null;
      const vertices = fallbackGeometry.attributes?.position?.count || 0;
      return {
        vertices,
        faces: Math.floor((fallbackGeometry.index?.count || vertices || 0) / 3)
      };
    }

    let vertices = 0;
    let faces = 0;
    targetMeshes.forEach(mesh => {
      const geometry = mesh?.geometry;
      if (!geometry) return;
      const positionCount = geometry.attributes?.position?.count || 0;
      vertices += positionCount;
      faces += Math.floor((geometry.index?.count || positionCount || 0) / 3);
    });

    return {
      vertices,
      faces
    };
  }

  _getBoundingBox(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    return {
      min: box.min.toArray(),
      max: box.max.toArray(),
      size: size.toArray(),
      center: center.toArray()
    };
  }

  _buildTreeNode(obj) {
    const node = {
      name: obj.name || obj.type,
      uuid: obj.uuid,
      type: obj.type,
      isMesh: obj.isMesh || false,
      visible: obj.visible,
      sceneModelInstanceId: obj.userData?.sceneModelInstanceId || "",
      sceneModelId: obj.userData?.sceneModelId || "",
      sceneModelName: obj.userData?.sceneModelName || "",
      sceneModelType: obj.userData?.sceneModelType || "",
      children: []
    };

    obj.children.forEach(child => {
      // 过滤掉辅助对象
      if (!child.userData?.isHelper && !child.userData?.isMeasure) {
        node.children.push(this._buildTreeNode(child));
      }
    });

    return node;
  }
}

export default ObjectPicker;
