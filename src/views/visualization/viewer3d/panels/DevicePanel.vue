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

function getStatusTagType(status = "") {
  const text = String(status || "").toLowerCase();
  if (!text || text === "-") return "info";
  if (
    ["alarm", "danger", "error", "告警", "报警", "异常"].some(item =>
      text.includes(item)
    )
  ) {
    return "danger";
  }
  if (["warning", "warn", "预警", "警告"].some(item => text.includes(item))) {
    return "warning";
  }
  return "success";
}
</script>

<template>
  <div class="dd-inspector-module">
    <div class="dd-inspector-module__head">
      <span class="dd-inspector-module__title">设备联动</span>
      <span class="dd-inspector-module__count">
        {{ filteredSceneDevices.length }}
      </span>
    </div>

    <el-input
      :model-value="deviceKeyword"
      clearable
      placeholder="搜索设备名称/类型/路径"
      class="dd-inspector-module__field"
      @update:model-value="emit('update:deviceKeyword', $event)"
    />

    <div class="dd-inspector-module__hint">
      点击列表项可在场景中高亮并定位到对应构件。
    </div>

    <el-scrollbar height="100%">
      <div v-if="filteredSceneDevices.length > 0" class="space-y-2 pr-1">
        <div
          v-for="item in filteredSceneDevices"
          :key="item.uuid"
          class="dd-list-row rounded border px-3 py-2 transition cursor-pointer"
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
                {{ item.systemName || "未绑定系统" }}
                <el-tag
                  class="ml-1"
                  size="small"
                  effect="plain"
                  :type="getStatusTagType(item.status)"
                >
                  {{ item.status || "-" }}
                </el-tag>
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

<style scoped>
.dd-inspector-module {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.dd-inspector-module__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  margin-bottom: 10px;
}

.dd-inspector-module__title {
  font-size: 15px;
  font-weight: 760;
  color: #172033;
}

.dd-inspector-module__count {
  min-width: 28px;
  height: 22px;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 760;
  line-height: 22px;
  color: #0b73ff;
  text-align: center;
  background: #edf5ff;
  border-radius: 999px;
}

.dd-inspector-module__field {
  margin-bottom: 10px;
}

.dd-inspector-module__hint {
  margin-bottom: 12px;
  font-size: 12px;
  color: #94a3b8;
}

.dd-list-row {
  border-radius: 10px;
}
</style>
