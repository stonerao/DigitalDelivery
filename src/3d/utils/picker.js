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
    this._onClick = this._onClick.bind(this);
    this._markContainerRectDirty = this._markContainerRectDirty.bind(this);

    // 回调
    this.onHover = null;
    this.onSelect = null;
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
    this.container.addEventListener("click", this._onClick);
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
    this.container.removeEventListener("click", this._onClick);
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
    return {
      name: this.selectedObject.name || "未命名",
      uuid: this.selectedObject.uuid,
      type: this.selectedObject.type,
      userData: this.selectedObject.userData,
      geometry: this.selectedObject.geometry
        ? {
            vertices:
              this.selectedObject.geometry.attributes?.position?.count || 0,
            faces: Math.floor(
              (this.selectedObject.geometry.index?.count ||
                this.selectedObject.geometry.attributes?.position?.count ||
                0) / 3
            )
          }
        : null,
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
      if (obj.uuid === uuid && obj.isMesh) {
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

      this.clearHighlight();
      if (hit && hit.object !== this.selectedObject) {
        this.highlightedObject = hit.object;
        this._applyHoverHelper(hit.object);

        if (this.onHover) {
          this.onHover(hit.object, hit.point);
        }
      }
    });
  }

  _onClick(event) {
    if (!this.enabled) return;
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

    // 清除之前的选中
    this.clearSelection();

    if (hit) {
      this._selectObject(hit.object);

      if (this.onSelect) {
        this.onSelect(
          hit.object,
          this.getSelectedProperties(),
          hit.point?.clone?.() || null
        );
      }
    }
  }

  _selectObject(obj) {
    this.selectedObject = obj;
    this._applySelectHelper(obj);
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
    if (!obj) return;
    this._removeHoverHelper();
    this.hoverHelper = new THREE.BoxHelper(obj, 0x00ffff);
    this.hoverHelper.userData.isHelper = true;
    this.hoverHelper.renderOrder = 998;
    this.scene.add(this.hoverHelper);
  }

  _applySelectHelper(obj) {
    if (!obj) return;
    this._removeSelectHelper();
    this.selectHelper = new THREE.BoxHelper(obj, 0xff6600);
    this.selectHelper.userData.isHelper = true;
    this.selectHelper.renderOrder = 999;
    this.scene.add(this.selectHelper);
  }

  _removeHoverHelper() {
    if (!this.hoverHelper) return;
    this.scene.remove(this.hoverHelper);
    this.hoverHelper.geometry?.dispose?.();
    this.hoverHelper.material?.dispose?.();
    this.hoverHelper = null;
  }

  _removeSelectHelper() {
    if (!this.selectHelper) return;
    this.scene.remove(this.selectHelper);
    this.selectHelper.geometry?.dispose?.();
    this.selectHelper.material?.dispose?.();
    this.selectHelper = null;
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
