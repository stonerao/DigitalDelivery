<script setup>
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";

defineOptions({
  name: "VisualizationMonitor"
});

const router = useRouter();

const form = reactive({
  keyword: "",
  status: ""
});

const statusOptions = [
  { label: "全部", value: "" },
  { label: "正常", value: "normal" },
  { label: "预警", value: "warn" },
  { label: "告警", value: "alarm" },
  { label: "离线", value: "offline" }
];

const points = ref([
  {
    id: "p1",
    name: "主给水泵A-出口压力",
    area: "锅炉区域",
    kks: "10LAC10CP001",
    unit: "MPa",
    value: 12.6,
    low: 10,
    high: 14,
    status: "normal",
    updatedAt: "2026-01-15 10:20"
  },
  {
    id: "p2",
    name: "主给水泵A-轴承温度",
    area: "锅炉区域",
    kks: "10LAC10CT101",
    unit: "℃",
    value: 88,
    low: 0,
    high: 90,
    status: "warn",
    updatedAt: "2026-01-15 10:20"
  },
  {
    id: "p3",
    name: "DCS机柜-运行状态",
    area: "控制室",
    kks: "10HAA00DS001",
    unit: "-",
    value: 1,
    low: 0,
    high: 1,
    status: "normal",
    updatedAt: "2026-01-15 10:20"
  },
  {
    id: "p4",
    name: "冷却塔-振动值",
    area: "冷却塔",
    kks: "10KAA10CV201",
    unit: "mm/s",
    value: 0,
    low: 0,
    high: 10,
    status: "offline",
    updatedAt: "2026-01-15 10:20"
  }
]);

const filteredPoints = computed(() => {
  const kw = form.keyword.trim().toLowerCase();
  return points.value.filter(p => {
    const hitStatus = form.status ? p.status === form.status : true;
    const hitKw = kw
      ? `${p.name} ${p.area} ${p.kks}`.toLowerCase().includes(kw)
      : true;
    return hitStatus && hitKw;
  });
});

const kpi = computed(() => {
  const total = points.value.length;
  const alarm = points.value.filter(p => p.status === "alarm").length;
  const warn = points.value.filter(p => p.status === "warn").length;
  const offline = points.value.filter(p => p.status === "offline").length;
  return { total, alarm, warn, offline };
});

function statusLabel(s) {
  const map = {
    normal: "正常",
    warn: "预警",
    alarm: "告警",
    offline: "离线"
  };
  return map[s] || s;
}

function statusType(s) {
  const map = {
    normal: "success",
    warn: "warning",
    alarm: "danger",
    offline: "info"
  };
  return map[s] || "info";
}

function calcStatus(p) {
  if (p.status === "offline") return "offline";
  if (typeof p.value !== "number") return "offline";
  if (p.value > p.high) return "alarm";
  if (p.value >= p.high - (p.high - p.low) * 0.05) return "warn";
  return "normal";
}

function simulateRefresh() {
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;

  points.value = points.value.map(p => {
    if (p.status === "offline") return { ...p, updatedAt: stamp };
    const jitter = (Math.random() - 0.5) * (p.high - p.low) * 0.06;
    const nextValue = Math.max(
      p.low,
      Math.min(p.high * 1.05, Number(p.value) + jitter)
    );
    const next = {
      ...p,
      value: Number(nextValue.toFixed(2)),
      updatedAt: stamp
    };
    next.status = calcStatus(next);
    return next;
  });

  message("已刷新监控点位（演示）", { type: "success" });
}

const detailOpen = ref(false);
const detailPoint = ref(null);
const trend = ref([]);

function openDetail(row) {
  detailPoint.value = row;
  trend.value = Array.from({ length: 12 }).map((_, i) => {
    const base = typeof row.value === "number" ? row.value : 0;
    const delta = (Math.random() - 0.5) * (row.high - row.low) * 0.04;
    return {
      time: `T-${12 - i}min`,
      value: Number((base + delta).toFixed(2))
    };
  });
  detailOpen.value = true;
}

function jumpToViewer(row) {
  router.push("/visualization/3d-viewer");
  message(`已联动三维查看：${row.kks}（演示）`, { type: "info" });
}

function jumpToVideo(row) {
  router.push({ path: "/visualization/video", query: { q: row.kks } });
}

