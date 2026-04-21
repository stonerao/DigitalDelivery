<script setup>
defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  anchorDetail: {
    type: Object,
    default: null
  },
  summarizeAnchorBinding: {
    type: Function,
    required: true
  }
});

const emit = defineEmits(["update:modelValue"]);
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="点位当前数据"
    width="520px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="anchorDetail" class="space-y-4">
      <el-descriptions :column="1" border size="small">
        <el-descriptions-item label="点位名称">
          {{ anchorDetail.name }}
        </el-descriptions-item>
        <el-descriptions-item label="点位类型">
          {{ anchorDetail.type }}
        </el-descriptions-item>
        <el-descriptions-item label="数据绑定">
          {{ summarizeAnchorBinding(anchorDetail) }}
        </el-descriptions-item>
        <el-descriptions-item label="当前值">
          {{
            `${anchorDetail.runtimeState?.value ?? "-"}${anchorDetail.runtimeState?.unit || ""}`
          }}
        </el-descriptions-item>
        <el-descriptions-item label="展示文本">
          {{ anchorDetail.runtimeState?.displayText || "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          {{ anchorDetail.runtimeState?.status || "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="来源">
          {{ anchorDetail.runtimeState?.sourceName || "-" }}
        </el-descriptions-item>
      </el-descriptions>
    </div>
  </el-dialog>
</template>
