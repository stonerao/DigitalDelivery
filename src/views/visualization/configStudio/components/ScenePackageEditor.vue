<script setup>
import { computed } from "vue";

defineOptions({
  name: "ScenePackageEditor"
});

const props = defineProps({
  projectPackage: {
    type: Object,
    default: () => ({})
  }
});

const scene = computed(() => props.projectPackage?.scene || {});
const metadata = computed(() => props.projectPackage?.metadata || {});
const sceneManifest = computed(
  () => props.projectPackage?.assets?.sceneManifest || {}
);

const summaryItems = computed(() => [
  {
    key: "anchors",
    label: "场景点位",
    value: Array.isArray(scene.value.anchors) ? scene.value.anchors.length : 0
  },
  {
    key: "cameras",
    label: "摄像头点位",
    value: Array.isArray(scene.value.cameras) ? scene.value.cameras.length : 0
  },
  {
    key: "measurements",
    label: "测量记录",
    value: Array.isArray(scene.value.measurements)
      ? scene.value.measurements.length
      : 0
  },
  {
    key: "schemes",
    label: "场景方案",
    value: Array.isArray(scene.value.schemes) ? scene.value.schemes.length : 0
  },
  {
    key: "groups",
    label: "资源分组",
    value: Array.isArray(sceneManifest.value.groups)
      ? sceneManifest.value.groups.length
      : 0
  },
  {
    key: "lodLevels",
    label: "LOD 档位",
    value: Array.isArray(sceneManifest.value.lodLevels)
      ? sceneManifest.value.lodLevels.length
      : 0
  }
]);

function buildPreview(items = [], type) {
  return items.slice(0, 5).map(item => ({
    id: item.id || "-",
    name: item.name || item.label || "-",
    type:
      type === "measurements" ? item.type || item.mode || "-" : item.type || "-"
  }));
}

const anchorPreview = computed(() =>
  buildPreview(scene.value.anchors, "anchors")
);
const cameraPreview = computed(() =>
  buildPreview(scene.value.cameras, "cameras")
);
const measurementPreview = computed(() =>
  buildPreview(scene.value.measurements, "measurements")
);
const schemePreview = computed(() =>
  buildPreview(scene.value.schemes, "schemes")
);
</script>

<template>
  <div class="space-y-4">
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <span class="font-semibold">工程概览</span>
          <el-tag size="small" effect="plain">
            version {{ projectPackage?.version || "1.0.0" }}
          </el-tag>
        </div>
      </template>

      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div class="rounded border border-[var(--el-border-color)] p-3">
          <div class="text-xs text-[var(--el-text-color-secondary)]">
            模型名称
          </div>
          <div class="mt-1 text-sm font-medium">
            {{ metadata.modelName || "未指定" }}
          </div>
        </div>
        <div class="rounded border border-[var(--el-border-color)] p-3">
          <div class="text-xs text-[var(--el-text-color-secondary)]">
            模型 ID
          </div>
          <div class="mt-1 break-all text-sm font-medium">
            {{ metadata.modelId || "未指定" }}
          </div>
        </div>
        <div
          class="rounded border border-[var(--el-border-color)] p-3 md:col-span-2"
        >
          <div class="text-xs text-[var(--el-text-color-secondary)]">
            模型地址
          </div>
          <div class="mt-1 break-all text-sm font-medium">
            {{ metadata.modelUrl || "未指定" }}
          </div>
        </div>
      </div>
    </el-card>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <div
        v-for="item in summaryItems"
        :key="item.key"
        class="rounded border border-[var(--el-border-color)] bg-[var(--el-fill-color-blank)] p-4"
      >
        <div
          class="text-xs uppercase tracking-wide text-[var(--el-text-color-secondary)]"
        >
          {{ item.label }}
        </div>
        <div class="mt-2 text-2xl font-semibold leading-none">
          {{ item.value }}
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <el-card shadow="never">
        <template #header>
          <span class="font-semibold">点位预览</span>
        </template>
        <el-table :data="anchorPreview" size="small" max-height="220">
          <el-table-column prop="id" label="ID" min-width="120" />
          <el-table-column prop="name" label="名称" min-width="140" />
          <el-table-column prop="type" label="类型" min-width="120" />
        </el-table>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <span class="font-semibold">摄像头预览</span>
        </template>
        <el-table :data="cameraPreview" size="small" max-height="220">
          <el-table-column prop="id" label="ID" min-width="120" />
          <el-table-column prop="name" label="名称" min-width="140" />
          <el-table-column prop="type" label="类型" min-width="120" />
        </el-table>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <span class="font-semibold">测量记录预览</span>
        </template>
        <el-table :data="measurementPreview" size="small" max-height="220">
          <el-table-column prop="id" label="ID" min-width="120" />
          <el-table-column prop="name" label="名称" min-width="140" />
          <el-table-column prop="type" label="类型" min-width="120" />
        </el-table>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <span class="font-semibold">场景方案预览</span>
        </template>
        <el-table :data="schemePreview" size="small" max-height="220">
          <el-table-column prop="id" label="ID" min-width="120" />
          <el-table-column prop="name" label="名称" min-width="140" />
          <el-table-column prop="type" label="类型" min-width="120" />
        </el-table>
      </el-card>
    </div>
  </div>
</template>
