<script setup>
import { computed } from "vue";

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
  "toggle-animation",
  "update:animationSpeed",
  "update:animationMode",
  "update:animationAxis",
  "reset"
]);

const currentTargetMode = computed(() => {
  const targets = props.clippingState?.targets || {};
  if (targets.mode !== "objects") return "scene";
  return (targets.objectUuids || []).length > 1 ? "objects" : "object";
});

const targetObjects = computed(() => {
  const targets = props.clippingState?.targets || {};
  const uuids = Array.isArray(targets.objectUuids) ? targets.objectUuids : [];
  const names = Array.isArray(targets.objectNames) ? targets.objectNames : [];
  return uuids.map((uuid, index) => ({
    uuid,
    name: names[index] || uuid
  }));
});

const selectedObjectUuid = computed(
  () =>
    props.selectedObjectInfo?.objectUuid || props.selectedObjectInfo?.uuid || ""
);

const selectedObjectName = computed(
  () =>
    props.selectedObjectInfo?.name ||
    props.selectedObjectInfo?.objectName ||
    props.selectedObjectInfo?.uuid ||
    ""
);

const planeNormalText = computed(() => {
  const normal = props.clippingState?.plane?.normal || [0, 0, 0];
  return normal.map(item => Number(item || 0).toFixed(2)).join(", ");
});

const planePositionText = computed(() => {
  const position = props.clippingState?.plane?.position || [0, 0, 0];
  return position.map(item => Number(item || 0).toFixed(2)).join(", ");
});

const planeRows = computed(() => {
  const planes = Array.isArray(props.clippingState?.planes)
    ? props.clippingState.planes
    : [];
  return planes.map((item, index) => ({
    ...item,
    name: item.name || `剖切面 ${index + 1}`
  }));
});

const activePlaneId = computed(
  () => props.clippingState?.activePlaneId || planeRows.value[0]?.id || ""
);

function emitState(nextState) {
  emit("update:clippingState", nextState);
}

function patchState(patch = {}) {
  emitState({
    ...props.clippingState,
    ...patch,
    targets: {
      ...(props.clippingState?.targets || {}),
      ...(patch.targets || {})
    },
    plane: {
      ...(props.clippingState?.plane || {}),
      ...(patch.plane || {})
    },
    singlePlane: {
      ...(props.clippingState?.singlePlane || {}),
      ...(patch.singlePlane || {})
    }
  });
}

function updateSinglePlane(key, value) {
  patchState({
    plane: {
      custom: false
    },
    singlePlane: {
      [key]: value
    }
  });
}

function getSingleObjectPlanePatch() {
  if (props.clippingState?.mode !== "single-plane") return {};
  const firstPlaneId =
    props.clippingState?.planes?.[0]?.id || props.clippingState?.plane?.id;
  return {
    singlePlane: {
      position: 1,
      direction: "positive"
    },
    plane: {
      custom: false,
      normalizedPosition: 1,
      direction: "positive"
    },
    planes: Array.isArray(props.clippingState?.planes)
      ? props.clippingState.planes.map(item =>
          item.id === firstPlaneId
            ? {
                ...item,
                custom: false,
                normalizedPosition: 1,
                direction: "positive"
              }
            : item
        )
      : props.clippingState?.planes
  };
}

function onTargetModeChange(value) {
  if (value === "scene") {
    patchState({
      targetMode: "scene",
      targetObjectUuid: "",
      targetObjectName: "",
      targets: {
        mode: "scene",
        objectUuids: [],
        objectNames: []
      }
    });
    return;
  }

  const currentUuid =
    selectedObjectUuid.value ||
    props.clippingState?.targetObjectUuid ||
    targetObjects.value[0]?.uuid ||
    "";
  const currentName =
    selectedObjectName.value ||
    props.clippingState?.targetObjectName ||
    targetObjects.value[0]?.name ||
    "";
  const existingUuids = targetObjects.value.map(item => item.uuid);
  const existingNames = targetObjects.value.map(item => item.name);
  const objectUuids =
    value === "objects" && existingUuids.length
      ? existingUuids
      : currentUuid
        ? [currentUuid]
        : [];
  const objectNames =
    value === "objects" && existingNames.length
      ? existingNames
      : currentName
        ? [currentName]
        : [];

  patchState({
    ...(value === "object" ? getSingleObjectPlanePatch() : {}),
    targetMode: objectUuids.length ? "object" : "scene",
    targetObjectUuid: objectUuids[0] || "",
    targetObjectName: objectNames[0] || "",
    targets: {
      mode: objectUuids.length ? "objects" : "scene",
      objectUuids,
      objectNames
    }
  });
}

