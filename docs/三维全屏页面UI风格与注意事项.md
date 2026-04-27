# 三维全屏页面 UI 风格与注意事项

更新时间：2026-04-25

适用范围：`/visualization/3d-fullscreen` 三维全屏工作台，以及该页面下的顶部栏、底部工具栏、右侧功能面板、性能面板、模块内容区。

## 一、设计定位

当前页面是三维 BIM 操作工作台，不是普通后台表单页。UI 的核心目标是让模型画布保持主导，工具和属性面板作为辅助信息层存在。

设计关键词：

- 轻量工作台：主画布优先，所有控件减少厚重边框和大面积填充。
- 白色检查器：右侧模块内容采用白底、轻边框、紧凑行距，接近设计稿中的属性检查器风格。
- 蓝色单一强调：交互主色固定为亮蓝，避免多色抢占模型视图注意力。
- 信息密度可读：模块内容可以密集，但必须保持标题、标签、数值、操作按钮的层级清晰。
- 可视区域约束：所有模块内容不得横向撑出右侧面板，不允许出现不可控横向滚动。

## 二、页面骨架

当前全屏页由四类固定层组成：

| 区域 | 责任 | 主要文件 |
| --- | --- | --- |
| 顶部栏 | 返回、项目名称、模型模式、在线状态、保存、画质与面板入口 | `src/views/visualization/viewer3d/toolbars/ViewerTopbar.vue` |
| 主画布 | Three.js 模型渲染、场景交互、画布快捷工具 | `src/views/visualization/viewer3d/components/fullscreen/Viewer3DWorkspace.vue` |
| 右侧面板 | 场景、结构、导航、设备、点位、摄像头、测量、资产、联动模块 | `src/views/visualization/viewer3d/components/fullscreen/Viewer2DWorkspace.vue` |
| 底部工具栏 | 移动、旋转、缩放、测量、视图、显示、透明、剖切、2D/3D 等操作 | `src/views/visualization/viewer3d/toolbars/ViewerBottomToolbar.vue` |

全屏容器核心变量在 `fullscreen.vue` 中维护：

```css
--dd-gap: 16px;
--dd-topbar-height: 52px;
--dd-panels-top: 68px;
--dd-bottom-reserve: 92px;
--dd-panel-width: 430px;
```

后续新增悬浮面板或工具条时，应优先复用这些变量，避免硬编码造成遮挡。

## 三、视觉规范

### 颜色

| 用途 | 推荐值 | 说明 |
| --- | --- | --- |
| 主强调色 | `#0b73ff` | 选中态、主按钮、活动模块 |
| 主文本 | `#172033` | 标题、关键数值 |
| 次级文本 | `#415169` / `#42526b` | 普通标签、按钮文本 |
| 弱文本 | `#718096` / `#94a3b8` | 说明、空状态、辅助信息 |
| 边框 | `#d9e2ee` / `#e5edf7` | 输入框、卡片、模块分隔 |
| 浅蓝背景 | `#f2f7ff` / `#edf5ff` | hover、选中态、轻提示 |
| 危险操作 | `#f05252` | 删除、危险按钮 |

注意事项：

- 不要引入新的高饱和强调色，除非是状态语义必须区分。
- 成功、警告、危险只用于明确状态，不用于装饰。
- 模型画布已有蓝色模型主体，面板中蓝色应克制使用，避免视觉竞争。

### 表面与阴影

顶部栏、右侧面板、底部工具栏使用半透明白色、轻阴影和背景模糊：

```css
background: rgb(255 255 255 / 84%);
border: 1px solid rgb(226 232 240 / 82%);
box-shadow: 0 20px 55px rgb(15 23 42 / 12%);
backdrop-filter: blur(18px) saturate(150%);
```

模块内部不要再叠加厚卡片。能用普通段落、列表、表格表达的内容，不要再包一层 `el-card`。

## 四、右侧面板规范

右侧面板采用“内容区 + 独立竖向功能栏”的结构：

