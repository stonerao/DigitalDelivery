import { http } from "@/utils/http";

/** 用户列表（分页） */
export const listUsersApi = params => {
  return http.request("get", "/api/system/users/list", { params });
};

/** 创建用户 */
export const createUserApi = data => {
  return http.request("post", "/api/system/users/create", { data });
};

/** 更新用户 */
export const updateUserApi = data => {
  return http.request("post", "/api/system/users/update", { data });
};

/** 重置密码 */
export const resetUserPasswordApi = data => {
  return http.request("post", "/api/system/users/resetPassword", { data });
};

/** 分配角色 */
export const assignUserRolesApi = data => {
  return http.request("post", "/api/system/users/assignRoles", { data });
};

/** 批量导入用户 */
export const batchImportUsersApi = data => {
  return http.request("post", "/api/system/users/batchImport", { data });
};
