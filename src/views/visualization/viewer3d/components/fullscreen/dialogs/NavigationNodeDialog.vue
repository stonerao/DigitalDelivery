<script setup>
defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: "create"
  },
  label: {
    type: String,
    default: ""
  }
});

const emit = defineEmits(["update:modelValue", "update:label", "confirm"]);
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="mode === 'create' ? '新增导航节点' : '重命名导航节点'"
    width="420px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-width="88px">
      <el-form-item label="节点名称">
        <el-input
          :model-value="label"
          placeholder="请输入导航节点名称"
          @update:model-value="emit('update:label', $event)"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="emit('confirm')">确定</el-button>
    </template>
  </el-dialog>
</template>
