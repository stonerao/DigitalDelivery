<script setup>
import { computed } from "vue";
import { VIEWER_MATERIAL_THEME_OPTIONS } from "../services/viewerToolbarConfig";

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

const defaultQualityOptions = [
  { label: "高", value: "high" },
  { label: "中", value: "medium" },
  { label: "低", value: "low" },
  { label: "平面渲染", value: "plane" }
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

function normalizeChoiceOption(option) {
  if (option && typeof option === "object") {
    const value = String(option.value ?? option.label ?? "").trim();
    const label = String(option.label ?? option.name ?? option.value ?? "").trim();
    return value ? { label: label || value, value } : null;
  }
  const value = String(option ?? "").trim();
  return value ? { label: value, value } : null;
}

const normalizedQualityOptions = computed(() => {
  const source = props.qualityOptions?.length
    ? props.qualityOptions
    : defaultQualityOptions;
  return source.map(normalizeChoiceOption).filter(Boolean);
});

const normalizedMaterialThemeOptions = computed(() =>
  VIEWER_MATERIAL_THEME_OPTIONS.map(normalizeChoiceOption).filter(Boolean)
);
</script>

<template>
  <div class="dd-assets-module">
    <section class="dd-assets-section">
      <header class="dd-assets-section__head">
        <h3>场景模型</h3>
        <div class="dd-assets-actions">
          <span class="dd-assets-pill">可添加 {{ addableModelCount }}</span>
          <button
            type="button"
            class="dd-assets-btn"
            :disabled="loadingModelOptions"
            @click="emit('refresh-model-options')"
          >
            {{ loadingModelOptions ? "刷新中" : "刷新" }}
          </button>
          <button
            type="button"
            class="dd-assets-btn is-primary"
            @click="emit('add-model')"
          >
            添加模型
          </button>
        </div>
      </header>

      <div v-if="sceneModels.length" class="dd-assets-list">
        <article
          v-for="item in sceneModels"
          :key="item.instanceId"
          class="dd-model-card"
          :class="{ 'is-active': item.modelId === activeModelId }"
        >
          <div class="dd-model-card__top">
            <div class="dd-model-card__main">
              <strong>{{ item.modelName || item.modelId }}</strong>
              <span>{{ item.modelUrl || "未配置模型 URL" }}</span>
            </div>
            <span
              v-if="item.modelId === activeModelId"
              class="dd-assets-pill is-blue"
            >
              当前
            </span>
          </div>

          <dl class="dd-model-meta">
            <div>
              <dt>版本</dt>
              <dd>{{ getModelVersion(item) }}</dd>
            </div>
            <div>
              <dt>上传人</dt>
              <dd>{{ getModelUploader(item) }}</dd>
            </div>
            <div>
              <dt>更新</dt>
              <dd>{{ getModelUpdatedAt(item) }}</dd>
            </div>
          </dl>

          <p v-if="getModelChangeLog(item)" class="dd-assets-note">
            变更：{{ getModelChangeLog(item) }}
          </p>

          <div class="dd-model-card__actions">
            <button
              type="button"
              class="dd-assets-btn"
              :class="{ 'is-primary': item.modelId === activeModelId }"
              @click="emit('select-model', item.modelId)"
            >
              设为主模型
            </button>
            <button
              type="button"
              class="dd-assets-btn"
              @click="emit('locate-model', item)"
            >
              定位
            </button>
            <button
              type="button"
              class="dd-assets-btn is-danger"
              @click="emit('remove-model', item)"
            >
              删除
            </button>
          </div>
        </article>
      </div>
      <el-empty v-else description="当前场景还没有加载模型" :image-size="88" />

      <p v-if="modelOptionHint" class="dd-assets-note">
        {{ modelOptionHint }}
      </p>
    </section>

    <section class="dd-assets-section">
      <header class="dd-assets-section__head">
        <h3>发布包信息</h3>
        <span class="dd-assets-pill is-blue">v{{ projectPackageSummary.version }}</span>
      </header>

      <dl class="dd-assets-kv">
        <div>
          <dt>作用域</dt>
          <dd>{{ projectPackageSummary.scope }}</dd>
        </div>
        <div>
          <dt>关联模型</dt>
          <dd>{{ projectPackageSummary.modelName }}</dd>
        </div>
        <div>
          <dt>更新时间</dt>
          <dd>{{ projectPackageSummary.updatedAt }}</dd>
        </div>
        <div>
          <dt>Manifest</dt>
          <dd>{{ projectPackageSummary.manifestVersion }}</dd>
        </div>
        <div>
          <dt>资源统计</dt>
          <dd>
            模型 {{ projectPackageSummary.modelCount }} / 分组
            {{ projectPackageSummary.groupCount }} / LOD
            {{ projectPackageSummary.lodCount }}
          </dd>
        </div>
      </dl>
    </section>

    <section class="dd-assets-section">
      <header class="dd-assets-section__head">
        <h3>质量与材质</h3>
      </header>

      <div class="dd-choice-block">
        <span class="dd-assets-label">质量档</span>
        <div class="dd-choice-grid">
          <button
            v-for="item in normalizedQualityOptions"
            :key="item.value"
            type="button"
            class="dd-choice"
            :class="{ 'is-active': quality === item.value }"
            :aria-pressed="quality === item.value"
            @click="emit('update:quality', item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div class="dd-choice-block">
        <span class="dd-assets-label">材质主题</span>
        <div class="dd-choice-grid">
          <button
            v-for="item in normalizedMaterialThemeOptions"
            :key="item.value"
            type="button"
            class="dd-choice"
            :class="{ 'is-active': materialTheme === item.value }"
            :aria-pressed="materialTheme === item.value"
            @click="emit('update:material-theme', item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </section>

    <section class="dd-assets-section">
      <header class="dd-assets-section__head">
        <h3>LOD 选择</h3>
        <button
          v-if="activeLodId"
          type="button"
          class="dd-assets-text-btn"
          @click="emit('clear-lod')"
        >
          清除 LOD
        </button>
      </header>

      <div v-if="lodLevels.length" class="dd-assets-list">
        <article
          v-for="lod in lodLevels"
          :key="lod.id"
          class="dd-plain-card"
        >
          <div class="dd-plain-card__body">
            <strong>{{ lod.level || lod.id }}</strong>
            <span>距离：{{ lod.distance || 0 }} / {{ lod.modelUrl || "未配置模型 URL" }}</span>
          </div>
          <button
            type="button"
            class="dd-assets-btn"
            :class="{ 'is-primary': activeLodId === lod.id }"
            @click="emit('apply-lod', lod)"
          >
            {{ activeLodId === lod.id ? "已应用" : "应用" }}
          </button>
        </article>
      </div>
      <el-empty v-else description="当前没有配置 LOD 资源" :image-size="88" />
    </section>

    <section class="dd-assets-section">
      <header class="dd-assets-section__head">
        <h3>资源分组</h3>
      </header>
      <p class="dd-assets-note">
        按 scene-manifest 里的资源分组控制模型显隐。未配置 UUID
        清单的分组只做信息展示。
      </p>

      <div v-if="groups.length" class="dd-assets-list">
        <article
          v-for="group in groups"
          :key="group.id"
          class="dd-plain-card"
        >
          <div class="dd-plain-card__body">
            <strong>{{ group.name || group.id }}</strong>
            <span>{{ group.modelUrl || "未配置独立模型 URL" }}</span>
            <span>UUID 数量：{{ group.uuidCount || 0 }}</span>
          </div>
          <el-switch
            :model-value="group.visible !== false"
            @update:model-value="
              emit('toggle-group', { id: group.id, visible: $event })
            "
          />
        </article>
      </div>

      <el-empty v-else description="当前没有配置资源分组" :image-size="88" />
    </section>
  </div>
</template>

<style scoped>
.dd-assets-module {
  display: grid;
  min-width: 0;
  gap: 18px;
  overflow-x: hidden;
  color: #172033;
}

.dd-assets-section {
  min-width: 0;
}

.dd-assets-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  gap: 10px;
  margin-bottom: 10px;
}

