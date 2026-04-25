<script setup>
import { computed } from "vue";

defineOptions({
  name: "SceneOverviewPanel"
});

const props = defineProps({
  sceneModels: {
    type: Array,
    default: () => []
  },
  sceneDevices: {
    type: Array,
    default: () => []
  },
  anchors: {
    type: Array,
    default: () => []
  },
  cameraAnchors: {
    type: Array,
    default: () => []
  },
  measurementRecords: {
    type: Array,
    default: () => []
  },
  runtimeAssetGroups: {
    type: Array,
    default: () => []
  },
  navigationMapItems: {
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
  materialTheme: {
    type: String,
    default: ""
  },
  displayModeText: {
    type: String,
    default: ""
  },
  selectedLodId: {
    type: String,
    default: ""
  },
  lodLevels: {
    type: Array,
    default: () => []
  },
  selectedObjectInfo: {
    type: Object,
    default: null
  },
  selectedDeviceUuid: {
    type: String,
    default: ""
  },
  realtimeState: {
    type: Object,
    default: () => ({})
  },
  scriptState: {
    type: Object,
    default: () => ({})
  },
  backendState: {
    type: Object,
    default: () => ({})
  },
  clippingStats: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(["refresh-navigation-map"]);

function firstText(...values) {
  return (
    values
      .map(value => String(value ?? "").trim())
      .find(value => value && value !== "-") || ""
  );
}

function firstNumber(...values) {
  const hit = values.find(value => Number.isFinite(Number(value)));
  return hit === undefined ? null : Number(hit);
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "--";
  const num = Number(value);
  if (!Number.isFinite(num)) return "--";
  if (num >= 100000000) return `${(num / 100000000).toFixed(1)}亿`;
  if (num >= 10000) return `${(num / 10000).toFixed(1)}万`;
  return num.toLocaleString();
}

function formatSize(value) {
  if (value === null || value === undefined || value === "") return "--";
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "--";
  if (num >= 1024 * 1024 * 1024) {
    return `${(num / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
  if (num >= 1024 * 1024) return `${(num / 1024 / 1024).toFixed(1)} MB`;
  if (num >= 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${num} B`;
}

const manifest = computed(
  () => props.projectPackage?.assets?.sceneManifest || {}
);

const modelStats = computed(() => {
  const manifestStats = manifest.value.stats || manifest.value.modelStats || {};
  const modelTriangles = props.sceneModels.reduce((sum, item) => {
    const raw = item?.rawDetail || item?.raw || {};
    return (
      sum +
      Number(
        item?.stats?.triangles ||
          raw?.stats?.triangles ||
          raw?.triangleCount ||
          0
      )
    );
  }, 0);
  const modelSize = props.sceneModels.reduce((sum, item) => {
    const raw = item?.rawDetail || item?.raw || {};
    return sum + Number(item?.size || raw?.size || raw?.fileSize || 0);
  }, 0);

  return {
    triangles: firstNumber(
      manifestStats.triangles,
      manifestStats.triangleCount,
      modelTriangles || null
    ),
    size: firstNumber(
      manifestStats.size,
      manifestStats.fileSize,
      modelSize || null
    )
  };
});

const activeLodLabel = computed(() => {
  if (!props.selectedLodId) return "默认";
  const lod = props.lodLevels.find(item => item.id === props.selectedLodId);
  return lod?.level || lod?.name || props.selectedLodId;
});

const selectedLabel = computed(() => {
  return firstText(
    props.selectedObjectInfo?.name,
    props.selectedObjectInfo?.uuid,
    props.selectedDeviceUuid
  );
});

const currentModelName = computed(() => {
  const active = props.sceneModels[0] || {};
  return firstText(
    active.modelName,
    active.name,
    props.projectPackage?.metadata?.modelName,
    "未加载模型"
  );
});

const statusCards = computed(() => [
  {
    key: "realtime",
    label: "实时数据",
    value: props.realtimeState?.running ? "运行中" : "未启动",
    active: Boolean(props.realtimeState?.running)
  },
  {
    key: "script",
    label: "脚本联动",
    value: props.scriptState?.running ? "运行中" : "待机",
    active: Boolean(props.scriptState?.running)
  },
  {
    key: "backend",
    label: "后端桥接",
    value: props.backendState?.running ? "在线" : "未连接",
    active: Boolean(props.backendState?.running)
  }
]);
</script>

<template>
  <div class="dd-scene-overview">
    <div class="dd-scene-tabs" aria-label="场景信息分组">
      <button type="button" class="dd-scene-tabs__item is-active">
        场景信息
      </button>
      <button type="button" class="dd-scene-tabs__item" disabled>属性</button>
      <button type="button" class="dd-scene-tabs__item" disabled>分类</button>
    </div>

    <section class="dd-inspector-section">
      <div class="dd-section-head">
        <div>
          <div class="dd-section-title">场景概览</div>
          <div class="dd-section-subtitle">当前模型、导航图与运行状态</div>
        </div>
        <button
          type="button"
          class="dd-text-action"
          @click="emit('refresh-navigation-map')"
        >
          刷新
        </button>
      </div>

      <div class="dd-scene-preview">
        <div class="dd-scene-preview__mark" />
        <div class="dd-scene-preview__title">{{ currentModelName }}</div>
        <div class="dd-scene-preview__desc">
          {{
            navigationMapItems.length
              ? `已生成 ${navigationMapItems.length} 个导航热点`
              : "暂无导航热点，可在导航面板生成或刷新"
          }}
        </div>
      </div>
    </section>

    <section class="dd-inspector-section">
      <div class="dd-section-title">场景统计</div>
      <div class="dd-stat-grid">
        <div class="dd-stat-item">
          <span>场景模型</span>
          <strong>{{ formatNumber(sceneModels.length) }}</strong>
        </div>
        <div class="dd-stat-item">
          <span>绑定设备</span>
          <strong>{{ formatNumber(sceneDevices.length) }}</strong>
        </div>
        <div class="dd-stat-item">
          <span>三角面数</span>
          <strong>{{ formatNumber(modelStats.triangles) }}</strong>
        </div>
        <div class="dd-stat-item">
          <span>模型大小</span>
          <strong>{{ formatSize(modelStats.size) }}</strong>
        </div>
        <div class="dd-stat-item">
          <span>点位</span>
          <strong>{{ formatNumber(anchors.length) }}</strong>
        </div>
        <div class="dd-stat-item">
          <span>摄像头</span>
          <strong>{{ formatNumber(cameraAnchors.length) }}</strong>
        </div>
      </div>
    </section>

    <section class="dd-inspector-section">
      <div class="dd-section-title">场景设置</div>
      <div class="dd-setting-list">
        <div class="dd-setting-row">
          <span>画质档位</span>
          <strong>{{ quality }}</strong>
        </div>
        <div class="dd-setting-row">
          <span>材质主题</span>
          <strong>{{ materialTheme || "默认" }}</strong>
        </div>
        <div class="dd-setting-row">
          <span>LOD</span>
          <strong>{{ activeLodLabel }}</strong>
        </div>
        <div class="dd-setting-row">
          <span>剖切面</span>
          <strong>{{ clippingStats.activePlaneCount || 0 }}</strong>
        </div>
      </div>
    </section>

    <section class="dd-inspector-section">
      <div class="dd-section-title">视图信息</div>
      <div class="dd-view-list">
        <div>
          <span>显示范围</span>
          <strong>{{ displayModeText || "全部构件" }}</strong>
        </div>
        <div>
          <span>资源分组</span>
          <strong>{{ runtimeAssetGroups.length }}</strong>
        </div>
        <div>
          <span>测量记录</span>
          <strong>{{ measurementRecords.length }}</strong>
        </div>
        <div>
          <span>当前选择</span>
          <strong>{{ selectedLabel || "未选择" }}</strong>
        </div>
      </div>
    </section>

    <section class="dd-runtime-strip">
      <div
        v-for="item in statusCards"
        :key="item.key"
        class="dd-runtime-card"
        :class="{ 'is-active': item.active }"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dd-scene-overview {
  display: grid;
  gap: 14px;
}

.dd-scene-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgb(226 232 240 / 84%);
}

.dd-scene-tabs__item {
  height: 32px;
  font-size: 13px;
  color: #64748b;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 9px;
}

.dd-scene-tabs__item.is-active {
  font-weight: 700;
  color: #0b73ff;
  background: #edf5ff;
}

.dd-scene-tabs__item:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.dd-inspector-section {
  padding: 16px;
  background: rgb(255 255 255 / 82%);
  border: 1px solid rgb(226 232 240 / 88%);
  border-radius: 14px;
}

.dd-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.dd-section-title {
  font-size: 15px;
  font-weight: 700;
  line-height: 20px;
  color: #172033;
}

.dd-section-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #94a3b8;
}

.dd-text-action {
  height: 26px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: #0b73ff;
  cursor: pointer;
  background: #f2f7ff;
  border: 1px solid #d7e8ff;
  border-radius: 999px;
}

.dd-scene-preview {
  display: grid;
  justify-items: center;
  min-height: 168px;
  padding: 22px 12px;
  margin-top: 14px;
  text-align: center;
  background:
    radial-gradient(circle at 50% 36%, rgb(11 115 255 / 12%), transparent 36%),
    linear-gradient(135deg, #f9fbff 0%, #eef3f8 100%);
  border: 1px solid #e5edf7;
  border-radius: 13px;
}

.dd-scene-preview__mark {
  position: relative;
  width: 76px;
  height: 60px;
  margin-top: 10px;
  opacity: 0.72;
}

.dd-scene-preview__mark::before,
.dd-scene-preview__mark::after {
  position: absolute;
  content: "";
  border-radius: 10px;
}

.dd-scene-preview__mark::before {
  inset: 22px 13px 4px;
  background: linear-gradient(180deg, #dfe7f1, #f7fafc);
  box-shadow: 0 18px 24px rgb(15 23 42 / 8%);
}

.dd-scene-preview__mark::after {
  top: 3px;
  left: 26px;
  width: 26px;
  height: 34px;
  background: linear-gradient(135deg, #eff4fb, #cfd9e7);
  clip-path: polygon(0 100%, 50% 0, 100% 100%);
}

.dd-scene-preview__title {
  max-width: 100%;
  margin-top: 8px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 700;
  color: #334155;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dd-scene-preview__desc {
  margin-top: 6px;
  font-size: 12px;
  color: #94a3b8;
}

.dd-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 18px;
  margin-top: 14px;
}

.dd-stat-item,
.dd-setting-row,
.dd-view-list > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dd-stat-item span,
.dd-setting-row span,
.dd-view-list span,
.dd-runtime-card span {
  font-size: 12px;
  color: #8a97aa;
}

.dd-stat-item strong {
  font-size: 18px;
  font-weight: 760;
  color: #172033;
}

.dd-setting-list,
.dd-view-list {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.dd-setting-row,
.dd-view-list > div {
  min-height: 28px;
}

.dd-setting-row strong,
.dd-view-list strong {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 650;
  color: #334155;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dd-runtime-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.dd-runtime-card {
  display: grid;
  gap: 4px;
  padding: 10px;
  background: #f8fafc;
  border: 1px solid #e5edf7;
  border-radius: 12px;
}

.dd-runtime-card strong {
  font-size: 13px;
  color: #64748b;
}

.dd-runtime-card.is-active {
  background: #eefdf7;
  border-color: #b7ead4;
}

.dd-runtime-card.is-active strong {
  color: #05a66b;
}
</style>
