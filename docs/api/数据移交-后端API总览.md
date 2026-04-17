# 数据移交-后端 API 总览（已确认）

> 状态：已确认
> 覆盖页面：`/handover/dashboard`、`/handover/documents`、`/handover/models`、`/handover/data`

---

## 一、全局约束（已确认）

1. 变化率由后端计算并返回。
2. 仪表盘“近期活动”聚合日志审计模块数据。
3. 上传走后端中转上传（不采用前端直传对象存储）。
4. 服务端必须执行文件与元数据校验。
5. 回收站保留 1 个月（30 天），超期由后端定时任务自动清理。
6. 模型不做格式转换，`components` 由前端维护。
7. 下载/预览地址统一返回短时签名 URL。
8. 导入与校验流程走异步任务队列。
9. 校验规则采用配置化方案。
10. 导出按当前筛选条件执行，并记录导出审计日志。

---

## 二、统一返回结构

```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

---

## 三、仪表盘（Dashboard）

### 1) 仪表盘统计
- `GET /api/handover/dashboard/stats`
- 参数：`projectId`、`dateFrom`、`dateTo`
- 返回核心字段：
  - `documentCount`
  - `modelCount`
  - `kksCount`
  - `activeProjectCount`
  - `documentChangeRate`
  - `modelChangeRate`
  - `kksChangeRate`
  - `activeProjectChangeRate`

### 2) 近期活动（聚合审计）
- `GET /api/handover/dashboard/activities`
- 参数：`projectId`、`page`、`size`
- 返回：`records[] + total/page/size`
- `records[]`建议字段：`id/time/action/user/statusText/statusType/source/bizType/bizId`

### 3) 快速上传（文档）
- `POST /api/handover/dashboard/quickUpload`（`multipart/form-data`）
- 参数：`files[]`、`transferDepth`、`projectId`
- 返回：`uploadedCount`、`documentIds[]`

---

## 四、文档管理（Documents）

### 1) 文档列表查询（高级筛选）
- `GET /api/handover/documents/list`
- 参数：
  - `keyword`、`searchMode`（`fuzzy/exact`）
  - `types[]`
  - `updatedFrom`、`updatedTo`
  - `kksKeyword`、`nodeId`
  - `folderId`、`recycleBin`
  - `page`、`size`
- 返回：`records[] + total/page/size`
- `records[]`建议包含：
  - 基础：`id/name/size/type/updatedAt/createdAt/createdBy/updatedBy`
  - 回收站：`deletedAt/deletedBy`
  - 目录关联：`folderId/nodeIds[]/kksRefs[]`
  - 版本：`versions[]`

### 2) 上传文档（后端中转 + 服务端校验）
- `POST /api/handover/documents/upload`（`multipart/form-data`）
- 参数：`files[]`、`folderId`、`nodeIds[]`、`kksRefs[]`、`transferDepth`
- 服务端校验：
  - 文件后缀白名单
  - 文件大小上限
  - 版本上传同类型/同后缀
  - 必填元数据校验

### 3) 文档详情
- `GET /api/handover/documents/{id}`

### 4) 更新文档元数据（重命名/关联）
- `POST /api/handover/documents/update`
- 请求体：`id/name/folderId/nodeIds[]/kksRefs[]`

### 5) 移动文档
- `POST /api/handover/documents/move`
- 请求体：`ids[]`、`targetFolderId`

### 6) 回收站
- 软删除：`POST /api/handover/documents/delete`
- 恢复：`POST /api/handover/documents/restore`
- 彻底删除：`POST /api/handover/documents/purge`
- 请求体：`ids[]`
- 策略：保留 30 天，后端定时清理

### 7) 文档版本管理
- 查询版本：`GET /api/handover/documents/{id}/versions`
- 上传新版本：`POST /api/handover/documents/{id}/versions/upload`（`multipart/form-data`）
- 回滚版本：`POST /api/handover/documents/{id}/versions/rollback`
- 回滚体：`versionId`

### 8) 下载能力（统一签名地址）
- 单文档下载地址：`GET /api/handover/documents/{id}/downloadUrl`
- 批量下载打包：`POST /api/handover/documents/batchDownload`
- 批量请求体：`ids[]`
- 返回建议：`url`（带签名）、`signed=true`、`expireAt`

### 9) 文档目录树
- 查询：`GET /api/handover/docFolders/tree`
- 新建：`POST /api/handover/docFolders/create`
- 重命名：`POST /api/handover/docFolders/rename`
- 移动：`POST /api/handover/docFolders/move`
- 删除：`POST /api/handover/docFolders/delete`
- 导入 JSON：`POST /api/handover/docFolders/import`
- 导出 JSON：`GET /api/handover/docFolders/export`

### 10) 对象字典（关联弹窗）
- 系统节点选项：`GET /api/handover/systemNodes/options`
- KKS 选项：`GET /api/handover/kks/options`

---

## 五、模型管理（Models）

### 1) 模型列表
- `GET /api/handover/models/list`
- 参数：`keyword`、`lod`、`nodeId`、`kks`、`page`、`size`
- 返回核心：`records[] + total/page/size`
- `records[]`字段建议：`id/name/url(l短签名)/lod/components/updatedAt/nodeIds[]/kksRefs[]/format/size/status`

### 2) 上传模型（后端中转 + 异步任务）
- `POST /api/handover/models/upload`（`multipart/form-data`）
- 参数：`files[]`、`lod`、`nodeIds[]`、`kksRefs[]`
- 返回：`taskId`、`status=queued`

### 2.1) 上传任务状态
- `GET /api/handover/models/upload/task`
- 参数：`taskId`
- 返回：任务状态与产出模型信息

### 3) 更新模型（编辑）
- `POST /api/handover/models/update`
- 请求体：`id/name/lod`

### 4) 模型详情
- `GET /api/handover/models/{id}`
- 返回：`url` 使用统一短时签名地址

### 5) 删除模型
- `POST /api/handover/models/delete`
- 请求体：`ids[]`

---

## 六、数据管理（KKS/Data）

### 1) 台账数据列表
- `GET /api/handover/kks/list`
- 参数：`keyword`、`status`、`nodeId`、`page`、`size`
- 返回：`records[] + total/page/size`

### 2) 导入台账数据（异步）
- `POST /api/handover/kks/import`（`multipart/form-data`）
- 参数：`files[]`、`importMode`、`note`
- 返回：`taskId`、`version`

### 3) 导入任务状态
- `GET /api/handover/kks/import/task`
- 参数：`taskId`
- 返回：`status/total/inserted/updated/failed/errorFileUrl`

### 4) 台账校验（配置化 + 异步）
- 全量：`POST /api/handover/kks/validateAll`
- 单条：`POST /api/handover/kks/validateOne`
- 单条请求体：`kks`
- 任务状态：`GET /api/handover/kks/validate/task?taskId=...`

### 5) 导出台账（按当前筛选 + 记审计日志）
- `GET /api/handover/kks/export`
- 参数：`keyword`、`status`、`nodeId`、`page`、`size`
- 返回：
  - `url`（签名地址）
  - `signed=true`
  - `auditLogId`
  - `expireAt`

### 6) 数据版本记录
- `GET /api/handover/kks/versions`
- 返回：`records[]`

---

## 七、错误码建议（可选）

| code | 含义 | 处理建议 |
| ---- | ---- | ---- |
| 200 | 成功 | 正常展示 |
| 40001 | 参数校验失败 | 前端提示字段错误 |
| 40101 | 未登录/令牌失效 | 触发重新登录 |
| 40301 | 无权限 | 按钮禁用+提示 |
| 40401 | 资源不存在 | 刷新列表 |
| 40901 | 状态冲突（如回滚冲突） | 提示并重试 |
| 41301 | 文件超限 | 提示压缩/分批 |
| 41501 | 文件类型不支持 | 提示允许类型 |
| 50000 | 服务内部错误 | 统一错误提示 |

---

## 八、与日志审计模块联动

- 仪表盘活动流读取/聚合日志审计数据。
- 数据导出接口必须写入审计日志并返回 `auditLogId`。
- 建议在文档上传、版本回滚、回收站清理、批量删除等关键动作写审计日志。
