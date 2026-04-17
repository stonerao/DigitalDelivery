<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { message } from "@/utils/message";
import { getHandoverSystemNodeOptions } from "@/api/handoverDictionary";
import {
  exportHandoverKks,
  getHandoverKksImportTask,
  getHandoverKksList,
  getHandoverKksValidateTask,
  getHandoverKksVersions,
  importHandoverKks,
  validateHandoverKksAll,
  validateHandoverKksOne
} from "@/api/handoverData";

defineOptions({
  name: "HandoverData"
});

const route = useRoute();

const keyword = ref("");
const tableLoading = ref(false);
const versionLoading = ref(false);
const validating = ref(false);
const exporting = ref(false);
const rowValidatingId = ref("");
const importSubmitting = ref(false);

const records = ref([]);
const versions = ref([]);
const nodeOptions = ref([]);
const importFiles = ref([]);
const selectedVersionId = ref("");
const pagination = ref({
  page: 1,
  size: 20,
  total: 0
});

const statusOptions = [
  { label: "全部状态", value: "" },
  { label: "已校验", value: "VALID" },
  { label: "待校验", value: "PENDING" },
  { label: "异常", value: "INVALID" }
];
const importModeOptions = [
  { label: "合并导入", value: "merge" },
  { label: "替换导入", value: "replace" }
];
const status = ref("");
const nodeIdFilter = ref("");
const importForm = ref({
  importMode: "merge",
  note: ""
});
const activeImportTask = ref(null);
const activeValidateTask = ref(null);
const latestImportResult = ref(null);
const latestValidateResult = ref(null);
const latestExportResult = ref(null);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const allowedImportExtensions = [".xlsx", ".xls", ".csv"];
const isApiSuccess = response =>
  response?.success === true || response?.code === 200 || response?.code === 0;

function unwrapApiData(response, fallbackMessage) {
  if (!isApiSuccess(response)) {
    throw new Error(response?.message || fallbackMessage);
  }
  return response?.data;
}

function readOptionList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.options)) return data.options;
  if (Array.isArray(data?.list)) return data.list;
  return [];
}

function normalizeOption(item) {
  const value = item?.value ?? item?.id ?? item?.nodeId ?? item?.kks;
  const label = item?.label ?? item?.name ?? item?.title ?? item?.kks;
  return value && label
    ? {
        label: String(label),
        value: String(value)
      }
    : null;
}

async function loadNodeOptions() {
  try {
    const response = await getHandoverSystemNodeOptions();
    const data = unwrapApiData(response, "加载系统节点选项失败");
    nodeOptions.value = readOptionList(data)
      .map(normalizeOption)
      .filter(Boolean);
  } catch (error) {
    nodeOptions.value = [];
    message(error?.message || "加载系统节点选项失败", { type: "error" });
  }
}

function normalizeStatus(raw) {
  const value = String(raw || "").toUpperCase();
  if (value === "VALID" || value === "SUCCESS" || value === "已校验") {
    return "已校验";
  }
  if (value === "INVALID" || value === "FAILED" || value === "异常") {
    return "异常";
  }
  return "待校验";
}

function normalizeCategory(raw) {
  const value = String(raw || "").trim();
  if (!value) return "-";
  const upper = value.toUpperCase();
  if (upper === "DEVICE") return "设备";
  if (upper === "MEASUREMENT") return "测点";
  if (upper === "SYSTEM") return "系统";
  return value;
}

function resolveNodeLabel(nodeId) {
  if (!nodeId) return "-";
  const hit = nodeOptions.value.find(item => item.value === String(nodeId));
  return hit?.label || String(nodeId);
}

async function loadRecords() {
  tableLoading.value = true;
  try {
    const response = await getHandoverKksList({
      keyword: keyword.value.trim() || undefined,
      status: status.value || undefined,
      nodeId: nodeIdFilter.value || undefined,
      page: pagination.value.page,
      size: pagination.value.size
    });
    const data = unwrapApiData(response, "加载台账数据失败");
    const list = Array.isArray(data?.records) ? data.records : [];
    records.value = list.map(item => ({
      ...item,
      statusText: normalizeStatus(item.status),
      categoryText: normalizeCategory(item.category),
      systemNodeLabel: resolveNodeLabel(item.systemNodeId)
    }));
    pagination.value.total = Number(data?.total ?? 0);
    pagination.value.page = Number(data?.page ?? pagination.value.page ?? 1);
    pagination.value.size = Number(data?.size ?? pagination.value.size ?? 20);
  } catch (error) {
    records.value = [];
    pagination.value.total = 0;
    message(error?.message || "加载台账数据失败", { type: "error" });
  } finally {
    tableLoading.value = false;
  }
}

