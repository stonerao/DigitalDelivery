/*
 * @Date: 2026-03-05 10:44:51
 * @LastEditors: stonerao 674656681@qq.com
 * @LastEditTime: 2026-03-05 11:12:37
 * @FilePath: \DigitalDelivery\src\api\handoverDashboard.js
 */
import { http } from "@/utils/http";

export const getHandoverDocuments = params => {
  return http.request("get", "/api/handover/documents/list", { params });
};

export const getHandoverModels = params => {
  return http.request("get", "/api/handover/models/list", { params });
};

export const getHandoverKks = params => {
  return http.request("get", "/api/handover/kks/list", { params });
};

export const uploadHandoverDocuments = data => {
  return http.request("post", "/api/handover/documents/upload", data, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
};

export const quickUploadDashboard = data => {
  return http.request("post", "/api/handover/dashboard/quickUpload", { data });
};
