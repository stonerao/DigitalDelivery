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
  folderLoading: {
    type: Boolean,
    default: false
  },
  folderTreeData: {
    type: Array,
    default: () => []
  },
  selectedFolderId: {
    type: String,
    default: "root"
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
  "folder-change",
  "selection-change",
  "table-ref-change",
  "size-change",
  "page-change",
  "document-detail",
  "document-preview",
  "document-download",
  "confirm"
]);

function handleTableRefChange(instance) {
  emit("table-ref-change", instance || null);
}

const folderTreeProps = {
  label: "label",
  children: "children"
};
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
          <div class="document-binding-browser">
            <aside
              v-loading="folderLoading"
              class="document-binding-browser__tree"
            >
              <div class="document-binding-browser__tree-title">文档目录</div>
              <el-tree
                :data="folderTreeData"
                node-key="id"
                :props="folderTreeProps"
                :current-node-key="selectedFolderId"
                highlight-current
                default-expand-all
                empty-text="暂无目录"
                @node-click="emit('folder-change', $event?.id || 'root')"
              />
            </aside>
            <div class="document-binding-browser__table">
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
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-space wrap>
                  <el-button text @click="emit('document-detail', row)">
                    详情
                  </el-button>
                  <el-button
                    text
                    type="primary"
                    @click="emit('document-preview', row)"
                  >
                    预览
                  </el-button>
                  <el-button text @click="emit('document-download', row)">
                    下载
                  </el-button>
                </el-space>
              </template>
            </el-table-column>
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

<style scoped>
.document-binding-browser {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 12px;
  width: 100%;
}

.document-binding-browser__tree {
  min-width: 0;
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}

.document-binding-browser__tree-title {
  height: 36px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 600;
  line-height: 36px;
  color: var(--el-text-color-primary);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.document-binding-browser__table {
  min-width: 0;
}

.document-binding-browser__tree :deep(.el-tree) {
  height: calc(45vh + 44px);
  padding: 8px;
  overflow: auto;
}

@media (width <= 900px) {
  .document-binding-browser {
    grid-template-columns: 1fr;
  }

  .document-binding-browser__tree :deep(.el-tree) {
    height: 180px;
  }
}
</style>