function addCurrentTarget() {
  if (!selectedObjectUuid.value) return;
  const next = [...targetObjects.value];
  if (!next.some(item => item.uuid === selectedObjectUuid.value)) {
    next.push({
      uuid: selectedObjectUuid.value,
      name: selectedObjectName.value || selectedObjectUuid.value
    });
  }
  patchTargetObjects(next);
}

function removeTargetObject(uuid) {
  patchTargetObjects(targetObjects.value.filter(item => item.uuid !== uuid));
}

function clearTargetObjects() {
  patchTargetObjects([]);
}

function patchTargetObjects(items = []) {
  patchState({
    targetMode: items.length ? "object" : "scene",
    targetObjectUuid: items[0]?.uuid || "",
    targetObjectName: items[0]?.name || "",
    targets: {
      mode: items.length ? "objects" : "scene",
      objectUuids: items.map(item => item.uuid),
      objectNames: items.map(item => item.name)
    }
  });
}

function resetPlaneAngle() {
  patchState({
    plane: {
      custom: false
    }
  });
}

function createPanelPlane(index = planeRows.value.length) {
  const axis = ["x", "y", "z"][index % 3];
  return {
    id: `plane-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    name: `剖切面 ${index + 1}`,
    enabled: true,
    custom: false,
    axis,
    normalizedPosition: 0.5,
    direction: "positive",
    normal: axis === "y" ? [0, 1, 0] : axis === "z" ? [0, 0, 1] : [1, 0, 0],
    constant: 0,
    position: [0, 0, 0],
    quaternion: [0, 0, 0, 1],
    size: [1, 1]
  };
}

function addPlane() {
  const next = [...planeRows.value, createPanelPlane()];
  patchState({
    mode: "multi-plane",
    planes: next,
    activePlaneId: next[next.length - 1]?.id || ""
  });
}

function removePlane(id) {
  const next = planeRows.value.filter(item => item.id !== id);
  patchState({
    planes: next.length ? next : [createPanelPlane(0)],
    activePlaneId: next[0]?.id || ""
  });
}

function setActivePlane(id) {
  patchState({ activePlaneId: id });
}

function patchPlane(id, patch = {}) {
  patchState({
    planes: planeRows.value.map(item =>
      item.id === id ? { ...item, ...patch } : item
    ),
    activePlaneId: id
  });
}

function resetPlaneToAxis(id) {
  patchPlane(id, { custom: false });
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
          :model-value="currentTargetMode"
          :options="targetOptions"
          size="small"
          @change="onTargetModeChange"
        />
      </div>

      <div v-if="currentTargetMode !== 'scene'" class="dd-clipping-target-tip">
        {{
          targetObjects.length
            ? `当前目标：${targetObjects.length} 个物体`
            : "请先在场景中选中一个物体，再加入剖切目标"
        }}
      </div>

      <div v-if="currentTargetMode === 'objects'" class="dd-target-actions">
        <el-button
          size="small"
          type="primary"
          plain
          :disabled="!selectedObjectUuid"
          @click="addCurrentTarget"
        >
          加入当前选中
        </el-button>
        <el-button size="small" plain @click="clearTargetObjects">
          清空目标
        </el-button>
      </div>

      <div
        v-if="currentTargetMode === 'objects' && targetObjects.length"
        class="dd-target-list"
      >
        <el-tag
          v-for="item in targetObjects"
          :key="item.uuid"
          size="small"
          closable
          @close="removeTargetObject(item.uuid)"
        >
          {{ item.name }}
        </el-tag>
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

      <div class="dd-clipping-row dd-clipping-feedback">
        <span class="dd-label">画布编辑</span>
        <el-segmented
          :model-value="clippingState.editMode || 'translate'"
          :options="[
            { label: '移动', value: 'translate' },
            { label: '旋转', value: 'rotate' }
          ]"
          size="small"
          @change="patchState({ editMode: $event })"
        />
      </div>

      <template v-if="clippingState.mode === 'single-plane'">
        <div class="dd-plane-info">
          <div>法线：{{ planeNormalText }}</div>
          <div>位置：{{ planePositionText }}</div>
          <el-button size="small" link @click="resetPlaneAngle">
            重置为轴向剖切
          </el-button>
        </div>
      </template>

      <div class="dd-clipping-row">
        <span class="dd-label">剖切面填充</span>
        <el-switch
          :model-value="clippingState.capEnabled"
          size="small"
          @update:model-value="patchState({ capEnabled: $event })"
        />
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

      <template v-else-if="clippingState.mode === 'multi-plane'">
        <div class="dd-plane-list-head">
          <span class="dd-label">平面列表</span>
          <el-button
            size="small"
            type="primary"
            plain
            :disabled="planeRows.length >= 6"
            @click="addPlane"
          >
            新增平面
          </el-button>
        </div>

        <div class="dd-plane-list">
          <div
            v-for="item in planeRows"
            :key="item.id"
            class="dd-plane-item"
            :class="{ 'is-active': item.id === activePlaneId }"
            @click="setActivePlane(item.id)"
          >
            <div class="dd-plane-item-head">
              <el-checkbox
                :model-value="item.enabled"
                size="small"
                @click.stop
                @update:model-value="
                  patchPlane(item.id, {
                    enabled: $event
                  })
                "
              >
                {{ item.name }}
              </el-checkbox>
              <el-button
                size="small"
                link
                type="danger"
                :disabled="planeRows.length <= 1"
                @click.stop="removePlane(item.id)"
              >
                删除
              </el-button>
            </div>

            <div class="dd-plane-item-row">
              <span>轴向</span>
              <el-segmented
                :model-value="item.axis"
                :options="axisOptions"
                size="small"
                @click.stop
                @change="
                  patchPlane(item.id, {
                    axis: $event,
                    custom: false
                  })
                "
              />
            </div>
            <div class="dd-plane-item-row">
              <span>方向</span>
              <el-segmented
                :model-value="item.direction"
                :options="directionOptions"
                size="small"
                @click.stop
                @change="
                  patchPlane(item.id, {
                    direction: $event,
                    custom: false
                  })
                "
              />
            </div>
            <div class="dd-plane-item-row is-slider">
              <span
                >{{ Math.round((item.normalizedPosition || 0) * 100) }}%</span
              >
              <el-slider
                :model-value="item.normalizedPosition"
                :min="0"
                :max="1"
                :step="0.01"
                size="small"
                @click.stop
                @update:model-value="
                  patchPlane(item.id, {
                    normalizedPosition: $event,
                    custom: false
                  })
                "
              />
            </div>
            <el-button
              v-if="item.custom"
              size="small"
              link
              @click.stop="resetPlaneToAxis(item.id)"
            >
              重置为轴向平面
            </el-button>
          </div>
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
  right: calc(var(--dd-panel-width) + var(--dd-gap) + var(--dd-gap));
}

.dd-clipping-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
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

.dd-target-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: -4px;
}

.dd-target-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 88px;
  overflow-y: auto;
}

.dd-plane-info {
  display: grid;
  gap: 4px;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.dd-clipping-row {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.dd-clipping-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.dd-stat-card {
  padding: 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
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

.dd-clipping-axis-block.is-disabled {
  opacity: 0.48;
}

.dd-plane-list-head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.dd-plane-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 360px;
  padding-right: 2px;
  overflow-y: auto;
}

.dd-plane-item {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  cursor: pointer;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  transition:
    border-color 0.18s ease,
    background 0.18s ease;
}

.dd-plane-item.is-active {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
}

.dd-plane-item-head,
.dd-plane-item-row {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.dd-plane-item-row.is-slider {
  flex-direction: column;
  align-items: stretch;
}

.dd-slider-head,
.dd-axis-head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.dd-axis-range {
  color: var(--el-text-color-secondary);
}
</style>
