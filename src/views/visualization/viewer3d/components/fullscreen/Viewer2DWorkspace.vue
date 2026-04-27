<script setup>
import { computed } from "vue";
import {
  Aim,
  Camera,
  CollectionTag,
  Crop,
  Pointer,
  Position,
  RefreshRight,
  ScaleToOriginal,
  View
} from "@element-plus/icons-vue";
import NavigationPanel from "../../panels/NavigationPanel.vue";
import SceneSchemePanel from "../../panels/SceneSchemePanel.vue";
import DevicePanel from "../../panels/DevicePanel.vue";
import SceneAnchorPanel from "../../panels/SceneAnchorPanel.vue";
import MeasurementPanel from "../../panels/MeasurementPanel.vue";
import AssetGroupPanel from "../../panels/AssetGroupPanel.vue";
import RuntimeLinkagePanel from "../../panels/RuntimeLinkagePanel.vue";
import StructurePanel from "../../panels/StructurePanel.vue";
import SceneOverviewPanel from "../../panels/SceneOverviewPanel.vue";

const props = defineProps({
  showSidePanel: {
    type: Boolean,
    default: true
  },
  activeSideTab: {
    type: String,
    default: "navigation"
  },
  sceneTree: {
    type: Object,
    default: null
  },
  treeV2Props: {
    type: Object,
    default: () => ({})
  },
  treeDefaultExpandedKeys: {
    type: Array,
    default: () => []
  },
  treeFilterText: {
    type: String,
    default: ""
  },
  structureModelTypeFilter: {
    type: String,
    default: "all"
  },
  structureModelTypeOptions: {
    type: Array,
    default: () => []
  },
  structureFilterMethod: {
    type: Function,
    default: () => true
  },
  selectedTreeNode: {
    type: Object,
    default: null
  },
  structureBindingMap: {
    type: Object,
    default: () => ({})
  },
  meshOpacity: {
    type: Number,
    default: 0.2
  },
  navigationTreeData: {
    type: Array,
    default: () => []
  },
  currentNavNodeKey: {
    type: String,
    default: ""
  },
  selectedSystemNodeId: {
    type: String,
    default: ""
  },
  selectedQuickKks: {
    type: String,
    default: ""
  },
  sceneDeviceSystemOptions: {
    type: Array,
    default: () => []
  },
  sceneDeviceKksOptions: {
    type: Array,
    default: () => []
  },
  navigationSnapshot: {
    type: Object,
    default: null
  },
  navigationSnapshotLoading: {
    type: Boolean,
    default: false
  },
  navigationMapItems: {
    type: Array,
    default: () => []
  },
  navigationMapActiveId: {
    type: String,
    default: ""
  },
  navigationMapDisabled: {
    type: Boolean,
    default: false
  },
  layerTreeData: {
    type: Array,
    default: () => []
  },
  layerCheckedKeys: {
    type: Array,
    default: () => []
  },
  displayMode: {
    type: String,
    default: ""
  },
  displayModeText: {
    type: String,
    default: ""
  },
  schemeName: {
    type: String,
    default: ""
  },
  sceneSchemes: {
    type: Array,
    default: () => []
  },
  filteredSceneDevices: {
    type: Array,
    default: () => []
  },
  deviceKeyword: {
    type: String,
    default: ""
  },
  selectedDeviceUuid: {
    type: String,
    default: ""
  },
  anchors: {
    type: Array,
    default: () => []
  },
  selectedAnchorId: {
    type: String,
    default: ""
  },
  anchorMarkersVisible: {
    type: Boolean,
    default: true
  },
  cameraAnchors: {
    type: Array,
    default: () => []
  },
  selectedCameraId: {
    type: String,
    default: ""
  },
  cameraMarkersVisible: {
    type: Boolean,
    default: true
  },
  measurementRecords: {
    type: Array,
    default: () => []
  },
  measurementMode: {
    type: String,
    default: ""
  },
  measurementModeOptions: {
    type: Array,
    default: () => []
  },
  sceneModels: {
    type: Array,
    default: () => []
  },
  activeSceneModelId: {
    type: String,
    default: ""
  },
  runtimeAssetGroups: {
    type: Array,
    default: () => []
  },
  projectPackage: {
    type: Object,
    default: null
  },
  selectableModelOptions: {
    type: Array,
    default: () => []
  },
  loadingModelOptions: {
    type: Boolean,
    default: false
  },
  quality: {
    type: String,
    default: "high"
  },
  qualityModeOptions: {
    type: Array,
    default: () => []
  },
  materialTheme: {
    type: String,
    default: ""
  },
  lodLevels: {
    type: Array,
    default: () => []
  },
  selectedLodId: {
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
  },
  runtimeLogs: {
    type: Array,
    default: () => []
  },
  formatSchemeTime: {
    type: Function,
    required: true
  }
});

