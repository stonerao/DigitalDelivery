import { http } from "@/utils/http";

/** 角色列表 */
export const listRolesApi = params => {
  return http.request("get", "/api/system/roles/list", { params });
};

/** 创建角色 */
export const createRoleApi = data => {
  return http.request("post", "/api/system/roles/create", { data });
};

/** 更新角色 */
export const updateRoleApi = data => {
  return http.request("post", "/api/system/roles/update", { data });
};

/** 删除角色 */
export const deleteRoleApi = data => {
  return http.request("post", "/api/system/roles/delete", { data });
};
