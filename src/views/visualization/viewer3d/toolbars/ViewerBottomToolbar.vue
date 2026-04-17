<script setup>
import { computed } from "vue";
import {
  Aim,
  Camera,
  CollectionTag,
  Crop,
  Pointer,
  Position,
  RefreshRight,
  Right,
  ScaleToOriginal,
  ZoomIn,
  ZoomOut
} from "@element-plus/icons-vue";

defineOptions({
  name: "ViewerBottomToolbar"
});

const props = defineProps({
  toolOptions: {
    type: Array,
    default: () => []
  },
  activeTool: {
    type: String,
    default: "rotate"
  },
  roamingEnabled: {
    type: Boolean,
    default: false
  },
  transparent: {
    type: Boolean,
    default: false
  },
  enableClipping: {
    type: Boolean,
    default: false
  },
  presetViews: {
    type: Array,
    default: () => []
  },
  bookmarks: {
    type: Array,
    default: () => []
  },
  measurementMode: {
    type: String,
    default: "distance"
  },
  measurementModeOptions: {
    type: Array,
    default: () => []
  },
  projectionMode: {
    type: String,
    default: "perspective"
  },
  selectedCount: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits([
  "update:active-tool",
  "tool-change",
  "zoom-in",
  "zoom-out",
  "reset-view",
  "toggle-roaming",
  "toggle-transparent",
  "toggle-projection",
  "toggle-clipping",
  "take-screenshot",
  "save-bookmark",
  "apply-bookmark",
  "clear-measurements",
  "export-measurements",
  "update:measurement-mode",
  "set-preset-view"
]);

function onToolChange(value) {
  emit("update:active-tool", value);
  emit("tool-change", value);
}

const primaryTools = computed(() => {
  const preferredOrder = ["pan", "rotate", "zoom"];
  const toolMap = new Map(
    (props.toolOptions || []).map(item => [item?.value, item])
  );
  return preferredOrder.map(value => toolMap.get(value)).filter(Boolean);
});

const extraTools = computed(() => {
  const primary = new Set(primaryTools.value.map(item => item.value));
  return (props.toolOptions || []).filter(item => !primary.has(item.value));
});

const quickViews = computed(() => {
  return (props.presetViews || []).slice(0, 4);
});

function getToolLabel(item) {
  if (!item?.value) return item?.label || "-";
  if (item.value === "pan") return "移动";
  if (item.value === "rotate") return "旋转";
  if (item.value === "zoom") return "缩放";
  if (item.value === "measure") return "测量";
  if (item.value === "pick") return "选取";
  return String(item.label || item.value)
    .replace(/\(.*?\)/g, "")
    .trim();
}

function isToolActive(value) {
  return props.activeTool === value;
}

function measurementLabel(item) {
  return String(item?.label || item?.value || "")
    .replace(/\s+/g, "")
    .trim();
}

function getToolIcon(value) {
  if (value === "pan") return Position;
  if (value === "rotate") return RefreshRight;
  if (value === "zoom") return ScaleToOriginal;
  if (value === "measure") return Crop;
  if (value === "pick") return Pointer;
  return Right;
}
</script>

<template>
  <div class="dd-bottombar pointer-events-none">
    <div class="dd-bottombar-shell pointer-events-auto">
      <div class="dd-bottombar-row">
        <div class="dd-toolbar-group">
          <button
            v-for="item in primaryTools"
            :key="item.value"
            type="button"
            class="dd-toolbar-btn"
            :class="{ 'is-active': isToolActive(item.value) }"
            :title="getToolLabel(item)"
            @click="onToolChange(item.value)"
          >
            <el-icon class="dd-toolbar-icon">
              <component :is="getToolIcon(item.value)" />
            </el-icon>
            {{ getToolLabel(item) }}
          </button>
        </div>

        <div v-if="extraTools.length > 0" class="dd-toolbar-group">
          <button
            v-for="item in extraTools"
            :key="item.value"
            type="button"
            class="dd-toolbar-btn"
            :class="{ 'is-active': isToolActive(item.value) }"
            :title="getToolLabel(item)"
            @click="onToolChange(item.value)"
          >
            <el-icon class="dd-toolbar-icon">
              <component :is="getToolIcon(item.value)" />
            </el-icon>
            {{ getToolLabel(item) }}
          </button>
        </div>

        <div v-if="quickViews.length > 0" class="dd-toolbar-group">
          <button
            v-for="item in quickViews"
            :key="item.value"
            type="button"
            class="dd-toolbar-btn"
            :title="item.label"
            @click="emit('set-preset-view', item.value)"
          >
            {{ item.label }}
          </button>
        </div>

        <div class="dd-toolbar-group">
          <button
            type="button"
            class="dd-toolbar-btn dd-toolbar-status"
            :class="{ 'is-active': roamingEnabled }"
            @click="emit('toggle-roaming')"
          >
            <span class="dd-toolbar-dot" />
            漫游
          </button>
          <button
            type="button"
            class="dd-toolbar-btn dd-toolbar-status"
            :class="{ 'is-active': transparent }"
            @click="emit('toggle-transparent')"
          >
            <span class="dd-toolbar-dot" />
            透明
          </button>
          <div class="dd-toolbar-btn dd-toolbar-status is-static">
            <span class="dd-toolbar-dot" />
            选中 {{ selectedCount }}
          </div>
          <button
            type="button"
            class="dd-toolbar-btn dd-toolbar-status"
            :class="{ 'is-active': enableClipping }"
            @click="emit('toggle-clipping')"
          >
            <span class="dd-toolbar-dot" />
            剖切
          </button>
        </div>

        <div class="dd-toolbar-group">
          <button
            type="button"
            class="dd-toolbar-btn"
            :class="{ 'is-active': projectionMode === 'orthographic' }"
            @click="emit('toggle-projection')"
          >
            2D
          </button>
          <button
            type="button"
            class="dd-toolbar-btn"
            :class="{ 'is-active': projectionMode === 'perspective' }"
            @click="emit('toggle-projection')"
          >
            3D
          </button>
        </div>

        <div class="dd-toolbar-group">
          <button
            type="button"
            class="dd-toolbar-btn dd-toolbar-btn-icon"
            title="缩小"
            @click="emit('zoom-out')"
          >
            <el-icon><ZoomOut /></el-icon>
          </button>
          <button
            type="button"
            class="dd-toolbar-btn dd-toolbar-btn-icon"
            title="放大"
            @click="emit('zoom-in')"
          >
            <el-icon><ZoomIn /></el-icon>
          </button>
          <button
            type="button"
            class="dd-toolbar-btn dd-toolbar-btn-icon"
            title="重置视角"
            @click="emit('reset-view')"
          >
            <el-icon><Aim /></el-icon>
          </button>
        </div>

        <div class="dd-toolbar-group">
          <button
            type="button"
            class="dd-toolbar-btn dd-toolbar-btn-icon"
            title="截图"
            @click="emit('take-screenshot')"
          >
            <el-icon><Camera /></el-icon>
          </button>
          <button
            type="button"
            class="dd-toolbar-btn dd-toolbar-btn-icon"
            title="保存书签"
            @click="emit('save-bookmark')"
          >
            <el-icon><CollectionTag /></el-icon>
          </button>
        </div>
      </div>

      <div
        v-if="
          activeTool === 'measure' || roamingEnabled || bookmarks.length > 0
        "
        class="dd-bottombar-row dd-bottombar-row-secondary"
      >
        <div v-if="activeTool === 'measure'" class="dd-toolbar-group">
          <button
            v-for="item in measurementModeOptions"
            :key="item.value"
            type="button"
            class="dd-toolbar-btn"
            :class="{ 'is-active': measurementMode === item.value }"
            @click="emit('update:measurement-mode', item.value)"
          >
            {{ measurementLabel(item) }}
          </button>
          <button
            type="button"
            class="dd-toolbar-btn dd-toolbar-btn-danger"
            @click="emit('clear-measurements')"
          >
            清空
          </button>
          <button
            type="button"
            class="dd-toolbar-btn"
            @click="emit('export-measurements')"
          >
            导出
          </button>
        </div>

        <div v-if="roamingEnabled" class="dd-toolbar-hint">
          第一人称漫游中：点击场景锁定鼠标，WASDQE 移动，Shift 加速，Esc 退出
        </div>

        <div v-if="bookmarks.length > 0" class="dd-toolbar-group">
          <button
            v-for="bm in bookmarks.slice(0, 4)"
            :key="bm.id"
            type="button"
            class="dd-toolbar-btn"
            @click="emit('apply-bookmark', bm)"
          >
            {{ bm.name }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dd-bottombar {
  position: absolute;
  left: 50%;
  bottom: 14px;
  z-index: 30;
  transform: translateX(-50%);
}

.dd-bottombar-shell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: max-content;
  max-width: calc(100vw - 24px);
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: var(--el-bg-color-overlay);
  box-shadow: var(--el-box-shadow-light);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.dd-bottombar-shell::-webkit-scrollbar {
  display: none;
}

@supports (backdrop-filter: blur(1px)) {
  .dd-bottombar-shell {
    backdrop-filter: blur(10px) saturate(140%);
  }
}

.dd-bottombar-row {
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  gap: 6px;
  width: max-content;
}

.dd-bottombar-row-secondary {
  align-items: center;
}

.dd-toolbar-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-extra-light);
  flex: none;
}

.dd-toolbar-btn {
  min-width: 40px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;
}

.dd-toolbar-btn-icon {
  min-width: 28px;
  width: 28px;
  padding: 0;
}

.dd-toolbar-btn:hover {
  border-color: var(--el-border-color);
  background: var(--el-fill-color-light);
}

.dd-toolbar-btn.is-active {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  box-shadow: none;
}

.dd-toolbar-btn.is-static {
  cursor: default;
}

.dd-toolbar-btn.is-static:hover {
  border-color: transparent;
  background: var(--el-bg-color);
}

.dd-toolbar-btn-danger {
  color: var(--el-color-danger);
}

.dd-toolbar-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dd-toolbar-icon {
  font-size: 12px;
}

.dd-toolbar-dot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--el-text-color-placeholder);
  flex: none;
}

.dd-toolbar-status.is-active .dd-toolbar-dot {
  background: var(--el-color-success);
}

.dd-toolbar-hint {
  padding: 0 4px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
}

@media (max-width: 1200px) {
  .dd-bottombar {
    left: 12px;
    right: 12px;
    transform: none;
  }

  .dd-bottombar-shell {
    width: auto;
  }

  .dd-bottombar-row {
    justify-content: flex-start;
  }
}
</style>