function jumpToSearch(row) {
  router.push({ path: "/search-nav/search", query: { q: row.kks } });
}
</script>

<template>
  <div class="dd-page">
    <el-row :gutter="16" class="mb-4">
      <el-col :xs="24" :sm="12" :lg="6" class="mb-4">
        <el-card shadow="never">
          <div class="text-sm text-[var(--el-text-color-secondary)]">
            监控点位
          </div>
          <div class="text-[26px] font-semibold mt-1">{{ kpi.total }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6" class="mb-4">
        <el-card shadow="never">
          <div class="text-sm text-[var(--el-text-color-secondary)]">告警</div>
          <div class="text-[26px] font-semibold mt-1">{{ kpi.alarm }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6" class="mb-4">
        <el-card shadow="never">
          <div class="text-sm text-[var(--el-text-color-secondary)]">预警</div>
          <div class="text-[26px] font-semibold mt-1">{{ kpi.warn }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6" class="mb-4">
        <el-card shadow="never">
          <div class="text-sm text-[var(--el-text-color-secondary)]">离线</div>
          <div class="text-[26px] font-semibold mt-1">{{ kpi.offline }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="mb-4">
      <el-form :inline="true" :model="form">
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width: 160px">
            <el-option
              v-for="s in statusOptions"
              :key="s.value"
              :label="s.label"
              :value="s.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input
            v-model="form.keyword"
            placeholder="名称/区域/KKS"
            style="width: 260px"
            clearable
          />
        </el-form-item>
        <el-form-item>
          <el-space wrap>
            <el-button type="primary" @click="simulateRefresh"
              >刷新（模拟）</el-button
            >
          </el-space>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="font-semibold">监控点位</div>
          <div class="text-xs text-[var(--el-text-color-secondary)]">
            共 {{ filteredPoints.length }} 条
          </div>
        </div>
      </template>

      <el-table :data="filteredPoints" stripe>
        <el-table-column
          prop="name"
          label="点位"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column prop="area" label="区域" width="120" />
        <el-table-column
          prop="kks"
          label="KKS"
          width="160"
          show-overflow-tooltip
        />
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="statusType(scope.row.status)">{{
              statusLabel(scope.row.status)
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="当前值" width="160">
          <template #default="scope">
            <span v-if="scope.row.status === 'offline'">-</span>
            <span v-else>{{ scope.row.value }} {{ scope.row.unit }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="160" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="scope">
            <el-space>
              <el-button link type="primary" @click="openDetail(scope.row)"
                >详情</el-button
              >
              <el-button link type="primary" @click="jumpToViewer(scope.row)"
                >三维</el-button
              >
              <el-button link type="primary" @click="jumpToVideo(scope.row)"
                >视频</el-button
              >
              <el-button link type="primary" @click="jumpToSearch(scope.row)"
                >搜索</el-button
              >
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="detailOpen" title="点位详情" width="640px">
      <div v-if="detailPoint" class="text-sm">
        <div class="mb-2">
          <span class="font-semibold">点位：</span>{{ detailPoint.name }}
        </div>
        <div class="mb-2">
          <span class="font-semibold">区域：</span>{{ detailPoint.area }}
        </div>
        <div class="mb-2">
          <span class="font-semibold">KKS：</span>{{ detailPoint.kks }}
        </div>
        <div class="mb-2">
          <span class="font-semibold">状态：</span>
          <el-tag :type="statusType(detailPoint.status)">{{
            statusLabel(detailPoint.status)
          }}</el-tag>
        </div>
        <div class="mb-2">
          <span class="font-semibold">当前值：</span>
          <span v-if="detailPoint.status === 'offline'">-</span>
          <span v-else>{{ detailPoint.value }} {{ detailPoint.unit }}</span>
        </div>
        <div class="mb-2 text-[var(--el-text-color-secondary)]">
          阈值：{{ detailPoint.low }} ~ {{ detailPoint.high }}
          {{ detailPoint.unit }}
        </div>

        <el-divider />

        <div class="font-semibold mb-2">近 12 分钟趋势（演示）</div>
        <el-table :data="trend" size="small" stripe>
          <el-table-column prop="time" label="时间" width="120" />
          <el-table-column label="数值">
            <template #default="scope"
              >{{ scope.row.value }} {{ detailPoint.unit }}</template
            >
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="detailOpen = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>
