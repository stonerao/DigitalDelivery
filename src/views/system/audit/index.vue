<script setup>
import dayjs from "dayjs";
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";
import { exportAuditLogsApi, listAuditLogsApi } from "@/api/systemAudit";

defineOptions({
  name: "SystemAudit"
});

const router = useRouter();

const form = reactive({
  operation: "",
  username: "",
  timeRange: []
});

const typeOptions = [
  { label: "全部", value: "" },
  { label: "登录", value: "login" },
  { label: "退出", value: "logout" },
  { label: "新增", value: "create" },
  { label: "修改", value: "update" },
  { label: "删除", value: "delete" },
  { label: "导入", value: "import" }
];

const logs = ref([]);
const tableLoading = ref(false);
const pager = reactive({
  page: 1,
  size: 20,
  total: 0
});

const currentDisplayPage = computed(() => pager.page + 1);

function isApiSuccess(res) {
  return res?.success === true || res?.code === 200 || res?.code === 0;
}

function normalizeLogsFromResponse(res) {
  const payload = res?.data;
  const list = Array.isArray(payload)
    ? payload
    : payload?.records ||
      payload?.list ||
      payload?.content ||
      payload?.items ||
      payload?.rows ||
      [];
  pager.total =
    payload?.total ?? payload?.totalElements ?? payload?.count ?? list.length;

  return (Array.isArray(list) ? list : []).map((item, index) => ({
    id: item?.id ?? `log-${index + 1}`,
    type: item?.operation || item?.type || "",
    user: item?.username || item?.user || "-",
    action: item?.action || item?.operationDesc || item?.operation || "-",
    target: item?.target || item?.module || item?.resource || "-",
    ip: item?.ip || item?.ipAddress || "-",
    time: item?.time || item?.createdAt || item?.timestamp || "-",
    detail: item?.detail || item?.message || item?.description || "-"
  }));
}

function buildQueryParams(withPage = true) {
  const [start, end] = form.timeRange || [];
  const params = {
    username: form.username?.trim() || undefined,
    operation: form.operation || undefined,
    startTime: start ? dayjs(start).format("YYYY-MM-DD HH:mm:ss") : undefined,
    endTime: end ? dayjs(end).format("YYYY-MM-DD HH:mm:ss") : undefined
  };
  if (withPage) {
    params.page = pager.page;
    params.size = pager.size;
  }
  return params;
}

async function fetchLogs() {
  tableLoading.value = true;
  try {
    const res = await listAuditLogsApi(buildQueryParams(true));
    if (!isApiSuccess(res)) {
      throw new Error(res?.message || "获取日志失败");
    }
    logs.value = normalizeLogsFromResponse(res);
  } catch (error) {
    logs.value = [];
    pager.total = 0;
    message(error?.message || "获取日志失败", { type: "error" });
  } finally {
    tableLoading.value = false;
  }
}

const filteredLogs = computed(() => {
  const kw = form.username.trim().toLowerCase();
  return logs.value.filter(l => {
    const hitType = form.operation ? l.type === form.operation : true;
    const hitKw = kw
      ? `${l.user} ${l.action} ${l.target} ${l.ip} ${l.detail}`
          .toLowerCase()
          .includes(kw)
      : true;
    return hitType && hitKw;
  });
});

function typeLabel(v) {
  const map = Object.fromEntries(typeOptions.map(i => [i.value, i.label]));
  return map[v] || v;
}

function typeTagType(v) {
  const map = {
    login: "success",
    logout: "info",
    create: "success",
    update: "warning",
    delete: "danger",
    import: "primary"
  };
  return map[v] || "info";
}

const detailOpen = ref(false);
const detailRow = ref(null);
function openDetail(row) {
  detailRow.value = row;
  detailOpen.value = true;
}

