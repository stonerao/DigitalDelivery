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

export const deleteHandoverProjects = data => {
  return http.request("post", "/api/handover/projects/delete", { data });
};

export const getAllHandoverProjects = () => {
  return http.request("get", "/api/handover/projects/all");
};

export const getHandoverProjectTypeTree = () => {
  return http.request("get", "/api/handover/projectTypes/tree");
};

export const searchHandoverProjectTypes = params => {
  return http.request("get", "/api/handover/projectTypes/search", { params });
};

export const createHandoverProjectType = data => {
  return http.request("post", "/api/handover/projectTypes/create", { data });
};

export const renameHandoverProjectType = data => {
  return http.request("post", "/api/handover/projectTypes/rename", { data });
};

export const moveHandoverProjectType = data => {
  return http.request("post", "/api/handover/projectTypes/move", { data });
};

export const deleteHandoverProjectTypes = data => {
  return http.request("post", "/api/handover/projectTypes/delete", { data });
};
