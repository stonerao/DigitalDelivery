/**
 * 截图与视角书签工具
 */
export class ScreenshotTool {
  constructor({ renderer, camera, scene }) {
    this.renderer = renderer;
    this.camera = camera;
    this.scene = scene;
    this.bookmarks = [];
  }

  /**
   * 截取当前视图
   * @param {Object} options - 截图选项
   * @returns {string} Base64 图片数据
   */
  capture(options = {}) {
    const {
      width = this.renderer.domElement.width,
      height = this.renderer.domElement.height,
      format = "image/png",
      quality = 0.92,
      backgroundColor = null
    } = options;

    // 保存原始状态
    const originalSize = this.renderer.getSize(new THREE.Vector2());
    const originalBg = this.scene.background;
    const originalRenderTarget = this.renderer.getRenderTarget();

    // 调整相机比例用于截图
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    // 设置背景色（可选）
    if (backgroundColor !== null) {
      this.scene.background = new THREE.Color(backgroundColor);
    }

    const target = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false
    });

    try {
      this.renderer.setRenderTarget(target);
      this.renderer.clear(true, true, true);
      this.renderer.render(this.scene, this.camera);

      const pixels = new Uint8Array(width * height * 4);
      this.renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      const imageData = ctx.createImageData(width, height);

      // WebGL 像素数据是自下而上，需要翻转 Y 轴
      for (let y = 0; y < height; y++) {
        const srcY = height - 1 - y;
        const srcOffset = srcY * width * 4;
        const dstOffset = y * width * 4;
        imageData.data.set(
          pixels.subarray(srcOffset, srcOffset + width * 4),
          dstOffset
        );
      }
      ctx.putImageData(imageData, 0, 0);

      return canvas.toDataURL(format, quality);
    } finally {
      this.renderer.setRenderTarget(originalRenderTarget);
      target.dispose();

      // 恢复原始状态
      this.camera.aspect = originalSize.x / originalSize.y;
      this.camera.updateProjectionMatrix();
      this.scene.background = originalBg;

      // 恢复主渲染画面
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * 下载截图
   */
  download(filename = "screenshot.png", options = {}) {
    const dataURL = this.capture(options);
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = filename;
    link.click();
  }

  /**
   * 添加视角书签
   */
  addBookmark(name, cameraState) {
    const bookmark = {
      id: `bm-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      name: name || `视角 ${this.bookmarks.length + 1}`,
      timestamp: Date.now(),
      camera: cameraState,
      thumbnail: null
    };

    // 生成缩略图
    try {
      bookmark.thumbnail = this.capture({ width: 200, height: 150 });
    } catch {
      // 忽略缩略图生成失败
    }

    this.bookmarks.push(bookmark);
    return bookmark;
  }

  /**
   * 获取所有书签
   */
  getBookmarks() {
    return [...this.bookmarks];
  }

  /**
   * 删除书签
   */
  removeBookmark(id) {
    const index = this.bookmarks.findIndex(b => b.id === id);
    if (index >= 0) {
      this.bookmarks.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 清除所有书签
   */
  clearBookmarks() {
    this.bookmarks = [];
  }

  /**
   * 导出书签为 JSON
   */
  exportBookmarks() {
    return JSON.stringify(this.bookmarks, null, 2);
  }

  /**
   * 导入书签
   */
  importBookmarks(json) {
    try {
      const data = typeof json === "string" ? JSON.parse(json) : json;
      if (Array.isArray(data)) {
        this.bookmarks = data;
        return true;
      }
    } catch (e) {
      console.warn("导入书签失败:", e);
    }
    return false;
  }
}

// 需要导入 THREE
import * as THREE from "three";

export default ScreenshotTool;
