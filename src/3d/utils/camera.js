/**
 * 相机控制增强工具
 * 支持透视/正交切换、预设视角、第一人称漫游
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class CameraController {
  constructor({ container, initialPosition, initialTarget }) {
    this.container = container;
    this.initialPosition = initialPosition || new THREE.Vector3(6, 4, 6);
    this.initialTarget = initialTarget || new THREE.Vector3(0, 0, 0);

    // 相机
    this.perspectiveCamera = null;
    this.orthographicCamera = null;
    this.activeCamera = null;
    this.isOrthographic = false;

    // 控制器
    this.controls = null;

    // 第一人称状态
    this.firstPersonEnabled = false;
    this.moveSpeed = 0.1;
    this.keys = { w: false, a: false, s: false, d: false, q: false, e: false };

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
  }

  /**
   * 初始化相机
   */
  init(width, height, renderer) {
    this.renderer = renderer;

    // 透视相机
    this.perspectiveCamera = new THREE.PerspectiveCamera(
      45,
      width / height,
      0.01,
      2000
    );
    this.perspectiveCamera.position.copy(this.initialPosition);

    // 正交相机
    const aspect = width / height;
    const frustumSize = 10;
    this.orthographicCamera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.01,
      2000
    );
    this.orthographicCamera.position.copy(this.initialPosition);

    // 默认使用透视
    this.activeCamera = this.perspectiveCamera;

    // 创建控制器
    this.controls = new OrbitControls(this.activeCamera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;
    this.controls.target.copy(this.initialTarget);

    return this.activeCamera;
  }

  /**
   * 获取当前相机
   */
  getCamera() {
    return this.activeCamera;
  }

  /**
   * 获取控制器
   */
  getControls() {
    return this.controls;
  }

  /**
   * 切换透视/正交相机
   */
  toggleProjection() {
    const oldCamera = this.activeCamera;
    const newCamera = this.isOrthographic
      ? this.perspectiveCamera
      : this.orthographicCamera;

    // 复制位置和朝向
    newCamera.position.copy(oldCamera.position);
    newCamera.quaternion.copy(oldCamera.quaternion);

    // 更新活动相机
    this.activeCamera = newCamera;
    this.isOrthographic = !this.isOrthographic;

    // 更新控制器
    this.controls.object = this.activeCamera;
    this.controls.update();

    return this.isOrthographic;
  }

  /**
   * 设置预设视角
   */
  setPresetView(preset, bounds = null) {
    if (!this.activeCamera || !this.controls) return;

    let center = this.controls.target.clone();
    let dist = 10;

    // 如果有边界信息，计算合适的距离
    if (bounds) {
      const size = new THREE.Vector3();
      bounds.getSize(size);
      bounds.getCenter(center);
      dist = Math.max(size.x, size.y, size.z) * 1.5;
    }

    const positions = {
      top: new THREE.Vector3(center.x, center.y + dist, center.z),
      bottom: new THREE.Vector3(center.x, center.y - dist, center.z),
      front: new THREE.Vector3(center.x, center.y, center.z + dist),
      back: new THREE.Vector3(center.x, center.y, center.z - dist),
      left: new THREE.Vector3(center.x - dist, center.y, center.z),
      right: new THREE.Vector3(center.x + dist, center.y, center.z),
      iso: new THREE.Vector3(
        center.x + dist * 0.7,
        center.y + dist * 0.5,
        center.z + dist * 0.7
      )
    };

    const targetPos = positions[preset] || positions.iso;

    // 动画过渡
    this._animateCamera(targetPos, center);
  }

  /**
   * 适应模型边界
   */
  fitToBounds(bounds) {
    if (!bounds || !this.activeCamera) return;

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const dist = maxDim * 1.6;

    // 更新相机位置
    this.activeCamera.position.set(
      center.x + dist,
      center.y + dist * 0.6,
      center.z + dist
    );

    // 更新近远裁剪面
    this.activeCamera.near = Math.max(dist / 500, 0.01);
    this.activeCamera.far = Math.max(dist * 50, 1000);
    this.activeCamera.updateProjectionMatrix();

    // 更新控制器目标
    this.controls.target.copy(center);
    this.controls.update();
  }

  /**
   * 启用第一人称漫游
   */
  enableFirstPerson() {
    if (this.firstPersonEnabled) return;
    this.firstPersonEnabled = true;

    // 禁用 OrbitControls 的旋转
    this.controls.enableRotate = false;
    this.controls.enablePan = false;

    document.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("keyup", this._onKeyUp);
  }

  /**
   * 禁用第一人称漫游
   */
  disableFirstPerson() {
    if (!this.firstPersonEnabled) return;
    this.firstPersonEnabled = false;

    this.controls.enableRotate = true;
    this.controls.enablePan = true;

    document.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("keyup", this._onKeyUp);

    this.keys = { w: false, a: false, s: false, d: false, q: false, e: false };
  }

  /**
   * 每帧更新
   */
  update() {
    if (this.firstPersonEnabled) {
      this._updateFirstPerson();
    }
    this.controls?.update();
  }

  /**
   * 调整大小
   */
  resize(width, height) {
    const aspect = width / height;

    // 透视相机
    this.perspectiveCamera.aspect = aspect;
    this.perspectiveCamera.updateProjectionMatrix();

    // 正交相机
    const frustumSize = 10;
    this.orthographicCamera.left = (-frustumSize * aspect) / 2;
    this.orthographicCamera.right = (frustumSize * aspect) / 2;
    this.orthographicCamera.top = frustumSize / 2;
    this.orthographicCamera.bottom = -frustumSize / 2;
    this.orthographicCamera.updateProjectionMatrix();
  }

  /**
   * 获取相机状态（用于书签/导出）
   */
  getState() {
    return {
      position: this.activeCamera.position.toArray(),
      target: this.controls.target.toArray(),
      isOrthographic: this.isOrthographic,
      zoom: this.activeCamera.zoom
    };
  }

  /**
   * 恢复相机状态
   */
  setState(state) {
    if (!state) return;

    if (state.isOrthographic !== this.isOrthographic) {
      this.toggleProjection();
    }

    this.activeCamera.position.fromArray(state.position);
    this.controls.target.fromArray(state.target);

    if (state.zoom) {
      this.activeCamera.zoom = state.zoom;
    }

    this.activeCamera.updateProjectionMatrix();
    this.controls.update();
  }

  /**
   * 销毁
   */
  dispose() {
    this.disableFirstPerson();
    this.controls?.dispose();
    this.controls = null;
  }

  // ============ 私有方法 ============

  _animateCamera(targetPos, targetLookAt, duration = 500) {
    const startPos = this.activeCamera.position.clone();
    const startTarget = this.controls.target.clone();
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const easeT = 1 - Math.pow(1 - t, 3); // easeOutCubic

      this.activeCamera.position.lerpVectors(startPos, targetPos, easeT);
      this.controls.target.lerpVectors(startTarget, targetLookAt, easeT);
      this.controls.update();

      if (t < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  _onKeyDown(e) {
    const key = e.key.toLowerCase();
    if (key in this.keys) {
      this.keys[key] = true;
      e.preventDefault();
    }
  }

  _onKeyUp(e) {
    const key = e.key.toLowerCase();
    if (key in this.keys) {
      this.keys[key] = false;
    }
  }

  _updateFirstPerson() {
    if (!this.activeCamera) return;

    const direction = new THREE.Vector3();
    this.activeCamera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(direction, new THREE.Vector3(0, 1, 0));

    const move = new THREE.Vector3();

    if (this.keys.w) move.add(direction);
    if (this.keys.s) move.sub(direction);
    if (this.keys.a) move.sub(right);
    if (this.keys.d) move.add(right);
    if (this.keys.q) move.y -= 1;
    if (this.keys.e) move.y += 1;

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(this.moveSpeed);
      this.activeCamera.position.add(move);
      this.controls.target.add(move);
    }
  }
}

export default CameraController;
