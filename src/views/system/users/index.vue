<script setup>
import { ElMessageBox } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import { message } from "@/utils/message";
import {
  assignUserRolesApi,
  createUserApi,
  listUsersApi,
  resetUserPasswordApi,
  updateUserApi
} from "@/api/systemUsers";
import { listRolesApi } from "@/api/systemRoles";

defineOptions({
  name: "SystemUsers"
});

const form = reactive({
  keyword: "",
  role: "",
  status: ""
});

const roleOptions = ref([]);

const roleFilterOptions = computed(() => [
  { label: "全部", value: "" },
  ...roleOptions.value
]);

/** 从后端拉取角色列表 */
async function fetchRoles() {
  try {
    const res = await listRolesApi();
    if (!isApiSuccess(res)) throw new Error(res?.message || "获取角色列表失败");
    const payload = res?.data;
    const list = Array.isArray(payload)
      ? payload
      : payload?.records ||
        payload?.list ||
        payload?.content ||
        payload?.items ||
        payload?.rows ||
        [];
    roleOptions.value = (Array.isArray(list) ? list : []).map(item => ({
      label: item.name || item.roleName || item.code || "-",
      value: item.code || item.roleCode || String(item.id),
      id: item.id
    }));
  } catch (e) {
    roleOptions.value = [];
    console.warn("获取角色列表失败", e);
  }
}

const statusOptions = [
  { label: "全部", value: "" },
  { label: "启用", value: "enabled" },
  { label: "停用", value: "disabled" }
];

const rows = ref([]);
const tableLoading = ref(false);

function isApiSuccess(res) {
  return res?.success === true || res?.code === 200 || res?.code === 0;
}

function toRoleValue(rawRole) {
  const role = String(rawRole || "").toLowerCase();
  if (!role) return roleOptions.value.length ? roleOptions.value[0].value : "";
  // 优先匹配已有角色的 code
  const match = roleOptions.value.find(
    r =>
      String(r.id) === role ||
      r.value.toLowerCase() === role ||
      r.label === rawRole
  );
  if (match) return match.value;
  return role;
}

function roleIdByValue(value) {
  return roleOptions.value.find(i => i.value === value)?.id || 1;
}

function normalizeUsersFromResponse(res) {
  const payload = res?.data;
  const list = Array.isArray(payload)
    ? payload
    : payload?.records ||
      payload?.list ||
      payload?.content ||
      payload?.items ||
      payload?.rows ||
      [];
  return (Array.isArray(list) ? list : []).map((item, index) => ({
    id: item?.id ?? item?.userId ?? `u-${index + 1}`,
    username: item?.username || item?.account || `user-${index + 1}`,
    nickname: item?.nickname || item?.realName || item?.username || "-",
    role: toRoleValue(item?.role || item?.roleCode || item?.roleName),
    status:
      item?.enabled === false ||
      item?.status === "disabled" ||
      item?.status === 0
        ? "disabled"
        : "enabled",
    phone: item?.phone || "",
    email: item?.email || "",
    lastLogin: item?.lastLoginTime || item?.lastLogin || "-"
  }));
}

async function fetchUsers() {
  tableLoading.value = true;
  try {
    const res = await listUsersApi({ page: 1, size: 200 });
    if (!isApiSuccess(res)) {
      throw new Error(res?.message || "获取用户列表失败");
    }
    rows.value = normalizeUsersFromResponse(res);
  } catch (error) {
    rows.value = [];
    message(error?.message || "获取用户列表失败", { type: "error" });
  } finally {
    tableLoading.value = false;
  }
}

const filteredRows = computed(() => {
  const kw = form.keyword.trim().toLowerCase();
  return rows.value.filter(u => {
    const hitRole = form.role ? u.role === form.role : true;
    const hitStatus = form.status ? u.status === form.status : true;
    const hitKw = kw
      ? `${u.username} ${u.nickname} ${u.phone} ${u.email}`
          .toLowerCase()
          .includes(kw)
      : true;
    return hitRole && hitStatus && hitKw;
  });
});

