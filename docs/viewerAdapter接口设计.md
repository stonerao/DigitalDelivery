# viewerAdapter接口设计

日期：2026-03-25

## 1. 文档目标

本文档用于定义 BIM 三维运行时中的 `viewerAdapter` 适配层接口、职责边界、事件转发方式与实现建议，作为页面层、service 层与底层 `ThreeModelViewer` 之间的统一调用契约。

对应文档：

- [运行时架构拆分设计.md](e:/项目/数字交付/DigitalDelivery/docs/运行时架构拆分设计.md#L1)
- [viewer3d运行时Store设计.md](e:/项目/数字交付/DigitalDelivery/docs/viewer3d运行时Store设计.md#L1)
- [阶段一详细任务表.md](e:/项目/数字交付/DigitalDelivery/docs/阶段一详细任务表.md#L1)

## 2. 设计目标

`viewerAdapter` 的核心目标：

- 页面和面板不直接访问 `viewerRef.value?.xxx`
- service 层只面向稳定接口，不依赖底层组件细节
- 统一承接 viewer 事件与错误处理
- 为后续点位、摄像头、实时数据、脚本扩展保留接口位置

## 3. 职责边界

`viewerAdapter` 负责：

- 绑定和解绑 viewer 实例
- 封装底层暴露方法
- 统一处理空实例、防御性调用、返回值归一化
- 向上抛出统一事件
- 提供少量状态查询能力

`viewerAdapter` 不负责：

- 保存业务状态
- 直接修改 Pinia store
- 组织复杂业务流程
- 持有 three.js 对象作为公共状态

## 4. 适配层位置建议

建议文件位置：

```text
src/3d/runtime/adapter/viewerAdapter.js
```

建议配套：

```text
src/3d/runtime/events/runtimeEventBus.js
src/views/visualization/viewer3d/composables/useViewerRuntime.js
```

## 5. 对外接口设计

## 5.1 生命周期接口

### `bindViewer(instance)`

用途：

- 绑定 `ThreeModelViewer` 组件实例

输入：

- `instance`: viewer 组件暴露对象

输出：

- 无

### `unbindViewer()`

用途：

- 清理当前 viewer 引用

输出：

- 无

### `isReady()`

用途：

- 判断 viewer 是否已绑定

输出：

- `boolean`

## 5.2 模型与视图接口

### `loadModel()`

用途：

- 请求 viewer 重新加载当前模型

返回：

- `boolean`

### `resetView()`

### `zoomIn()`

### `zoomOut()`

### `setQuality(quality)`

参数：

- `quality`: `low | medium | high`

### `toggleProjection()`

返回：

- `boolean | null`

说明：

- 返回值可表示当前是否为正交投影

### `setPresetView(preset)`

参数：

- `preset`: `iso | top | front | left | right | back`

## 5.3 选择与聚焦接口

### `selectObjectByUUID(uuid)`

### `clearSelection()`

### `getSelectedObject()`

### `highlightObjectByUUID(uuid)`

### `focusObjectByUUID(uuid)`

### `focusObjectsByUUIDs(uuids)`

### `getSceneTree()`

说明：

- `getSceneTree()` 返回当前模型结构树
- service 层可基于该树建立结构导航

## 5.4 可见性与隔离接口

### `isolateObjectByUUID(uuid)`

### `showOnlyUUIDs(uuids)`

### `filterVisibleUUIDs(uuidsOrNull)`

说明：

- `null` 表示恢复全部显示

### `clearIsolation()`

### `setMeshOpacityByUUID(uuid, opacity)`

参数：

- `opacity`: `0 ~ 1`

## 5.5 工具与交互接口

### `toggleFirstPerson(force)`

参数：

- `force`: `true | false | undefined`

### `getFirstPersonState()`

输出：

- `boolean`

### `setClippingEnabled(axis, enabled)`

参数：

- `axis`: `x | y | z`
- `enabled`: `boolean`

### `setClippingRange(axis, range)`

参数：

- `axis`: `x | y | z`
- `range`: `[number, number]`

### `getClippingState()`

输出：

- 统一剖切状态对象

### `clearMeasurements()`

### `getMeasurements()`

## 5.6 媒体与标记接口

### `setLinkedPoints(points)`

### `clearLinkedPoints()`

### `setLinkedPointsVisible(visible)`

说明：

- 当前阶段可先复用现有测点接口
- 后续点位系统上线后，可扩展更通用接口

### 预留接口

以下接口建议先在文档层保留，不要求阶段一落地实现：

- `setAnchors(anchors)`
- `setCameraAnchors(cameraAnchors)`
- `updateAnchorState(anchorId, runtimeState)`
- `openCameraOverlay(payload)`
- `closeCameraOverlay()`

## 5.7 截图与书签接口

### `captureScreenshot(options)`

### `downloadScreenshot(filename, options)`

### `addBookmark(name)`

### `getBookmarks()`

### `applyBookmark(bookmark)`

## 5.8 状态查询接口

### `getModelStats()`

### `getObjectWorldPositionByUUID(uuid)`

### `getViewerCapabilities()`

建议返回：

```js
{
  clippingRange: true,
  firstPerson: true,
  measurements: ["distance"],
  bookmarks: true,
  anchors: false,
  cameraOverlay: false
}
```

用于帮助 service 判断当前阶段支持能力。

## 6. 统一返回约定

建议 `viewerAdapter` 统一返回规则如下：

- 成功布尔能力返回 `true/false`
- 查询类接口返回对象或 `null`
- 不抛出面向页面的底层异常，内部消化后通过事件或日志上报

不建议：

- 让页面直接依赖底层 `undefined`
- 不做空实例保护

## 7. 事件转发设计

建议 `viewerAdapter` 将底层 viewer 事件统一转发到运行时事件总线。

## 7.1 输入事件来源

当前 `ThreeModelViewer` 已具备事件：

- `loaded`
- `error`
- `progress`
- `object-select`
- `scene-click`

## 7.2 输出事件建议

统一转发为：

- `viewer.loaded`
- `viewer.error`
- `viewer.progress`
- `viewer.objectSelected`
- `viewer.sceneClicked`

### `viewer.loaded`

建议负载：

```js
{
  url,
  type,
  stats
}
```

### `viewer.objectSelected`

建议负载：

```js
{
  object: selectedObjectInfo
}
```

### `viewer.error`

建议负载：

```js
{
  message,
  raw
}
```

## 8. 与 useViewerRuntime 的协作

建议 `useViewerRuntime` 负责：

- 创建 adapter 实例
- 在 `ref` 可用时执行 `bindViewer`
- 将组件事件接入 adapter 或事件总线
- 在页面销毁时执行 `unbindViewer`

建议 `viewerAdapter` 保持纯适配，不感知 Vue 生命周期。

## 9. 与 service 的协作边界

`viewerAdapter` 只做命令转发。

示例：

- `selectionService.locateDevice(device)` 内部调用：
  - `selectObjectByUUID`
  - `highlightObjectByUUID`
  - `focusObjectByUUID`

- `visibilityService.applyDisplayMode(mode)` 内部调用：
  - `showOnlyUUIDs`
  - `filterVisibleUUIDs`
  - `clearIsolation`

不建议：

- 在 adapter 中直接实现 `locateDevice`
- 在 adapter 中直接处理业务设备或 KKS 逻辑

## 10. 实现建议

建议 `viewerAdapter` 为无状态对象或轻状态类。

可选实现形式：

### 方案 A：工厂函数

```js
export function createViewerAdapter() {}
```

优点：

- 轻量
- 与组合式 API 更自然

### 方案 B：类

```js
export class ViewerAdapter {}
```

优点：

- 接口边界清晰
- 适合后续能力持续增长

当前项目更建议方案 A，简单直接。

## 11. 阶段一最低落地范围

阶段一至少实现以下接口：

- `bindViewer`
- `unbindViewer`
- `isReady`
- `loadModel`
- `resetView`
- `zoomIn`
- `zoomOut`
- `setQuality`
- `toggleProjection`
- `setPresetView`
- `selectObjectByUUID`
- `clearSelection`
- `getSelectedObject`
- `highlightObjectByUUID`
- `focusObjectByUUID`
- `focusObjectsByUUIDs`
- `getSceneTree`
- `isolateObjectByUUID`
- `showOnlyUUIDs`
- `filterVisibleUUIDs`
- `clearIsolation`
- `setMeshOpacityByUUID`
- `toggleFirstPerson`
- `getFirstPersonState`
- `setClippingEnabled`
- `setClippingRange`
- `getClippingState`
- `clearMeasurements`
- `getMeasurements`
- `setLinkedPoints`
- `clearLinkedPoints`
- `setLinkedPointsVisible`
- `captureScreenshot`
- `downloadScreenshot`
- `addBookmark`
- `getBookmarks`
- `applyBookmark`

## 12. 验收标准

满足以下条件可视为适配层设计落地有效：

- 页面和 service 不再直接依赖 `viewerRef.value?.xxx`
- viewer 方法名变化时只需修改 adapter
- viewer 事件转发路径清晰
- 空实例状态下不会导致页面报错

## 13. 下一步建议

本设计确认后，建议继续：

1. 输出运行时 service 设计文档
2. 输出 `useViewerRuntime` 设计文档
3. 开始阶段一代码拆分实施
