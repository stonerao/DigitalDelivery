<script setup>
import { nextTick, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";
import {
  createHandoverProject,
  getAllHandoverProjects,
  getHandoverProjectDetail,
  getHandoverProjectList,
  updateHandoverProject
} from "@/api/handoverProjects";

defineOptions({
  name: "HandoverProjects"
});

const router = useRouter();
const loading = ref(false);
const detailLoading = ref(false);
const submitLoading = ref(false);
const allProjectsLoaded = ref(false);

const keyword = ref("");
const projects = ref([]);
const detailVisible = ref(false);
const formVisible = ref(false);
const formMode = ref("create");

const pagination = ref({
  page: 1,
  size: 10,
  total: 0
});

const detailData = ref({
  id: "",
  projectName: "",
  projectInfo: "",
  createdAt: "",
  updatedAt: "",
  createdBy: "",
  updatedBy: ""
});

const formData = reactive({
  id: "",
  projectName: "",
  projectInfo: ""
});

function unwrapData(resp) {
  return resp?.data ?? resp ?? {};
}

function normalizeProjectItem(item) {
  return {
    id: item?.id || "",
    projectName: item?.projectName || "未命名项目",
    projectInfo: typeof item?.projectInfo === "string" ? item.projectInfo : "",
    createdAt: item?.createdAt || "-",
    updatedAt: item?.updatedAt || "-",
    createdBy: item?.createdBy || "-",
    updatedBy: item?.updatedBy || "-"
  };
}

function formatProjectInfoSummary(value) {
  const text = String(value || "").trim();
  if (!text) return "-";
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
}

function buildProjectRow(item) {
  const record = normalizeProjectItem(item);
  return {
    ...record,
    projectInfoSummary: formatProjectInfoSummary(record.projectInfo)
  };
}

async function loadProjects(showSuccess = false) {
  loading.value = true;
  try {
    const res = await getHandoverProjectList({
      projectName: keyword.value.trim() || undefined,
      pageNum: pagination.value.page,
      pageSize: pagination.value.size
    });
    const data = unwrapData(res);
    const records = Array.isArray(data?.records) ? data.records : [];
    projects.value = records.map(buildProjectRow);
    pagination.value.total = Number(data?.total ?? 0);
    pagination.value.page = Number(data?.page ?? pagination.value.page ?? 1);
    pagination.value.size = Number(data?.size ?? pagination.value.size ?? 10);
    if (showSuccess) {
      message("项目列表已刷新", { type: "success" });
    }
  } catch (error) {
    console.error("load projects failed", error);
    projects.value = [];
    pagination.value.total = 0;
    message(error?.message || "获取项目列表失败", { type: "error" });
  } finally {
    loading.value = false;
  }
}

async function preloadAllProjects() {
  if (allProjectsLoaded.value) return;
  try {
    await getAllHandoverProjects();
    allProjectsLoaded.value = true;
  } catch (error) {
    console.error("preload all projects failed", error);
  }
}

async function fetchProjectDetail(id) {
  if (!id) return normalizeProjectItem({});
  const res = await getHandoverProjectDetail(id);
  return normalizeProjectItem(unwrapData(res));
}

async function openDetail(row) {
  detailLoading.value = true;
  detailVisible.value = true;
  detailData.value = normalizeProjectItem(row);
  try {
    detailData.value = await fetchProjectDetail(row?.id);
  } catch (error) {
    console.error("get project detail failed", error);
    message(error?.message || "获取项目详情失败，已显示列表数据", {
      type: "warning"
    });
  } finally {
    detailLoading.value = false;
  }
}

function resetForm() {
  formData.id = "";
  formData.projectName = "";
  formData.projectInfo = "";
}

async function openCreate() {
  resetForm();
  formMode.value = "create";
  formVisible.value = true;
  await nextTick();
  preloadAllProjects();
}

async function openEdit(row) {
  if (!row?.id) {
    message("缺少项目ID，无法进入编辑页", { type: "warning" });
    return;
  }

  router.push({
    path: "/visualization/3d-fullscreen",
    query: {
      projectId: row.id
    }
  });
}

function validateProjectInfo(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  try {
    JSON.parse(text);
    return true;
  } catch (error) {
    return false;
  }
}

async function submitForm() {
  const projectName = formData.projectName.trim();
  const projectInfo = formData.projectInfo.trim();

  if (!projectName) {
    message("项目名称不能为空", { type: "warning" });
    return;
  }

  if (!validateProjectInfo(projectInfo)) {
    message("项目信息必须是合法的 JSON 文本", { type: "warning" });
    return;
  }

  submitLoading.value = true;
  try {
    if (formMode.value === "create") {
      const response = await createHandoverProject({
        projectName,
        projectInfo
      });
      const createdProject = normalizeProjectItem(unwrapData(response));
      message("项目已创建", { type: "success" });
      formVisible.value = false;
      await loadProjects();
      router.push({
        path: "/visualization/3d-viewer",
        query: {
          projectId: createdProject.id
        }
      });
      return;
    } else {
      await updateHandoverProject({
        id: formData.id,
        projectName,
        projectInfo
      });
      message("项目已更新", { type: "success" });
    }

    formVisible.value = false;
    await loadProjects();
  } catch (error) {
    console.error("submit project failed", error);
    message(error?.message || "保存项目失败", { type: "error" });
  } finally {
    submitLoading.value = false;
  }
}

function handleSizeChange(size) {
  pagination.value.size = size;
  pagination.value.page = 1;
  loadProjects();
}

function handleCurrentChange(page) {
  pagination.value.page = Math.max(1, page);
  loadProjects();
}

function refreshList() {
  loadProjects(true);
}

let keywordTimer = null;
watch(keyword, () => {
  if (keywordTimer) clearTimeout(keywordTimer);
  keywordTimer = setTimeout(() => {
    pagination.value.page = 1;
    loadProjects();
  }, 300);
});

loadProjects();
</script>

<template>
  <div class="dd-page">
    <el-card shadow="never">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div class="flex flex-wrap items-center gap-3">
          <el-input
            v-model="keyword"
            placeholder="请输入项目名称"
            clearable
            class="!w-[280px]"
          />
          <el-button @click="refreshList">刷新</el-button>
        </div>
        <el-button type="primary" @click="openCreate">新建项目</el-button>
      </div>

      <el-table v-loading="loading" :data="projects" stripe>
        <el-table-column prop="projectName" label="项目名称" min-width="220" />
        <el-table-column
          prop="projectInfoSummary"
          label="项目信息"
          min-width="320"
          show-overflow-tooltip
        />
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column prop="updatedAt" label="更新时间" width="180" />
        <el-table-column prop="createdBy" label="创建人" width="120" />
        <el-table-column prop="updatedBy" label="更新人" width="120" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <div class="flex gap-2">
              <el-button link type="primary" @click="openDetail(row)">
                详情
              </el-button>
              <el-button link type="primary" @click="openEdit(row)">
                编辑
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="flex justify-end mt-4">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="pagination.total"
          :current-page="pagination.page"
          :page-size="pagination.size"
          :page-sizes="[10, 20, 50, 100]"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="detailVisible"
      title="项目详情"
      width="720px"
      destroy-on-close
    >
      <div v-loading="detailLoading">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="项目ID">
            {{ detailData.id || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="项目名称">
            {{ detailData.projectName || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ detailData.createdAt || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ detailData.updatedAt || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="创建人">
            {{ detailData.createdBy || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="更新人">
            {{ detailData.updatedBy || "-" }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>

    <el-dialog
      v-model="formVisible"
      :title="formMode === 'create' ? '新建项目' : '编辑项目'"
      width="720px"
      destroy-on-close
    >
      <div v-loading="detailLoading">
        <el-form label-width="96px">
          <el-form-item label="项目名称" required>
            <el-input
              v-model="formData.projectName"
              maxlength="100"
              show-word-limit
              placeholder="请输入项目名称"
            />
          </el-form-item>
          <el-form-item label="项目信息">
            <el-input
              v-model="formData.projectInfo"
              type="textarea"
              :rows="12"
              placeholder='请输入 JSON 文本，例如：{"code":"P001"}'
            />
          </el-form-item>
        </el-form>
        <div class="text-xs text-[var(--el-text-color-secondary)]">
          `projectInfo` 为空时允许提交；非空时需为合法 JSON 文本。
        </div>
      </div>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submitForm">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