- 内容区宽度由 `--dd-panel-width` 控制。
- 功能栏宽度约 `62px`，图标在上，文字在下。
- 当前模块使用浅蓝背景和蓝色文字。
- 内容区滚动只允许纵向滚动，不应出现横向滚动。

模块内容应遵循以下结构：

```vue
<section class="模块名-section">
  <header class="模块名-section__head">
    <h3>模块标题</h3>
    <button>操作</button>
  </header>
  <!-- 内容 -->
</section>
```

开发注意事项：

- 根节点必须设置 `min-width: 0`，列表项、文本容器也要设置 `min-width: 0`。
- 长 ID、URL、项目作用域、模型路径必须支持 `overflow-wrap: anywhere` 或 `word-break: break-word`。
- 不能让按钮组和标题强制在一行展示，窄宽度下必须允许换行。
- 面板内不建议使用 `width: max-content`、固定大宽度、不可收缩 flex 子项。

## 五、模块内容风格

### 场景模块

场景模块是进入右侧面板后的默认概览页，展示当前模型、统计、设置、视图状态和运行状态。

要求：

- 统计项使用两列或紧凑网格。
- 设置项使用 label + value 行，不使用复杂表单。
- 材质主题、画质档位等枚举值必须展示中文标签。

### 结构模块

结构模块参考设计稿中的“模型结构”样式：

- 顶部为标题 + 刷新。
- 搜索框和类型选择框为 32px 左右的紧凑输入。
- 树节点简洁显示，不叠加厚卡片。
- 当前节点、hover 节点使用浅蓝底。

### 设备、点位、摄像头、测量、导航、联动

这些模块统一为检查器风格：

- 模块标题在顶部，右侧放新增、刷新、清空等轻操作。
- 列表行采用轻边框、浅白背景、圆角。
- 选中态只改变边框和浅蓝背景，不使用大面积深色。
- 空状态使用 Element Plus `el-empty`，描述文案要说明当前缺什么。

### 资产模块

资产模块已按当前规范重构，应保持单列信息流：

- `场景模型`
- `发布包信息`
- `质量与材质`
- `LOD 选择`
- `资源分组`

注意事项：

- 不展示 `4D/5D 扩展位`，本轮也不预留前端扩展位。
- 材质主题必须展示中文：`基础纹理`、`线框`、`实体`、`渲染`。
- 质量与材质选择使用可换行按钮网格，不使用会横向溢出的长分段控件。
- 模型名称单行省略，模型 URL、作用域、长 ID 允许断行。
- 删除、定位、设为主模型等按钮必须允许换行，不能挤压文本列。

## 六、顶部栏规范

顶部栏左侧顺序固定：

1. 返回
2. 分隔线
3. 项目名称
4. 下拉箭头
5. 模型模式
6. 在线状态

注意事项：

- 返回图标、返回文字、项目名称、模式标签必须视觉对齐。
- 不使用裸字符箭头，统一使用 Element Plus 图标。
- 项目名称过长时单行省略，不得撑开右侧操作区。
- 右侧按钮保持紧凑，优先隐藏低优先级文字，不影响保存按钮可见性。

## 七、底部工具栏规范

底部工具栏是横向操作坞，不是普通按钮堆叠区。

要求：

- 工具组之间使用轻分隔线。
- 当前工具使用浅蓝底和蓝色文本。
- 二级菜单和弹出项保持白底、轻边框、短标签。
- 窄屏时允许横向滚动，但工具栏不能遮挡右侧面板主要内容。

注意事项：

- 工具标签应短，例如 `移动`、`旋转`、`缩放`、`测量`。
- 材质主题、显示范围等枚举文案必须中文化。
- 选中数量、透明、剖切等状态信息不要占用过多宽度。

## 八、性能面板规范

性能面板用于运行状态提示，不再使用黑色调试盒样式。

要求：

- 使用白底轻卡片。
- 展示 FPS、MS、精度、TRI、CALL 等关键指标。
- 正常状态使用绿色，异常或低帧率再使用警告色。
- 面板不得遮挡顶部栏、右侧面板或底部工具栏。

