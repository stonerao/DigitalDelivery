<script setup>
defineOptions({
  name: "SceneSchemePanel"
});

defineProps({
  schemeName: {
    type: String,
    default: ""
  },
  sceneSchemes: {
    type: Array,
    default: () => []
  },
  formatSchemeTime: {
    type: Function,
    default: value => value
  }
});

const emit = defineEmits([
  "update:schemeName",
  "save-scheme",
  "apply-scheme",
  "remove-scheme"
]);
</script>

<template>
  <div class="rounded border border-[var(--el-border-color)] p-3">
    <div class="mb-2 text-sm font-semibold">场景方案</div>
    <div class="mb-2 text-xs text-[var(--el-text-color-secondary)]">
      保存当前显隐树、定位方式和测点显示状态，便于后续一键恢复。
    </div>
    <div class="flex items-center gap-2">
      <el-input
        :model-value="schemeName"
        placeholder="输入方案名称，可留空自动命名"
        @update:model-value="emit('update:schemeName', $event)"
      />
      <el-button type="primary" @click="emit('save-scheme')">保存</el-button>
    </div>

    <div v-if="sceneSchemes.length > 0" class="mt-3 space-y-2">
      <div
        v-for="scheme in sceneSchemes"
        :key="scheme.id"
        class="rounded border border-[var(--el-border-color)] px-3 py-2"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold">
              {{ scheme.name }}
            </div>
            <div class="mt-1 text-xs text-[var(--el-text-color-secondary)]">
              {{ formatSchemeTime(scheme.savedAt) }} /
              {{ scheme.displayMode || "all" }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <el-button size="small" link @click="emit('apply-scheme', scheme)">
              应用
            </el-button>
            <el-button
              size="small"
              link
              @click="emit('remove-scheme', scheme.id)"
            >
              删除
            </el-button>
          </div>
        </div>
      </div>
    </div>
    <el-empty
      v-else
      description="当前模型还没有保存的场景方案"
      :image-size="68"
    />
  </div>
</template>
