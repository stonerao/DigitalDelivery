<script setup>
import { computed } from "vue";
import { QuestionFilled, Setting } from "@element-plus/icons-vue";

defineOptions({
  name: "ViewerTopbar"
});

const props = defineProps({
  modelName: {
    type: String,
    default: ""
  },
  projectName: {
    type: String,
    default: ""
  },
  quality: {
    type: String,
    default: "high"
  },
  showSidePanel: {
    type: Boolean,
    default: true
  },
  showStats: {
    type: Boolean,
    default: false
  },
  saveLoading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  "back",
  "open-settings",
  "save-project",
  "update:quality",
  "quality-change",
  "update:showSidePanel",
  "update:showStats"
]);

const titleText = computed(
  () => props.projectName || props.modelName || "三维全屏查看"
);

const modelModeText = computed(() => {
  const name = String(props.modelName || "").trim();
  const hit = name.match(/\.([a-z0-9]+)(?:\?.*)?$/i);
  return `${(hit?.[1] || "GLB").toUpperCase()} 模式`;
});

function onQualityChange(value) {
  emit("update:quality", value);
  emit("quality-change", value);
}

const shortcutGroups = [
  {
    title: "基础操作",
    items: [
      { keys: ["R", "W/A/S/D", "鼠标"], label: "漫游与第一人称移动" },
      { keys: ["鼠标左键", "框选"], label: "选择构件" },
      { keys: ["Q", "鼠标右键"], label: "旋转视图" },
      { keys: ["W", "鼠标中键"], label: "平移视图" },
      { keys: ["S", "鼠标滚轮"], label: "缩放视图" },
      { keys: ["F"], label: "启用对象拾取" },
      { keys: ["Home"], label: "重置视图" }
    ]
  },
  {
    title: "测量与剖切",
    items: [
      { keys: ["C"], label: "打开测量工具" },
      { keys: ["1", "2", "3", "4"], label: "距离 / 角度 / 面积 / 折线测量" },
      { keys: ["K"], label: "开启或关闭剖切" },
      { keys: ["X", "Y", "Z"], label: "X / Y / Z 平面剖切" },
      { keys: ["M"], label: "双平面夹层剖切" },
      { keys: ["剖切面控件"], label: "拖拽移动或旋转剖切面" }
    ]
  },
  {
    title: "显示与视图",
    items: [
      { keys: ["Alt+1"], label: "显示全部" },
      { keys: ["Alt+2"], label: "按绑定显示" },
      { keys: ["Alt+3"], label: "按系统显示" },
      { keys: ["Alt+4"], label: "仅显示当前选择" },
      { keys: ["T"], label: "透明化切换" },
      { keys: ["H"], label: "高亮 / 隔离当前选择" },
      { keys: ["8", "9", "0"], label: "线框 / 实体 / 渲染模式" }
    ]
  }
];
</script>

<template>
  <header class="dd-topbar">
    <div class="dd-topbar__left">
      <button type="button" class="dd-topbar__back" @click="emit('back')">
        <span class="dd-topbar__back-icon">‹</span>
        返回
      </button>
      <span class="dd-topbar__divider" />
      <div class="dd-topbar__title" :title="titleText">
        <span>{{ titleText }}</span>
        <span class="dd-topbar__chevron">⌄</span>
      </div>
      <span class="dd-topbar__mode">{{ modelModeText }}</span>
      <span class="dd-topbar__status"><i />在线</span>
    </div>

    <div class="dd-topbar__right">
      <button
        type="button"
        class="dd-topbar__save"
        :disabled="saveLoading"
        @click="emit('save-project')"
      >
        {{ saveLoading ? "保存中" : "保存项目" }}
      </button>

      <button
        type="button"
        class="dd-topbar__icon-btn"
        title="场景设置"
        @click="emit('open-settings')"
      >
        <el-icon><Setting /></el-icon>
      </button>

      <el-popover
        placement="bottom-end"
        trigger="click"
        width="430"
        :teleported="false"
        popper-class="dd-shortcuts-popper"
      >
        <template #reference>
          <button
            type="button"
            class="dd-topbar__icon-btn"
            title="快捷键说明"
          >
            <el-icon><QuestionFilled /></el-icon>
          </button>
        </template>
        <div class="dd-shortcuts">
          <div class="dd-shortcuts__header">
            <div>
              <div class="dd-shortcuts__title">快捷键说明</div>
              <div class="dd-shortcuts__subtitle">
                输入框聚焦时快捷键不会触发
              </div>
            </div>
          </div>
          <div
            v-for="group in shortcutGroups"
            :key="group.title"
            class="dd-shortcut-group"
          >
            <div class="dd-shortcut-group__title">{{ group.title }}</div>
            <div class="dd-shortcut-list">
              <div
                v-for="item in group.items"
                :key="`${group.title}-${item.label}`"
                class="dd-shortcut-row"
              >
                <div class="dd-shortcut-keys">
                  <kbd
                    v-for="keyItem in item.keys"
                    :key="`${item.label}-${keyItem}`"
                    class="dd-shortcut-key"
                  >
                    {{ keyItem }}
                  </kbd>
                </div>
                <div class="dd-shortcut-label">{{ item.label }}</div>
              </div>
            </div>
          </div>
        </div>
      </el-popover>

      <div class="dd-quality-field">
        <span>画质</span>
        <el-select
          :model-value="quality"
          size="small"
          class="dd-quality-select"
          :teleported="false"
          @update:model-value="onQualityChange"
        >
          <el-option label="高" value="high" />
          <el-option label="中" value="medium" />
          <el-option label="低" value="low" />
          <el-option label="平面渲染" value="plane" />
        </el-select>
      </div>

      <button
        type="button"
        class="dd-topbar__toggle"
        :class="{ 'is-active': showSidePanel }"
        @click="emit('update:showSidePanel', !showSidePanel)"
      >
        功能面板
      </button>
      <button
        type="button"
        class="dd-topbar__toggle"
        :class="{ 'is-active': showStats }"
        @click="emit('update:showStats', !showStats)"
      >
        性能统计
      </button>
    </div>
  </header>
