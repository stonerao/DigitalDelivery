<script setup>
import { computed } from "vue";

defineOptions({
  name: "AssetGroupPanel"
});

const props = defineProps({
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
  projectPackage: {
    type: Object,
    default: null
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
  "locate-model",
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
  { label: "Basic", value: "basic" },
  { label: "Wireframe", value: "wireframe" }
];

function firstText(...values) {
  const hit = values
    .map(value => String(value ?? "").trim())
    .find(value => value && value !== "-");
  return hit || "";
}

function formatMetaTime(value) {
  if (!value) return "-";
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
  }
  return String(value || "-");
}

function getModelRaw(item = {}) {
  return item.rawDetail || item.raw || {};
}

function getModelVersion(item = {}) {
  const raw = getModelRaw(item);
  return (
    firstText(
      raw.versionName,
      raw.version,
      raw.modelVersion,
      raw.versionNo,
      raw.revision,
      item.metadata?.versionName,
      item.metadata?.modelVersion
    ) || "未提供"
  );
}

function getModelUploader(item = {}) {
  const raw = getModelRaw(item);
  return (
    firstText(
      raw.uploadedBy,
      raw.uploadUserName,
      raw.createdBy,
      raw.updatedBy,
      item.metadata?.uploadedBy
    ) || "未提供"
  );
}

function getModelUpdatedAt(item = {}) {
  const raw = getModelRaw(item);
  return formatMetaTime(
    firstText(
      raw.updatedAt,
      raw.uploadedAt,
      raw.createdAt,
      item.metadata?.updatedAt
    )
  );
}

function getModelChangeLog(item = {}) {
  const raw = getModelRaw(item);
  return firstText(
    raw.changeLog,
    raw.changeRemark,
    raw.remark,
    raw.description,
    item.metadata?.changeLog
  );
}

const projectPackageSummary = computed(() => {
  const payload = props.projectPackage || {};
  const manifest = payload.assets?.sceneManifest || {};
  return {
    version: payload.version || "1.0.0",
    scope: payload.scope || "-",
    updatedAt: formatMetaTime(payload.updatedAt),
    modelName: payload.metadata?.modelName || "-",
    manifestVersion: manifest.manifestVersion || "1.0.0",
    modelCount: props.sceneModels.length,
    groupCount: Array.isArray(manifest.groups) ? manifest.groups.length : 0,
    lodCount: Array.isArray(manifest.lodLevels) ? manifest.lodLevels.length : 0
  };
});

const extensionCards = computed(() => {
  const extensions = props.projectPackage?.extensions || {};
  const schedule4d = extensions.schedule4d || {};
  const cost5d = extensions.cost5d || {};
  return [
    {
      key: "schedule4d",
      title: "4D 进度",
      status: schedule4d.enabled ? "已接入" : "未接入",
      enabled: Boolean(schedule4d.enabled),
      primaryLabel: "任务",
      primaryCount: Array.isArray(schedule4d.tasks)
        ? schedule4d.tasks.length
        : 0,
      bindingCount: Array.isArray(schedule4d.bindings)
        ? schedule4d.bindings.length
        : 0
    },
    {
      key: "cost5d",
      title: "5D 成本/物资",
      status: cost5d.enabled ? "已接入" : "未接入",
      enabled: Boolean(cost5d.enabled),
      primaryLabel: "条目",
      primaryCount: Array.isArray(cost5d.items) ? cost5d.items.length : 0,
      bindingCount: Array.isArray(cost5d.bindings) ? cost5d.bindings.length : 0
    }
  ];
});

const addableModelCount = computed(
  () =>
    props.availableModelOptions.filter(
      item => item?.disabled !== true && item?.loaded !== true
    ).length
);

const modelOptionHint = computed(() => {
  if (props.loadingModelOptions) return "";
  if (!props.availableModelOptions.length) return "模型列表尚未加载或为空。";
  if (!addableModelCount.value) return "所有可用模型都已添加到当前场景。";
  return "";
});
</script>

<template>
  <div class="space-y-4">
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <span class="font-semibold">场景模型</span>
          <div class="flex items-center gap-2">
            <el-tag size="small" effect="plain">
              可添加 {{ addableModelCount }}
            </el-tag>
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
              <div
                class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--el-text-color-secondary)]"
              >
                <span>版本：{{ getModelVersion(item) }}</span>
                <span>上传人：{{ getModelUploader(item) }}</span>
                <span>更新：{{ getModelUpdatedAt(item) }}</span>
              </div>
              <div
                v-if="getModelChangeLog(item)"
                class="mt-1 text-xs text-[var(--el-text-color-secondary)] line-clamp-2"
              >
                变更：{{ getModelChangeLog(item) }}
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
              <el-button size="small" @click="emit('locate-model', item)">
                定位
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
        v-if="modelOptionHint"
        class="mt-3 text-xs text-[var(--el-text-color-secondary)]"
      >
        {{ modelOptionHint }}
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <span class="font-semibold">发布包信息</span>
          <el-tag size="small" effect="plain">
            v{{ projectPackageSummary.version }}
          </el-tag>
        </div>
      </template>

      <el-descriptions :column="1" size="small" border>
        <el-descriptions-item label="作用域">
          {{ projectPackageSummary.scope }}
        </el-descriptions-item>
        <el-descriptions-item label="关联模型">
          {{ projectPackageSummary.modelName }}
        </el-descriptions-item>
        <el-descriptions-item label="更新时间">
          {{ projectPackageSummary.updatedAt }}
        </el-descriptions-item>
        <el-descriptions-item label="Manifest">
          {{ projectPackageSummary.manifestVersion }}
        </el-descriptions-item>
        <el-descriptions-item label="资源统计">
          模型 {{ projectPackageSummary.modelCount }} / 分组
          {{ projectPackageSummary.groupCount }} / LOD
          {{ projectPackageSummary.lodCount }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span class="font-semibold">质量与材质</span>
      </template>

      <div class="flex flex-col gap-4">
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

    <el-card shadow="never">
      <template #header>
        <span class="font-semibold">4D/5D 扩展位</span>
      </template>

      <div class="grid grid-cols-1 gap-3">
        <div
          v-for="item in extensionCards"
          :key="item.key"
          class="rounded border border-[var(--el-border-color)] p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="font-medium">{{ item.title }}</div>
            <el-tag
              size="small"
              effect="plain"
              :type="item.enabled ? 'success' : 'info'"
            >
              {{ item.status }}
            </el-tag>
          </div>
          <div class="mt-2 text-xs text-[var(--el-text-color-secondary)]">
            {{ item.primaryLabel }} {{ item.primaryCount }} / 构件绑定
            {{ item.bindingCount }}
          </div>
        </div>
      </div>
      <div class="mt-3 text-xs text-[var(--el-text-color-secondary)]">
        仅预留 4D 进度和 5D 成本/物资数据入口；本批不预留 GIS 扩展。
      </div>
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
