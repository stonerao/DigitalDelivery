<script setup>
defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ""
  },
  keyword: {
    type: String,
    default: ""
  },
  currentTargetName: {
    type: String,
    default: ""
  },
  currentKks: {
    type: String,
    default: ""
  },
  loading: {
    type: Boolean,
    default: false
  },
  records: {
    type: Array,
    default: () => []
  },
  pagination: {
    type: Object,
    default: () => ({ total: 0, page: 1, size: 20 })
  },
  selectedKks: {
    type: String,
    default: ""
  }
});

const emit = defineEmits([
  "update:modelValue",
  "update:keyword",
  "search",
  "row-click",
  "size-change",
  "page-change",
  "confirm"
]);
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="80vw"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-width="90px" class="pr-4">
      <el-form-item label="业务数据">
        <el-input
          :model-value="keyword"
          clearable
          placeholder="搜索数据移交中的 KKS / 名称 / 系统"
          @update:model-value="emit('update:keyword', $event)"
          @input="emit('search', $event)"
        />
      </el-form-item>
      <el-form-item label="当前构件">
        <el-input :model-value="currentTargetName" readonly />
      </el-form-item>
      <el-form-item label="KKS 编码">
        <el-input :model-value="currentKks || '-'" readonly />
      </el-form-item>
      <el-form-item label="KKS 列表">
        <div class="w-full">
          <el-table
            v-loading="loading"
            :data="records"
            height="50vh"
            highlight-current-row
            @row-click="emit('row-click', $event)"
          >
            <el-table-column prop="kks" label="KKS编码" min-width="150" />
            <el-table-column prop="name" label="名称" min-width="180" />
            <el-table-column prop="type" label="类型" width="100" />
            <el-table-column
              prop="systemName"
              label="所属系统"
              min-width="160"
              show-overflow-tooltip
            />
            <el-table-column prop="status" label="状态" width="100" />
          </el-table>
          <div class="mt-3 flex justify-end">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next"
              :total="pagination.total"
              :current-page="pagination.page"
              :page-size="pagination.size"
              :page-sizes="[20, 50, 100]"
              @size-change="emit('size-change', $event)"
              @current-change="emit('page-change', $event)"
            />
          </div>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button
        type="primary"
        :disabled="!selectedKks"
        @click="emit('confirm')"
      >
        确定
      </el-button>
    </template>
  </el-dialog>
</template>
