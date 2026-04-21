<script setup>
import SceneStylePanel from "../../../panels/SceneStylePanel.vue";

defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  anchorStyle: {
    type: Object,
    default: () => ({})
  },
  cameraStyle: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits([
  "update:modelValue",
  "save-style",
  "export-data",
  "import-data"
]);
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="设置"
    width="880px"
    class="dd-settings-dialog"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <SceneStylePanel
      :anchor-style="anchorStyle"
      :camera-style="cameraStyle"
      @save-style="emit('save-style', $event)"
      @export-data="emit('export-data', $event)"
      @import-data="emit('import-data', $event)"
    />
  </el-dialog>
</template>

<style scoped>
.dd-settings-dialog :deep(.el-dialog__body) {
  padding: 16px 18px 18px;
}
</style>
