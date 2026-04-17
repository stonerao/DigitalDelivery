<script setup>
defineOptions({
  name: "AssetGroupPanel"
});

defineProps({
  sceneModels: {
    type: Array,
    default: () => []
  },
  activeModelId: {
    type: String,
    default: ""
  },
  availableModelOptions: {
    type: Array,
    default: () => []
  },
  loadingModelOptions: {
    type: Boolean,
    default: false
  },
  groups: {
    type: Array,
    default: () => []
  },
  quality: {
    type: String,
    default: "high"
  },
  qualityOptions: {
    type: Array,
    default: () => []
  },
  materialTheme: {
    type: String,
    default: "textured-basic"
  },
  lodLevels: {
    type: Array,
    default: () => []
  },
  activeLodId: {
    type: String,
    default: ""
  }
});

const emit = defineEmits([
  "add-model",
  "select-model",
  "remove-model",
  "refresh-model-options",
  "toggle-group",
  "update:quality",
  "update:material-theme",
  "apply-lod",
  "clear-lod"
]);

const materialThemeOptions = [
  { label: "Original", value: "original" },
  { label: "Textured Basic", value: "textured-basic" },
  { label: "Basic", value: "basic" }
];
</script>

<template>
  <div class="space-y-4">
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <span class="font-semibold">场景模型</span>
          <div class="flex items-center gap-2">
            <el-button
              size="small"
              :loading="loadingModelOptions"
              @click="emit('refresh-model-options')"
            >
              刷新
            </el-button>
            <el-button type="primary" size="small" @click="emit('add-model')">
              添加模型
            </el-button>
          </div>
        </div>
      </template>

      <div v-if="sceneModels.length" class="space-y-3">
        <div
          v-for="item in sceneModels"
          :key="item.instanceId"
          class="rounded border border-[var(--el-border-color)] p-3"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="font-medium truncate">
                {{ item.modelName || item.modelId }}
              </div>
              <div
                class="mt-1 text-xs text-[var(--el-text-color-secondary)] truncate"
              >
                {{ item.modelUrl || "未配置模型 URL" }}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <el-tag
                v-if="item.modelId === activeModelId"
                size="small"
                type="primary"
              >
                当前
              </el-tag>
              <el-button
                size="small"
                :type="item.modelId === activeModelId ? 'primary' : 'default'"
                @click="emit('select-model', item.modelId)"
              >
                设为主模型
              </el-button>
              <el-button
                size="small"
                type="danger"
                plain
                @click="emit('remove-model', item)"
              >
                删除
              </el-button>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else description="当前场景还没有加载模型" :image-size="88" />

      <div
        v-if="availableModelOptions.length === 0"
        class="mt-3 text-xs text-[var(--el-text-color-secondary)]"
      >
        没有可添加的其他模型，或模型列表尚未加载。
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span class="font-semibold">质量与材质</span>
      </template>

      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div>
          <div class="mb-2 text-xs text-[var(--el-text-color-secondary)]">
            质量档
          </div>
          <el-segmented
            :model-value="quality"
            :options="qualityOptions"
            size="small"
            @change="emit('update:quality', $event)"
          />
        </div>
        <div>
          <div class="mb-2 text-xs text-[var(--el-text-color-secondary)]">
            材质主题
          </div>
          <el-segmented
            :model-value="materialTheme"
            :options="materialThemeOptions"
            size="small"
            @change="emit('update:material-theme', $event)"
          />
        </div>
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <span class="font-semibold">LOD 选择</span>
          <el-button
            v-if="activeLodId"
            size="small"
            link
            @click="emit('clear-lod')"
          >
            清除 LOD
          </el-button>
        </div>
      </template>

      <div v-if="lodLevels.length" class="space-y-3">
        <div
          v-for="lod in lodLevels"
          :key="lod.id"
          class="rounded border border-[var(--el-border-color)] p-3"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="font-medium">{{ lod.level || lod.id }}</div>
              <div class="mt-1 text-xs text-[var(--el-text-color-secondary)]">
                距离：{{ lod.distance || 0 }} /
                {{ lod.modelUrl || "未配置模型 URL" }}
              </div>
            </div>
            <el-button
              size="small"
              :type="activeLodId === lod.id ? 'primary' : 'default'"
              @click="emit('apply-lod', lod)"
            >
              {{ activeLodId === lod.id ? "已应用" : "应用" }}
            </el-button>
          </div>
        </div>
      </div>
      <el-empty v-else description="当前没有配置 LOD 资源" :image-size="88" />
    </el-card>

    <div class="space-y-3">
      <div class="text-xs text-[var(--el-text-color-secondary)]">
        按 scene-manifest 里的资源分组控制模型显隐。未配置 UUID
        清单的分组只做信息展示。
      </div>

      <div v-if="groups.length" class="space-y-3">
        <div
          v-for="group in groups"
          :key="group.id"
          class="rounded border border-[var(--el-border-color)] p-3"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="font-medium">{{ group.name || group.id }}</div>
              <div class="mt-1 text-xs text-[var(--el-text-color-secondary)]">
                {{ group.modelUrl || "未配置独立模型 URL" }}
              </div>
              <div class="mt-1 text-xs text-[var(--el-text-color-secondary)]">
                UUID 数量：{{ group.uuidCount || 0 }}
              </div>
            </div>
            <el-switch
              :model-value="group.visible !== false"
              @update:model-value="
                emit('toggle-group', { id: group.id, visible: $event })
              "
            />
          </div>
        </div>
      </div>

      <el-empty v-else description="当前没有配置资源分组" :image-size="88" />
    </div>
  </div>
</template>
