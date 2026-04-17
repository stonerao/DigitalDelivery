<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";
import { useUserStoreHook } from "@/store/modules/user";
import UploadDialog from "../components/UploadDialog.vue";
import {
  getDashboardStats,
  getHandoverDocuments,
  getHandoverKks,
  getHandoverModels,
  quickUploadDashboard,
  uploadHandoverDocuments
} from "@/api/handoverDashboard";

defineOptions({
  name: "HandoverDashboard"
});

const router = useRouter();

const currentUser = computed(() => {
  const userStore = useUserStoreHook();
  return userStore?.nickname || userStore?.username || "当前用户";
});

const refreshing = ref(false);
const uploadDialogVisible = ref(false);

const quickActions = [
  {
    key: "upload",
    label: "快速上传",
    type: "primary",
    action: () => openUploadDialog()
  },
  {
    key: "search",
    label: "关联搜索",
    action: () => router.push("/search-nav/search")
  },
  {
    key: "viewer3d",
    label: "三维浏览",
    action: () => router.push("/visualization/3d-viewer")
  },
  {
    key: "projects",
    label: "项目管理",
    action: () => router.push("/handover/projects")
  }
];

const stats = ref([
  {
    value: 0,
    label: "文档数量",
    changeText: "持平",
    changeType: "success"
  },
  {
    value: 0,
    label: "三维模型",
    changeText: "持平",
    changeType: "success"
  },
  {
    value: 0,
    label: "设备编码",
    changeText: "持平",
    changeType: "success"
  },
  {
    value: 0,
    label: "活跃项目",
    changeText: "持平",
    changeType: "success"
  }
]);

const activities = ref([]);

