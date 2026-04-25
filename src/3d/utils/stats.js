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
      top: "22px",
      left: "22px",
      zIndex: "1200",
      width: "224px",
      background: "rgba(255,255,255,0.88)",
      color: "#172033",
      fontFamily:
        "Inter, \"PingFang SC\", \"Microsoft YaHei\", Arial, sans-serif",
      fontSize: "12px",
      padding: "14px 16px 16px",
      border: "1px solid rgba(226,232,240,0.88)",
      borderRadius: "14px",
      lineHeight: "1.4",
      boxShadow: "0 18px 45px rgba(15,23,42,0.12)",
      backdropFilter: "blur(16px) saturate(150%)",
      pointerEvents: "none",
      userSelect: "none"
    });

    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      marginBottom: "12px"
    });

    const title = document.createElement("div");
    title.textContent = "BIM 性能";
    Object.assign(title.style, {
      fontSize: "14px",
      fontWeight: "760",
      color: "#172033"
    });

    const status = document.createElement("div");
    status.textContent = "在线";
    Object.assign(status.style, {
      height: "22px",
      padding: "0 9px",
      display: "inline-flex",
      alignItems: "center",
      color: "#08a362",
      background: "#eafbf3",
      border: "1px solid #b8ecd2",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: "700"
    });

    const bars = document.createElement("div");
    Object.assign(bars.style, {
      display: "inline-flex",
      gap: "2px",
      alignItems: "end",
      marginLeft: "auto"
    });
    [8, 12, 16].forEach(height => {
      const bar = document.createElement("span");
      Object.assign(bar.style, {
        width: "3px",
        height: `${height}px`,
        background: "#19c37d",
        borderRadius: "999px"
      });
      bars.appendChild(bar);
    });

    header.appendChild(title);
    header.appendChild(status);
    header.appendChild(bars);

    const grid = document.createElement("div");
    Object.assign(grid.style, {
      display: "grid",
      gap: "0",
      borderTop: "1px solid rgba(226,232,240,0.9)"
    });

    const createMetric = label => {
      const row = document.createElement("div");
      Object.assign(row.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: "36px",
        borderBottom: "1px solid rgba(226,232,240,0.86)"
      });

      const labelEl = document.createElement("span");
      labelEl.textContent = label;
      Object.assign(labelEl.style, {
        color: "#334155",
        fontWeight: "650"
      });

      const valueEl = document.createElement("span");
      Object.assign(valueEl.style, {
        color: "#0fb66d",
        fontVariantNumeric: "tabular-nums",
        fontWeight: "760"
      });

      row.appendChild(labelEl);
      row.appendChild(valueEl);
      grid.appendChild(row);
      return valueEl;
    };

    this.fpsText = createMetric("FPS");
    this.msText = createMetric("MS");
    this.memText = createMetric("MEM");
    this.geoText = createMetric("TRI / CALL");

    this.dom.appendChild(header);
    this.dom.appendChild(grid);

    this._updateDisplay();
  }

  _updateDisplay() {
    if (!this.dom) return;
    this.fpsText.textContent = String(this.fps);
    this.msText.textContent = `${this.ms.toFixed(1)} ms`;
    this.memText.textContent = `${this.memory.toFixed(1)} MB`;
    this.geoText.textContent = `${formatNumber(this.triangles)} / ${this.drawCalls}`;

    // FPS 颜色指示
    if (this.fps >= 50) {
      this.fpsText.style.color = "#0fb66d";
    } else if (this.fps >= 30) {
      this.fpsText.style.color = "#d08700";
    } else {
      this.fpsText.style.color = "#dc2626";
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
