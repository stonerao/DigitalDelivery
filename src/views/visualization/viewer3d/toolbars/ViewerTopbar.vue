<script setup>
import { QuestionFilled, Setting } from "@element-plus/icons-vue";

defineOptions({
  name: "ViewerTopbar"
});

defineProps({
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
  <div class="dd-topbar">
    <el-button type="primary" @click="emit('back')">返回</el-button>
    <div class="truncate text-sm text-[var(--el-text-color-secondary)]">
      {{ projectName || modelName || "三维全屏查看" }}
    </div>
    <div class="flex-1" />

    <el-button
      type="primary"
      :loading="saveLoading"
      @click="emit('save-project')"
    >
      保存项目
    </el-button>

    <el-button :icon="Setting" circle @click="emit('open-settings')" />

    <el-popover
      placement="bottom-end"
      trigger="click"
      width="430"
      :teleported="false"
    >
      <template #reference>
        <el-button :icon="QuestionFilled" circle title="快捷键说明" />
      </template>
      <div class="dd-shortcuts">
        <div class="dd-shortcuts__header">
          <div>
            <div class="dd-shortcuts__title">快捷键说明</div>
            <div class="dd-shortcuts__subtitle">输入框聚焦时快捷键不会触发</div>
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

    <div class="flex items-center gap-2">
      <span class="text-xs text-[var(--el-text-color-secondary)]">画质</span>
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

    <el-checkbox
      :model-value="showSidePanel"
      size="small"
      @update:model-value="emit('update:showSidePanel', $event)"
    >
      功能面板
    </el-checkbox>
    <el-checkbox
      :model-value="showStats"
      size="small"
      @update:model-value="emit('update:showStats', $event)"
    >
      性能统计
    </el-checkbox>
  </div>
</template>

<style scoped>
.dd-topbar {
  display: flex;
  gap: 12px;
  align-items: center;
  height: 52px;
  padding: 0 16px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
}

.dd-quality-select {
  width: 110px;
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
</style>
