<script setup>
import { onMounted, reactive, ref, computed } from "vue";
import { message } from "@/utils/message";
import {
  listRolesApi,
  createRoleApi,
  updateRoleApi,
  deleteRoleApi
} from "@/api/systemRoles";

defineOptions({
  name: "SystemRoles"
});

function isApiSuccess(res) {
  return res?.success === true || res?.code === 200 || res?.code === 0;
}

/* ---------- 列表 ---------- */
const rows = ref([]);
const tableLoading = ref(false);
const keyword = ref("");

function normalizeRolesFromResponse(res) {
  const payload = res?.data;
  const list = Array.isArray(payload)
    ? payload
    : payload?.records ||
      payload?.list ||
      payload?.content ||
      payload?.items ||
      payload?.rows ||
      [];
  return (Array.isArray(list) ? list : []).map((item, idx) => ({
    id: item?.id ?? idx + 1,
    code: item?.code || item?.roleCode || "",
    name: item?.name || item?.roleName || "",
    description: item?.description || item?.remark || "",
    createTime: item?.createTime || item?.createdAt || "-",
    userCount: item?.userCount ?? item?.users ?? "-"
  }));
}

async function fetchRoles() {
  tableLoading.value = true;
  try {
    const res = await listRolesApi();
    if (!isApiSuccess(res)) {
      throw new Error(res?.message || "获取角色列表失败");
    }
    rows.value = normalizeRolesFromResponse(res);
  } catch (error) {
    rows.value = [];
    message(error?.message || "获取角色列表失败", { type: "error" });
  } finally {
    tableLoading.value = false;
  }
}

const filteredRows = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return rows.value;
  return rows.value.filter(r =>
    `${r.name} ${r.code} ${r.description}`.toLowerCase().includes(kw)
  );
});

/* ---------- 编辑 / 新增 ---------- */
const editOpen = ref(false);
const editMode = ref("create");
const editForm = reactive({
  id: "",
  code: "",
  name: "",
  description: ""
});

function openCreate() {
  editMode.value = "create";
  editForm.id = "";
  editForm.code = "";
  editForm.name = "";
  editForm.description = "";
  editOpen.value = true;
}

function openEdit(row) {
  editMode.value = "edit";
  editForm.id = row.id;
  editForm.code = row.code;
  editForm.name = row.name;
  editForm.description = row.description;
  editOpen.value = true;
}

async function saveRole() {
  if (!editForm.name.trim()) {
    message("请填写角色名称", { type: "warning" });
    return;
  }

  try {
    if (editMode.value === "create") {
      if (!editForm.code.trim()) {
        message("请填写角色编码", { type: "warning" });
        return;
      }
      const res = await createRoleApi({
        code: editForm.code.trim(),
        name: editForm.name.trim(),
        description: editForm.description.trim()
      });
      if (!isApiSuccess(res)) {
        throw new Error(res?.message || "创建角色失败");
      }
      message("创建角色成功", { type: "success" });
    } else {
      const res = await updateRoleApi({
        id: editForm.id,
        name: editForm.name.trim(),
        description: editForm.description.trim()
      });
      if (!isApiSuccess(res)) {
        throw new Error(res?.message || "更新角色失败");
      }
      message("更新角色成功", { type: "success" });
    }
    editOpen.value = false;
    await fetchRoles();
  } catch (error) {
    message(error?.message || "保存失败", { type: "error" });
  }
}

/* ---------- 删除 ---------- */
async function handleDelete(row) {
  try {
    const res = await deleteRoleApi({ id: row.id });
    if (!isApiSuccess(res)) {
      throw new Error(res?.message || "删除角色失败");
    }
    message(`已删除角色：${row.name}`, { type: "success" });
    await fetchRoles();
  } catch (error) {
    message(error?.message || "删除角色失败", { type: "error" });
  }
}

onMounted(() => {
  fetchRoles();
});
</script>

<template>
  <div class="dd-page">
    <el-card shadow="never" class="mb-4">
      <el-form :inline="true">
        <el-form-item label="关键字">
          <el-input
            v-model="keyword"
            placeholder="角色名称/编码/描述"
            style="width: 260px"
            clearable
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="openCreate">新增角色</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="font-semibold">角色列表</div>
          <div class="text-xs text-[var(--el-text-color-secondary)]">
            共 {{ filteredRows.length }} 项
          </div>
        </div>
      </template>

      <el-table v-loading="tableLoading" :data="filteredRows" stripe>
        <el-table-column prop="code" label="角色编码" width="180" />
        <el-table-column prop="name" label="角色名称" width="180" />
        <el-table-column
          prop="description"
          label="描述"
          min-width="260"
          show-overflow-tooltip
        />
        <el-table-column prop="createTime" label="创建时间" width="180" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="scope">
            <el-space>
              <el-button link type="primary" @click="openEdit(scope.row)"
                >编辑</el-button
              >
              <el-popconfirm
                :title="`确定删除角色「${scope.row.name}」？`"
                @confirm="handleDelete(scope.row)"
              >
                <template #reference>
                  <el-button link type="danger">删除</el-button>
                </template>
              </el-popconfirm>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑 弹窗 -->
    <el-dialog
      v-model="editOpen"
      :title="editMode === 'create' ? '新增角色' : '编辑角色'"
      width="560px"
    >
      <el-form label-width="90px">
        <el-form-item label="角色编码">
          <el-input
            v-model="editForm.code"
            placeholder="例如：ROLE_ADMIN"
            :disabled="editMode === 'edit'"
          />
        </el-form-item>
        <el-form-item label="角色名称">
          <el-input v-model="editForm.name" placeholder="例如：管理员" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="editForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入角色描述"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-space>
          <el-button @click="editOpen = false">取消</el-button>
          <el-button type="primary" @click="saveRole">保存</el-button>
        </el-space>
      </template>
    </el-dialog>
  </div>
</template>