const emit = defineEmits([
  "structure-tree-ref-change",
  "layer-tree-ref-change",
  "update:activeSideTab",
  "refresh-tree",
  "update:treeFilterText",
  "update:structureModelTypeFilter",
  "tree-node-click",
  "tree-node-expand",
  "tree-node-collapse",
  "focus-selected-node",
  "make-selected-mesh-transparent",
  "restore-selected-mesh-opacity",
  "isolate-selected-node",
  "show-all-objects",
  "hide-selected-node",
  "restore-hidden-objects",
  "update:meshOpacity",
  "navigation-node-click",
  "navigation-node-contextmenu",
  "update:selectedSystemNodeId",
  "update:selectedQuickKks",
  "navigation-map-select",
  "refresh-navigation-map",
  "locate-system",
  "locate-by-kks",
  "apply-display-mode",
  "layer-tree-check",
  "update:schemeName",
  "save-scheme",
  "apply-scheme",
  "remove-scheme",
  "update:deviceKeyword",
  "locate-device",
  "isolate-device",
  "update:anchorMarkersVisible",
  "add-anchor",
  "select-anchor",
  "edit-anchor",
  "remove-anchor",
  "update:cameraMarkersVisible",
  "add-camera",
  "select-camera",
  "edit-camera",
  "remove-camera",
  "update:measurementMode",
  "focus-record",
  "toggle-record-visible",
  "remove-record",
  "clear-records",
  "export-records",
  "add-model",
  "select-model",
  "locate-model",
  "remove-model",
  "refresh-model-options",
  "toggle-group",
  "update:quality",
  "update:materialTheme",
  "apply-lod",
  "clear-lod",
  "restart-realtime",
  "run-manual-trigger",
  "send-backend-command",
  "clear-logs"
]);

const panelTabs = [
  { name: "scene", label: "场景", icon: View },
  { name: "structure", label: "结构", icon: ScaleToOriginal },
  { name: "navigation", label: "导航", icon: Position },
  { name: "devices", label: "设备", icon: Aim },
  { name: "anchors", label: "点位", icon: Pointer },
  { name: "cameras", label: "摄像头", icon: Camera },
  { name: "measurements", label: "测量", icon: Crop },
  { name: "assets", label: "资产", icon: CollectionTag },
  { name: "runtime", label: "联动", icon: RefreshRight }
];

const activePanelName = computed(() => {
  return panelTabs.some(item => item.name === props.activeSideTab)
    ? props.activeSideTab
    : "scene";
});

function selectPanel(name) {
  emit("update:activeSideTab", name);
}

function handleLayerTreeRefChange(instance) {
  emit("layer-tree-ref-change", instance || null);
}

function handleStructureTreeRefChange(instance) {
  emit("structure-tree-ref-change", instance || null);
}

function handleNavigationNodeContextmenu(...args) {
  emit("navigation-node-contextmenu", ...args);
}
</script>

