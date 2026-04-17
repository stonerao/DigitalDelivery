/**
 * 性能监控工具 - 基于 Stats.js 理念的轻量实现
 * 显示 FPS、内存、渲染调用等信息
 */

export class PerformanceMonitor {
  constructor(options = {}) {
    this.fps = 0;
    this.ms = 0;
    this.memory = 0;
    this.drawCalls = 0;
    this.triangles = 0;

    this.frameCount = 0;
    this.lastTime = performance.now();
    this.enabled = options.enabled ?? true;

    this.container = null;

    this.dom = null;
    this.fpsText = null;
    this.msText = null;
    this.memText = null;
    this.geoText = null;

    this._createDOM();
    this._syncVisibility();
  }

  _createDOM() {
    this.dom = document.createElement("div");
    this.dom.className = "perf-monitor";
    Object.assign(this.dom.style, {
      position: "absolute",
      top: "72px",
      left: "12px",
      zIndex: "1200",
      background: "rgba(0,0,0,0.75)",
      color: "#0f0",
      fontFamily: "monospace",
      fontSize: "11px",
      padding: "6px 10px",
      borderRadius: "4px",
      lineHeight: "1.5",
      pointerEvents: "none",
      userSelect: "none"
    });

    this.fpsText = document.createElement("div");
    this.msText = document.createElement("div");
    this.memText = document.createElement("div");
    this.geoText = document.createElement("div");

    this.dom.appendChild(this.fpsText);
    this.dom.appendChild(this.msText);
    this.dom.appendChild(this.memText);
    this.dom.appendChild(this.geoText);

    this._updateDisplay();
  }

  _updateDisplay() {
    if (!this.dom) return;
    this.fpsText.textContent = `FPS: ${this.fps}`;
    this.msText.textContent = `MS: ${this.ms.toFixed(1)}`;
    this.memText.textContent = `MEM: ${this.memory.toFixed(1)} MB`;
    this.geoText.textContent = `TRI: ${formatNumber(this.triangles)} | CALL: ${this.drawCalls}`;

    // FPS 颜色指示
    if (this.fps >= 50) {
      this.fpsText.style.color = "#0f0";
    } else if (this.fps >= 30) {
      this.fpsText.style.color = "#ff0";
    } else {
      this.fpsText.style.color = "#f00";
    }
  }

  /**
   * 挂载到指定容器
   */
  mount(container) {
    this.container = container || null;
    if (!this.container) return;

    if (!this.dom) {
      this._createDOM();
    }

    const containerStyle = window.getComputedStyle(this.container);
    if (containerStyle.position === "static") {
      this.container.style.position = "relative";
    }

    if (this.dom && this.dom.parentNode !== this.container) {
      this.container.appendChild(this.dom);
    }
    this._syncVisibility();
  }

  /**
   * 卸载
   */
  unmount() {
    if (this.dom && this.dom.parentNode) {
      this.dom.parentNode.removeChild(this.dom);
    }
  }

  /**
   * 每帧开始时调用
   */
  begin() {
    this._beginTime = performance.now();
  }

  /**
   * 每帧结束时调用，传入 renderer.info
   */
  end(rendererInfo = null) {
    if (!this.enabled) return;

    const now = performance.now();
    this.ms = now - (this._beginTime || now);
    this.frameCount++;

    // 每秒更新一次统计
    if (now >= this.lastTime + 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
      this.frameCount = 0;
      this.lastTime = now;

      // 内存信息（仅 Chrome 支持）
      if (performance.memory) {
        this.memory = performance.memory.usedJSHeapSize / 1048576;
      }

      // 渲染信息
      if (rendererInfo) {
        this.drawCalls = rendererInfo.render?.calls ?? 0;
        this.triangles = rendererInfo.render?.triangles ?? 0;
      }

      this._updateDisplay();
    }
  }

  /**
   * 切换显示/隐藏
   */
  toggle() {
    if (this.dom) {
      this.dom.style.display =
        this.dom.style.display === "none" ? "block" : "none";
    }
  }

  /**
   * 设置启用状态
   */
  setEnabled(val) {
    this.enabled = val;

    if (!this.dom) {
      this._createDOM();
    }

    if (this.container && this.dom.parentNode !== this.container) {
      this.container.appendChild(this.dom);
    }
    this._syncVisibility();
  }

  _syncVisibility() {
    if (this.dom) {
      this.dom.style.display = this.enabled ? "block" : "none";
    }
  }

  dispose() {
    this.unmount();
    this.container = null;
    this.dom = null;
  }
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return String(num);
}

export default PerformanceMonitor;
