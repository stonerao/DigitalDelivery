<script setup>
import { nextTick, onMounted, onBeforeUnmount, ref, watch } from "vue";

defineOptions({
  name: "StructurePanel"
});

const props = defineProps({
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
  filterMethod: {
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
  active: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  "refresh-tree",
  "update:treeFilterText",
  "tree-node-click",
  "tree-node-expand",
  "tree-node-collapse",
  "focus-selected-node",
  "make-selected-mesh-transparent",
  "restore-selected-mesh-opacity",
  "isolate-selected-node",
  "show-all-objects",
  "update:meshOpacity"
]);

const treeRef = ref(null);
const treePanelRef = ref(null);
const treeHeight = ref(400);
const treeInstanceKey = ref(0);
const treeData = ref([]);
let treePanelObserver = null;

function syncTreePanelHeight() {
  nextTick(() => {
    const element = treePanelRef.value;
    if (!element) return;
    treeHeight.value = Math.max(220, element.clientHeight || 0);
  });
}

function refreshTreeInstance() {
  treeInstanceKey.value += 1;
  syncTreePanelHeight();
}

defineExpose({
  setCurrentKey(key) {
    treeRef.value?.setCurrentKey?.(key);
  },
  setExpandedKeys(keys) {
    treeRef.value?.setExpandedKeys?.(keys);
  },
  scrollTo(key) {
    treeRef.value?.scrollTo?.(key);
  },
  filter(keyword) {
    treeRef.value?.filter?.(keyword);
  }
});

onMounted(() => {
  nextTick(() => {
    const element = treePanelRef.value;
    if (element) {
      treePanelObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          treeHeight.value = Math.max(
            220,
            Math.floor(entry.contentRect.height)
          );
        }
      });
      treePanelObserver.observe(element);
      treeHeight.value = Math.max(220, element.clientHeight);
    }
  });
});

watch(
  () => props.active,
  value => {
    if (!value) return;
    refreshTreeInstance();
  },
  { immediate: true }
);

watch(
  () => props.sceneTree,
  value => {
    treeData.value = value ? [value] : [];
    refreshTreeInstance();
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (treePanelObserver) {
    treePanelObserver.disconnect();
    treePanelObserver = null;
  }
});
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="mb-2 flex items-center justify-between">
      <span class="font-semibold text-sm">模型结构</span>
      <el-button size="small" link @click="emit('refresh-tree')"
        >刷新</el-button
      >
    </div>

    <el-input
      size="small"
      clearable
      placeholder="筛选（按名称）"
      class="mb-2"
      @update:model-value="emit('update:treeFilterText', $event)"
    />

    <div ref="treePanelRef" class="dd-tree">
      <el-tree-v2
        v-if="treeData.length"
        :key="treeInstanceKey"
        ref="treeRef"
        :data="treeData"
        node-key="uuid"
        :props="treeV2Props"
        :height="treeHeight"
        :item-size="28"
        :highlight-current="true"
        :default-expanded-keys="treeDefaultExpandedKeys"
        :expand-on-click-node="false"
        :filter-method="filterMethod"
        @node-click="emit('tree-node-click', $event)"
        @node-expand="emit('tree-node-expand', $event)"
        @node-collapse="emit('tree-node-collapse', $event)"
      />
      <div v-else class="text-xs text-[var(--el-text-color-secondary)]">
        未加载结构（请先加载模型）
      </div>
    </div>

    <div v-if="selectedTreeNode" class="mt-3">
      <div class="mb-2 text-xs text-[var(--el-text-color-secondary)]">
        已选：{{ selectedTreeNode.name }}
        <span v-if="selectedTreeNode.isMesh" class="ml-1">(Mesh)</span>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <el-button size="small" @click="emit('focus-selected-node')">
          最佳视角
        </el-button>
        <el-button
          size="small"
          :disabled="!selectedTreeNode.isMesh"
          @click="emit('make-selected-mesh-transparent')"
        >
          透明
        </el-button>
        <el-button
          size="small"
          :disabled="!selectedTreeNode.isMesh"
          @click="emit('restore-selected-mesh-opacity')"
        >
          恢复
        </el-button>
        <el-button size="small" @click="emit('isolate-selected-node')">
          仅显示当前
        </el-button>
        <el-button size="small" @click="emit('show-all-objects')">
          显示全部
        </el-button>
      </div>

      <div v-if="selectedTreeNode.isMesh" class="mt-2">
        <div class="mb-1 text-xs text-[var(--el-text-color-secondary)]">
          透明度：{{ meshOpacity.toFixed(2) }}
        </div>
        <el-slider
          :model-value="meshOpacity"
          :min="0.05"
          :max="0.9"
          :step="0.05"
          size="small"
          @update:model-value="emit('update:meshOpacity', $event)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dd-tree {
  min-height: 220px;
  flex: 1;
  overflow: auto;
}
</style>
