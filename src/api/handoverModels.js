import { http } from "@/utils/http";

export const getHandoverModelList = params => {
  return http.request("get", "/api/handover/models/list", { params });
};

export const uploadHandoverModel = data => {
  return http.request("post", "/api/handover/models/upload", data, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
};

export const getHandoverModelUploadTask = params => {
  return http.request("get", "/api/handover/models/upload/task", { params });
};

export const getHandoverModelDetail = params => {
  return http.request("get", "/api/handover/models/detail", { params });
};

export const getHandoverModelThumbnail = (id, axiosConfig = {}) => {
  return http.request(
    "get",
    `/api/handover/models/thumbnail/${encodeURIComponent(id)}`,
    {},
    {
      ...axiosConfig,
      responseType: "blob",
      headers: {
        Accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        ...(axiosConfig.headers || {})
      }
    }
  );
};

export const updateHandoverModel = data => {
  return http.request("post", "/api/handover/models/update", { data });
};

export const deleteHandoverModel = data => {
  return http.request("post", "/api/handover/models/delete", { data });
};
