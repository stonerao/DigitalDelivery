import { http } from "@/utils/http";

export const getHandoverProjectList = params => {
  return http.request("get", "/api/handover/projects/list", { params });
};

export const getHandoverProjectDetail = id => {
  return http.request("get", `/api/handover/projects/${id}`);
};

export const createHandoverProject = data => {
  return http.request("post", "/api/handover/projects/create", { data });
};

export const updateHandoverProject = data => {
  return http.request("post", "/api/handover/projects/update", { data });
};

export const getAllHandoverProjects = () => {
  return http.request("get", "/api/handover/projects/all");
};
