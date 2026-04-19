<script setup>
defineOptions({
  name: "ClippingPanel"
});

const props = defineProps({
  enableClipping: {
    type: Boolean,
    default: false
  },
  showSidePanel: {
    type: Boolean,
    default: true
  },
  clippingState: {
    type: Object,
    default: () => ({})
  },
  clippingSummary: {
    type: String,
    default: ""
  },
  clippingStats: {
    type: Object,
    default: () => ({})
  },
  targetOptions: {
    type: Array,
    default: () => []
  },
  selectedObjectInfo: {
    type: Object,
    default: null
  },
  modeOptions: {
    type: Array,
    default: () => []
  },
  axisOptions: {
    type: Array,
    default: () => []
  },
  directionOptions: {
    type: Array,
    default: () => []
  },
  feedbackOptions: {
    type: Array,
    default: () => []
  },
  presetOptions: {
    type: Array,
    default: () => []
  },
  savedPresets: {
    type: Array,
    default: () => []
  },
  animationPlaying: {
    type: Boolean,
    default: false
  },
  animationSpeed: {
    type: Number,
    default: 0.6
  },
  animationMode: {
    type: String,
    default: "ping-pong"
  },
  animationModeOptions: {
    type: Array,
    default: () => []
  },
  animationAxis: {
    type: String,
    default: "auto"
  },
  animationAxisOptions: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits([
  "update:clippingState",
  "apply-preset",
  "save-preset",
  "apply-saved-preset",
  "remove-saved-preset",
  "toggle-animation",
  "update:animationSpeed",
  "update:animationMode",
  "update:animationAxis",
  "reset"
]);

function emitState(nextState) {
  emit("update:clippingState", nextState);
}

function patchState(patch = {}) {
  emitState({
    ...props.clippingState,
    ...patch,
    singlePlane: {
      ...(props.clippingState?.singlePlane || {}),
      ...(patch.singlePlane || {})
    },
    box: {
      ...(props.clippingState?.box || {}),
      ...(patch.box || {})
    }
  });
}

function updateSinglePlane(key, value) {
  patchState({
    singlePlane: {
      [key]: value
    }
  });
}

function updateBoxAxis(axis, patch = {}) {
  patchState({
    mode: "box",
    box: {
      [axis]: {
        ...(props.clippingState?.box?.[axis] || {}),
        ...patch
      }
    }
  });
}

function onPresetChange(value) {
  if (!value) return;
  emit("apply-preset", value);
}

function onTargetModeChange(value) {
  const isObject = value === "object";
  patchState({
    targetMode: isObject ? "object" : "scene",
    targetObjectUuid: isObject
      ? props.selectedObjectInfo?.uuid ||
        props.clippingState?.targetObjectUuid ||
        ""
      : "",
    targetObjectName: isObject
      ? props.selectedObjectInfo?.name ||
        props.clippingState?.targetObjectName ||
        ""
      : ""
  });
}
</script>

<template>
  <el-card
    v-if="enableClipping"
    shadow="never"
    class="dd-clipping-panel"
    :class="{ 'dd-clipping-shift': showSidePanel }"
  >
    <template #header>
      <div class="dd-clipping-header">
        <div>
          <div class="dd-clipping-title">剖切控制</div>
          <div class="dd-clipping-summary">
            {{ clippingSummary || "已启用" }}
          </div>
        </div>
        <el-button size="small" link @click="emit('reset')">重置</el-button>
      </div>
    </template>

    <div class="dd-clipping-body">
      <div class="dd-clipping-row">
        <span class="dd-label">模式</span>
        <el-segmented
          :model-value="clippingState.mode"
          :options="modeOptions"
          size="small"
          @change="patchState({ mode: $event })"
        />
      </div>

      <div class="dd-clipping-row">
        <span class="dd-label">剖切对象</span>
        <el-segmented
          :model-value="clippingState.targetMode || 'scene'"
          :options="targetOptions"
          size="small"
          @change="onTargetModeChange"
        />
      </div>

      <div
        v-if="(clippingState.targetMode || 'scene') === 'object'"
        class="dd-clipping-target-tip"
      >
        {{
          clippingState.targetObjectName
            ? `当前对象：${clippingState.targetObjectName}`
            : selectedObjectInfo?.name
              ? `当前对象：${selectedObjectInfo.name}`
              : "请先在场景中选中一个物体，再进行单物体剖切"
        }}
      </div>

      <div class="dd-clipping-stats">
        <div class="dd-stat-card">
          <div class="dd-stat-label">平面数</div>
          <div class="dd-stat-value">
            {{ clippingStats.activePlaneCount || 0 }}
          </div>
        </div>
        <div class="dd-stat-card">
          <div class="dd-stat-label">受影响构件</div>
          <div class="dd-stat-value">
            {{ clippingStats.affectedMeshCount || 0 }}
          </div>
        </div>
        <div class="dd-stat-card">
          <div class="dd-stat-label">总构件</div>
          <div class="dd-stat-value">
            {{ clippingStats.totalMeshCount || 0 }}
          </div>
        </div>
      </div>

      <div class="dd-clipping-row">
        <span class="dd-label">辅助面</span>
        <el-switch
          :model-value="clippingState.helpersVisible"
          size="small"
          @update:model-value="patchState({ helpersVisible: $event })"
        />
      </div>

      <div class="dd-clipping-row">
        <span class="dd-label">剖切面填充</span>
        <el-switch
          :model-value="clippingState.capEnabled"
          size="small"
          @update:model-value="patchState({ capEnabled: $event })"
        />
      </div>

      <div class="dd-clipping-row dd-clipping-feedback">
        <span class="dd-label">视觉反馈</span>
        <el-select
          :model-value="clippingState.feedbackMode"
          size="small"
          placeholder="选择反馈方式"
          @change="patchState({ feedbackMode: $event })"
        >
          <el-option
            v-for="item in feedbackOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>

      <div class="dd-clipping-row dd-clipping-animation-actions">
        <span class="dd-label">剖切动画</span>
        <el-button
          size="small"
          :type="animationPlaying ? 'warning' : 'primary'"
          plain
          @click="emit('toggle-animation')"
        >
          {{ animationPlaying ? "暂停" : "播放" }}
        </el-button>
      </div>

      <div class="dd-clipping-row dd-clipping-feedback">
        <span class="dd-label">播放模式</span>
        <el-select
          :model-value="animationMode"
          size="small"
          placeholder="选择播放模式"
          @change="emit('update:animationMode', $event)"
        >
          <el-option
            v-for="item in animationModeOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>

      <div class="dd-clipping-row dd-clipping-feedback">
        <span class="dd-label">动画轴</span>
        <el-select
          :model-value="animationAxis"
          size="small"
          placeholder="选择动画轴"
          @change="emit('update:animationAxis', $event)"
        >
          <el-option
            v-for="item in animationAxisOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>

      <div class="dd-clipping-slider-block">
        <div class="dd-slider-head">
          <span>动画速度</span>
          <span>{{ animationSpeed.toFixed(1) }}x</span>
        </div>
        <el-slider
          :model-value="animationSpeed"
          :min="0.2"
          :max="2"
          :step="0.1"
          size="small"
          @update:model-value="emit('update:animationSpeed', $event)"
        />
      </div>

      <div class="dd-clipping-row dd-clipping-preset">
        <span class="dd-label">内置预设</span>
        <el-select
          :model-value="clippingState.presetId"
          placeholder="选择预设"
          size="small"
          @change="onPresetChange"
        >
          <el-option
            v-for="item in presetOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>

      <div class="dd-clipping-row">
        <span class="dd-label">当前状态</span>
        <el-button
          size="small"
          type="primary"
          plain
          @click="emit('save-preset')"
        >
          保存为预设
        </el-button>
      </div>

      <div v-if="savedPresets.length" class="dd-saved-preset-list">
        <div class="dd-saved-preset-title">已保存预设</div>
        <div
          v-for="item in savedPresets"
          :key="item.id"
          class="dd-saved-preset-item"
        >
          <div class="dd-saved-preset-meta">
            <div class="dd-saved-preset-name">{{ item.name }}</div>
            <div class="dd-saved-preset-time">
              {{ new Date(item.createdAt || Date.now()).toLocaleString() }}
            </div>
          </div>
          <div class="dd-saved-preset-actions">
            <el-button
              size="small"
              link
              @click="emit('apply-saved-preset', item)"
            >
              应用
            </el-button>
            <el-button
              size="small"
              link
              type="danger"
              @click="emit('remove-saved-preset', item.id)"
            >
              删除
            </el-button>
          </div>
        </div>
      </div>

      <template v-if="clippingState.mode === 'single-plane'">
        <div class="dd-clipping-row">
          <span class="dd-label">轴向</span>
          <el-segmented
            :model-value="clippingState.singlePlane.axis"
            :options="axisOptions"
            size="small"
            @change="updateSinglePlane('axis', $event)"
          />
        </div>

        <div class="dd-clipping-row">
          <span class="dd-label">方向</span>
          <el-segmented
            :model-value="clippingState.singlePlane.direction"
            :options="directionOptions"
            size="small"
            @change="updateSinglePlane('direction', $event)"
          />
        </div>

        <div class="dd-clipping-slider-block">
          <div class="dd-slider-head">
            <span>位置</span>
            <span
              >{{
                Math.round((clippingState.singlePlane.position || 0) * 100)
              }}%</span
            >
          </div>
          <el-slider
            :model-value="clippingState.singlePlane.position"
            :min="0"
            :max="1"
            :step="0.01"
            size="small"
            @update:model-value="updateSinglePlane('position', $event)"
          />
        </div>
      </template>

      <template v-else>
        <div
          v-for="axis in ['x', 'y', 'z']"
          :key="axis"
          class="dd-clipping-axis-block"
        >
          <div class="dd-axis-head">
            <el-checkbox
              :model-value="clippingState.box?.[axis]?.enabled"
              size="small"
              @update:model-value="
                updateBoxAxis(axis, {
                  enabled: $event
                })
              "
            >
              {{ axis.toUpperCase() }} 轴
            </el-checkbox>
            <span class="dd-axis-range">
              {{
                Math.round((clippingState.box?.[axis]?.range?.[0] || 0) * 100)
              }}% -
              {{
                Math.round((clippingState.box?.[axis]?.range?.[1] || 1) * 100)
              }}%
            </span>
          </div>

          <el-slider
            :model-value="clippingState.box?.[axis]?.range"
            :min="0"
            :max="1"
            :step="0.01"
            range
            size="small"
            :disabled="!clippingState.box?.[axis]?.enabled"
            @update:model-value="
              updateBoxAxis(axis, {
                enabled: true,
                range: $event
              })
            "
          />
        </div>
      </template>
    </div>
  </el-card>
</template>

<style scoped>
.dd-clipping-panel {
  position: fixed;
  top: var(--dd-panels-top);
  right: var(--dd-gap);
  z-index: 1150;
  width: 320px;
  box-shadow: var(--el-box-shadow-light);
  transition: right 0.25s ease;
}

.dd-clipping-shift {
  right: 384px;
}

.dd-clipping-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.dd-clipping-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.dd-clipping-summary {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.dd-clipping-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dd-clipping-target-tip {
  margin-top: -6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.dd-clipping-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dd-clipping-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.dd-stat-card {
  padding: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.dd-stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.dd-stat-value {
  margin-top: 4px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.dd-clipping-preset :deep(.el-select),
.dd-clipping-feedback :deep(.el-select) {
  width: 160px;
}

.dd-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.dd-clipping-slider-block,
.dd-clipping-axis-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dd-slider-head,
.dd-axis-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}

.dd-axis-range {
  color: var(--el-text-color-secondary);
}

.dd-saved-preset-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.dd-saved-preset-title {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.dd-saved-preset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}

.dd-saved-preset-meta {
  min-width: 0;
}

.dd-saved-preset-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.dd-saved-preset-time {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.dd-saved-preset-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
