<script setup>
import { computed, nextTick, reactive, ref, watch } from "vue";
import { ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";
import {
  createHandoverProject,
  createHandoverProjectType,
  deleteHandoverProjects,
  deleteHandoverProjectTypes,
  getAllHandoverProjects,
  getHandoverProjectDetail,
  getHandoverProjectList,
  getHandoverProjectTypeTree,
  moveHandoverProjectType,
  renameHandoverProjectType,
  searchHandoverProjectTypes,
  updateHandoverProject
} from "@/api/handoverProjects";

defineOptions({
  name: "HandoverProjects"
});

const PROJECT_TYPE_ROOT_VALUE = "__project_type_root__";

const router = useRouter();
const activeTab = ref("projects");
const loading = ref(false);
const detailLoading = ref(false);
const formLoading = ref(false);
const submitLoading = ref(false);
const allProjectsLoaded = ref(false);

const keyword = ref("");
const projectTypeFilter = ref("");
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
  projectType: "",
  projectTypeName: "",
  projectInfo: "",
  createdAt: "",
  updatedAt: "",
  createdBy: "",
  updatedBy: ""
});

const formData = reactive({
  id: "",
  projectName: "",
  projectType: "",
  projectInfo: ""
});

const projectTypeTreeRef = ref();
const projectTypeTree = ref([]);
const projectTypeTreeLoaded = ref(false);
const projectTypeLoading = ref(false);
const projectTypeSearchLoading = ref(false);
const projectTypeKeyword = ref("");
const selectedProjectTypeId = ref("");
const projectTypeExpandedKeys = ref([]);

const projectTypeFormRef = ref();
const projectTypeFormVisible = ref(false);
const projectTypeFormMode = ref("create");
const projectTypeSubmitLoading = ref(false);
const projectTypeForm = reactive({
  id: "",
  name: "",
  parentId: "",
  sortOrder: null
});
const projectTypeRules = {
  name: [{ required: true, message: "请输入类型名称", trigger: "blur" }]
};

const projectTypeMoveVisible = ref(false);
const projectTypeMoveTarget = ref(null);
const projectTypeMoveParentId = ref(PROJECT_TYPE_ROOT_VALUE);

function unwrapData(resp) {
  return resp?.data ?? resp ?? {};
}

