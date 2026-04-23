<script setup>
import { ref, watch } from "vue";
import { ThreeModelViewer } from "@/3d";
import ViewerBottomToolbar from "../../toolbars/ViewerBottomToolbar.vue";
import ClippingPanel from "../../panels/ClippingPanel.vue";
import ObjectInfoPanel from "../../panels/ObjectInfoPanel.vue";

const props = defineProps({
  viewerModelUrl: {
    type: String,
    default: ""
  },
  modelName: {
    type: String,
    default: ""
  },
  viewerSceneModels: {
    type: Array,
    default: () => []
  },
  transparent: {
    type: Boolean,
    default: false
  },
  quality: {
    type: String,
    default: "high"
  },
  interactionMode: {
    type: String,
    default: ""
  },
  ifcWasmPath: {
    type: String,
    default: ""
  },
  showStats: {
    type: Boolean,
    default: false
  },
  enableClipping: {
    type: Boolean,
    default: false
  },
  toolOptions: {
    type: Array,
    default: () => []
  },
  activeTool: {
    type: String,
    default: ""
  },
  roamingEnabled: {
    type: Boolean,
    default: false
  },
  presetViews: {
    type: Array,
    default: () => []
  },
  bookmarks: {
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
  projectionMode: {
    type: String,
    default: ""
  },
  materialTheme: {
    type: String,
    default: "original"
  },
  displayMode: {
    type: String,
    default: "all"
  },
  selectedCount: {
    type: Number,
    default: 0
  },
  showSidePanel: {
    type: Boolean,
    default: true
  },
  runtimeClippingState: {
    type: Object,
    default: () => ({})
  },
  clippingSummaryText: {
    type: String,
    default: ""
  },
  clippingStats: {
    type: Object,
    default: () => ({})
  },
  clippingTargetOptions: {
    type: Array,
    default: () => []
  },
  selectedObjectInfo: {
    type: Object,
    default: null
  },
  clippingAnimationPlaying: {
    type: Boolean,
    default: false
  },
  clippingAnimationSpeed: {
    type: Number,
    default: 0
  },
  clippingAnimationMode: {
    type: String,
    default: ""
  },
  clippingAnimationModeOptions: {
    type: Array,
    default: () => []
  },
  clippingAnimationAxis: {
    type: String,
    default: ""
  },
  clippingAnimationAxisOptions: {
    type: Array,
    default: () => []
  },
  clippingModeOptions: {
    type: Array,
    default: () => []
  },
  clippingAxisOptions: {
    type: Array,
    default: () => []
  },
  clippingDirectionOptions: {
    type: Array,
    default: () => []
  },
  showObjectPanel: {
    type: Boolean,
    default: false
  },
  selectedSceneDevice: {
    type: Object,
    default: null
  },
  selectedKksDetail: {
    type: Object,
    default: null
  },
  selectedKksDetailLoading: {
    type: Boolean,
    default: false
  },
  selectedKksDetailError: {
    type: String,
    default: ""
  },
  currentMeasurementPoints: {
    type: Array,
    default: () => []
  },
  pointMarkersVisible: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits([
  "viewer-ref-change",
  "loaded",
  "object-select",
  "measure-change",
  "measure-complete",
  "scene-anchor-click",
  "clipping-change",
  "update:activeTool",
  "update:measurementMode",
  "tool-change",
  "zoom-in",
  "zoom-out",
  "reset-view",
  "toggle-roaming",
  "toggle-transparent",
  "toggle-projection",
  "toggle-clipping",
  "take-screenshot",
  "save-bookmark",
  "apply-bookmark",
  "clear-measurements",
  "export-measurements",
  "set-preset-view",
  "set-material-theme",
  "apply-display-action",
  "update:clippingState",
  "toggle-animation",
  "update:animationSpeed",
  "update:animationMode",
  "update:animationAxis",
  "reset-clipping",
  "close-object-panel",
  "update:pointMarkersVisible"
]);

const viewerRef = ref(null);

watch(
  viewerRef,
  value => {
    emit("viewer-ref-change", value || null);
  },
  { immediate: true }
);
</script>

<template>
  <div class="relative h-full w-full">
    <ThreeModelViewer
      ref="viewerRef"
      :model-url="viewerModelUrl"
      :model-name="modelName"
      :scene-models="viewerSceneModels"
      :transparent="transparent"
      :use-basic-material="true"
      :quality="quality"
      :interaction-mode="interactionMode"
      :ifc-wasm-path="ifcWasmPath"
      :show-stats="showStats"
      :enable-clipping="enableClipping"
      @loaded="emit('loaded')"
      @object-select="emit('object-select', $event)"
      @measure-change="emit('measure-change', $event)"
      @measure-complete="emit('measure-complete', $event)"
      @scene-anchor-click="emit('scene-anchor-click', $event)"
      @clipping-change="emit('clipping-change', $event)"
    />

    <ViewerBottomToolbar
      :tool-options="toolOptions"
      :active-tool="activeTool"
      :roaming-enabled="roamingEnabled"
      :transparent="transparent"
      :enable-clipping="enableClipping"
      :preset-views="presetViews"
      :bookmarks="bookmarks"
      :measurement-mode="measurementMode"
      :measurement-mode-options="measurementModeOptions"
      :projection-mode="projectionMode"
      :material-theme="materialTheme"
      :display-mode="displayMode"
      :selected-object-info="selectedObjectInfo"
      :selected-count="selectedCount"
      @update:active-tool="emit('update:activeTool', $event)"
      @update:measurement-mode="emit('update:measurementMode', $event)"
      @tool-change="emit('tool-change', $event)"
      @zoom-in="emit('zoom-in')"
      @zoom-out="emit('zoom-out')"
      @reset-view="emit('reset-view')"
      @toggle-roaming="emit('toggle-roaming')"
      @toggle-transparent="emit('toggle-transparent')"
      @toggle-projection="emit('toggle-projection')"
      @toggle-clipping="emit('toggle-clipping')"
      @take-screenshot="emit('take-screenshot')"
      @save-bookmark="emit('save-bookmark', $event)"
      @apply-bookmark="emit('apply-bookmark', $event)"
      @clear-measurements="emit('clear-measurements')"
      @export-measurements="emit('export-measurements')"
      @set-preset-view="emit('set-preset-view', $event)"
      @set-material-theme="emit('set-material-theme', $event)"
      @apply-display-action="emit('apply-display-action', $event)"
    />

    <ClippingPanel
      :enable-clipping="enableClipping"
      :show-side-panel="showSidePanel"
      :clipping-state="runtimeClippingState"
      :clipping-summary="clippingSummaryText"
      :clipping-stats="clippingStats"
      :target-options="clippingTargetOptions"
      :selected-object-info="selectedObjectInfo"
      :animation-playing="clippingAnimationPlaying"
      :animation-speed="clippingAnimationSpeed"
      :animation-mode="clippingAnimationMode"
      :animation-mode-options="clippingAnimationModeOptions"
      :animation-axis="clippingAnimationAxis"
      :animation-axis-options="clippingAnimationAxisOptions"
      :mode-options="clippingModeOptions"
      :axis-options="clippingAxisOptions"
      :direction-options="clippingDirectionOptions"
      @update:clipping-state="emit('update:clippingState', $event)"
      @toggle-animation="emit('toggle-animation')"
      @update:animation-speed="emit('update:animationSpeed', $event)"
      @update:animation-mode="emit('update:animationMode', $event)"
      @update:animation-axis="emit('update:animationAxis', $event)"
      @reset="emit('reset-clipping')"
    />

    <ObjectInfoPanel
      :visible="showObjectPanel"
      :selected-object-info="selectedObjectInfo"
      :selected-scene-device="selectedSceneDevice"
      :selected-bound-documents="selectedSceneDevice?.boundDocuments || []"
      :selected-kks-detail="selectedKksDetail"
      :selected-kks-detail-loading="selectedKksDetailLoading"
      :selected-kks-detail-error="selectedKksDetailError"
      :current-measurement-points="currentMeasurementPoints"
      :point-markers-visible="pointMarkersVisible"
      @close="emit('close-object-panel')"
      @update:point-markers-visible="emit('update:pointMarkersVisible', $event)"
    />
  </div>
</template>
