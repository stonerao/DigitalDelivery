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
  currentLabel: {
    type: String,
    default: ""
  },
  targetLabel: {
    type: String,
    default: ""
  },
  currentBoundCount: {
    type: Number,
    default: 0
  },
  mode: {
    type: String,
    default: "bind"
  },
  keyword: {
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
  selectedDocuments: {
    type: Array,
    default: () => []
  },
  emptyText: {
    type: String,
    default: ""
  }
});

const emit = defineEmits([
  "update:modelValue",
  "update:keyword",
  "search",
  "selection-change",
  "table-ref-change",
  "size-change",
  "page-change",
  "confirm"
]);

function handleTableRefChange(instance) {
  emit("table-ref-change", instance || null);
}
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
      <el-form-item :label="currentLabel">
        <el-input :model-value="targetLabel || '-'" readonly />
      </el-form-item>
      <el-form-item label="已绑文档">
        <div class="w-full text-sm text-gray-500">
          当前共绑定 {{ currentBoundCount }} 个文档
        </div>
      </el-form-item>
      <template v-if="mode === 'bind'">
        <el-form-item label="文档搜索">
          <el-input
            :model-value="keyword"
            clearable
            placeholder="搜索文档名称"
            @update:model-value="emit('update:keyword', $event)"
            @input="emit('search', $event)"
          />
        </el-form-item>
        <el-form-item label="文档列表">
          <div class="w-full">
            <el-table
              :ref="handleTableRefChange"
              v-loading="loading"
              :data="records"
              row-key="id"
              height="45vh"
              @selection-change="emit('selection-change', $event)"
            >
              <el-table-column type="selection" width="52" />
              <el-table-column
                prop="name"
                label="文档名称"
                min-width="260"
                show-overflow-tooltip
              />
              <el-table-column prop="type" label="类型" width="120" />
              <el-table-column
                prop="updatedAt"
                label="更新时间"
                min-width="180"
              />
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
      </template>
      <el-form-item :label="mode === 'view' ? '绑定结果' : '已选文件'">
        <div class="w-full">
          <el-table
            :data="selectedDocuments"
            row-key="id"
            height="28vh"
            :empty-text="emptyText"
          >
            <el-table-column
              prop="name"
              label="文档名称"
              min-width="260"
              show-overflow-tooltip
            />
            <el-table-column prop="type" label="类型" width="120" />
            <el-table-column
              prop="updatedAt"
              label="更新时间"
              min-width="180"
            />
          </el-table>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">
        {{ mode === "view" ? "关闭" : "取消" }}
      </el-button>
      <el-button v-if="mode === 'bind'" type="primary" @click="emit('confirm')">
        确定
      </el-button>
    </template>
  </el-dialog>
</template>