async function loadVersions() {
  versionLoading.value = true;
  try {
    const response = await getHandoverKksVersions();
    const data = unwrapApiData(response, "加载版本记录失败");
    versions.value = Array.isArray(data?.records) ? data.records : [];
    if (!selectedVersionId.value && versions.value.length > 0) {
      selectedVersionId.value = versions.value[0].id || "";
    }
  } catch (error) {
    versions.value = [];
    message(error?.message || "加载版本记录失败", { type: "error" });
  } finally {
    versionLoading.value = false;
  }
}

async function waitTask(taskId, getStatus, onProgress) {
  const doneFlags = ["DONE", "SUCCESS", "COMPLETED", "FINISHED"];
  const failedFlags = ["FAILED", "ERROR", "CANCEL", "ABORT"];

  for (let i = 0; i < 30; i += 1) {
    const response = await getStatus({ taskId });
    const data = unwrapApiData(response, "获取任务状态失败");
    const current = String(data?.status || "").toUpperCase();
    onProgress?.(data);

    if (doneFlags.some(flag => current.includes(flag))) {
      return data;
    }

    if (failedFlags.some(flag => current.includes(flag))) {
      throw new Error(`任务执行失败(${current || "UNKNOWN"})`);
    }

    await sleep(1000);
  }

  throw new Error("任务执行超时，请稍后刷新查看结果");
}

async function refreshAll() {
  await Promise.all([loadNodeOptions(), loadRecords(), loadVersions()]);
}

function applyQuery() {
  const q = route.query?.q;
  if (typeof q === "string") {
    keyword.value = q;
  }
}

onMounted(() => {
  applyQuery();
  refreshAll();
});

watch(
  () => route.query?.q,
  () => {
    applyQuery();
    pagination.value.page = 1;
    loadRecords();
  }
);

let keywordTimer;
watch(keyword, () => {
  if (keywordTimer) {
    clearTimeout(keywordTimer);
  }

  keywordTimer = setTimeout(() => {
    pagination.value.page = 1;
    loadRecords();
  }, 300);
});

watch(status, () => {
  pagination.value.page = 1;
  loadRecords();
});

watch(nodeIdFilter, () => {
  pagination.value.page = 1;
  loadRecords();
});

onBeforeUnmount(() => {
  if (keywordTimer) {
    clearTimeout(keywordTimer);
  }
});

const importVisible = ref(false);

async function openImport() {
  importForm.value = {
    importMode: "merge",
    note: ""
  };
  importFiles.value = [];
  importVisible.value = true;
}

function handleImportFileChange(_file, fileList) {
  const validFiles = [];
  const invalidNames = [];

  fileList.forEach(item => {
    const rawFile = item?.raw || item;
    const fileName = String(item?.name || rawFile?.name || "");
    const lowerName = fileName.toLowerCase();
    const isValid = allowedImportExtensions.some(ext =>
      lowerName.endsWith(ext)
    );

    if (isValid) {
      validFiles.push(item);
    } else if (fileName) {
      invalidNames.push(fileName);
    }
  });

  importFiles.value = validFiles;

  if (invalidNames.length > 0) {
    message(`仅支持 xlsx、xls、csv 格式，已移除: ${invalidNames.join("、")}`, {
      type: "warning"
    });
  }
}

function handleImportFileRemove(_file, fileList) {
  importFiles.value = [...fileList];
}