<template>
  <div v-show="showSidePanel" class="dd-side-panel">
    <section class="dd-side-panel__content">
      <SceneOverviewPanel
        v-if="activePanelName === 'scene'"
        :scene-models="sceneModels"
        :scene-devices="filteredSceneDevices"
        :anchors="anchors"
        :camera-anchors="cameraAnchors"
        :measurement-records="measurementRecords"
        :runtime-asset-groups="runtimeAssetGroups"
        :navigation-map-items="navigationMapItems"
        :project-package="projectPackage"
        :quality="quality"
        :material-theme="materialTheme"
        :display-mode-text="displayModeText"
        :selected-lod-id="selectedLodId"
        :lod-levels="lodLevels"
        :selected-device-uuid="selectedDeviceUuid"
        :realtime-state="realtimeState"
        :script-state="scriptState"
        :backend-state="backendState"
        :clipping-stats="clippingStats"
        @refresh-navigation-map="emit('refresh-navigation-map')"
      />

      <StructurePanel
        v-else-if="activePanelName === 'structure'"
        :ref="handleStructureTreeRefChange"
        :scene-tree="sceneTree"
        :tree-v2-props="treeV2Props"
        :tree-default-expanded-keys="treeDefaultExpandedKeys"
        :tree-filter-text="treeFilterText"
        :model-type-filter="structureModelTypeFilter"
        :model-type-options="structureModelTypeOptions"
        :filter-method="structureFilterMethod"
        :selected-tree-node="selectedTreeNode"
        :binding-status-map="structureBindingMap"
        :mesh-opacity="meshOpacity"
        :active="activePanelName === 'structure'"
        @refresh-tree="emit('refresh-tree')"
        @update:tree-filter-text="emit('update:treeFilterText', $event)"
        @update:model-type-filter="
          emit('update:structureModelTypeFilter', $event)
        "
        @tree-node-click="emit('tree-node-click', $event)"
        @tree-node-expand="emit('tree-node-expand', $event)"
        @tree-node-collapse="emit('tree-node-collapse', $event)"
        @focus-selected-node="emit('focus-selected-node')"
        @make-selected-mesh-transparent="emit('make-selected-mesh-transparent')"
        @restore-selected-mesh-opacity="emit('restore-selected-mesh-opacity')"
        @isolate-selected-node="emit('isolate-selected-node')"
        @show-all-objects="emit('show-all-objects')"
        @hide-selected-node="emit('hide-selected-node')"
        @restore-hidden-objects="emit('restore-hidden-objects')"
        @update:mesh-opacity="emit('update:meshOpacity', $event)"
      />

      <div v-else-if="activePanelName === 'navigation'" class="dd-panel-stack">
        <NavigationPanel
          :ref="handleLayerTreeRefChange"
          :navigation-tree-data="navigationTreeData"
          :current-nav-node-key="currentNavNodeKey"
          :selected-system-node-id="selectedSystemNodeId"
          :selected-quick-kks="selectedQuickKks"
          :scene-device-system-options="sceneDeviceSystemOptions"
          :scene-device-kks-options="sceneDeviceKksOptions"
          :navigation-snapshot="navigationSnapshot"
          :navigation-snapshot-loading="navigationSnapshotLoading"
          :navigation-map-items="navigationMapItems"
          :navigation-map-active-id="navigationMapActiveId"
          :navigation-map-disabled="navigationMapDisabled"
          :layer-tree-data="layerTreeData"
          :layer-checked-keys="layerCheckedKeys"
          :display-mode="displayMode"
          :display-mode-text="displayModeText"
          @navigation-node-click="emit('navigation-node-click', $event)"
          @navigation-node-contextmenu="handleNavigationNodeContextmenu"
          @update:selected-system-node-id="
            emit('update:selectedSystemNodeId', $event)
          "
          @update:selected-quick-kks="emit('update:selectedQuickKks', $event)"
          @navigation-map-select="emit('navigation-map-select', $event)"
          @refresh-navigation-map="emit('refresh-navigation-map')"
          @locate-system="emit('locate-system')"
          @locate-by-kks="emit('locate-by-kks')"
          @apply-display-mode="emit('apply-display-mode', $event)"
          @layer-tree-check="emit('layer-tree-check')"
        />

        <SceneSchemePanel
          :scheme-name="schemeName"
          :scene-schemes="sceneSchemes"
          :format-scheme-time="formatSchemeTime"
          @update:scheme-name="emit('update:schemeName', $event)"
          @save-scheme="emit('save-scheme')"
          @apply-scheme="emit('apply-scheme', $event)"
          @remove-scheme="emit('remove-scheme', $event)"
        />
      </div>

      <DevicePanel
        v-else-if="activePanelName === 'devices'"
        :device-keyword="deviceKeyword"
        :filtered-scene-devices="filteredSceneDevices"
        :selected-device-uuid="selectedDeviceUuid"
        @update:device-keyword="emit('update:deviceKeyword', $event)"
        @locate-device="emit('locate-device', $event)"
        @isolate-device="emit('isolate-device', $event)"
      />

      <SceneAnchorPanel
        v-else-if="activePanelName === 'anchors'"
        title="场景点位"
        kind="anchor"
        :items="anchors"
        :selected-id="selectedAnchorId"
        :visible="anchorMarkersVisible"
        empty-text="当前模型暂无点位"
        @toggle-visible="emit('update:anchorMarkersVisible', $event)"
        @add-item="emit('add-anchor')"
        @select-item="emit('select-anchor', $event)"
        @edit-item="emit('edit-anchor', $event)"
        @remove-item="emit('remove-anchor', $event)"
      />

      <SceneAnchorPanel
        v-else-if="activePanelName === 'cameras'"
        title="摄像头点位"
        kind="camera"
        :items="cameraAnchors"
        :selected-id="selectedCameraId"
        :visible="cameraMarkersVisible"
        empty-text="当前模型暂无摄像头点位"
        @toggle-visible="emit('update:cameraMarkersVisible', $event)"
        @add-item="emit('add-camera')"
        @select-item="emit('select-camera', $event)"
        @edit-item="emit('edit-camera', $event)"
        @remove-item="emit('remove-camera', $event)"
      />

      <MeasurementPanel
        v-else-if="activePanelName === 'measurements'"
        :measurement-records="measurementRecords"
        :measurement-mode="measurementMode"
        :measurement-mode-options="measurementModeOptions"
        @update:measurement-mode="emit('update:measurementMode', $event)"
        @focus-record="emit('focus-record', $event)"
        @toggle-record-visible="emit('toggle-record-visible', $event)"
        @remove-record="emit('remove-record', $event)"
        @clear-records="emit('clear-records')"
        @export-records="emit('export-records')"
      />

      <AssetGroupPanel
        v-else-if="activePanelName === 'assets'"
        :scene-models="sceneModels"
        :active-model-id="activeSceneModelId"
        :groups="runtimeAssetGroups"
        :project-package="projectPackage"
        :available-model-options="selectableModelOptions"
        :loading-model-options="loadingModelOptions"
        :quality="quality"
        :quality-options="qualityModeOptions"
        :material-theme="materialTheme"
        :lod-levels="lodLevels"
        :active-lod-id="selectedLodId"
        @add-model="emit('add-model')"
        @select-model="emit('select-model', $event)"
        @locate-model="emit('locate-model', $event)"
        @remove-model="emit('remove-model', $event)"
        @refresh-model-options="emit('refresh-model-options')"
        @toggle-group="emit('toggle-group', $event)"
        @update:quality="emit('update:quality', $event)"
        @update:material-theme="emit('update:materialTheme', $event)"
        @apply-lod="emit('apply-lod', $event)"
        @clear-lod="emit('clear-lod')"
      />

      <RuntimeLinkagePanel
        v-else-if="activePanelName === 'runtime'"
        :realtime-state="realtimeState"
        :script-state="scriptState"
        :backend-state="backendState"
        :runtime-logs="runtimeLogs"
        @restart-realtime="emit('restart-realtime')"
        @run-manual-trigger="emit('run-manual-trigger', $event)"
        @send-backend-command="emit('send-backend-command', $event)"
        @clear-logs="emit('clear-logs')"
      />
    </section>

    <nav class="dd-side-panel__rail" aria-label="三维功能面板">
      <button
        v-for="item in panelTabs"
        :key="item.name"
        type="button"
        class="dd-rail-item"
        :class="{ 'is-active': activePanelName === item.name }"
        @click="selectPanel(item.name)"
      >
        <el-icon class="dd-rail-item__icon">
          <component :is="item.icon" />
        </el-icon>
        <span>{{ item.label }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.dd-side-panel {
  position: fixed;
  top: var(--dd-panels-top);
  right: var(--dd-gap);
  bottom: var(--dd-bottom-reserve);
  z-index: 1100;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 62px;
  gap: 10px;
  width: var(--dd-panel-width);
}

.dd-side-panel__content,
.dd-side-panel__rail {
  background: rgb(255 255 255 / 84%);
  border: 1px solid rgb(226 232 240 / 82%);
  box-shadow: 0 20px 55px rgb(15 23 42 / 12%);
  backdrop-filter: blur(18px) saturate(150%);
}

.dd-side-panel__content {
  min-width: 0;
  height: 100%;
  padding: 18px;
  overflow: hidden auto;
  border-radius: 15px;
}

.dd-side-panel__content::-webkit-scrollbar {
  width: 4px;
}

.dd-side-panel__content::-webkit-scrollbar-thumb {
  background: rgb(148 163 184 / 64%);
  border-radius: 999px;
}

.dd-side-panel__rail {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  height: max-content;
  max-height: 100%;
  padding: 8px 6px;
  overflow: hidden auto;
  border-radius: 14px;
}

.dd-side-panel__rail::-webkit-scrollbar {
  width: 0;
}

.dd-rail-item {
  display: grid;
  gap: 6px;
  place-items: center;
  min-height: 62px;
  padding: 8px 2px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  color: #415169;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 12px;
  transition:
    color 0.18s ease,
    background-color 0.18s ease,
    transform 0.18s ease;
}

.dd-rail-item:hover {
  color: #0b73ff;
  background: #f2f7ff;
}

.dd-rail-item.is-active {
  color: #0b73ff;
  background: linear-gradient(180deg, #edf5ff, #f7fbff);
  box-shadow: inset 0 0 0 1px #d7e8ff;
}

.dd-rail-item__icon {
  font-size: 18px;
}

.dd-panel-stack {
  display: grid;
  gap: 16px;
}

.dd-side-panel__content :deep(.el-card) {
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.dd-side-panel__content :deep(.el-card__header) {
  padding: 0 0 10px;
  border-bottom: 0;
}

.dd-side-panel__content :deep(.el-card__body) {
  padding: 0;
}

.dd-side-panel__content :deep(.font-semibold.text-sm),
.dd-side-panel__content :deep(.text-sm.font-semibold),
.dd-side-panel__content :deep(.font-semibold) {
  color: #172033;
  font-weight: 760;
}

.dd-side-panel__content :deep(.text-\[var\(--el-text-color-secondary\)\]),
.dd-side-panel__content :deep(.el-tree-node__label) {
  color: #718096;
}

.dd-side-panel__content :deep(.el-input__wrapper),
.dd-side-panel__content :deep(.el-select__wrapper) {
  min-height: 32px;
  background: rgb(255 255 255 / 72%);
  border-radius: 7px;
  box-shadow: 0 0 0 1px #d9e2ee inset;
}

.dd-side-panel__content :deep(.el-input__wrapper:hover),
.dd-side-panel__content :deep(.el-select__wrapper:hover),
.dd-side-panel__content :deep(.el-input__wrapper.is-focus),
.dd-side-panel__content :deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 1px #9fc8ff inset;
}

.dd-side-panel__content :deep(.el-input__inner),
.dd-side-panel__content :deep(.el-select__placeholder),
.dd-side-panel__content :deep(.el-select__selected-item) {
  font-size: 13px;
}

.dd-side-panel__content :deep(.el-button.is-link) {
  height: 28px;
  padding: 0 2px;
  font-weight: 650;
  color: #64748b;
}

.dd-side-panel__content :deep(.el-button.is-link:hover) {
  color: #0b73ff;
}

.dd-side-panel__content :deep(.el-button:not(.is-link)) {
  border-color: #d9e2ee;
  border-radius: 7px;
  box-shadow: none;
}

.dd-side-panel__content :deep(.el-button--primary) {
  border-color: #0b73ff;
  background: #0b73ff;
}

.dd-side-panel__content :deep(.el-tree),
.dd-side-panel__content :deep(.el-vl__wrapper) {
  color: #334155;
  background: transparent;
}

.dd-side-panel__content :deep(.el-tree-node__content),
.dd-side-panel__content :deep(.el-tree-v2__node) {
  min-height: 32px;
  border-radius: 8px;
}

.dd-side-panel__content :deep(.el-tree-node__content:hover),
.dd-side-panel__content :deep(.el-tree-v2__node:hover) {
  background: #f2f7ff;
}

.dd-side-panel__content :deep(.el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content),
.dd-side-panel__content :deep(.el-tree-v2__node.is-current) {
  color: #0b73ff;
  background: #edf5ff;
}

.dd-side-panel__content :deep(.rounded.border) {
  background: transparent;
  border-color: #e5edf7;
  border-radius: 10px;
}

.dd-side-panel__content :deep(.cursor-pointer.rounded.border) {
  background: rgb(255 255 255 / 42%);
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.dd-side-panel__content :deep(.cursor-pointer.rounded.border:hover) {
  background: #f6faff;
  border-color: #c6dcff;
}

.dd-side-panel__content :deep(.el-tag) {
  border-radius: 999px;
}

.dd-side-panel__content :deep(.el-empty) {
  padding: 42px 0;
}

.dd-side-panel__content :deep(.el-empty__description p) {
  color: #94a3b8;
}

.dd-side-panel__content :deep(.el-segmented) {
  --el-segmented-bg-color: #f3f7fc;
  --el-segmented-item-selected-bg-color: #ffffff;
  --el-segmented-item-selected-color: #0b73ff;
  padding: 3px;
  border: 1px solid #e5edf7;
  border-radius: 9px;
}

.dd-side-panel__content :deep(.el-scrollbar__view) {
  min-height: 100%;
}

@media (width <= 1200px) {
  .dd-side-panel {
    grid-template-columns: minmax(0, 1fr);
    width: min(420px, calc(100vw - 24px));
  }

  .dd-side-panel__rail {
    position: absolute;
    right: 10px;
    bottom: 10px;
    left: 10px;
    flex-direction: row;
    height: auto;
    padding: 6px;
  }

  .dd-rail-item {
    flex: 1 0 58px;
    min-height: 52px;
  }
}
</style>
