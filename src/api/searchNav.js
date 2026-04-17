import { http } from "@/utils/http";

export const searchNav = data => {
  return http.request("post", "/api/search-nav/search", { data });
};

export const getSystemNodeTree = () => {
  return http.request("get", "/api/handover/systemNodes/tree");
};

export const getSystemNodeDetail = id => {
  return http.request("get", `/api/handover/systemNodes/${id}/detail`);
};

export const getKksOptions = params => {
  return http.request("get", "/api/handover/kks/options", { params });
};

export const createSystemNode = data => {
  return http.request("post", "/api/handover/systemNodes/create", { data });
};

export const renameSystemNode = data => {
  return http.request("post", "/api/handover/systemNodes/rename", { data });
};

export const moveSystemNode = data => {
  return http.request("post", "/api/handover/systemNodes/move", { data });
};

export const deleteSystemNodes = data => {
  return http.request("post", "/api/handover/systemNodes/delete", { data });
};

export const importSystemNodes = data => {
  return http.request("post", "/api/handover/systemNodes/import", { data });
};

export const exportSystemNodes = () => {
  return http.request("get", "/api/handover/systemNodes/export");
};

export const pageQueryRelationRecords = data => {
  return http.request("post", "/api/search-nav/relationRecords/pageQuery", {
    data
  });
};

export const getRelationRecordDetail = id => {
  return http.request("get", `/api/search-nav/relationRecords/${id}`);
};

export const createRelationRecord = data => {
  return http.request("post", "/api/search-nav/relationRecords/create", {
    data
  });
};

export const updateRelationRecord = data => {
  return http.request("post", "/api/search-nav/relationRecords/update", {
    data
  });
};

export const deleteRelationRecord = id => {
  return http.request("post", `/api/search-nav/relationRecords/delete/${id}`);
};

export const batchDeleteRelationRecords = data => {
  return http.request("post", "/api/search-nav/relationRecords/batchDelete", {
    data
  });
};

export const deleteRelationRecordsBySource = params => {
  return http.request(
    "post",
    "/api/search-nav/relationRecords/deleteBySource",
    {
      params
    }
  );
};

export const deleteRelationRecordsByTarget = params => {
  return http.request(
    "post",
    "/api/search-nav/relationRecords/deleteByTarget",
    {
      params
    }
  );
};

export const listRelationRecordsBySource = params => {
  return http.request("get", "/api/search-nav/relationRecords/bySource", {
    params
  });
};

export const listRelationRecordsByTarget = params => {
  return http.request("get", "/api/search-nav/relationRecords/byTarget", {
    params
  });
};

export const listRelationRecordsBySourceAndType = params => {
  return http.request(
    "get",
    "/api/search-nav/relationRecords/bySourceAndType",
    {
      params
    }
  );
};
