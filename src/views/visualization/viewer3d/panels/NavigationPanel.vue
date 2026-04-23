<script setup>
import { computed, ref } from "vue";

defineOptions({
  name: "NavigationPanel"
});

const props = defineProps({
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
    default: "all"
  },
  displayModeText: {
    type: String,
    default: ""
  }
});

const emit = defineEmits([
  "navigation-node-click",
  "navigation-node-contextmenu",
  "update:selectedSystemNodeId",
  "update:selectedQuickKks",
  "locate-system",
  "locate-by-kks",
  "apply-display-mode",
  "layer-tree-check"
]);

const layerTreeRef = ref(null);
const hasNavigationData = computed(() => props.navigationTreeData.length > 0);
const hasSystemOptions = computed(
  () => props.sceneDeviceSystemOptions.length > 0
);
const hasKksOptions = computed(() => props.sceneDeviceKksOptions.length > 0);
const hasLayerTreeData = computed(() => props.layerTreeData.length > 0);

function handleNodeContextmenu(...args) {
  emit("navigation-node-contextmenu", ...args);
}

defineExpose({
  setCheckedKeys(keys) {
    layerTreeRef.value?.setCheckedKeys?.(keys);
  },
  getCheckedKeys(leafOnly) {
    return layerTreeRef.value?.getCheckedKeys?.(leafOnly) || [];
  }
});
</script>

<template>
  <el-scrollbar height="100%">
    <div class="space-y-3 pr-1">
      <div class="rounded border border-[var(--el-border-color)] p-3">
        <div class="mb-2 flex items-center justify-between gap-2">
          <div class="text-sm font-semibold">导航</div>
        </div>
        <div class="mb-2 text-xs text-[var(--el-text-color-secondary)]">
          以模型为一级节点，按模型内构件逐级定位。
        </div>
        <el-tree
          v-if="hasNavigationData"
          :data="navigationTreeData"
          node-key="id"
          highlight-current
          :current-node-key="currentNavNodeKey"
          default-expand-all
          :expand-on-click-node="false"
          @node-click="emit('navigation-node-click', $event)"
          @node-contextmenu="handleNodeContextmenu"
        />
        <el-empty v-else description="未加载模型数据" :image-size="56" />
      </div>

      <div class="rounded border border-[var(--el-border-color)] p-3">
        <div class="mb-2 text-sm font-semibold">快速定位</div>
        <el-select
          :model-value="selectedSystemNodeId"
          clearable
          filterable
          :disabled="!hasSystemOptions"
          placeholder="按系统快速定位"
          class="w-full"
          @update:model-value="emit('update:selectedSystemNodeId', $event)"
        >
          <el-option
            v-for="item in sceneDeviceSystemOptions"
            :key="item.value"
            :label="`${item.label}（${item.count}）`"
            :value="item.value"
          />
        </el-select>
        <div class="mt-2 flex items-center gap-2">
          <el-button size="small" @click="emit('locate-system')">
            定位系统
          </el-button>
          <el-button
            size="small"
            link
            @click="emit('apply-display-mode', 'system')"
          >
            只看系统
          </el-button>
        </div>

        <el-select
          :model-value="selectedQuickKks"
          clearable
          filterable
          :disabled="!hasKksOptions"
          placeholder="按 KKS 快速定位"
          class="mt-3 w-full"
          @update:model-value="emit('update:selectedQuickKks', $event)"
        >
          <el-option
            v-for="item in sceneDeviceKksOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <div class="mt-2 flex items-center gap-2">
          <el-button size="small" @click="emit('locate-by-kks')">
            定位设备
          </el-button>
          <el-button
            size="small"
            link
            @click="emit('apply-display-mode', 'selection')"
          >
            仅看当前设备
          </el-button>
        </div>
      </div>

      <div class="rounded border border-[var(--el-border-color)] p-3">
        <div class="mb-2 text-sm font-semibold">分层显示树</div>
        <div class="mb-2 text-xs text-[var(--el-text-color-secondary)]">
          勾选需要显示的系统或设备，支持批量开关子层级。
        </div>
        <el-tree
          v-if="hasLayerTreeData"
          ref="layerTreeRef"
          :data="layerTreeData"
          node-key="id"
          show-checkbox
          default-expand-all
          :default-checked-keys="layerCheckedKeys"
          :expand-on-click-node="false"
          @check="emit('layer-tree-check')"
        />
        <el-empty v-else description="暂无模型分层数据" :image-size="56" />
      </div>

      <div class="rounded border border-[var(--el-border-color)] p-3">
        <div class="mb-2 text-sm font-semibold">显示控制</div>
        <div class="flex flex-wrap gap-2">
          <el-button
            size="small"
            :type="displayMode === 'all' ? 'primary' : 'default'"
            @click="emit('apply-display-mode', 'all')"
          >
            全部
          </el-button>
          <el-button
            size="small"
            :type="displayMode === 'business' ? 'primary' : 'default'"
            @click="emit('apply-display-mode', 'business')"
          >
            已绑定设备
          </el-button>
          <el-button
            size="small"
            :type="displayMode === 'system' ? 'primary' : 'default'"
            @click="emit('apply-display-mode', 'system')"
          >
            当前系统
          </el-button>
          <el-button
            size="small"
            :type="displayMode === 'selection' ? 'primary' : 'default'"
            @click="emit('apply-display-mode', 'selection')"
          >
            当前设备
          </el-button>
        </div>
        <div class="mt-2 text-xs text-[var(--el-text-color-secondary)]">
          当前显示范围：{{ displayModeText }}
        </div>
      </div>
    </div>
  </el-scrollbar>
</template>
