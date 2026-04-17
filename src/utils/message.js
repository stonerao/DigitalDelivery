import { isFunction } from "@pureadmin/utils";
import { ElMessage } from "element-plus";

/** 用法非常简单，参考 src/views/components/message/index.vue 文件 */

/**
 * `Message` 消息提示函数
 */
const message = (message, params) => {
  if (!params) {
    return ElMessage({
      message,
      customClass: "pure-message"
    });
  } else {
    const {
      icon,
      type = "info",
      plain = false,
      dangerouslyUseHTMLString = false,
      customClass = "antd",
      duration = 2000,
      showClose = false,
      offset = 16,
      placement = "top",
      appendTo = document.body,
      grouping = false,
      repeatNum = 1,
      onClose
    } = params;

    return ElMessage({
      message,
      icon,
      type,
      plain,
      dangerouslyUseHTMLString,
      duration,
      showClose,
      offset,
      placement,
      appendTo,
      grouping,
      repeatNum,
      // 全局搜 pure-message 即可知道该类的样式位置
      customClass: customClass === "antd" ? "pure-message" : "",
      onClose: () => (isFunction(onClose) ? onClose() : null)
    });
  }
};

/**
 * 关闭所有 `Message` 消息提示函数
 */
const closeAllMessage = () => ElMessage.closeAll();

export { message, closeAllMessage };