function normalizeSortOrder(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function mapProjectTypeNodes(nodes = [], parentId = "") {
  return nodes
    .map((node, index) => {
      const id = node?.id || "";
      const name = node?.name || node?.label || id || "-";
      const sortOrder = normalizeSortOrder(node?.sortOrder, index);
      return {
        ...node,
        id,
        value: id,
        name,
        label: name,
        parentId: node?.parentId || parentId || "",
        sortOrder,
        children: mapProjectTypeNodes(node?.children || [], id),
        rawIndex: index
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.rawIndex - b.rawIndex)
    .map(({ rawIndex, ...node }) => node);
}

function flattenProjectTypeTree(nodes = [], result = []) {
  nodes.forEach(node => {
    result.push(node);
    if (Array.isArray(node.children) && node.children.length > 0) {
      flattenProjectTypeTree(node.children, result);
    }
  });
  return result;
}

function collectProjectTypeExpandableKeys(nodes = [], result = []) {
  nodes.forEach(node => {
    if (Array.isArray(node.children) && node.children.length > 0) {
      result.push(node.id);
      collectProjectTypeExpandableKeys(node.children, result);
    }
  });
  return result;
}

function findProjectTypeById(id) {
  if (!id) return null;
  return flattenProjectTypeTree(projectTypeTree.value, []).find(
    node => node.id === id
  );
}

function findProjectTypeByNameAndParent(name, parentId = "") {
  return flattenProjectTypeTree(projectTypeTree.value, []).find(
    node => node.name === name && (node.parentId || "") === (parentId || "")
  );
}

function collectProjectTypeDescendantKeys(targetId) {
  const result = [];
  if (!targetId) return result;

  function walk(nodes = []) {
    nodes.forEach(node => {
      if (node.id === targetId) {
        flattenProjectTypeTree(node.children || [], result);
        return;
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        walk(node.children);
      }
    });
  }

  walk(projectTypeTree.value);
  return result.map(node => node.id);
}

function collectProjectTypeAncestorKeys(targetId) {
  if (!targetId) return [];
  const allNodes = flattenProjectTypeTree(projectTypeTree.value, []);
  const nodeMap = new Map(allNodes.map(node => [node.id, node]));
  const result = [];
  let current = nodeMap.get(targetId);

  while (current?.parentId) {
    result.unshift(current.parentId);
    current = nodeMap.get(current.parentId);
  }

  return result;
}

function appendProjectTypeExpandedKeys(keys = []) {
  projectTypeExpandedKeys.value = Array.from(
    new Set([...projectTypeExpandedKeys.value, ...keys])
  );
}

function setProjectTypeExpandedState(expandedKeySet) {
  const nodesMap = projectTypeTreeRef.value?.store?.nodesMap;
  if (!nodesMap) return;
  Object.values(nodesMap).forEach(node => {
    if (!node?.data?.id) return;
    node.expanded = expandedKeySet.has(node.data.id);
  });
}

async function restoreProjectTypeTreeUiState() {
  await nextTick();
  projectTypeTreeRef.value?.store?.setDefaultExpandedKeys?.(
    projectTypeExpandedKeys.value
  );
  projectTypeTreeRef.value?.setCurrentKey?.(
    selectedProjectTypeId.value || null
  );
}

function syncProjectTypeExpandedState() {
  const allExpandableKeys = new Set(
    collectProjectTypeExpandableKeys(projectTypeTree.value, [])
  );
  projectTypeExpandedKeys.value = projectTypeExpandedKeys.value.filter(key =>
    allExpandableKeys.has(key)
  );

  if (selectedProjectTypeId.value) {
    const ancestorKeys = collectProjectTypeAncestorKeys(
      selectedProjectTypeId.value
    ).filter(key => allExpandableKeys.has(key));
    appendProjectTypeExpandedKeys(ancestorKeys);
  }
}

function filterProjectTypeTree(nodes = [], keywordValue = "") {
  const query = keywordValue.trim().toLowerCase();
  if (!query) return nodes;

  return nodes.reduce((result, node) => {
    const children = filterProjectTypeTree(node.children || [], query);
    const matched =
      String(node.name || "")
        .toLowerCase()
        .includes(query) ||
      String(node.id || "")
        .toLowerCase()
        .includes(query);

    if (matched || children.length > 0) {
      result.push({ ...node, children });
    }

    return result;
  }, []);
}

const visibleProjectTypeTree = computed(() => {
  return filterProjectTypeTree(projectTypeTree.value, projectTypeKeyword.value);
});

const selectedProjectType = computed(() => {
  return findProjectTypeById(selectedProjectTypeId.value);
});

const projectTypeFormParentName = computed(() => {
  if (!projectTypeForm.parentId) return "根类型";
  return findProjectTypeById(projectTypeForm.parentId)?.name || "根类型";
});

const projectTypeMoveOptions = computed(() => {
  const invalidIds = new Set([
    projectTypeMoveTarget.value?.id,
    ...collectProjectTypeDescendantKeys(projectTypeMoveTarget.value?.id)
  ]);

  function walk(nodes = []) {
    return nodes
      .filter(node => !invalidIds.has(node.id))
      .map(node => ({
        value: node.id,
        label: node.label,
        children: walk(node.children || [])
      }));
  }

  return [
    { value: PROJECT_TYPE_ROOT_VALUE, label: "根类型", children: [] },
    ...walk(projectTypeTree.value)
  ];
});

function normalizeProjectItem(item) {
  return {
    id: item?.id || "",
    projectName: item?.projectName || "未命名项目",
    projectType: item?.projectType || "",
    projectTypeName: item?.projectTypeName || "",
    projectInfo: typeof item?.projectInfo === "string" ? item.projectInfo : "",
    createdAt: item?.createdAt || "-",
    updatedAt: item?.updatedAt || "-",
    createdBy: item?.createdBy || "-",
    updatedBy: item?.updatedBy || "-"
  };
}

function buildProjectRow(item) {
  return normalizeProjectItem(item);
}

function formatProjectTypeDisplay(row) {
  return (
    row?.projectTypeName ||
    findProjectTypeById(row?.projectType)?.name ||
    row?.projectType ||
    "-"
  );
}

async function loadProjectTypeTree(
  showSuccess = false,
  preserveSelected = true
) {
  projectTypeLoading.value = true;
  try {
    const response = await getHandoverProjectTypeTree();
    const data = unwrapData(response);
    const nodes = Array.isArray(data) ? data : [];
    projectTypeTree.value = mapProjectTypeNodes(nodes);
    projectTypeTreeLoaded.value = true;

    const allNodes = flattenProjectTypeTree(projectTypeTree.value, []);
    const hasCurrent = allNodes.some(
      node => node.id === selectedProjectTypeId.value
    );
    if (!preserveSelected || !selectedProjectTypeId.value || !hasCurrent) {
      selectedProjectTypeId.value = allNodes[0]?.id || "";
    }

    if (
      projectTypeFilter.value &&
      !allNodes.some(node => node.id === projectTypeFilter.value)
    ) {
      projectTypeFilter.value = "";
    }

    syncProjectTypeExpandedState();
    await restoreProjectTypeTreeUiState();
    if (showSuccess) {
      message("项目类型树已刷新", { type: "success" });
    }
  } catch (error) {
    console.error("load project type tree failed", error);
    projectTypeTree.value = [];
    projectTypeExpandedKeys.value = [];
    projectTypeTreeLoaded.value = false;
    message(error?.message || "获取项目类型树失败", { type: "error" });
  } finally {
    projectTypeLoading.value = false;
  }
}

async function ensureProjectTypesLoaded() {
  if (projectTypeTreeLoaded.value) return;
  await loadProjectTypeTree(false);
}

async function loadProjects(showSuccess = false) {
  loading.value = true;
  try {
    const res = await getHandoverProjectList({
      projectName: keyword.value.trim() || undefined,
      projectType: projectTypeFilter.value || undefined,
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
  formData.projectType = "";
  formData.projectInfo = "";
}

function fillProjectForm(project) {
  formData.id = project.id || "";
  formData.projectName = project.projectName || "";
  formData.projectType = project.projectType || "";
  formData.projectInfo = project.projectInfo || "";
}

async function openCreate() {
  resetForm();
  formMode.value = "create";
  formLoading.value = false;
  formVisible.value = true;
  await nextTick();
  await ensureProjectTypesLoaded();
  preloadAllProjects();
}

async function openBaseEdit(row) {
  if (!row?.id) {
    message("缺少项目ID，无法编辑项目", { type: "warning" });
    return;
  }

  formMode.value = "edit";
  formVisible.value = true;
  formLoading.value = true;
  fillProjectForm(normalizeProjectItem(row));
  try {
    await ensureProjectTypesLoaded();
    const detail = await fetchProjectDetail(row.id);
    fillProjectForm(detail);
  } catch (error) {
    console.error("get project detail for edit failed", error);
    message(error?.message || "获取项目详情失败，已使用列表数据", {
      type: "warning"
    });
  } finally {
    formLoading.value = false;
  }
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

async function submitForm() {
  const projectName = formData.projectName.trim();
  const projectType = formData.projectType || "";
  const projectInfo = String(formData.projectInfo || "").trim();

  if (!projectName) {
    message("项目名称不能为空", { type: "warning" });
    return;
  }

  submitLoading.value = true;
  try {
    if (formMode.value === "create") {
      const response = await createHandoverProject({
        projectName,
        projectType,
        projectInfo
      });
      const createdProject = normalizeProjectItem(unwrapData(response));
      message("项目已创建", { type: "success" });
      formVisible.value = false;
      await loadProjects();
      router.push({
        path: "/visualization/3d-fullscreen",
        query: {
          projectId: createdProject.id
        }
      });
      return;
    }

    await updateHandoverProject({
      id: formData.id,
      projectName,
      projectType,
      projectInfo
    });
    message("项目已更新", { type: "success" });
    formVisible.value = false;
    await loadProjects();
  } catch (error) {
    console.error("submit project failed", error);
    message(error?.message || "保存项目失败", { type: "error" });
  } finally {
    submitLoading.value = false;
  }
}

async function removeProject(row) {
  if (!row?.id) return;
  try {
    await ElMessageBox.confirm(
      `确认删除项目“${row.projectName || row.id}”吗？`,
      "删除确认",
      {
        type: "warning",
        confirmButtonText: "确认删除",
        cancelButtonText: "取消"
      }
    );
    if (projects.value.length === 1 && pagination.value.page > 1) {
      pagination.value.page -= 1;
    }
    await deleteHandoverProjects({ ids: [row.id] });
    message("项目已删除", { type: "success" });
    await loadProjects();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    console.error("delete project failed", error);
    message(error?.message || "删除项目失败", { type: "error" });
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

function handleProjectTypeClick(data) {
  selectedProjectTypeId.value = data?.id || "";
}

function handleProjectTypeExpand(data) {
  if (data?.id && !projectTypeExpandedKeys.value.includes(data.id)) {
    projectTypeExpandedKeys.value = [...projectTypeExpandedKeys.value, data.id];
  }
}

function handleProjectTypeCollapse(data) {
  projectTypeExpandedKeys.value = projectTypeExpandedKeys.value.filter(
    key => key !== data?.id
  );
}

function expandAllProjectTypes() {
  const keys = collectProjectTypeExpandableKeys(
    visibleProjectTypeTree.value,
    []
  );
  projectTypeExpandedKeys.value = keys;
  setProjectTypeExpandedState(new Set(keys));
}

function collapseAllProjectTypes() {
  projectTypeExpandedKeys.value = [];
  setProjectTypeExpandedState(new Set());
}

function resetProjectTypeForm() {
  projectTypeForm.id = "";
  projectTypeForm.name = "";
  projectTypeForm.parentId = "";
  projectTypeForm.sortOrder = null;
}

function openCreateRootType() {
  resetProjectTypeForm();
  projectTypeFormMode.value = "create";
  projectTypeFormVisible.value = true;
}

function openCreateChildType(node) {
  resetProjectTypeForm();
  projectTypeFormMode.value = "create";
  projectTypeForm.parentId = node?.id || "";
  projectTypeFormVisible.value = true;
}

function openRenameProjectType(node) {
  if (!node?.id) return;
  resetProjectTypeForm();
  projectTypeFormMode.value = "rename";
  projectTypeForm.id = node.id;
  projectTypeForm.name = node.name || node.label || "";
  projectTypeForm.parentId = node.parentId || "";
  projectTypeForm.sortOrder = node.sortOrder ?? null;
  projectTypeFormVisible.value = true;
}

async function submitProjectTypeForm() {
  const valid = await projectTypeFormRef.value?.validate?.().catch(() => false);
  if (valid === false) return;

  const name = projectTypeForm.name.trim();
  if (!name) {
    message("类型名称不能为空", { type: "warning" });
    return;
  }

  projectTypeSubmitLoading.value = true;
  try {
    if (projectTypeFormMode.value === "create") {
      const sortOrder =
        projectTypeForm.sortOrder === null ||
        projectTypeForm.sortOrder === undefined
          ? undefined
          : Number(projectTypeForm.sortOrder);
      const response = await createHandoverProjectType({
        name,
        parentId: projectTypeForm.parentId || undefined,
        sortOrder
      });
      const createdId = unwrapData(response)?.id || "";
      appendProjectTypeExpandedKeys(
        projectTypeForm.parentId
          ? [
              ...collectProjectTypeAncestorKeys(projectTypeForm.parentId),
              projectTypeForm.parentId
            ]
          : []
      );
      selectedProjectTypeId.value =
        createdId ||
        findProjectTypeByNameAndParent(name, projectTypeForm.parentId)?.id ||
        selectedProjectTypeId.value;
      message("项目类型已创建", { type: "success" });
    } else {
      await renameHandoverProjectType({
        id: projectTypeForm.id,
        name
      });
      selectedProjectTypeId.value =
        projectTypeForm.id || selectedProjectTypeId.value;
      message("项目类型已重命名", { type: "success" });
    }

    projectTypeFormVisible.value = false;
    await loadProjectTypeTree(false, true);
    await loadProjects();
  } catch (error) {
    console.error("save project type failed", error);
    message(error?.message || "保存项目类型失败", { type: "error" });
  } finally {
    projectTypeSubmitLoading.value = false;
  }
}

function openMoveProjectType(node) {
  if (!node?.id) return;
  projectTypeMoveTarget.value = node;
  projectTypeMoveParentId.value = node.parentId || PROJECT_TYPE_ROOT_VALUE;
  projectTypeMoveVisible.value = true;
}

async function submitProjectTypeMove() {
  if (!projectTypeMoveTarget.value?.id) return;
  if (!projectTypeMoveParentId.value) {
    message("请选择目标父类型", { type: "warning" });
    return;
  }

  const targetParentId =
    projectTypeMoveParentId.value === PROJECT_TYPE_ROOT_VALUE
      ? ""
      : projectTypeMoveParentId.value;

  if (projectTypeMoveTarget.value.id === targetParentId) {
    message("目标父类型不能是当前类型", { type: "warning" });
    return;
  }
  if (
    collectProjectTypeDescendantKeys(projectTypeMoveTarget.value.id).includes(
      targetParentId
    )
  ) {
    message("目标父类型不能是当前类型的子类型", { type: "warning" });
    return;
  }
  if ((projectTypeMoveTarget.value.parentId || "") === targetParentId) {
    message("项目类型已在该父类型下", { type: "warning" });
    return;
  }

  try {
    selectedProjectTypeId.value = projectTypeMoveTarget.value.id;
    await moveHandoverProjectType({
      id: projectTypeMoveTarget.value.id,
      targetParentId
    });
    appendProjectTypeExpandedKeys(
      targetParentId
        ? [...collectProjectTypeAncestorKeys(targetParentId), targetParentId]
        : []
    );
    projectTypeMoveVisible.value = false;
    message("项目类型已移动", { type: "success" });
    await loadProjectTypeTree(false, true);
  } catch (error) {
    console.error("move project type failed", error);
    message(error?.message || "移动项目类型失败", { type: "error" });
  }
}

async function removeProjectType(node) {
  if (!node?.id) return;
  try {
    await ElMessageBox.confirm(
      `确认删除项目类型“${node.name || node.label || node.id}”吗？`,
      "删除确认",
      {
        type: "warning",
        confirmButtonText: "确认删除",
        cancelButtonText: "取消"
      }
    );
    const deletedIds = [node.id, ...collectProjectTypeDescendantKeys(node.id)];
    const fallbackSelectedId =
      selectedProjectTypeId.value === node.id
        ? node.parentId || ""
        : selectedProjectTypeId.value;
    await deleteHandoverProjectTypes({ ids: [node.id] });
    if (deletedIds.includes(projectTypeFilter.value)) {
      projectTypeFilter.value = "";
    }
    selectedProjectTypeId.value = fallbackSelectedId;
    message("项目类型已删除", { type: "success" });
    await loadProjectTypeTree(false, true);
    await loadProjects();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    console.error("delete project type failed", error);
    message(error?.message || "删除项目类型失败", { type: "error" });
  }
}

function normalizeProjectTypeSearchResult(item) {
  if (typeof item === "string") {
    return { id: item, name: item };
  }
  return {
    id: item?.id || item?.value || item?.projectType || "",
    name: item?.name || item?.label || item?.projectTypeName || item?.id || ""
  };
}

async function runProjectTypeSearch() {
  const searchKeyword = projectTypeKeyword.value.trim();
  if (!searchKeyword) {
    message("请输入类型名称关键字", { type: "warning" });
    return;
  }

  projectTypeSearchLoading.value = true;
  try {
    const response = await searchHandoverProjectTypes({
      keyword: searchKeyword
    });
    const data = unwrapData(response);
    const remoteMatches = Array.isArray(data)
      ? data.map(normalizeProjectTypeSearchResult)
      : [];
    const allNodes = flattenProjectTypeTree(projectTypeTree.value, []);
    const remoteIds = remoteMatches
      .map(item => item.id)
      .filter(id => allNodes.some(node => node.id === id));
    const localIds = allNodes
      .filter(node =>
        String(node.name || "")
          .toLowerCase()
          .includes(searchKeyword.toLowerCase())
      )
      .map(node => node.id);
    const matchedIds = remoteIds.length > 0 ? remoteIds : localIds;

    if (matchedIds.length === 0) {
      message("未找到匹配的项目类型", { type: "warning" });
      return;
    }

    selectedProjectTypeId.value = matchedIds[0];
    appendProjectTypeExpandedKeys([
      ...collectProjectTypeAncestorKeys(matchedIds[0]),
      ...collectProjectTypeExpandableKeys(visibleProjectTypeTree.value, [])
    ]);
    await restoreProjectTypeTreeUiState();
    message(`找到 ${matchedIds.length} 个项目类型`, { type: "success" });
  } catch (error) {
    console.error("search project type failed", error);
    message(error?.message || "搜索项目类型失败", { type: "error" });
  } finally {
    projectTypeSearchLoading.value = false;
  }
}

async function refreshProjectTypeTree() {
  await loadProjectTypeTree(true);
  await loadProjects();
}

let keywordTimer = null;
watch([keyword, projectTypeFilter], () => {
  if (keywordTimer) clearTimeout(keywordTimer);
  keywordTimer = setTimeout(() => {
    pagination.value.page = 1;
    loadProjects();
  }, 300);
});

let projectTypeKeywordTimer = null;
watch(projectTypeKeyword, () => {
  if (projectTypeKeywordTimer) clearTimeout(projectTypeKeywordTimer);
  projectTypeKeywordTimer = setTimeout(async () => {
    if (projectTypeKeyword.value.trim()) {
      expandAllProjectTypes();
      return;
    }
    syncProjectTypeExpandedState();
    await restoreProjectTypeTreeUiState();
  }, 150);
});

watch(activeTab, async value => {
  if (value === "types") {
    await ensureProjectTypesLoaded();
    await restoreProjectTypeTreeUiState();
  }
});

loadProjectTypeTree();
loadProjects();
</script>

<template>
  <div class="dd-page">
    <el-card shadow="never">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="项目列表" name="projects">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div class="flex flex-wrap items-center gap-3">
              <el-input
                v-model="keyword"
                placeholder="请输入项目名称"
                clearable
                class="!w-[240px]"
              />
              <el-tree-select
                v-model="projectTypeFilter"
                :data="projectTypeTree"
                node-key="id"
                check-strictly
                filterable
                clearable
                :render-after-expand="false"
                placeholder="请选择项目类型"
                class="!w-[240px]"
              />
              <el-button @click="refreshList">刷新</el-button>
            </div>
            <el-button type="primary" @click="openCreate">新建项目</el-button>
          </div>

          <el-table v-loading="loading" :data="projects" stripe>
            <el-table-column
              prop="projectName"
              label="项目名称"
              min-width="200"
            />
            <el-table-column label="项目类型" min-width="160">
              <template #default="{ row }">
                {{ formatProjectTypeDisplay(row) }}
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="180" />
            <el-table-column prop="updatedAt" label="更新时间" width="180" />
            <el-table-column prop="createdBy" label="创建人" width="120" />
            <el-table-column prop="updatedBy" label="更新人" width="120" />
            <el-table-column label="操作" width="260" fixed="right">
              <template #default="{ row }">
                <div class="flex flex-wrap gap-2">
                  <el-button link type="primary" @click="openDetail(row)">
                    详情
                  </el-button>
                  <el-button link type="primary" @click="openBaseEdit(row)">
                    编辑项目
                  </el-button>
                  <el-button link type="primary" @click="openEdit(row)">
                    编辑
                  </el-button>
                  <el-button link type="danger" @click="removeProject(row)">
                    删除
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
        </el-tab-pane>

        <el-tab-pane label="类型管理" name="types">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div class="flex flex-wrap items-center gap-3">
              <el-input
                v-model="projectTypeKeyword"
                placeholder="搜索类型名称"
                clearable
                class="!w-[240px]"
                @keyup.enter="runProjectTypeSearch"
              />
              <el-button
                :loading="projectTypeSearchLoading"
                @click="runProjectTypeSearch"
              >
                搜索
              </el-button>
              <el-button @click="refreshProjectTypeTree">刷新</el-button>
              <el-button @click="expandAllProjectTypes">全部展开</el-button>
              <el-button @click="collapseAllProjectTypes">全部收起</el-button>
            </div>
            <el-button type="primary" @click="openCreateRootType">
              新增根类型
            </el-button>
          </div>

          <el-tree
            ref="projectTypeTreeRef"
            v-loading="projectTypeLoading"
            :data="visibleProjectTypeTree"
            node-key="id"
            :default-expanded-keys="projectTypeExpandedKeys"
            :current-node-key="selectedProjectTypeId"
            highlight-current
            empty-text="暂无项目类型"
            @node-click="handleProjectTypeClick"
            @node-expand="handleProjectTypeExpand"
            @node-collapse="handleProjectTypeCollapse"
          >
            <template #default="{ data }">
              <div class="flex items-center justify-between w-full gap-3 pr-1">
                <div class="flex items-center min-w-0 gap-2">
                  <span class="truncate">{{ data.label }}</span>
                  <el-tag size="small" type="info">
                    排序 {{ data.sortOrder }}
                  </el-tag>
                </div>
                <el-space wrap>
                  <el-button
                    size="small"
                    text
                    @click.stop="openCreateChildType(data)"
                  >
                    新增
                  </el-button>
                  <el-button
                    size="small"
                    text
                    @click.stop="openRenameProjectType(data)"
                  >
                    重命名
                  </el-button>
                  <el-button
                    size="small"
                    text
                    @click.stop="openMoveProjectType(data)"
                  >
                    移动
                  </el-button>
                  <el-button
                    size="small"
                    text
                    type="danger"
                    @click.stop="removeProjectType(data)"
                  >
                    删除
                  </el-button>
                </el-space>
              </div>
            </template>
          </el-tree>

          <div
            v-if="selectedProjectType"
            class="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-2 mt-4 text-sm"
          >
            <div>
              <span class="font-semibold">当前类型：</span>
              {{ selectedProjectType.name || "-" }}
            </div>
            <div>
              <span class="font-semibold">类型ID：</span>
              {{ selectedProjectType.id || "-" }}
            </div>
            <div>
              <span class="font-semibold">父类型ID：</span>
              {{ selectedProjectType.parentId || "-" }}
            </div>
            <div>
              <span class="font-semibold">排序：</span>
              {{ selectedProjectType.sortOrder }}
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
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
          <el-descriptions-item label="项目类型">
            {{ formatProjectTypeDisplay(detailData) }}
          </el-descriptions-item>
          <el-descriptions-item label="类型ID">
            {{ detailData.projectType || "-" }}
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
      <div v-loading="formLoading">
        <el-form label-width="96px">
          <el-form-item label="项目名称" required>
            <el-input
              v-model="formData.projectName"
              maxlength="100"
              show-word-limit
              placeholder="请输入项目名称"
            />
          </el-form-item>
          <el-form-item label="项目类型">
            <el-tree-select
              v-model="formData.projectType"
              :data="projectTypeTree"
              node-key="id"
              check-strictly
              filterable
              clearable
              :render-after-expand="false"
              placeholder="请选择项目类型"
              class="w-full"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submitForm">
          确定
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="projectTypeFormVisible"
      :title="
        projectTypeFormMode === 'create' ? '新增项目类型' : '重命名项目类型'
      "
      width="520px"
      destroy-on-close
    >
      <el-form
        ref="projectTypeFormRef"
        :model="projectTypeForm"
        :rules="projectTypeRules"
        label-width="96px"
      >
        <el-form-item v-if="projectTypeFormMode === 'create'" label="父类型">
          <el-input :model-value="projectTypeFormParentName" disabled />
        </el-form-item>
        <el-form-item label="类型名称" prop="name">
          <el-input
            v-model="projectTypeForm.name"
            maxlength="100"
            show-word-limit
            placeholder="请输入类型名称"
          />
        </el-form-item>
        <el-form-item v-if="projectTypeFormMode === 'create'" label="排序">
          <el-input-number
            v-model="projectTypeForm.sortOrder"
            :min="0"
            :max="999999"
            controls-position="right"
            class="!w-full"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="projectTypeFormVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="projectTypeSubmitLoading"
          @click="submitProjectTypeForm"
        >
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="projectTypeMoveVisible"
      title="移动项目类型"
      width="560px"
      destroy-on-close
    >
      <div class="mb-3 text-sm">
        当前类型：{{ projectTypeMoveTarget?.name || "-" }}
      </div>
      <el-tree-select
        v-model="projectTypeMoveParentId"
        class="w-full"
        :data="projectTypeMoveOptions"
        check-strictly
        filterable
        clearable
        node-key="value"
        placeholder="请选择目标父类型"
      />
      <template #footer>
        <el-button @click="projectTypeMoveVisible = false">取消</el-button>
        <el-button type="primary" @click="submitProjectTypeMove">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