## 九、文案规则

全屏页是中文业务系统，展示给用户的操作文案必须中文化。

必须中文展示的内容：

- 材质主题：`基础纹理`、`线框`、`实体`、`渲染`
- 画质档位：`高`、`中`、`低`、`平面渲染`
- 操作按钮：`刷新`、`添加模型`、`定位`、`删除`、`设为主模型`
- 空状态：明确说明当前缺少模型、点位、LOD、资源分组或导航热点

避免：

- 直接显示 `textured-basic`、`wireframe`、`original` 等内部值。
- 直接显示英文技术状态作为用户主文案。
- 用营销式文案替代操作说明。

## 十、响应式与溢出控制

必须遵守：

- 右侧面板内容区只允许纵向滚动。
- 任意模块不能超过右侧面板可视宽度。
- 长文本必须断行或省略。
- 按钮组必须可换行。
- `flex` 布局中的文本容器必须设置 `min-width: 0`。
- 表格、描述列表、分段控件必须在窄宽下收缩或换行。

推荐写法：

```css
.module-root {
  min-width: 0;
  overflow-x: hidden;
}

.text-cell {
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
```

不推荐：

```css
.bad-row {
  display: flex;
  white-space: nowrap;
}

.bad-cell {
  width: max-content;
}
```

## 十一、Element Plus 使用约束

当前页面允许使用 Element Plus，但不能让默认后台风格破坏全屏工作台体验。

要求：

- `el-card` 在右侧面板内默认弱化为透明、无阴影、无厚边框。
- `el-input`、`el-select` 统一紧凑高度和轻边框。
- `el-segmented` 只适合短标签；标签超过面板宽度时改用自定义按钮网格。
- `el-table`、`el-descriptions` 如果会造成横向溢出，应改成自定义 `dl` 或列表结构。
- `el-button` 主按钮只用于关键操作，普通操作使用轻按钮或文本按钮。

## 十二、开发检查清单

新增或修改右侧模块前，必须检查：

- 模块标题是否清晰，是否符合当前功能入口。
- 模块内容是否能在 `430px` 面板宽度内展示。
- 是否存在英文内部值直接暴露给用户。
- 是否存在横向滚动、文字竖排、按钮挤压文本。
- 是否误加了本轮不纳入范围的扩展位，如 `4D/5D`、`BIM+GIS`。
- 空状态是否说明当前缺失数据，而不是只显示“暂无数据”。
- 选中、hover、禁用、危险操作是否有清晰状态。
- 是否复用 `#0b73ff` 作为唯一主强调色。

## 十三、当前关键实现文件

| 文件 | 说明 |
| --- | --- |
| `src/views/visualization/viewer3d/fullscreen.vue` | 全屏页面外壳、全局尺寸变量、画布背景 |
| `src/views/visualization/viewer3d/toolbars/ViewerTopbar.vue` | 顶部栏 UI |
| `src/views/visualization/viewer3d/toolbars/ViewerBottomToolbar.vue` | 底部工具栏 UI |
| `src/views/visualization/viewer3d/components/fullscreen/Viewer2DWorkspace.vue` | 右侧面板框架和通用检查器样式 |
| `src/views/visualization/viewer3d/components/fullscreen/Viewer3DWorkspace.vue` | 主画布与快捷工具 |
| `src/views/visualization/viewer3d/panels/SceneOverviewPanel.vue` | 场景概览模块 |
| `src/views/visualization/viewer3d/panels/StructurePanel.vue` | 模型结构模块 |
| `src/views/visualization/viewer3d/panels/AssetGroupPanel.vue` | 资产模块 |
| `src/views/visualization/viewer3d/services/viewerToolbarConfig.js` | 工具栏和材质主题等中文枚举 |
| `src/3d/utils/stats.js` | 性能面板样式 |

## 十四、边界说明

本轮 UI 风格只覆盖三维全屏工作台，不要求同步改造其他后台页面。普通管理页可以继续使用现有后台布局，但进入三维全屏页后，应遵守本文件的工作台式 UI 规范。

