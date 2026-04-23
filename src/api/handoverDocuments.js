import { http } from "@/utils/http";

export const getHandoverDocumentList = params => {
  return http.request("get", "/api/handover/documents/list", { params });
};

export const uploadHandoverDocument = data => {
  return http.request("post", "/api/handover/documents/upload", data, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
};

export const getHandoverDocumentDetail = id => {
  return http.request("get", "/api/handover/documents/detail", {
    params: { id }
  });
};

export const updateHandoverDocument = data => {
  return http.request("post", "/api/handover/documents/update", { data });
};

export const moveHandoverDocuments = data => {
  return http.request("post", "/api/handover/documents/move", { data });
};

export const deleteHandoverDocuments = data => {
  return http.request("post", "/api/handover/documents/delete", { data });
};

export const restoreHandoverDocuments = data => {
  return http.request("post", "/api/handover/documents/restore", { data });
};

export const purgeHandoverDocuments = data => {
  return http.request("post", "/api/handover/documents/purge", { data });
};

export const getHandoverDocumentVersions = id => {
  return http.request("get", "/api/handover/documents/versions", {
    params: { id }
  });
};

export const uploadHandoverDocumentVersion = data => {
  return http.request("post", "/api/handover/documents/versions/upload", data, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
};

export const rollbackHandoverDocumentVersion = (id, data) => {
  return http.request(
    "post",
    `/api/handover/documents/${id}/versions/rollback`,
    {
      data
    }
  );
};

export const downloadHandoverDocumentFile = (id, axiosConfig = {}) => {
  return http.request(
    "get",
    `/api/handover/documents/download/${encodeURIComponent(id)}`,
    {},
    {
      ...axiosConfig,
      responseType: "blob",
      headers: {
        Accept: "*/*",
        ...(axiosConfig.headers || {})
      }
    }
  );
};

export const batchDownloadHandoverDocuments = (data, axiosConfig = {}) => {
  return http.request(
    "post",
    "/api/handover/documents/batchDownload",
    {
      data
    },
    {
      ...axiosConfig,
      responseType: "blob",
      headers: {
        Accept: "*/*",
        ...(axiosConfig.headers || {})
      }
    }
  );
};

export const getHandoverDocFolderTree = () => {
  return http.request("get", "/api/handover/docFolders/tree");
};

export const createHandoverDocFolder = data => {
  return http.request("post", "/api/handover/docFolders/create", { data });
};

export const renameHandoverDocFolder = data => {
  return http.request("post", "/api/handover/docFolders/rename", { data });
};

export const moveHandoverDocFolder = data => {
  return http.request("post", "/api/handover/docFolders/move", { data });
};

export const deleteHandoverDocFolder = data => {
  return http.request("post", "/api/handover/docFolders/delete", { data });
};

export const importHandoverDocFolder = data => {
  return http.request("post", "/api/handover/docFolders/import", { data });
};

export const exportHandoverDocFolder = () => {
  return http.request("get", "/api/handover/docFolders/export");
};

export const getHandoverDocumentPreviewUrl = (id, params) => {
  return http.request("get", `/api/handover/documents/${id}/previewUrl`, {
    params
  });
};
