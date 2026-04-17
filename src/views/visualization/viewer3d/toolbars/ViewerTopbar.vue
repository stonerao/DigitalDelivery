<script setup>
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
</style>
