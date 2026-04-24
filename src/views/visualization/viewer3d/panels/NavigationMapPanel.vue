<script setup>
import { computed } from "vue";

defineOptions({
  name: "NavigationMapPanel"
});

const props = defineProps({
  snapshot: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  },
  items: {
    type: Array,
    default: () => []
  },
  activeItemId: {
    type: String,
    default: ""
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["select-item", "refresh"]);

const visibleItems = computed(() =>
  props.items.filter(
    item =>
      Number.isFinite(Number(item?.xPercent)) &&
      Number.isFinite(Number(item?.yPercent))
  )
);

function getItemShortLabel(item) {
  if (item?.shortLabel) return item.shortLabel;
  const label = String(item?.label || "").trim();
  if (!label) return "?";
  if (item?.type === "bookmark") return label.slice(0, 2);
  return label.slice(0, 2);
}

function getItemDotClass(item) {
  return {
    "is-system": item?.type === "system",
    "is-bookmark": item?.type === "bookmark",
    "is-device": item?.type === "device"
  };
}

function handleItemClick(item) {
  if (props.disabled || item?.disabled) return;
  emit("select-item", item);
}
</script>

<template>
  <div class="rounded border border-[var(--el-border-color)] p-3">
    <div class="mb-2 flex items-center justify-between gap-2">
      <div class="text-sm font-semibold">导航图</div>
      <el-button size="small" link @click="emit('refresh')">刷新</el-button>
    </div>
    <div class="mb-2 text-xs text-[var(--el-text-color-secondary)]">
      {{
        disabled
          ? "平面渲染下仅展示导航图，不支持视角定位。"
          : "点击热点可快速定位系统或书签视角。"
      }}
    </div>

    <div class="dd-map-frame" :class="{ 'is-disabled': disabled }">
      <img
        v-if="snapshot?.imageUrl"
        :src="snapshot.imageUrl"
        alt="导航图"
        class="dd-map-image"
      />
      <div v-else class="dd-map-empty">
        <el-empty description="未生成导航图" :image-size="52" />
      </div>

      <button
        v-for="item in visibleItems"
        :key="item.id"
        type="button"
        class="dd-map-marker"
        :class="{
          'is-active': activeItemId === item.id,
          'is-disabled': disabled || item.disabled
        }"
        :style="{
          left: `${item.xPercent}%`,
          top: `${item.yPercent}%`
        }"
        :title="item.label"
        @click="handleItemClick(item)"
      >
        <span class="dd-map-dot" :class="getItemDotClass(item)" />
        <span class="dd-map-badge">{{ getItemShortLabel(item) }}</span>
      </button>

      <div v-if="loading" class="dd-map-loading">生成中...</div>
    </div>

    <div
      class="mt-3 flex flex-wrap gap-3 text-xs text-[var(--el-text-color-secondary)]"
    >
      <span class="dd-map-legend">
        <i class="dd-map-dot is-system" />
        系统
      </span>
      <span class="dd-map-legend">
        <i class="dd-map-dot is-bookmark" />
        书签
      </span>
      <span class="dd-map-legend">
        <i class="dd-map-dot is-device" />
        当前设备
      </span>
    </div>
  </div>
</template>

<style scoped>
.dd-map-frame {
  position: relative;
  overflow: hidden;
  min-height: 180px;
  aspect-ratio: 16 / 10;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: #eef2f6;
}

.dd-map-frame.is-disabled {
  filter: saturate(0.86);
}

.dd-map-image,
.dd-map-empty {
  width: 100%;
  height: 100%;
}

.dd-map-image {
  display: block;
  object-fit: cover;
}

.dd-map-empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.dd-map-marker {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 4px;
  transform: translate(-50%, -50%);
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.dd-map-marker.is-disabled {
  cursor: default;
}

.dd-map-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.95);
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.18);
}

.dd-map-dot.is-system {
  background: #2563eb;
}

.dd-map-dot.is-bookmark {
  background: #7c3aed;
}

.dd-map-dot.is-device {
  background: #f97316;
}

.dd-map-badge {
  min-width: 24px;
  height: 20px;
  border-radius: 999px;
  padding: 0 6px;
  background: rgba(15, 23, 42, 0.76);
  color: #fff;
  font-size: 11px;
  line-height: 20px;
  text-align: center;
  white-space: nowrap;
}

.dd-map-marker.is-active .dd-map-badge {
  background: var(--el-color-primary);
}

.dd-map-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.55);
  color: var(--el-text-color-primary);
  font-size: 12px;
  backdrop-filter: blur(2px);
}

.dd-map-legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
