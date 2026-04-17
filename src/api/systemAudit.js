import { http } from "@/utils/http";

/** 日志列表查询 */
export const listAuditLogsApi = params => {
  return http.request("get", "/api/audit/logs", { params });
};

/** 日志导出 */
export const exportAuditLogsApi = params => {
  return http.request("get", "/api/audit/export", { params });
};
