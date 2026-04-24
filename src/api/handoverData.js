import { http } from "@/utils/http";

export const getHandoverKksList = params => {
  return http.request("get", "/api/handover/kks/list", { params });
};

export const importHandoverKks = formData => {
  return http.request(
    "post",
    "/api/handover/kks/import",
    { data: formData },
    {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    }
  );
};

export const getHandoverKksImportTask = params => {
  return http.request("get", "/api/handover/kks/import/task", { params });
};

export const validateHandoverKksAll = () => {
  return http.request("post", "/api/handover/kks/validateAll");
};

export const validateHandoverKksOne = data => {
  return http.request("post", "/api/handover/kks/validateOne", { data });
};

export const getHandoverKksValidateTask = params => {
  return http.request("get", "/api/handover/kks/validate/task", { params });
};

export const exportHandoverKks = params => {
  return http.request("get", "/api/handover/kks/export", { params });
};

export const deleteHandoverKks = data => {
  return http.request("post", "/api/handover/kks/delete", { data });
};

export const getHandoverKksVersions = () => {
  return http.request("get", "/api/handover/kks/versions");
};