function roleLabel(role) {
  const match = roleOptions.value.find(r => r.value === role);
  return match ? match.label : role;
}

function roleTagType(role) {
  // 第一个角色用 danger 标识，其余默认
  if (roleOptions.value.length && roleOptions.value[0].value === role)
    return "";
  const idx = roleOptions.value.findIndex(r => r.value === role);
  const typeList = ["", "danger", "warning", "success", "info"];
  return typeList[idx] ?? "";
}

function statusLabel(status) {
  return status === "enabled" ? "启用" : "停用";
}

function statusTagType(status) {
  return status === "enabled" ? "success" : "info";
}

const editOpen = ref(false);
const editMode = ref("create");
const editForm = reactive({
  id: "",
  username: "",
  nickname: "",
  role: "",
  phone: "",
  email: "",
  status: "enabled"
});

function openCreate() {
  editMode.value = "create";
  editForm.id = "";
  editForm.username = "";
  editForm.nickname = "";
  editForm.role = "";
  editForm.phone = "";
  editForm.email = "";
  editForm.status = "enabled";
  editOpen.value = true;
}

function openEdit(row) {
  editMode.value = "edit";
  editForm.id = row.id;
  editForm.username = row.username;
  editForm.nickname = row.nickname;
  editForm.role = row.role;
  editForm.phone = row.phone;
  editForm.email = row.email;
  editForm.status = row.status;
  editOpen.value = true;
}

async function saveUser() {
  if (!editForm.username.trim() || !editForm.nickname.trim()) {
    message("请填写用户名与姓名", { type: "warning" });
    return;
  }
  const exists = rows.value.some(
    u => u.username === editForm.username.trim() && u.id !== editForm.id
  );
  if (exists) {
    message("用户名已存在", { type: "warning" });
    return;
  }

  try {
    if (editMode.value === "create") {
      const createRes = await createUserApi({
        username: editForm.username.trim(),
        password: "123456",
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        roleIds: [roleIdByValue(editForm.role)]
      });
      if (!isApiSuccess(createRes)) {
        throw new Error(createRes?.message || "新增用户失败");
      }
      message("新增用户成功", { type: "success" });
    } else {
      const updateRes = await updateUserApi({
        id: editForm.id,
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        enabled: editForm.status === "enabled"
      });
      if (!isApiSuccess(updateRes)) {
        throw new Error(updateRes?.message || "更新用户失败");
      }
      const assignRes = await assignUserRolesApi({
        userId: editForm.id,
        roleIds: [roleIdByValue(editForm.role)]
      });
      if (!isApiSuccess(assignRes)) {
        throw new Error(assignRes?.message || "分配角色失败");
      }
      message("更新用户成功", { type: "success" });
    }
    editOpen.value = false;
    await fetchUsers();
  } catch (error) {
    message(error?.message || "保存失败", { type: "error" });
  }
}

async function toggleStatus(row) {
  try {
    const enabled = row.status !== "enabled";
    const res = await updateUserApi({
      id: row.id,
      email: row.email,
      phone: row.phone,
      enabled
    });
    if (!isApiSuccess(res)) {
      throw new Error(res?.message || "更新状态失败");
    }
    message(`已${enabled ? "启用" : "停用"}：${row.username}`, {
      type: "success"
    });
    await fetchUsers();
  } catch (error) {
    message(error?.message || "更新状态失败", { type: "error" });
  }
}