.dd-assets-section__head h3 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 15px;
  font-weight: 760;
  line-height: 1.35;
  color: #172033;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dd-assets-actions {
  display: flex;
  flex: 0 1 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  min-width: 0;
  gap: 7px;
}

.dd-assets-btn,
.dd-assets-text-btn,
.dd-choice {
  appearance: none;
  font: inherit;
  cursor: pointer;
  border: 0;
}

.dd-assets-btn {
  min-height: 28px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 650;
  line-height: 28px;
  color: #42526b;
  background: #ffffff;
  border: 1px solid #d9e2ee;
  border-radius: 7px;
  transition:
    color 0.16s ease,
    background-color 0.16s ease,
    border-color 0.16s ease;
}

.dd-assets-btn:hover {
  color: #0b73ff;
  border-color: #bfd8ff;
  background: #f7fbff;
}

.dd-assets-btn:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.dd-assets-btn.is-primary {
  color: #ffffff;
  border-color: #0b73ff;
  background: #0b73ff;
}

.dd-assets-btn.is-danger {
  color: #f05252;
  border-color: #ffd7d7;
  background: #fff8f8;
}

.dd-assets-text-btn {
  padding: 0;
  font-size: 12px;
  font-weight: 680;
  color: #64748b;
  background: transparent;
}

