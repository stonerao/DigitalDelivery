<script setup>
defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  modelPickerSelection: {
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
  }
});

const emit = defineEmits([
  "update:modelValue",
  "update:modelPickerSelection",
  "confirm"
]);
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="添加模型到场景"
    width="560px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-width="108px">
      <el-form-item label="模型列表">
        <el-select
          :model-value="modelPickerSelection"
          multiple
          filterable
          class="w-full"
          :loading="loadingModelOptions"
          placeholder="请选择要添加的模型"
          @update:model-value="emit('update:modelPickerSelection', $event)"
        >
          <el-option
            v-for="item in selectableModelOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="emit('confirm')">添加</el-button>
    </template>
  </el-dialog>
</template>