async function resetPassword(row) {
  try {
    const { value, action } = await ElMessageBox.prompt(
      `请输入 ${row.username} 的新密码`,
      "重置密码",
      {
        confirmButtonText: "确认",
        cancelButtonText: "取消",
        inputValue: "123456",
        inputValidator: val =>
          String(val || "").length >= 5 ? true : "密码至少5位"
      }
    );
    if (action !== "confirm") return;
    const res = await resetUserPasswordApi({
      userId: row.id,
      newPassword: String(value || "").trim()
    });
    if (!isApiSuccess(res)) {
      throw new Error(res?.message || "重置密码失败");
    }
    message(`已重置密码：${row.username}`, { type: "success" });
  } catch (error) {
    if (error === "cancel") return;
    message(error?.message || "重置密码失败", { type: "error" });
  }
}

async function assignRole(row) {
  try {
    const res = await assignUserRolesApi({
      userId: row.id,
      roleIds: [roleIdByValue(row.role)]
    });
    if (!isApiSuccess(res)) {
      throw new Error(res?.message || "分配角色失败");
    }
    message(`已分配角色：${row.username}`, { type: "success" });
    await fetchUsers();
  } catch (error) {
    message(error?.message || "分配角色失败", { type: "error" });
  }
}

onMounted(async () => {
  await fetchRoles();
  fetchUsers();
});
</script>

<template>
  <div class="dd-page">
    <el-card shadow="never" class="mb-4">
      <el-form :inline="true" :model="form">
        <el-form-item label="角色">
          <el-select
            v-model="form.role"
            placeholder="全部角色"
            clearable
            style="width: 180px"
          >
            <el-option
              v-for="r in roleFilterOptions"
              :key="r.value"
              :label="r.label"
              :value="r.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="form.status"
            placeholder="全部状态"
            clearable
            style="width: 180px"
          >
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
            placeholder="用户名/姓名/手机号/邮箱"
            style="width: 260px"
            clearable
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="openCreate">新增用户</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="font-semibold">用户列表</div>
          <div class="text-xs text-[var(--el-text-color-secondary)]">
            共 {{ filteredRows.length }} 人
          </div>
        </div>
      </template>

      <el-table v-loading="tableLoading" :data="filteredRows" stripe>
        <el-table-column prop="username" label="用户名" width="140" />
        <el-table-column prop="nickname" label="姓名" width="140" />
        <el-table-column label="角色" width="120">
          <template #default="scope">
            <el-tag :type="roleTagType(scope.row.role)">{{
              roleLabel(scope.row.role)
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="statusTagType(scope.row.status)">{{
              statusLabel(scope.row.status)
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column
          prop="email"
          label="邮箱"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column prop="lastLogin" label="最近登录" width="160" />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="scope">
            <el-space>
              <el-button link type="primary" @click="openEdit(scope.row)"
                >编辑</el-button
              >
              <el-button link type="primary" @click="toggleStatus(scope.row)">
                {{ scope.row.status === "enabled" ? "停用" : "启用" }}
              </el-button>
              <el-button link type="primary" @click="resetPassword(scope.row)"
                >重置密码</el-button
              >
              <el-button link type="primary" @click="assignRole(scope.row)"
                >分配角色</el-button
              >
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="editOpen"
      :title="editMode === 'create' ? '新增用户' : '编辑用户'"
      width="640px"
    >
      <el-form label-width="90px">
        <el-form-item label="用户名">
          <el-input
            v-model="editForm.username"
            placeholder="例如：admin"
            :disabled="editMode === 'edit'"
          />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="editForm.nickname" placeholder="例如：张三" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select
            v-model="editForm.role"
            placeholder="请选择角色"
            style="width: 100%"
          >
            <el-option
              v-for="r in roleOptions"
              :key="r.value"
              :label="r.label"
              :value="r.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="editForm.phone" placeholder="138xxxxxxxx" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="editForm.email" placeholder="name@example.com" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="editForm.status">
            <el-radio label="enabled">启用</el-radio>
            <el-radio label="disabled">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-space>
          <el-button @click="editOpen = false">取消</el-button>
          <el-button type="primary" @click="saveUser">保存</el-button>
        </el-space>
      </template>
    </el-dialog>
  </div>
</template>