</template>

<style scoped>
.dd-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 18px;
  color: #172033;
  background: rgb(255 255 255 / 86%);
  border-bottom: 1px solid rgb(226 232 240 / 88%);
  box-shadow: 0 8px 28px rgb(15 23 42 / 7%);
  backdrop-filter: blur(18px) saturate(160%);
}

.dd-topbar__left,
.dd-topbar__right {
  display: flex;
  align-items: center;
  min-width: 0;
}

.dd-topbar__left {
  gap: 14px;
}

.dd-topbar__right {
  gap: 10px;
  margin-left: 18px;
}

.dd-topbar__back,
.dd-topbar__save,
.dd-topbar__icon-btn,
.dd-topbar__toggle {
  border: 0;
  transition:
    transform 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;
}

.dd-topbar__back {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  height: 34px;
  padding: 0 8px;
  font-size: 14px;
  font-weight: 650;
  color: #334155;
  cursor: pointer;
  background: transparent;
  border-radius: 9px;
}

.dd-topbar__back:hover {
  color: #0b73ff;
  background: #f2f7ff;
}

.dd-topbar__back-icon {
  font-size: 24px;
  line-height: 1;
}

.dd-topbar__divider {
  width: 1px;
  height: 24px;
  background: #e5edf7;
}

.dd-topbar__title {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  max-width: min(34vw, 420px);
  overflow: hidden;
  font-size: 15px;
  font-weight: 760;
  white-space: nowrap;
}

.dd-topbar__title span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
}

.dd-topbar__chevron {
  color: #64748b;
}

.dd-topbar__mode {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 700;
  color: #0b73ff;
  background: #edf5ff;
  border: 1px solid #d7e8ff;
  border-radius: 9px;
}

.dd-topbar__status {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  padding-left: 2px;
  font-size: 13px;
  font-weight: 650;
  color: #334155;
}

.dd-topbar__status i {
  width: 8px;
  height: 8px;
  background: #19c37d;
  border-radius: 999px;
  box-shadow: 0 0 0 4px rgb(25 195 125 / 12%);
}

.dd-topbar__save {
  height: 34px;
  padding: 0 18px;
  font-size: 13px;
  font-weight: 760;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(135deg, #0b73ff, #005bd6);
  border-radius: 8px;
  box-shadow: 0 8px 18px rgb(11 115 255 / 22%);
}

.dd-topbar__save:disabled {
  cursor: not-allowed;
  opacity: 0.62;
  box-shadow: none;
}

.dd-topbar__icon-btn {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  color: #334155;
  cursor: pointer;
  background: rgb(255 255 255 / 72%);
  border: 1px solid #e5edf7;
  border-radius: 999px;
}

.dd-topbar__icon-btn:hover,
.dd-topbar__toggle:hover {
  color: #0b73ff;
  background: #f2f7ff;
}

.dd-quality-field {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  padding-left: 4px;
  font-size: 12px;
  font-weight: 650;
  color: #64748b;
}

.dd-quality-select {
  width: 96px;
}

.dd-quality-select :deep(.el-select__wrapper) {
  min-height: 30px;
  background: rgb(255 255 255 / 72%);
  border-radius: 8px;
  box-shadow: 0 0 0 1px #e5edf7 inset;
}

.dd-topbar__toggle {
  height: 32px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  background: transparent;
  border-radius: 8px;
}

.dd-topbar__toggle.is-active {
  color: #0b73ff;
  background: #edf5ff;
  box-shadow: inset 0 0 0 1px #d7e8ff;
}

.dd-shortcuts {
  display: grid;
  gap: 14px;
}

.dd-shortcuts__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.dd-shortcuts__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.dd-shortcuts__subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.dd-shortcut-group {
  display: grid;
  gap: 8px;
}

.dd-shortcut-group__title {
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-regular);
}

.dd-shortcut-list {
  display: grid;
  gap: 6px;
}

.dd-shortcut-row {
  display: grid;
  grid-template-columns: minmax(124px, auto) 1fr;
  gap: 10px;
  align-items: center;
  min-height: 28px;
}

.dd-shortcut-keys {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.dd-shortcut-key {
  min-width: 24px;
  padding: 2px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-primary);
  text-align: center;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-bottom-color: var(--el-border-color-darker);
  border-radius: 5px;
}

.dd-shortcut-label {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

@media (width <= 1180px) {
  .dd-topbar__mode,
  .dd-topbar__status,
  .dd-topbar__toggle {
    display: none;
  }

  .dd-topbar__title {
    max-width: 34vw;
  }
}
</style>
