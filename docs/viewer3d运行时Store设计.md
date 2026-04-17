# viewer3d运行时Store设计

日期：2026-03-25

## 1. 文档目标

本文档用于定义 BIM 三维运行时的 store 结构、字段、getter、action 和职责边界，作为阶段一架构拆分的状态设计依据。

对应文档：

- [技术分册.md](e:/项目/数字交付/DigitalDelivery/docs/技术分册.md#L1)
- [运行时架构拆分设计.md](e:/项目/数字交付/DigitalDelivery/docs/运行时架构拆分设计.md#L1)
- [阶段一详细任务表.md](e:/项目/数字交付/DigitalDelivery/docs/阶段一详细任务表.md#L1)

## 2. 设计原则

store 设计遵循以下原则：

- 运行态与工程态分离
- store 保存状态，不承接复杂 three.js 流程
- 复杂业务过程放 service
- store 字段名称尽量稳定，便于后续点位、摄像头、实时数据扩展
- 页面组件优先只读 store，并通过 action 或 service 修改状态

## 3. Store 划分

建议拆成两个 Pinia store。

## 3.1 viewer3dRuntime

定位：运行时页面即时状态。

适合存放：

- 当前工具
- 当前显示模式
- 当前面板状态
- 当前对象选择态
- 视频窗口状态
- 当前交互模式

不适合存放：

- 大型工程配置对象
- 原始模型树完整数据
- three.js 对象实例

## 3.2 viewer3dProject

定位：工程级运行数据与配置态缓存。

适合存放：

- 场景方案
- 点位定义
- 摄像头定义
- 测量结果
- 工程包配置
- 设备与系统索引

不适合存放：

- viewer 实例
- renderer、camera、mesh 等 three.js 对象

## 4. viewer3dRuntime 设计

## 4.1 state 建议

```js
{
  modelId: "",
  modelUrl: "",
  modelName: "",
  viewerReady: false,
  loading: false,
  errorText: "",

  activeTool: "rotate",
  interactionMode: "rotate",
  measurementMode: "",

  showSidePanel: true,
  showStats: false,
  showObjectPanel: false,
  activeSideTab: "navigation",

  displayMode: "all",
  transparentEnabled: false,
  clippingEnabled: false,
  roamingEnabled: false,
  pointMarkersVisible: true,

  selectedObjectUuid: "",
  selectedObjectInfo: null,
  selectedDeviceUuid: "",
  selectedTreeNodeUuid: "",
  selectedAnchorId: "",
  selectedCameraId: "",

  currentNavNodeKey: "",
  selectedSystemNodeId: "",
  selectedQuickKks: "",

  videoDialogVisible: false,
  videoDrawerVisible: false,
  activeVideoSource: null,

  ctxMenuVisible: false,
  ctxMenuNodeId: "",

  propDialogVisible: false,
  propDialogMode: "bind"
}
```

## 4.2 getter 建议

建议 getter：

- `hasModel`
- `hasSelection`
- `isMeasureMode`
- `isPickMode`
- `isRoaming`
- `isVideoVisible`
- `displayModeText`

### displayModeText 示例

```js
displayModeText(state) {
  const map = {
    all: "全部构件",
    business: "已绑定业务设备",
    system: "当前系统",
    selection: "当前设备",
    tree: "分层树筛选"
  };
  return map[state.displayMode] || "全部构件";
}
```

## 4.3 action 建议

建议 action 分类如下。

### 模型状态

- `setModelInfo`
- `setViewerReady`
- `setLoading`
- `setErrorText`
- `resetModelRuntimeState`

### 工具与交互

- `setActiveTool`
- `setInteractionMode`
- `setMeasurementMode`
- `setRoamingEnabled`
- `setTransparentEnabled`
- `setClippingEnabled`

### 面板与显示

- `setShowSidePanel`
- `setShowStats`
- `setShowObjectPanel`
- `setActiveSideTab`
- `setDisplayMode`
- `setPointMarkersVisible`

### 选择态

- `setSelectedObject`
- `setSelectedDeviceUuid`
- `setSelectedTreeNodeUuid`
- `setSelectedAnchorId`
- `setSelectedCameraId`
- `clearSelectionState`

### 导航与业务定位

- `setCurrentNavNodeKey`
- `setSelectedSystemNodeId`
- `setSelectedQuickKks`

### 视频与弹窗

- `openVideoDialog`
- `closeVideoDialog`
- `openVideoDrawer`
- `closeVideoDrawer`
- `setActiveVideoSource`

### 右键菜单与属性弹窗

- `openContextMenu`
- `closeContextMenu`
- `openPropDialog`
- `closePropDialog`

## 4.4 reset 设计

建议提供两个层级的 reset。

### 局部 reset

- `resetSelectionState`
- `resetVideoState`
- `resetPanelState`

### 全量 reset

- `resetRuntimeState`

说明：

- 模型切换时一般走全量 reset
- 局部面板关闭时只做局部 reset

## 5. viewer3dProject 设计

## 5.1 state 建议

```js
{
  projectId: "",
  projectName: "",
  projectVersion: "1.0.0",
  projectConfig: null,

  sceneSchemes: [],
  bookmarks: [],

  sceneDevices: [],
  deviceKeyword: "",
  deviceIndexByUuid: {},
  deviceIndexByKks: {},

  sceneTree: null,
  treeFilterText: "",
  treeFilterKeyword: "",
  treeExpandedKeys: [],
  treeDefaultExpandedKeys: [],

  layerCheckedKeys: [],

  anchors: [],
  anchorGroups: [],
  anchorStyles: [],

  cameraAnchors: [],

  measurementRecords: [],

  clippingRanges: {
    x: [0, 1],
    y: [0, 1],
    z: [0, 1]
  },
  clippingPlanesEnabled: {
    x: false,
    y: false,
    z: false
  }
}
```

## 5.2 getter 建议

建议 getter：

- `allDeviceUuids`
- `selectedVisibleDeviceRefs`
- `sceneDeviceSystemOptions`
- `sceneDeviceKksOptions`
- `filteredSceneDevices`
- `anchorMap`
- `cameraAnchorMap`

### filteredSceneDevices 示例逻辑

- 按名称筛选
- 按类型筛选
- 按路径筛选
- 按 KKS 筛选

## 5.3 action 建议

建议 action 分类如下。

### 工程与配置

- `setProjectInfo`
- `setProjectConfig`
- `resetProjectState`

### 场景设备

- `setSceneDevices`
- `setDeviceKeyword`
- `rebuildDeviceIndexes`
- `updateSceneDevice`
- `clearSceneDevices`

### 场景树

- `setSceneTree`
- `setTreeFilterText`
- `setTreeFilterKeyword`
- `setTreeExpandedKeys`
- `setTreeDefaultExpandedKeys`
- `clearSceneTreeState`

### 图层与显隐

- `setLayerCheckedKeys`
- `syncAllLayerCheckedKeys`

### 场景方案

- `setSceneSchemes`
- `addSceneScheme`
- `updateSceneScheme`
- `removeSceneScheme`
- `clearSceneSchemes`

### 书签

- `setBookmarks`
- `addBookmark`
- `removeBookmark`
- `clearBookmarks`

### 点位与摄像头

- `setAnchors`
- `addAnchor`
- `updateAnchor`
- `removeAnchor`
- `setCameraAnchors`
- `addCameraAnchor`
- `updateCameraAnchor`
- `removeCameraAnchor`

### 测量

- `setMeasurementRecords`
- `addMeasurementRecord`
- `removeMeasurementRecord`
- `clearMeasurementRecords`

### 剖切

- `setClippingRange`
- `setClippingPlaneEnabled`
- `resetClippingState`

## 6. 字段归属边界

以下字段建议放 runtime store：

- 当前选中对象
- 是否显示视频弹窗
- 当前激活工具
- 当前激活侧栏
- 当前是否漫游

以下字段建议放 project store：

- 点位定义
- 摄像头定义
- 场景方案
- 书签
- 场景设备与索引
- 场景树数据

以下内容不进入 store：

- `viewerRef`
- `THREE.Object3D`
- `renderer`
- `camera`
- `controls`
- 各类 helper 实例

## 7. 与 service 的边界

store 负责：

- 保存状态
- 简单同步逻辑
- 基础集合操作

service 负责：

- 复杂联动流程
- 调用 ViewerAdapter
- 将外部数据转换为 store 所需结构
- 处理跨 store 操作

示例：

- `locateDevice` 这类操作建议放 `selectionService`
- `applyDisplayMode` 建议放 `visibilityService`
- `applySceneScheme` 建议放 `schemeService`

## 8. 与现有 fullscreen.vue 的迁移建议

当前页面中的变量可以按如下方向迁移。

### 迁入 viewer3dRuntime

- `showSidePanel`
- `showStats`
- `transparent`
- `enableClipping`
- `activeTool`
- `roamingEnabled`
- `activeSideTab`
- `pointMarkersVisible`
- `selectedDeviceUuid`
- `selectedSystemNodeId`
- `selectedQuickKks`
- `displayMode`
- `currentNavNodeKey`
- `selectedObjectInfo`
- `showObjectPanel`
- `ctxMenuVisible`
- `ctxMenuNode`
- `propDialogVisible`
- `propDialogMode`

### 迁入 viewer3dProject

- `sceneDevices`
- `deviceKeyword`
- `sceneSchemes`
- `schemeName`
- `sceneTree`
- `treeFilterText`
- `selectedTreeNode`
- `treeDefaultExpandedKeys`
- `treeFilterKeyword`
- `layerCheckedKeys`
- `bookmarks`
- `clippingX/Y/Z`
- `clippingXEnabled/YEnabled/ZEnabled`

说明：

- `schemeName` 是否放 store 可以视实现选择
- 临时表单状态也可暂留组件内部

## 9. 典型 action 流程建议

### 工具切换

1. UI 触发 `setActiveTool`
2. service 根据 tool 映射设置 interactionMode
3. ViewerAdapter 调用 viewer 切换模式
4. runtime store 更新状态

### 对象选中

1. Viewer 触发 object-select
2. adapter 转发事件
3. service 查找设备映射和业务数据
4. runtime store 更新 `selectedObjectInfo`
5. runtime store 更新 `selectedDeviceUuid`
6. project store 同步树和导航状态

### 应用场景方案

1. UI 点击方案
2. `schemeService` 读取方案
3. 更新 runtime store 相关状态
4. 更新 project store 图层与点位状态
5. 通过 adapter 调用 viewer 恢复显隐与定位

## 10. 建议命名规范

建议遵循以下规范：

- 布尔字段统一用 `is/has/show/enable` 前缀
- setter 统一用 `setXxx`
- 局部清理统一用 `clearXxx`
- 全量清理统一用 `resetXxxState`

例子：

- `setShowObjectPanel`
- `setClippingEnabled`
- `clearMeasurementRecords`
- `resetRuntimeState`

## 11. 验收标准

store 设计落地后，应满足：

- 页面大部分状态已迁入 store
- 页面组件不再大量互相传递临时状态
- 主要逻辑可以通过 store 和 service 明确追踪
- 点位、摄像头、视频、测量功能后续接入时不需要重构状态层

## 12. 下一步建议

本设计确认后，建议继续输出：

1. `viewerAdapter` 接口设计文档
2. service 设计文档
3. 阶段一代码改造实施说明
