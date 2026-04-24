<script setup>
import NavigationPanel from "../../panels/NavigationPanel.vue";
import SceneSchemePanel from "../../panels/SceneSchemePanel.vue";
import DevicePanel from "../../panels/DevicePanel.vue";
import SceneAnchorPanel from "../../panels/SceneAnchorPanel.vue";
import MeasurementPanel from "../../panels/MeasurementPanel.vue";
import AssetGroupPanel from "../../panels/AssetGroupPanel.vue";
import RuntimeLinkagePanel from "../../panels/RuntimeLinkagePanel.vue";
import StructurePanel from "../../panels/StructurePanel.vue";

defineProps({
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
    <el-card shadow="never" class="h-full body-no-padding">
      <el-tabs
        :model-value="activeSideTab"
        tab-position="right"
        class="dd-side-tabs h-full"
        @update:model-value="emit('update:activeSideTab', $event)"
      >
        <el-tab-pane label="结构" name="structure">
          <StructurePanel
            :ref="handleStructureTreeRefChange"
            :scene-tree="sceneTree"
            :tree-v2-props="treeV2Props"
            :tree-default-expanded-keys="treeDefaultExpandedKeys"
            :tree-filter-text="treeFilterText"
            :model-type-filter="structureModelTypeFilter"
            :model-type-options="structureModelTypeOptions"
            :filter-method="structureFilterMethod"
            :selected-tree-node="selectedTreeNode"
            :mesh-opacity="meshOpacity"
            :active="activeSideTab === 'structure'"
            @refresh-tree="emit('refresh-tree')"
            @update:tree-filter-text="emit('update:treeFilterText', $event)"
            @update:model-type-filter="
              emit('update:structureModelTypeFilter', $event)
            "
            @tree-node-click="emit('tree-node-click', $event)"
            @tree-node-expand="emit('tree-node-expand', $event)"
            @tree-node-collapse="emit('tree-node-collapse', $event)"
            @focus-selected-node="emit('focus-selected-node')"
            @make-selected-mesh-transparent="
              emit('make-selected-mesh-transparent')
            "
            @restore-selected-mesh-opacity="
              emit('restore-selected-mesh-opacity')
            "
            @isolate-selected-node="emit('isolate-selected-node')"
            @show-all-objects="emit('show-all-objects')"
            @hide-selected-node="emit('hide-selected-node')"
            @restore-hidden-objects="emit('restore-hidden-objects')"
            @update:mesh-opacity="emit('update:meshOpacity', $event)"
          />
        </el-tab-pane>

        <el-tab-pane label="导航" name="navigation">
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

          <div class="mt-3 px-1">
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
        </el-tab-pane>

        <el-tab-pane label="设备" name="devices">
          <DevicePanel
            :device-keyword="deviceKeyword"
            :filtered-scene-devices="filteredSceneDevices"
            :selected-device-uuid="selectedDeviceUuid"
            @update:device-keyword="emit('update:deviceKeyword', $event)"
            @locate-device="emit('locate-device', $event)"
            @isolate-device="emit('isolate-device', $event)"
          />
        </el-tab-pane>

        <el-tab-pane label="点位" name="anchors">
          <SceneAnchorPanel
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
        </el-tab-pane>

        <el-tab-pane label="摄像头" name="cameras">
          <SceneAnchorPanel
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
        </el-tab-pane>

        <el-tab-pane label="测量" name="measurements">
          <MeasurementPanel
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
        </el-tab-pane>

        <el-tab-pane label="资产" name="assets">
          <AssetGroupPanel
            :scene-models="sceneModels"
            :active-model-id="activeSceneModelId"
            :groups="runtimeAssetGroups"
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
        </el-tab-pane>

        <el-tab-pane label="联动" name="runtime">
          <RuntimeLinkagePanel
            :realtime-state="realtimeState"
            :script-state="scriptState"
            :backend-state="backendState"
            :runtime-logs="runtimeLogs"
            @restart-realtime="emit('restart-realtime')"
            @run-manual-trigger="emit('run-manual-trigger', $event)"
            @send-backend-command="emit('send-backend-command', $event)"
            @clear-logs="emit('clear-logs')"
          />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<style scoped>
.dd-side-panel {
  position: fixed;
  top: var(--dd-panels-top);
  right: var(--dd-gap);
  bottom: var(--dd-bottom-reserve);
  z-index: 1100;
  width: var(--dd-panel-width);
  box-shadow: var(--el-box-shadow-light);
}

.dd-side-panel :deep(.el-card__body) {
  box-sizing: border-box;
  height: 100%;
  padding: 20px 0 20px 20px;
}

.dd-side-tabs :deep(.el-tabs__content) {
  height: 100%;
  padding-right: 12px;
  overflow: hidden auto;
}

.dd-side-tabs :deep(.el-tabs__content::-webkit-scrollbar) {
  width: 4px;
}

.dd-side-tabs :deep(.el-tabs__content::-webkit-scrollbar-thumb) {
  background: var(--el-border-color-dark);
  border-radius: 4px;
}

.dd-side-tabs.el-tabs--right :deep(.el-tabs__item) {
  height: auto !important;
  padding: 16px 8px !important;
  letter-spacing: 4px;
  writing-mode: vertical-rl;
}

.dd-side-tabs.el-tabs--right :deep(.el-tabs__item.is-active) {
  font-weight: bold;
}

.dd-side-tabs :deep(.el-tab-pane) {
  height: 100%;
}
</style>