async function onImported(files) {
  if (!Array.isArray(files) || files.length === 0) return;

  importSubmitting.value = true;
  try {
    const formData = new FormData();
    files.forEach(file => {
      const rawFile = file?.raw || file;
      if (rawFile instanceof Blob) {
        formData.append("files", rawFile, file?.name || rawFile.name || "file");
      }
    });
    formData.append("importMode", importForm.value.importMode || "merge");
    formData.append(
      "note",
      importForm.value.note || `导入 ${files.length} 个文件`
    );

    const response = await importHandoverKks(formData);
    const data = unwrapApiData(response, "导入台账失败");
    const taskId = data?.taskId;
    activeImportTask.value = taskId
      ? {
          taskId,
          status: data?.status || "SUBMITTED",
          total: 0,
          inserted: 0,
          updated: 0,
          failed: 0,
          errorFileUrl: ""
        }
      : null;

    if (!taskId) {
      message("导入任务已提交", { type: "success" });
      await refreshAll();
      return;
    }

    const result = await waitTask(
      taskId,
      getHandoverKksImportTask,
      progress => {
        activeImportTask.value = progress;
      }
    );
    latestImportResult.value = result;
    activeImportTask.value = null;
    message(
      `导入完成: 总计 ${result?.total ?? 0}，新增 ${result?.inserted ?? 0}，更新 ${result?.updated ?? 0}，失败 ${result?.failed ?? 0}`,
      { type: "success" }
    );
    await refreshAll();
  } catch (error) {
    activeImportTask.value = null;
    message(error?.message || "导入台账失败", { type: "error" });
  } finally {
    importSubmitting.value = false;
  }
}

function closeImportDialog() {
  if (importSubmitting.value) return;
  importVisible.value = false;
  importFiles.value = [];
}

async function submitImport() {
  const selectedFiles = importFiles.value
    .map(item => item?.raw || item)
    .filter(file => file instanceof Blob);

  if (selectedFiles.length === 0) {
    message("请先选择要导入的文件", { type: "warning" });
    return;
  }

  await onImported(importFiles.value);

  if (!importSubmitting.value) {
    closeImportDialog();
  }
}

async function validateAll() {
  validating.value = true;
  try {
    const response = await validateHandoverKksAll();
    const data = unwrapApiData(response, "数据校验失败");
    const taskId = data?.taskId;
    activeValidateTask.value = taskId
      ? {
          taskId,
          status: data?.status || "SUBMITTED",
          updated: 0,
          abnormal: 0,
          reportId: ""
        }
      : null;

    if (!taskId) {
      message("校验任务已提交", { type: "success" });
      await loadRecords();
      return;
    }

    const result = await waitTask(
      taskId,
      getHandoverKksValidateTask,
      progress => {
        activeValidateTask.value = progress;
      }
    );
    latestValidateResult.value = result;
    activeValidateTask.value = null;
    message(
      `校验完成，更新 ${result?.updated ?? 0} 条，异常 ${result?.abnormal ?? 0} 条`,
      { type: "success" }
    );
    await loadRecords();
  } catch (error) {
    activeValidateTask.value = null;
    message(error?.message || "数据校验失败", { type: "error" });
  } finally {
    validating.value = false;
  }
}

function triggerDownload(url) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.download = "";
  anchor.click();
}

async function exportData() {
  exporting.value = true;
  try {
    const response = await exportHandoverKks({
      keyword: keyword.value.trim() || undefined,
      status: status.value || undefined,
      nodeId: nodeIdFilter.value || undefined,
      page: pagination.value.page,
      size: pagination.value.size
    });
    const data = unwrapApiData(response, "导出台账失败");

    if (!data?.url) {
      message("未获取到导出链接", { type: "warning" });
      return;
    }

    latestExportResult.value = data;
    triggerDownload(data.url);
    message("导出链接已生成，正在下载", { type: "success" });
  } catch (error) {
    message(error?.message || "导出台账失败", { type: "error" });
  } finally {
    exporting.value = false;
  }
}

function onSizeChange(size) {
  pagination.value.size = size;
  pagination.value.page = 1;
  loadRecords();
}

function onPageChange(page) {
  pagination.value.page = Math.max(1, page);
  loadRecords();
}

const statusTagType = value => {
  if (value === "已校验") return "success";
  if (value === "待校验") return "warning";
  if (value === "异常") return "danger";
  return "info";
};

async function validateOne(row) {
  if (!row?.kks || rowValidatingId.value) return;
  rowValidatingId.value = row.id;
  try {
    const response = await validateHandoverKksOne({ kks: row.kks });
    const data = unwrapApiData(response, `KKS ${row.kks} 校验失败`);
    const taskId = data?.taskId;
    activeValidateTask.value = taskId
      ? {
          taskId,
          status: data?.status || "SUBMITTED",
          updated: 0,
          abnormal: 0,
          reportId: ""
        }
      : null;

    if (!taskId) {
      message(`KKS ${row.kks} 校验任务已提交`, { type: "success" });
      await loadRecords();
      return;
    }

    const result = await waitTask(
      taskId,
      getHandoverKksValidateTask,
      progress => {
        activeValidateTask.value = progress;
      }
    );
    latestValidateResult.value = result;
    activeValidateTask.value = null;
    message(
      `KKS ${row.kks} 校验完成，更新 ${result?.updated ?? 0} 条，异常 ${result?.abnormal ?? 0} 条`,
      { type: "success" }
    );
    await loadRecords();
  } catch (error) {
    activeValidateTask.value = null;
    message(error?.message || `KKS ${row.kks} 校验失败`, { type: "error" });
  } finally {
    rowValidatingId.value = "";
  }
}