.dd-assets-text-btn:hover {
  color: #0b73ff;
}

.dd-assets-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  min-height: 24px;
  padding: 0 9px;
  overflow: hidden;
  font-size: 12px;
  font-weight: 680;
  line-height: 1;
  color: #64748b;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #f8fafc;
  border: 1px solid #d9e2ee;
  border-radius: 999px;
}

.dd-assets-pill.is-blue {
  color: #0b73ff;
  background: #f2f7ff;
  border-color: #cfe1ff;
}

.dd-assets-pill.is-success {
  color: #059669;
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.dd-assets-list {
  display: grid;
  min-width: 0;
  gap: 10px;
}

.dd-model-card,
.dd-plain-card {
  min-width: 0;
  padding: 12px;
  background: rgb(255 255 255 / 48%);
  border: 1px solid #e5edf7;
  border-radius: 10px;
}

.dd-model-card.is-active {
  background: #f6faff;
  border-color: #cfe1ff;
}

.dd-model-card__top,
.dd-plain-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.dd-model-card__main,
.dd-plain-card__body {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.dd-model-card__main strong,
.dd-plain-card__body strong {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 720;
  line-height: 1.35;
  color: #172033;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dd-model-card__main span,
.dd-plain-card__body span,
.dd-assets-note {
  min-width: 0;
  font-size: 12px;
  line-height: 1.55;
  color: #718096;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.dd-model-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 10px 0 0;
}

.dd-model-meta div {
  min-width: 0;
}

.dd-model-meta dt {
  margin: 0 0 2px;
  font-size: 11px;
  color: #94a3b8;
}

.dd-model-meta dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 12px;
  color: #42526b;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dd-model-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 11px;
}

.dd-assets-note {
  margin: 9px 0 0;
}

.dd-assets-kv {
  display: grid;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  border: 1px solid #e5edf7;
  border-radius: 9px;
}

.dd-assets-kv div {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  min-width: 0;
}

.dd-assets-kv div + div {
  border-top: 1px solid #edf2f7;
}

.dd-assets-kv dt,
.dd-assets-kv dd {
  min-width: 0;
  margin: 0;
  padding: 9px 10px;
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.dd-assets-kv dt {
  font-weight: 700;
  color: #64748b;
  background: #f8fafc;
}

.dd-assets-kv dd {
  color: #334155;
  border-left: 1px solid #edf2f7;
}

.dd-choice-block {
  display: grid;
  min-width: 0;
  gap: 8px;
}

.dd-choice-block + .dd-choice-block {
  margin-top: 14px;
}

.dd-assets-label {
  font-size: 12px;
  font-weight: 680;
  color: #718096;
}

.dd-choice-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
  width: 100%;
  min-width: 0;
  gap: 7px;
}

.dd-choice {
  min-width: 0;
  min-height: 30px;
  padding: 0 8px;
  overflow: hidden;
  font-size: 12px;
  font-weight: 680;
  line-height: 30px;
  color: #53627a;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #f3f7fc;
  border: 1px solid #e5edf7;
  border-radius: 8px;
  transition:
    color 0.16s ease,
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.dd-choice:hover {
  color: #0b73ff;
  border-color: #cfe1ff;
}

.dd-choice.is-active {
  color: #0b73ff;
  background: #ffffff;
  border-color: #bfd8ff;
  box-shadow: 0 0 0 2px rgb(11 115 255 / 8%);
}

:deep(.el-empty) {
  padding: 36px 0;
}

@media (width <= 1320px) {
  .dd-model-meta {
    grid-template-columns: 1fr;
  }

  .dd-model-card__top,
  .dd-plain-card {
    align-items: stretch;
    flex-direction: column;
  }

  .dd-assets-section__head {
    align-items: flex-start;
    flex-direction: column;
  }

  .dd-assets-actions {
    justify-content: flex-start;
  }
}
</style>
