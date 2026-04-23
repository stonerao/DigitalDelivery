<script setup>
import { computed } from "vue";
import {
  Aim,
  ArrowDown,
  Camera,
  CollectionTag,
  Crop,
  Hide,
  Pointer,
  Position,
  RefreshRight,
  Right,
  ScaleToOriginal,
  View,
  ZoomIn,
  ZoomOut
} from "@element-plus/icons-vue";
import {
  VIEWER_DISPLAY_ACTION_OPTIONS,
  VIEWER_MATERIAL_THEME_OPTIONS
} from "../services/viewerToolbarConfig";

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
  materialTheme: {
    type: String,
    default: "original"
  },
  displayMode: {
    type: String,
    default: "all"
  },
  selectedObjectInfo: {
    type: Object,
    default: null
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
  "set-preset-view",
  "set-material-theme",
  "apply-display-action"
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

const materialThemeOptions = computed(() => VIEWER_MATERIAL_THEME_OPTIONS);

const displayActionOptions = computed(() => VIEWER_DISPLAY_ACTION_OPTIONS);

const hasSelectedObject = computed(() =>
  Boolean(
    props.selectedObjectInfo?.objectUuid || props.selectedObjectInfo?.uuid
  )
);

const materialThemeLabel = computed(() => {
  return (
    materialThemeOptions.value.find(item => item.value === props.materialTheme)
      ?.label || "视图"
  );
});

const displayModeLabel = computed(() => {
  return (
    displayActionOptions.value.find(item => item.mode === props.displayMode)
      ?.label || "显示"
  );
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

function isDisplayActionActive(item) {
  return item?.mode && props.displayMode === item.mode;
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
          <el-dropdown
            trigger="click"
            placement="top"
            popper-class="dd-toolbar-popper"
          >
            <button
              type="button"
              class="dd-toolbar-btn"
              :class="{ 'is-active': materialTheme !== 'original' }"
              :title="`当前视图：${materialThemeLabel}`"
            >
              <el-icon class="dd-toolbar-icon"><View /></el-icon>
              视图
              <el-icon class="dd-toolbar-caret"><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="item in materialThemeOptions"
                  :key="item.value"
                  :class="{ 'is-active': materialTheme === item.value }"
                  @click="emit('set-material-theme', item.value)"
                >
                  {{ item.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <el-dropdown
            trigger="click"
            placement="top"
            popper-class="dd-toolbar-popper"
          >
            <button
              type="button"
              class="dd-toolbar-btn"
              :class="{ 'is-active': displayMode !== 'all' }"
              :title="`当前显示：${displayModeLabel}`"
            >
              <el-icon class="dd-toolbar-icon"><Hide /></el-icon>
              显示
              <el-icon class="dd-toolbar-caret"><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="item in displayActionOptions"
                  :key="item.value"
                  :class="{
                    'is-active': isDisplayActionActive(item),
                    'is-selection-action':
                      item.needsSelection && !hasSelectedObject
                  }"
                  @click="emit('apply-display-action', item.value)"
                >
                  {{ item.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
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
  bottom: 14px;
  left: 50%;
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
  overflow: auto hidden;
  scrollbar-width: none;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  box-shadow: var(--el-box-shadow-light);
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
  gap: 6px;
  justify-content: center;
  width: max-content;
}

.dd-bottombar-row-secondary {
  align-items: center;
}

.dd-toolbar-group {
  display: inline-flex;
  flex: none;
  gap: 4px;
  align-items: center;
  padding: 4px;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.dd-toolbar-btn {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  background: var(--el-bg-color);
  border: 1px solid transparent;
  border-radius: 6px;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;
}

.dd-toolbar-btn-icon {
  width: 28px;
  min-width: 28px;
  padding: 0;
}

.dd-toolbar-btn:hover {
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color);
}

.dd-toolbar-btn.is-active {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-5);
  box-shadow: none;
}

.dd-toolbar-btn.is-static {
  cursor: default;
}

.dd-toolbar-btn.is-static:hover {
  background: var(--el-bg-color);
  border-color: transparent;
}

.dd-toolbar-btn-danger {
  color: var(--el-color-danger);
}

.dd-toolbar-status {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.dd-toolbar-icon {
  font-size: 12px;
}

.dd-toolbar-caret {
  margin-left: 0;
  font-size: 10px;
}

.dd-toolbar-dot {
  flex: none;
  width: 5px;
  height: 5px;
  background: var(--el-text-color-placeholder);
  border-radius: 999px;
}

.dd-toolbar-status.is-active .dd-toolbar-dot {
  background: var(--el-color-success);
}

.dd-toolbar-hint {
  padding: 0 4px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

@media (width <= 1200px) {
  .dd-bottombar {
    right: 12px;
    left: 12px;
    transform: none;
  }

  .dd-bottombar-shell {
    width: auto;
  }

  .dd-bottombar-row {
    justify-content: flex-start;
  }
}

:global(.dd-toolbar-popper .el-dropdown-menu__item.is-active) {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

:global(.dd-toolbar-popper .el-dropdown-menu__item.is-selection-action) {
  color: var(--el-text-color-secondary);
}
</style>
