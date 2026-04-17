<script setup>
defineOptions({
  name: "MeasurementPanel"
});

defineProps({
  measurementRecords: {
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
  }
});

const emit = defineEmits([
  "update:measurement-mode",
  "focus-record",
  "toggle-record-visible",
  "remove-record",
  "clear-records",
  "export-records"
]);

function formatType(type) {
  const map = {
    distance: "点距",
    polyline: "折线",
    angle: "夹角",
    area: "面积"
  };
  return map[type] || type;
}

function formatValue(item) {
  if (!item) return "-";
  if (item.type === "angle") return `${Number(item.value || 0).toFixed(2)}°`;
  if (item.type === "area") return `${Number(item.value || 0).toFixed(3)} m²`;
  return `${Number(item.value || 0).toFixed(3)} m`;
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="mb-3 flex items-center justify-between gap-2">
      <span class="font-semibold text-sm">测量结果</span>
      <div class="flex items-center gap-2">
        <el-button size="small" link @click="emit('export-records')">
          导出
        </el-button>
        <el-button
          size="small"
          link
          type="danger"
          @click="emit('clear-records')"
        >
          清空
        </el-button>
      </div>
    </div>

    <el-segmented
      :model-value="measurementMode"
      :options="measurementModeOptions"
      size="small"
      class="mb-3"
      @change="emit('update:measurement-mode', $event)"
    />

    <div class="mb-3 text-xs text-[var(--el-text-color-secondary)]">
      距离、折线、夹角、面积都在同一套结果模型下管理，右键、双击或 Enter
      完成当前绘制。
    </div>

    <el-scrollbar height="100%">
      <div v-if="measurementRecords.length" class="space-y-2 pr-1">
        <div
          v-for="item in measurementRecords"
          :key="item.id"
          class="rounded border border-[var(--el-border-color)] px-3 py-2"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold">
                {{ item.name || item.id }}
              </div>
              <div class="text-xs text-[var(--el-text-color-secondary)]">
                {{ formatType(item.type) }} / {{ formatValue(item) }}
              </div>
              <div class="text-xs text-[var(--el-text-color-secondary)]">
                {{ item.points?.length || 0 }} 个点
              </div>
            </div>
            <el-switch
              :model-value="item.visible !== false"
              inline-prompt
              active-text="显"
              inactive-text="隐"
              @update:model-value="emit('toggle-record-visible', item, $event)"
            />
          </div>
          <div class="mt-2 flex items-center gap-2">
            <el-button size="small" link @click="emit('focus-record', item)">
              定位
            </el-button>
            <el-button
              size="small"
              link
              type="danger"
              @click="emit('remove-record', item)"
            >
              删除
            </el-button>
          </div>
        </div>
      </div>
      <el-empty v-else description="当前没有测量结果" :image-size="88" />
    </el-scrollbar>
  </div>
</template>
