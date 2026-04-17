<script setup>
defineOptions({
  name: "AssetManifestEditor"
});

const props = defineProps({
  sceneManifest: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(["update:scene-manifest"]);

function clonePayload(payload) {
  return JSON.parse(JSON.stringify(payload || {}));
}

function patchManifest(patch) {
  emit("update:scene-manifest", {
    ...clonePayload(props.sceneManifest),
    ...patch
  });
}

function addGroup() {
  const next = clonePayload(props.sceneManifest);
  next.groups = Array.isArray(next.groups) ? next.groups : [];
  next.groups.push({
    id: `group-${Date.now()}`,
    name: "新资源组",
    visible: true,
    modelUrl: "",
    uuids: []
  });
  emit("update:scene-manifest", next);
}

function patchGroup(index, patch) {
  const next = clonePayload(props.sceneManifest);
  next.groups = Array.isArray(next.groups) ? next.groups : [];
  next.groups[index] = {
    ...(next.groups[index] || {}),
    ...patch
  };
  emit("update:scene-manifest", next);
}

function removeGroup(index) {
  const next = clonePayload(props.sceneManifest);
  next.groups = Array.isArray(next.groups) ? next.groups : [];
  next.groups.splice(index, 1);
  emit("update:scene-manifest", next);
}

function addLodLevel() {
  const next = clonePayload(props.sceneManifest);
  next.lodLevels = Array.isArray(next.lodLevels) ? next.lodLevels : [];
  next.lodLevels.push({
    id: `lod-${Date.now()}`,
    level: "LOD1",
    distance: 50,
    modelUrl: ""
  });
  emit("update:scene-manifest", next);
}

function patchLodLevel(index, patch) {
  const next = clonePayload(props.sceneManifest);
  next.lodLevels = Array.isArray(next.lodLevels) ? next.lodLevels : [];
  next.lodLevels[index] = {
    ...(next.lodLevels[index] || {}),
    ...patch
  };
  emit("update:scene-manifest", next);
}

function removeLodLevel(index) {
  const next = clonePayload(props.sceneManifest);
  next.lodLevels = Array.isArray(next.lodLevels) ? next.lodLevels : [];
  next.lodLevels.splice(index, 1);
  emit("update:scene-manifest", next);
}

function stringifyArray(value) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function parseArray(value) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}
</script>

<template>
  <div class="space-y-4">
    <el-card shadow="never">
      <template #header>
        <span class="font-semibold">scene-manifest</span>
      </template>

      <el-form
        label-width="120px"
        class="grid grid-cols-1 gap-x-4 lg:grid-cols-2"
      >
        <el-form-item label="Manifest 版本">
          <el-input
            :model-value="sceneManifest.manifestVersion"
            @update:model-value="patchManifest({ manifestVersion: $event })"
          />
        </el-form-item>
        <el-form-item label="默认模型 URL">
          <el-input
            :model-value="sceneManifest.defaultModelUrl"
            @update:model-value="patchManifest({ defaultModelUrl: $event })"
          />
        </el-form-item>
        <el-form-item label="高质量 URL">
          <el-input
            :model-value="sceneManifest.qualityProfiles?.high"
            @update:model-value="
              patchManifest({
                qualityProfiles: {
                  ...sceneManifest.qualityProfiles,
                  high: $event
                }
              })
            "
          />
        </el-form-item>
        <el-form-item label="中质量 URL">
          <el-input
            :model-value="sceneManifest.qualityProfiles?.medium"
            @update:model-value="
              patchManifest({
                qualityProfiles: {
                  ...sceneManifest.qualityProfiles,
                  medium: $event
                }
              })
            "
          />
        </el-form-item>
        <el-form-item label="低质量 URL">
          <el-input
            :model-value="sceneManifest.qualityProfiles?.low"
            @update:model-value="
              patchManifest({
                qualityProfiles: {
                  ...sceneManifest.qualityProfiles,
                  low: $event
                }
              })
            "
          />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <span class="font-semibold">资源分组</span>
          <el-button size="small" type="primary" @click="addGroup">
            新增分组
          </el-button>
        </div>
      </template>

      <div v-if="sceneManifest.groups?.length" class="space-y-3">
        <div
          v-for="(group, index) in sceneManifest.groups"
          :key="group.id || index"
          class="rounded border border-[var(--el-border-color)] p-3"
        >
          <div class="mb-3 flex items-center justify-between gap-2">
            <span class="font-medium">{{ group.name || "未命名分组" }}</span>
            <el-button
              size="small"
              type="danger"
              link
              @click="removeGroup(index)"
            >
              删除
            </el-button>
          </div>
          <el-form
            label-width="88px"
            class="grid grid-cols-1 gap-x-4 lg:grid-cols-2"
          >
            <el-form-item label="ID">
              <el-input
                :model-value="group.id"
                @update:model-value="patchGroup(index, { id: $event })"
              />
            </el-form-item>
            <el-form-item label="名称">
              <el-input
                :model-value="group.name"
                @update:model-value="patchGroup(index, { name: $event })"
              />
            </el-form-item>
            <el-form-item label="模型 URL" class="lg:col-span-2">
              <el-input
                :model-value="group.modelUrl"
                @update:model-value="patchGroup(index, { modelUrl: $event })"
              />
            </el-form-item>
            <el-form-item label="默认显示">
              <el-switch
                :model-value="group.visible !== false"
                @update:model-value="patchGroup(index, { visible: $event })"
              />
            </el-form-item>
            <el-form-item label="UUID 清单" class="lg:col-span-2">
              <el-input
                :model-value="stringifyArray(group.uuids)"
                placeholder="使用逗号分隔"
                @update:model-value="
                  patchGroup(index, { uuids: parseArray($event) })
                "
              />
            </el-form-item>
          </el-form>
        </div>
      </div>
      <el-empty v-else description="还没有配置资源分组" :image-size="88" />
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <span class="font-semibold">LOD 清单</span>
          <el-button size="small" type="primary" @click="addLodLevel">
            新增 LOD
          </el-button>
        </div>
      </template>

      <div v-if="sceneManifest.lodLevels?.length" class="space-y-3">
        <div
          v-for="(lod, index) in sceneManifest.lodLevels"
          :key="lod.id || index"
          class="rounded border border-[var(--el-border-color)] p-3"
        >
          <div class="mb-3 flex items-center justify-between gap-2">
            <span class="font-medium">{{ lod.level || "未命名 LOD" }}</span>
            <el-button
              size="small"
              type="danger"
              link
              @click="removeLodLevel(index)"
            >
              删除
            </el-button>
          </div>
          <el-form
            label-width="88px"
            class="grid grid-cols-1 gap-x-4 lg:grid-cols-2"
          >
            <el-form-item label="ID">
              <el-input
                :model-value="lod.id"
                @update:model-value="patchLodLevel(index, { id: $event })"
              />
            </el-form-item>
            <el-form-item label="级别">
              <el-input
                :model-value="lod.level"
                @update:model-value="patchLodLevel(index, { level: $event })"
              />
            </el-form-item>
            <el-form-item label="切换距离">
              <el-input-number
                :model-value="Number(lod.distance || 0)"
                :min="0"
                :step="10"
                @update:model-value="patchLodLevel(index, { distance: $event })"
              />
            </el-form-item>
            <el-form-item label="模型 URL" class="lg:col-span-2">
              <el-input
                :model-value="lod.modelUrl"
                @update:model-value="patchLodLevel(index, { modelUrl: $event })"
              />
            </el-form-item>
          </el-form>
        </div>
      </div>
      <el-empty v-else description="还没有配置 LOD 资源" :image-size="88" />
    </el-card>
  </div>
</template>