async function exportLogs() {
  try {
    const res = await exportAuditLogsApi(buildQueryParams(false));
    if (!isApiSuccess(res)) {
      throw new Error(res?.message || "导出日志失败");
    }
    const url = res?.data?.url || res?.data?.downloadUrl;
    if (url) {
      window.open(url, "_blank");
      message("已开始导出", { type: "success" });
      return;
    }
    message("导出成功", { type: "success" });
  } catch (error) {
    message(error?.message || "导出日志失败", { type: "error" });
  }
}

function handleSearch() {
  pager.page = 0;
  fetchLogs();
}

function handleReset() {
  form.operation = "";
  form.username = "";
  form.timeRange = [];
  pager.page = 0;
  fetchLogs();
}

function handlePageChange(page) {
  pager.page = Math.max(0, page - 1);
  fetchLogs();
}

function handleSizeChange(size) {
  pager.size = size;
  pager.page = 0;
  fetchLogs();
}

function jumpToTarget(row) {
  if (!row?.target) return;
  const map = {
    数据管理: "/handover/data",
    用户权限: "/system/users",
    系统配置: "/system/settings",
    文档管理: "/handover/documents",
    模型管理: "/handover/models"
  };
  const path = map[row.target];
  if (!path) {
    message("暂无可跳转目标（演示）", { type: "info" });
    return;
  }
  router.push(path);
}

onMounted(() => {
  fetchLogs();
});
</script>

<template>
  <div class="dd-page">
    <el-card shadow="never" class="mb-4">
      <el-form :inline="true" :model="form">
        <el-form-item label="类型">
          <el-select v-model="form.operation" style="width: 160px" clearable>
            <el-option
              v-for="t in typeOptions"
              :key="t.value"
              :label="t.label"
              :value="t.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="用户">
          <el-input
            v-model="form.username"
            placeholder="输入用户名"
            style="width: 180px"
            clearable
          />
        </el-form-item>
        <el-form-item label="时间">
          <el-date-picker
            v-model="form.timeRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
        <el-form-item>
          <el-button @click="exportLogs">导出</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="font-semibold">审计日志</div>
          <div class="text-xs text-[var(--el-text-color-secondary)]">
            共 {{ pager.total }} 条
          </div>
        </div>
      </template>

      <el-table v-loading="tableLoading" :data="filteredLogs" stripe>
        <el-table-column label="类型" width="110">
          <template #default="scope">
            <el-tag :type="typeTagType(scope.row.type)">{{
              typeLabel(scope.row.type)
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="user" label="用户" width="140" />
        <el-table-column
          prop="action"
          label="动作"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column prop="target" label="模块" width="140" />
        <el-table-column prop="ip" label="IP" width="140" />
        <el-table-column prop="time" label="时间" width="160" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="scope">
            <el-space>
              <el-button link type="primary" @click="openDetail(scope.row)"
                >详情</el-button
              >
              <el-button link type="primary" @click="jumpToTarget(scope.row)"
                >跳转</el-button
              >
            </el-space>
          </template>
        </el-table-column>
      </el-table>

      <div class="mt-4 flex justify-end">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next"
          :total="pager.total"
          :current-page="currentDisplayPage"
          :page-size="pager.size"
          :page-sizes="[10, 20, 50, 100]"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="detailOpen" title="日志详情" width="620px">
      <div v-if="detailRow" class="text-sm">
        <div class="mb-2">
          <span class="font-semibold">类型：</span
          >{{ typeLabel(detailRow.type) }}
        </div>
        <div class="mb-2">
          <span class="font-semibold">用户：</span>{{ detailRow.user }}
        </div>
        <div class="mb-2">
          <span class="font-semibold">动作：</span>{{ detailRow.action }}
        </div>
        <div class="mb-2">
          <span class="font-semibold">模块：</span>{{ detailRow.target }}
        </div>
        <div class="mb-2">
          <span class="font-semibold">IP：</span>{{ detailRow.ip }}
        </div>
        <div class="mb-2">
          <span class="font-semibold">时间：</span>{{ detailRow.time }}
        </div>
        <div class="mb-2">
          <span class="font-semibold">详情：</span>{{ detailRow.detail }}
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="detailOpen = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>