function openExternalUrl(url) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}
</script>

<template>
  <div class="dd-page">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex gap-2">
        <el-button type="primary" @click="openImport">导入数据</el-button>
        <el-button :loading="validating" @click="validateAll">
          数据校验
        </el-button>
        <el-button :loading="exporting" @click="exportData">导出</el-button>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :xs="24" :lg="16" class="mb-4">
        <el-card shadow="never">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="font-semibold">设备/台账数据</div>
              <el-input
                v-model="keyword"
                placeholder="搜索 KKS / 名称 / 类型..."
                clearable
                class="max-w-[320px]"
              />
              <el-select v-model="status" class="w-[160px]">
                <el-option
                  v-for="item in statusOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <el-select
                v-model="nodeIdFilter"
                clearable
                filterable
                class="w-[220px]"
                placeholder="筛选系统节点"
              >
                <el-option
                  v-for="item in nodeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>
          </template>

          <el-table
            v-loading="tableLoading"
            :data="records"
            row-key="id"
            stripe
          >
            <el-table-column prop="kks" label="KKS编码" min-width="160" />
            <el-table-column prop="name" label="名称" min-width="220" />
            <el-table-column prop="type" label="类型" width="120" />
            <el-table-column prop="categoryText" label="分类" width="140" />
            <el-table-column label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.statusText)" effect="light">
                  {{ row.statusText }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              prop="systemNodeLabel"
              label="系统节点"
              min-width="220"
              show-overflow-tooltip
            />
            <el-table-column prop="createdAt" label="创建时间" width="180" />
            <el-table-column prop="updatedAt" label="更新时间" width="180" />
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button
                  text
                  type="primary"
                  :loading="rowValidatingId === row.id"
                  @click="validateOne(row)"
                >
                  单条校验
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="mt-3 flex justify-end">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next"
              :total="pagination.total"
              :current-page="pagination.page"
              :page-size="pagination.size"
              :page-sizes="[20, 50, 100]"
              @size-change="onSizeChange"
              @current-change="onPageChange"
            />
          </div>

          <div class="text-xs text-[var(--el-text-color-secondary)] mt-3">
            说明：当前列表、导入、校验、导出、版本记录均已对接后端接口。
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="8" class="mb-4">
        <el-card shadow="never">
          <template #header>
            <div class="font-semibold">版本记录</div>
          </template>
          <el-skeleton v-if="versionLoading" :rows="4" animated />
          <div
            v-else-if="versions.length === 0"
            class="text-sm text-[var(--el-text-color-secondary)]"
          >
            暂无版本记录。
          </div>
          <div
            v-for="v in versions"
            :key="v.id"
            class="mb-3 last:mb-0 cursor-pointer rounded px-2 py-1"
            :class="
              selectedVersionId === v.id
                ? 'bg-[var(--el-fill-color-light)]'
                : ''
            "
            @click="selectedVersionId = v.id"
          >
            <div class="font-semibold truncate">{{ v.name }}</div>
            <div class="text-xs text-[var(--el-text-color-secondary)] mt-1">
              {{ v.time }}
            </div>
            <div class="text-xs text-[var(--el-text-color-secondary)]">
              {{ v.note }}
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="mt-4">
          <template #header>
            <div class="font-semibold">任务结果</div>
          </template>
          <div class="space-y-3 text-sm">
            <div v-if="activeValidateTask">
              <div class="font-semibold">校验进行中</div>
              <div class="text-[var(--el-text-color-secondary)] mt-1">
                任务ID：{{ activeValidateTask.taskId || "-" }}
              </div>
              <div class="text-[var(--el-text-color-secondary)]">
                状态：{{ activeValidateTask.status || "-" }}，更新
                {{ activeValidateTask.updated ?? 0 }}，异常
                {{ activeValidateTask.abnormal ?? 0 }}
              </div>
            </div>

            <div v-if="activeImportTask">
              <div class="font-semibold">导入进行中</div>
              <div class="text-[var(--el-text-color-secondary)] mt-1">
                任务ID：{{ activeImportTask.taskId || "-" }}
              </div>
              <div class="text-[var(--el-text-color-secondary)]">
                状态：{{ activeImportTask.status || "-" }}，总计
                {{ activeImportTask.total ?? 0 }}，新增
                {{ activeImportTask.inserted ?? 0 }}，更新
                {{ activeImportTask.updated ?? 0 }}，失败
                {{ activeImportTask.failed ?? 0 }}
              </div>
            </div>

            <div v-if="latestValidateResult">
              <div class="font-semibold">最近校验</div>
              <div class="text-[var(--el-text-color-secondary)] mt-1">
                状态：{{ latestValidateResult.status || "-" }}，更新
                {{ latestValidateResult.updated ?? 0 }}，异常
                {{ latestValidateResult.abnormal ?? 0 }}
              </div>
              <div
                v-if="latestValidateResult.reportId"
                class="text-[var(--el-text-color-secondary)]"
              >
                报告ID：{{ latestValidateResult.reportId }}
              </div>
            </div>

            <div v-if="latestImportResult">
              <div class="font-semibold">最近导入</div>
              <div class="text-[var(--el-text-color-secondary)] mt-1">
                状态：{{ latestImportResult.status || "-" }}，总计
                {{ latestImportResult.total ?? 0 }}，新增
                {{ latestImportResult.inserted ?? 0 }}，更新
                {{ latestImportResult.updated ?? 0 }}，失败
                {{ latestImportResult.failed ?? 0 }}
              </div>
              <el-button
                v-if="latestImportResult.errorFileUrl"
                text
                type="danger"
                @click="openExternalUrl(latestImportResult.errorFileUrl)"
              >
                下载错误文件
              </el-button>
            </div>

            <div v-if="latestExportResult">
              <div class="font-semibold">最近导出</div>
              <div class="text-[var(--el-text-color-secondary)] mt-1">
                签名链接：{{ latestExportResult.signed ? "是" : "否" }}，
                失效时间：{{ latestExportResult.expireAt || "-" }}
              </div>
              <div class="text-[var(--el-text-color-secondary)]">
                审计日志ID：{{ latestExportResult.auditLogId || "-" }}
              </div>
            </div>

            <div
              v-if="
                !activeValidateTask &&
                !activeImportTask &&
                !latestValidateResult &&
                !latestImportResult &&
                !latestExportResult
              "
              class="text-[var(--el-text-color-secondary)]"
            >
              暂无最近任务结果。
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog
      v-model="importVisible"
      title="从文档管理导入数据"
      width="900px"
      :close-on-click-modal="!importSubmitting"
      :close-on-press-escape="!importSubmitting"
    >
      <div class="space-y-4">
        <el-form label-width="90px">
          <el-form-item label="导入模式">
            <el-radio-group v-model="importForm.importMode">
              <el-radio
                v-for="item in importModeOptions"
                :key="item.value"
                :label="item.value"
              >
                {{ item.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="导入说明">
            <el-input
              v-model="importForm.note"
              type="textarea"
              :rows="3"
              placeholder="请输入导入说明"
            />
          </el-form-item>
        </el-form>

        <div class="rounded border border-[var(--el-border-color-light)] p-3">
          <el-upload
            drag
            multiple
            action="#"
            accept=".xlsx,.xls,.csv"
            :auto-upload="false"
            :file-list="importFiles"
            :disabled="importSubmitting"
            :on-change="handleImportFileChange"
            :on-remove="handleImportFileRemove"
          >
            <div class="el-upload__text">
              拖放文件到此处或点击选择文件
              <div class="text-xs text-[var(--el-text-color-secondary)] mt-2">
                仅支持 xlsx、xls、csv 格式，支持一次导入多个文件。
              </div>
            </div>
          </el-upload>

          <div class="mt-3 text-xs text-[var(--el-text-color-secondary)]">
            已选 {{ importFiles.length }} 个文件。
          </div>
        </div>
      </div>
      <template #footer>
        <el-button :disabled="importSubmitting" @click="closeImportDialog">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="importSubmitting"
          @click="submitImport"
        >
          开始导入
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
