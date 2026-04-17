# BIM三维运行时Service设计

日期：2026-03-25

## 1. 文档目标

本文档用于定义 BIM 三维运行时的 service 层拆分方式、各 service 职责、输入输出边界与协作关系，作为阶段一架构拆分中的业务逻辑迁移依据。

对应文档：

- [运行时架构拆分设计.md](e:/项目/数字交付/DigitalDelivery/docs/运行时架构拆分设计.md#L1)
- [viewerAdapter接口设计.md](e:/项目/数字交付/DigitalDelivery/docs/viewerAdapter接口设计.md#L1)
- [viewer3d运行时Store设计.md](e:/项目/数字交付/DigitalDelivery/docs/viewer3d运行时Store设计.md#L1)

## 2. 为什么需要 service 层

当前 [fullscreen.vue](e:/项目/数字交付/DigitalDelivery/src/views/visualization/viewer3d/fullscreen.vue#L1) 中大量函数同时做了三件事：

- 读写页面状态
- 调用 viewer 方法
- 组织业务数据联动

问题在于：

- 页面文件函数过多
- 逻辑复用困难
- 状态流与命令流交织
- 新能力接入时只能继续堆函数

引入 service 层后：

- 页面只做视图编排
- store 只保存状态
- adapter 只做 viewer 适配
- service 专门处理复杂业务流程

## 3. service 层总体原则

service 层应遵循：

- 面向业务动作，而不是面向页面组件
- 可组合、可测试、可复用
- 不持有页面 DOM 引用
- 不直接操作 three.js 原始对象
- 通过 store 和 adapter 完成状态与命令交互

## 4. 建议 service 划分

阶段一建议至少建立以下 service。

## 4.1 selectionService

定位：选择、定位、聚焦相关业务流程。

建议职责：

- 定位设备
- 按 KKS 定位
- 按系统定位
- 按区域定位
- 对象选中后同步运行时状态
- 结构树、导航树、设备列表选择联动

建议接口：

- `locateDevice(device, options)`
- `locateByKks(kks, options)`
- `locateSystem(nodeId, options)`
- `locateRegion(regionId, options)`
- `handleObjectSelected(objectInfo)`
- `selectTreeNodeByUUID(uuid, options)`
- `clearSelectionState()`

主要依赖：

- `viewerAdapter`
- `viewer3dRuntime`
- `viewer3dProject`
- `ddLinkage`

## 4.2 visibilityService

定位：显隐、隔离、显示模式控制。

建议职责：

- 应用显示模式
- 图层树显隐控制
- 单设备隔离
- 恢复全部显示
- 透明度覆盖控制

建议接口：

- `applyDisplayMode(mode, options)`
- `applyLayerVisibility(uuids)`
- `syncLayerTreeSelection(uuids)`
- `isolateDevice(device, options)`
- `showAllObjects()`
- `makeSelectedMeshTransparent(uuid, opacity)`
- `restoreSelectedMeshOpacity(uuid)`

主要依赖：

- `viewerAdapter`
- `viewer3dRuntime`
- `viewer3dProject`

## 4.3 clippingService

定位：剖切状态与 viewer 剖切能力协同。

建议职责：

- 剖切开关控制
- 三轴剖切状态同步
- 区间更新
- 剖切状态恢复

建议接口：

- `toggleClipping()`
- `setPlaneEnabled(axis, enabled)`
- `setPlaneRange(axis, range)`
- `restoreClippingState()`
- `syncClippingStateFromViewer()`

主要依赖：

- `viewerAdapter`
- `viewer3dRuntime`
- `viewer3dProject`

## 4.4 measurementService

定位：测量相关业务流程。

阶段一职责：

- 切换测量模式
- 清空测量
- 获取测量结果
- 测量结果回写 project store

后续职责：

- 接入连续长度、角度、面积测量
- 管理测量结果列表

建议接口：

- `activateMeasureMode(mode)`
- `clearMeasurements()`
- `syncMeasurementsFromViewer()`
- `saveMeasurementRecord(record)`

主要依赖：

- `viewerAdapter`
- `viewer3dRuntime`
- `viewer3dProject`

## 4.5 schemeService

定位：场景方案保存、应用、删除。

建议职责：

- 构造方案 payload
- 保存场景方案
- 应用场景方案
- 删除方案
- 处理存储作用域

建议接口：

- `loadSceneSchemes(scope)`
- `saveCurrentSceneScheme(name)`
- `applySceneScheme(scheme)`
- `removeSceneScheme(id)`
- `persistSceneSchemes(scope)`

主要依赖：

- `viewerAdapter`
- `viewer3dRuntime`
- `viewer3dProject`

## 4.6 sceneTreeService

定位：场景结构树构建与联动。

建议职责：

- 刷新场景树
- 构建节点索引
- 展开父路径
- 滚动到当前节点
- 结构树选中与场景选中联动

建议接口：

- `refreshSceneTree()`
- `buildTreeNodeIndex(root)`
- `expandTreeToUUID(uuid)`
- `selectTreeNodeByUUID(uuid, options)`
- `scrollCurrentTreeNodeIntoView(uuid)`

主要依赖：

- `viewerAdapter`
- `viewer3dProject`
- `viewer3dRuntime`

## 4.7 deviceBindingService

定位：场景 Mesh 与业务设备映射。

建议职责：

- 扁平化模型 Mesh
- 自动匹配 KKS 和系统
- 构建设备索引
- 更新业务绑定结果

建议接口：

- `refreshSceneDevices()`
- `flattenSceneMeshes(root)`
- `resolveBusinessBinding(item, index, usedKks)`
- `getDevicesBySystem(nodeId)`
- `getDevicesByRegion(regionId)`

主要依赖：

- `viewerAdapter`
- `viewer3dProject`
- `ddLinkage`
- `getConfig`

说明：

- 当前 `fullscreen.vue` 中最关键的业务逻辑之一就是这一块，后续应优先抽离

## 4.8 bookmarkService

定位：截图和书签流程。

建议职责：

- 保存书签
- 应用书签
- 同步书签到 project store
- 截图下载

建议接口：

- `saveBookmark(name)`
- `applyBookmark(bookmark)`
- `refreshBookmarks()`
- `takeScreenshot(filename, options)`

主要依赖：

- `viewerAdapter`
- `viewer3dProject`

## 4.9 objectPanelService

定位：对象属性面板同步。

建议职责：

- 对象拾取后拼装展示数据
- 同步业务设备信息
- 同步测点显示
- 关闭属性面板时清理选择

建议接口：

- `handleObjectSelected(objectInfo)`
- `closeObjectPanel()`
- `syncMeasurementPoints()`

主要依赖：

- `viewerAdapter`
- `viewer3dRuntime`
- `viewer3dProject`
- `ddLinkage`

## 4.10 uiStateService

定位：UI 辅助状态控制。

建议职责：

- 侧栏切换
- 右键菜单开关
- 属性编辑弹窗开关
- 视频窗口开关

说明：

- 如果状态简单，可仅通过 store action 控制
- 复杂时再建立 service，阶段一可选

## 5. service 之间的关系

建议依赖关系如下：

- `selectionService` 可调用 `sceneTreeService`
- `schemeService` 可调用 `visibilityService`、`selectionService`、`objectPanelService`
- `objectPanelService` 可调用 `selectionService`
- `bookmarkService` 独立性较强
- `deviceBindingService` 是导航、设备、场景方案的底层数据基础

不建议：

- service 之间无序互调
- 形成循环依赖

## 6. 调用链建议

## 6.1 页面触发

页面组件触发用户行为后，建议调用：

- store action
- service 方法

而不是直接：

- viewer 实例方法
- 多个 store 混合更新

## 6.2 典型流程示例

### 设备列表点击定位

1. `DevicePanel.vue` 发起 `selectionService.locateDevice(device)`
2. `selectionService` 调用 `viewerAdapter.selectObjectByUUID`
3. `selectionService` 调用 `viewerAdapter.highlightObjectByUUID`
4. `selectionService` 调用 `viewerAdapter.focusObjectByUUID`
5. 更新 runtime store 中的选中对象状态
6. 调用 `sceneTreeService.selectTreeNodeByUUID`

### 场景方案应用

1. `SceneSchemePanel.vue` 调用 `schemeService.applySceneScheme(scheme)`
2. 更新 runtime store 的显示模式和当前筛选
3. 更新 project store 的图层勾选和测点状态
4. 调用 `visibilityService` 和 `selectionService`
5. 必要时恢复对象选中和测点显示

## 7. 文件组织建议

建议目录：

```text
src/3d/runtime/services/
  selectionService.js
  visibilityService.js
  clippingService.js
  measurementService.js
  schemeService.js
  sceneTreeService.js
  deviceBindingService.js
  bookmarkService.js
  objectPanelService.js
```

## 8. 实现形态建议

建议使用工厂函数形式，而不是 class。

示例：

```js
export function createSelectionService(ctx) {
  return {
    locateDevice,
    locateByKks
  };
}
```

`ctx` 可包含：

- `viewerAdapter`
- `runtimeStore`
- `projectStore`
- `ddStore`
- `message`

优点：

- 依赖显式
- 易测
- 易替换

## 9. 阶段一最低落地优先级

阶段一建议优先落地这 5 个 service：

1. `selectionService`
2. `visibilityService`
3. `schemeService`
4. `sceneTreeService`
5. `deviceBindingService`

原因：

- 这些直接承接当前 `fullscreen.vue` 中最重的业务逻辑
- 其余 service 可在后续阶段补全

## 10. 验收标准

满足以下条件可视为 service 层拆分有效：

- 页面中的核心业务函数明显减少
- 定位、显隐、场景方案应用已有独立 service 承接
- service 与 store、adapter 的边界清晰
- 后续点位和摄像头能力可以在 service 层接入，而不回到页面堆逻辑

## 11. 下一步建议

本设计确认后，建议继续：

1. 输出 `useViewerRuntime` 设计文档
2. 直接进入阶段一代码拆分实施
