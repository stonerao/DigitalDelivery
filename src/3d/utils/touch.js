/**
 * 移动端触摸手势支持
 */
export class TouchGestures {
  constructor({ container, onRotate, onPan, onZoom, onTap }) {
    this.container = container;
    this.onRotate = onRotate;
    this.onPan = onPan;
    this.onZoom = onZoom;
    this.onTap = onTap;

    this.enabled = false;
    this.touches = [];
    this.lastTouchTime = 0;
    this.tapThreshold = 200; // ms
    this.moveThreshold = 10; // px

    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
  }

  /**
   * 启用触摸手势
   */
  enable() {
    if (this.enabled) return;
    this.enabled = true;

    this.container.addEventListener("touchstart", this._onTouchStart, {
      passive: false
    });
    this.container.addEventListener("touchmove", this._onTouchMove, {
      passive: false
    });
    this.container.addEventListener("touchend", this._onTouchEnd);
    this.container.addEventListener("touchcancel", this._onTouchEnd);
  }

  /**
   * 禁用触摸手势
   */
  disable() {
    if (!this.enabled) return;
    this.enabled = false;

    this.container.removeEventListener("touchstart", this._onTouchStart);
    this.container.removeEventListener("touchmove", this._onTouchMove);
    this.container.removeEventListener("touchend", this._onTouchEnd);
    this.container.removeEventListener("touchcancel", this._onTouchEnd);
  }

  /**
   * 销毁
   */
  dispose() {
    this.disable();
  }

  // ============ 私有方法 ============

  _onTouchStart(e) {
    e.preventDefault();
    this.touches = Array.from(e.touches).map(t => ({
      id: t.identifier,
      x: t.clientX,
      y: t.clientY,
      startX: t.clientX,
      startY: t.clientY,
      startTime: Date.now()
    }));
  }

  _onTouchMove(e) {
    e.preventDefault();

    const currentTouches = Array.from(e.touches);

    if (currentTouches.length === 1 && this.touches.length === 1) {
      // 单指：旋转
      const touch = currentTouches[0];
      const prevTouch = this.touches[0];

      const deltaX = touch.clientX - prevTouch.x;
      const deltaY = touch.clientY - prevTouch.y;

      if (this.onRotate) {
        this.onRotate(deltaX, deltaY);
      }

      this.touches[0].x = touch.clientX;
      this.touches[0].y = touch.clientY;
    } else if (currentTouches.length === 2 && this.touches.length >= 2) {
      // 双指：缩放 + 平移
      const t1 = currentTouches[0];
      const t2 = currentTouches[1];

      const prev1 =
        this.touches.find(t => t.id === t1.identifier) || this.touches[0];
      const prev2 =
        this.touches.find(t => t.id === t2.identifier) || this.touches[1];

      // 计算当前和之前的距离
      const currentDist = Math.hypot(
        t1.clientX - t2.clientX,
        t1.clientY - t2.clientY
      );
      const prevDist = Math.hypot(prev1.x - prev2.x, prev1.y - prev2.y);

      // 缩放
      if (prevDist > 0 && this.onZoom) {
        const scale = currentDist / prevDist;
        this.onZoom(scale);
      }

      // 平移（双指中心点移动）
      const currentCenter = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2
      };
      const prevCenter = {
        x: (prev1.x + prev2.x) / 2,
        y: (prev1.y + prev2.y) / 2
      };

      const panX = currentCenter.x - prevCenter.x;
      const panY = currentCenter.y - prevCenter.y;

      if (this.onPan && (Math.abs(panX) > 1 || Math.abs(panY) > 1)) {
        this.onPan(panX, panY);
      }

      // 更新触摸位置
      this.touches = currentTouches.map(t => ({
        id: t.identifier,
        x: t.clientX,
        y: t.clientY,
        startX:
          this.touches.find(pt => pt.id === t.identifier)?.startX || t.clientX,
        startY:
          this.touches.find(pt => pt.id === t.identifier)?.startY || t.clientY,
        startTime:
          this.touches.find(pt => pt.id === t.identifier)?.startTime ||
          Date.now()
      }));
    }
  }

  _onTouchEnd(e) {
    // 检测点击
    if (this.touches.length === 1 && e.changedTouches.length === 1) {
      const touch = this.touches[0];
      const endTouch = e.changedTouches[0];
      const now = Date.now();

      const moveX = Math.abs(endTouch.clientX - touch.startX);
      const moveY = Math.abs(endTouch.clientY - touch.startY);
      const duration = now - touch.startTime;

      if (
        moveX < this.moveThreshold &&
        moveY < this.moveThreshold &&
        duration < this.tapThreshold
      ) {
        if (this.onTap) {
          this.onTap(endTouch.clientX, endTouch.clientY);
        }
      }
    }

    this.touches = Array.from(e.touches).map(t => ({
      id: t.identifier,
      x: t.clientX,
      y: t.clientY,
      startX: t.clientX,
      startY: t.clientY,
      startTime: Date.now()
    }));
  }
}

export default TouchGestures;
