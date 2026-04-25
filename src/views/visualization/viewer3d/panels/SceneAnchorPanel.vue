<script setup>
defineOptions({
  name: "SceneAnchorPanel"
});

const props = defineProps({
  title: {
    type: String,
    default: ""
  },
  kind: {
    type: String,
    default: "anchor"
  },
  items: {
    type: Array,
    default: () => []
  },
  selectedId: {
    type: String,
    default: ""
  },
  visible: {
    type: Boolean,
    default: true
  },
  emptyText: {
    type: String,
    default: "暂无数据"
  }
});

const emit = defineEmits([
  "toggle-visible",
  "add-item",
  "select-item",
  "edit-item",
  "remove-item"
]);

function itemSubtitle(item) {
  if (props.kind === "camera") {
    return [
      item.cameraType,
      item.streamType,
      item.bindDeviceKks || item.cameraCode
    ]
      .filter(Boolean)
      .join(" / ");
  }

  const binding = item.businessBinding || {};
  if (binding.bindingType === "measurement") {
    return [item.type, binding.kks, binding.tag].filter(Boolean).join(" / ");
  }
  if (binding.bindingType === "device") {
    return [item.type, binding.kks].filter(Boolean).join(" / ");
  }
  return [item.type, item.payload?.displayText || item.payload?.value]
    .filter(Boolean)
    .join(" / ");
}

function itemLocation(item) {
  if (item.anchorMode === "object") {
    return item.objectUuid
      ? `绑定构件 ${item.objectUuid.slice(0, 8)}`
      : "未绑定构件";
  }
  if (Array.isArray(item.worldPosition)) {
    return `世界坐标 ${item.worldPosition.map(value => Number(value || 0).toFixed(2)).join(", ")}`;
  }
  return "未定位";
}

function itemIconUrl(item) {
  return item?.style?.iconUrl || "";
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="mb-3 flex items-center justify-between gap-3">
      <span class="font-semibold text-sm">{{ title }}</span>
      <div class="flex items-center gap-2">
        <el-switch
          :model-value="visible"
          inline-prompt
          active-text="显"
          inactive-text="隐"
          @update:model-value="emit('toggle-visible', $event)"
        />
        <el-button size="small" type="primary" @click="emit('add-item')">
          新增
        </el-button>
      </div>
    </div>

    <div class="mb-3 text-xs text-[var(--el-text-color-secondary)]">
      {{
        kind === "camera"
          ? "点击场景摄像头可查看视频接入信息。"
          : "点击场景点位可查看当前绑定数据。"
      }}
    </div>

    <el-scrollbar height="100%">
      <div v-if="items.length" class="space-y-2 pr-1">
        <div
          v-for="item in items"
          :key="item.id"
          class="rounded border px-3 py-2 transition cursor-pointer"
          :class="
            item.id === selectedId
              ? 'border-[var(--el-color-primary)] bg-[var(--el-color-primary-light-9)]'
              : 'border-[var(--el-border-color)] hover:border-[var(--el-color-primary-light-5)]'
          "
          @click="emit('select-item', item)"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex min-w-0 flex-1 items-start gap-2">
              <div class="dd-anchor-list-icon">
                <img
                  v-if="itemIconUrl(item)"
                  :src="itemIconUrl(item)"
                  :alt="item.style?.iconLabel || ''"
                />
                <span v-else>{{ kind === "camera" ? "摄" : "点" }}</span>
              </div>
              <div class="min-w-0">
                <div class="truncate text-sm font-semibold">
                  {{ item.name || item.cameraName || item.code || item.id }}
                </div>
                <div
                  class="truncate text-xs text-[var(--el-text-color-secondary)]"
                >
                  {{ itemSubtitle(item) || "-" }}
                </div>
                <div
                  class="mt-1 line-clamp-2 text-xs text-[var(--el-text-color-secondary)]"
                >
                  {{ itemLocation(item) }}
                </div>
              </div>
            </div>
            <div class="flex flex-col items-end">
              <el-button
                size="small"
                link
                @click.stop="emit('edit-item', item)"
              >
                编辑
              </el-button>
              <el-button
                size="small"
                link
                type="danger"
                @click.stop="emit('remove-item', item)"
              >
                删除
              </el-button>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else :description="emptyText" :image-size="88" />
    </el-scrollbar>
  </div>
</template>

<style scoped>
.dd-anchor-list-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  overflow: hidden;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}

.dd-anchor-list-icon img {
  max-width: 30px;
  max-height: 30px;
  object-fit: contain;
}
</style>