function unwrapData(resp) {
  return resp?.data ?? resp ?? {};
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatChange(rate) {
  const ratio = toNumber(rate);
  const percent = Math.abs(ratio * 100);
  const formattedPercent = Number.isInteger(percent)
    ? String(percent)
    : percent.toFixed(2).replace(/\.?0+$/, "");

  if (ratio > 0) {
    return {
      changeText: `较上期 +${formattedPercent}%`,
      changeType: "success"
    };
  }
  if (ratio < 0) {
    return {
      changeText: `较上期 -${formattedPercent}%`,
      changeType: "danger"
    };
  }
  return {
    changeText: "较上期 持平",
    changeType: "success"
  };
}

function buildStatsCards(rawStats) {
  const dashboardStats = rawStats || {};
  return [
    {
      value: toNumber(dashboardStats.documentCount),
      label: "文档数量",
      ...formatChange(dashboardStats.documentChangeRate)
    },
    {
      value: toNumber(dashboardStats.modelCount),
      label: "三维模型",
      ...formatChange(dashboardStats.modelChangeRate)
    },
    {
      value: toNumber(dashboardStats.kksCount),
      label: "设备编码",
      ...formatChange(dashboardStats.kksChangeRate)
    },
    {
      value: toNumber(dashboardStats.activeProjectCount),
      label: "活跃项目",
      ...formatChange(dashboardStats.activeProjectChangeRate)
    }
  ];
}

function toTimestamp(value) {
  if (!value) return 0;
  const t = new Date(String(value).replace(/-/g, "/")).getTime();
  return Number.isFinite(t) ? t : 0;
}

function formatRelativeTime(rawTime) {
  const timestamp = toTimestamp(rawTime);
  if (!timestamp) return "-";
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) return "刚刚";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}分钟前`;
  if (diff < 24 * 60 * 60 * 1000)
    return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
  const d = new Date(timestamp);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}-${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normalizeStatusType(statusText) {
  if (!statusText) return "info";
  if (statusText.includes("异常") || statusText.includes("失败"))
    return "danger";
  if (statusText.includes("待") || statusText.includes("进行"))
    return "warning";
  return "success";
}

function buildRecentActivities(docRecords, modelRecords, kksRecords) {
  const docs = (docRecords || []).map(item => ({
    rawTime: item.updatedAt || item.createdAt,
    action: `更新文档：${item.name || "-"}`,
    user: item.updatedBy || item.createdBy || "-",
    statusText: "完成"
  }));

  const models = (modelRecords || []).map(item => ({
    rawTime: item.updatedAt,
    action: `更新模型：${item.name || "-"}`,
    user: item.updatedBy || "-",
    statusText: item.status === "processing" ? "进行中" : "完成"
  }));

  const kks = (kksRecords || []).map(item => ({
    rawTime: item.updatedAt,
    action: `更新设备编码：${item.kks || item.name || "-"}`,
    user: item.updatedBy || "-",
    statusText: item.status || "完成"
  }));

  return [...docs, ...models, ...kks]
    .sort((a, b) => toTimestamp(b.rawTime) - toTimestamp(a.rawTime))
    .slice(0, 20)
    .map(item => ({
      time: formatRelativeTime(item.rawTime),
      action: item.action,
      user: item.user,
      statusText: item.statusText,
      statusType: normalizeStatusType(item.statusText)
    }));
}

async function loadDashboardData(showSuccessMessage = false) {
  try {
    refreshing.value = true;
    const [statsRes, docRes, modelRes, kksRes] = await Promise.all([
      getDashboardStats(),
      getHandoverDocuments({ page: 1, size: 5 }),
      getHandoverModels({ page: 1, size: 5 }),
      getHandoverKks({ page: 1, size: 5 })
    ]);

    const statsData = unwrapData(statsRes);
    const docData = unwrapData(docRes);
    const modelData = unwrapData(modelRes);
    const kksData = unwrapData(kksRes);

    stats.value = buildStatsCards(statsData);

    activities.value = buildRecentActivities(
      docData.records,
      modelData.records,
      kksData.records
    );

    if (showSuccessMessage) {
      message("仪表板数据已刷新", { type: "success" });
    }
  } catch (error) {
    console.error("load dashboard data failed", error);
    message("获取仪表板数据失败", { type: "error" });
  } finally {
    refreshing.value = false;
  }
}

function refreshDashboard() {
  loadDashboardData(true);
}

function openUploadDialog() {
  uploadDialogVisible.value = true;
}

async function appendUploadActivities(payload) {
  const files = payload?.files ?? [];
  if (files.length === 0) return;

  const formData = new FormData();
  files.forEach(file => {
    const rawFile = file?.raw || file;
    if (rawFile instanceof Blob) {
      formData.append("files", rawFile, file?.name || rawFile.name || "file");
    }
  });
  formData.append("folderId", "root");
  if (payload?.transferDepth) {
    formData.append("transferDepth", payload.transferDepth);
  }

  let uploadedCount = 0;
  let uploadedIds = [];

  try {
    const uploadRes = await uploadHandoverDocuments({ data: formData });
    const uploadData = unwrapData(uploadRes);
    uploadedCount = toNumber(uploadData.uploadedCount);
    uploadedIds = (uploadData.records || [])
      .map(item => item?.id)
      .filter(Boolean);

    if (uploadedIds.length > 0) {
      await quickUploadDashboard({
        strings: uploadedIds,
        dashboardQuickUploadRequest: {
          transferDepth: payload.transferDepth || "",
          projectId: ""
        }
      });
    }
  } catch (error) {
    console.error("quick upload failed", error);
    message("上传后处理失败，请稍后重试", { type: "error" });
    return;
  }

  const fileNames = (payload?.files ?? []).map(f => f?.name).filter(Boolean);
  const depthLabel = payload?.transferDepthLabel || "";
  const action =
    fileNames.length <= 1
      ? `上传文档：${fileNames[0] ?? "(未命名文件)"}（移交深度：${depthLabel}）`
      : `上传文档：${fileNames[0]} 等${fileNames.length}个文件（移交深度：${depthLabel}）`;

  activities.value.unshift({
    time: "刚刚",
    action,
    user: currentUser.value,
    statusText: `完成（${uploadedCount || uploadedIds.length}）`,
    statusType: "success"
  });

  if (activities.value.length > 20) activities.value.length = 20;
  message("快速上传处理完成", { type: "success" });
  loadDashboardData();
}

onMounted(() => {
  loadDashboardData();
});
</script>

<template>
  <div class="dd-page">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex gap-2">
        <el-button :loading="refreshing" @click="refreshDashboard"
          >刷新数据</el-button
        >
        <el-button type="primary" @click="openUploadDialog">
          快速上传
        </el-button>
      </div>
    </div>

    <el-row :gutter="16" class="mb-4">
      <el-col
        v-for="item in stats"
        :key="item.label"
        :xs="24"
        :sm="12"
        :md="12"
        :lg="6"
        class="mb-4"
      >
        <el-card shadow="never">
          <div class="flex items-start justify-between">
            <div>
              <div class="text-[26px] font-semibold leading-none">
                {{ item.value.toLocaleString() }}
              </div>
              <div class="text-sm text-[var(--el-text-color-secondary)] mt-1">
                {{ item.label }}
              </div>
              <div class="mt-2">
                <el-tag
                  v-if="item.changeType === 'success'"
                  type="success"
                  effect="light"
                >
                  {{ item.changeText }}
                </el-tag>
                <el-tag v-else type="danger" effect="light">
                  {{ item.changeText }}
                </el-tag>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="mb-4">
      <template #header>
        <div class="flex items-center gap-2">
          <span class="font-semibold">近期活动</span>
        </div>
      </template>
      <el-table :data="activities" stripe>
        <el-table-column prop="time" label="时间" width="140" />
        <el-table-column prop="action" label="活动" min-width="260" />
        <el-table-column prop="user" label="用户" width="120" />
        <el-table-column label="状态" width="140">
          <template #default="{ row }">
            <el-tag :type="row.statusType" effect="light">
              {{ row.statusText }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="flex items-center gap-2">
          <span class="font-semibold">快捷操作</span>
        </div>
      </template>
      <el-space wrap>
        <el-button
          v-for="item in quickActions"
          :key="item.key"
          :type="item.type || 'default'"
          @click="item.action"
        >
          {{ item.label }}
        </el-button>
      </el-space>
    </el-card>

    <UploadDialog
      v-model="uploadDialogVisible"
      title="上传文件"
      @uploaded="appendUploadActivities"
    />
  </div>
</template>
