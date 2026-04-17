<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { message } from "@/utils/message";

defineOptions({
  name: "VideoLinkage"
});

const route = useRoute();
const router = useRouter();

const regionOptions = [
  { label: "锅炉区域", value: "boiler" },
  { label: "控制室", value: "control" },
  { label: "冷却塔", value: "cooling" },
  { label: "全部", value: "all" }
];

const selectedRegion = ref("all");
const keyword = ref("");

const cameras = ref([
  {
    id: "c1",
    name: "锅炉-主给水泵A摄像头",
    region: "boiler",
    status: "online",
    kks: "10LAC10AP001"
  },
  {
    id: "c2",
    name: "锅炉-主给水泵B摄像头",
    region: "boiler",
    status: "online",
    kks: "10LAC10AP002"
  },
  {
    id: "c3",
    name: "控制室-大屏全景",
    region: "control",
    status: "online",
    kks: "10HAA00DS001"
  },
  {
    id: "c4",
    name: "冷却塔-入口平台",
    region: "cooling",
    status: "offline",
    kks: "10KAA10CV201"
  }
]);

const filteredCameras = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return cameras.value.filter(c => {
    const hitRegion =
      selectedRegion.value === "all" ? true : c.region === selectedRegion.value;
    const hitKw = kw ? `${c.name} ${c.kks}`.toLowerCase().includes(kw) : true;
    return hitRegion && hitKw;
  });
});

const selectedCameraId = ref("c1");
const currentCamera = computed(() => {
  return cameras.value.find(c => c.id === selectedCameraId.value) || null;
});

function statusType(s) {
  return s === "online" ? "success" : "info";
}

function statusLabel(s) {
  return s === "online" ? "在线" : "离线";
}

function selectCamera(id) {
  selectedCameraId.value = id;
  const cam = cameras.value.find(c => c.id === id);
  if (cam) message(`已切换：${cam.name}`, { type: "success" });
}

function openViewer() {
  router.push("/visualization/3d-viewer");
}

function openSmartSearch() {
  const q = currentCamera.value?.kks;
  router.push({ path: "/search-nav/search", query: { q: q || "" } });
}

function applyQuery() {
  const region = route.query?.region;
  if (
    typeof region === "string" &&
    regionOptions.some(r => r.value === region)
  ) {
    selectedRegion.value = region;
  }
  const q = route.query?.q;
  if (typeof q === "string" && q.trim()) {
    keyword.value = q.trim();
  }
  // 预选：匹配到的第一条
  const first = filteredCameras.value[0];
  if (first) selectedCameraId.value = first.id;
}

onMounted(() => {
  applyQuery();
});

watch(
  () => [route.query?.region, route.query?.q],
  () => {
    applyQuery();
  }
);
</script>

<template>
  <div class="dd-page">
    <el-card shadow="never" class="mb-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <el-space wrap>
          <div class="text-sm">区域：</div>
          <el-segmented v-model="selectedRegion" :options="regionOptions" />
        </el-space>
        <el-space wrap>
          <el-input
            v-model="keyword"
            placeholder="摄像头名称/KKS"
            style="width: 240px"
            clearable
          />
          <el-button @click="openViewer">三维查看</el-button>
          <el-button type="primary" @click="openSmartSearch"
            >关联搜索</el-button
          >
        </el-space>
      </div>
      <div class="mt-2 text-xs text-[var(--el-text-color-secondary)]">
        说明：视频为原型落地（占位预览）。后续可接入 HLS/FLV/WebRTC。
      </div>
    </el-card>

    <el-row :gutter="16">
      <el-col :xs="24" :lg="8" class="mb-4">
        <el-card shadow="never">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="font-semibold">摄像头列表</div>
              <div class="text-xs text-[var(--el-text-color-secondary)]">
                {{ filteredCameras.length }} 路
              </div>
            </div>
          </template>

          <el-table
            :data="filteredCameras"
            height="420"
            highlight-current-row
            @row-click="row => selectCamera(row.id)"
          >
            <el-table-column
              prop="name"
              label="名称"
              min-width="220"
              show-overflow-tooltip
            />
            <el-table-column label="状态" width="90">
              <template #default="scope">
                <el-tag :type="statusType(scope.row.status)">{{
                  statusLabel(scope.row.status)
                }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="16" class="mb-4">
        <el-card shadow="never">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="font-semibold truncate">
                预览：{{ currentCamera?.name || "未选择" }}
              </div>
              <div class="text-sm text-[var(--el-text-color-secondary)]">
                <span v-if="currentCamera">KKS：{{ currentCamera.kks }}</span>
              </div>
            </div>
          </template>

          <div
            class="rounded overflow-hidden"
            style="height: 420px; background: var(--el-color-info-light-9)"
          >
            <div class="h-full w-full flex items-center justify-center">
              <div class="text-center">
                <div
                  class="text-[16px] mb-2 text-[var(--el-text-color-secondary)]"
                >
                  视频预览
                </div>
                <div class="font-semibold">预览区（原型占位）</div>
                <div
                  v-if="currentCamera"
                  class="text-sm text-[var(--el-text-color-secondary)] mt-2"
                >
                  状态：
                  <el-tag :type="statusType(currentCamera.status)">{{
                    statusLabel(currentCamera.status)
                  }}</el-tag>
                </div>
                <div class="text-xs text-[var(--el-text-color-secondary)] mt-2">
                  后续：接入实时流，并与三维对象/设备台账联动
                </div>
              </div>
            </div>
          </div>

          <div class="mt-3">
            <el-space wrap>
              <el-button @click="openViewer">联动到三维查看</el-button>
              <el-button type="primary" @click="openSmartSearch"
                >用KKS搜索</el-button
              >
            </el-space>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>
