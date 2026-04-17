import { http } from "@/utils/http";

export const getHandoverSystemNodeOptions = params => {
  return http.request("get", "/api/handover/systemNodes/options", {
    params
  });
};

export const getHandoverKksOptions = params => {
  return http.request("get", "/api/handover/kks/options", { params });
};
