<script setup>
defineOptions({
  name: "DevicePanel"
});

defineProps({
  deviceKeyword: {
    type: String,
    default: ""
  },
  filteredSceneDevices: {
    type: Array,
    default: () => []
  },
  selectedDeviceUuid: {
    type: String,
    default: ""
  }
});

const emit = defineEmits([
  "update:deviceKeyword",
  "locate-device",
  "isolate-device"
]);
</script>

<template>
  <div class="flex h-full flex-col">
    <el-input
      :model-value="deviceKeyword"
      clearable
      placeholder="搜索设备名称/类型/路径"
      class="mb-3"
      @update:model-value="emit('update:deviceKeyword', $event)"
    />

    <div class="mb-3 text-xs text-[var(--el-text-color-secondary)]">
      点击列表项可在场景中高亮并定位到对应构件。
    </div>

    <el-scrollbar height="100%">
      <div v-if="filteredSceneDevices.length > 0" class="space-y-2 pr-1">
        <div
          v-for="item in filteredSceneDevices"
          :key="item.uuid"
          class="rounded border px-3 py-2 transition cursor-pointer"
          :class="
            item.uuid === selectedDeviceUuid
              ? 'border-[var(--el-color-primary)] bg-[var(--el-color-primary-light-9)]'
              : 'border-[var(--el-border-color)] hover:border-[var(--el-color-primary-light-5)]'
          "
          @click="emit('locate-device', item, false)"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold">
                {{ item.name }}
              </div>
              <div
                class="truncate text-xs text-[var(--el-text-color-secondary)]"
              >
                {{ item.kks ? `${item.type} · ${item.kks}` : item.type }}
              </div>
              <div
                class="mt-1 line-clamp-2 text-xs text-[var(--el-text-color-secondary)]"
              >
                {{ item.path }}
              </div>
              <div class="mt-1 text-xs text-[var(--el-text-color-secondary)]">
                {{ item.systemName || "未绑定系统" }} /
                {{ item.status || "-" }}
              </div>
            </div>
            <div class="flex flex-col items-end">
              <el-button
                size="small"
                link
                @click.stop="emit('locate-device', item, true)"
              >
                定位
              </el-button>
              <el-button
                size="small"
                link
                @click.stop="emit('isolate-device', item)"
              >
                隔离
              </el-button>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else description="当前模型暂无可联动构件" :image-size="88" />
    </el-scrollbar>
  </div>
</template>
