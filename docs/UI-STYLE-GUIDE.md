# VFD 大屏编辑器 UI 风格规范

本文档整理了 VFD 大屏编辑器项目的 UI 风格规范，包括颜色系统、主题配置、排版规范、动画效果、组件规范等。

## 目录

- [1. 颜色系统](#1-颜色系统)
  - [1.1 基础颜色](#11-基础颜色)
  - [1.2 语义颜色](#12-语义颜色)
  - [1.3 文字颜色](#13-文字颜色)
  - [1.4 背景颜色](#14-背景颜色)
- [2. 主题系统](#2-主题系统)
  - [2.1 深色主题](#21-深色主题)
  - [2.2 浅色主题](#22-浅色主题)
  - [2.3 主题切换](#23-主题切换)
- [3. 布局规范](#3-布局规范)
  - [3.1 尺寸常量](#31-尺寸常量)
  - [3.2 间距系统](#32-间距系统)
  - [3.3 边框与圆角](#33-边框与圆角)
- [4. 动画效果](#4-动画效果)
  - [4.1 过渡动画](#41-过渡动画)
  - [4.2 组件动画](#42-组件动画)
- [5. 图表主题](#5-图表主题)
  - [5.1 预设主题](#51-预设主题)
  - [5.2 全局图表配置](#52-全局图表配置)
- [6. 组件规范](#6-组件规范)
  - [6.1 组件分类](#61-组件分类)
  - [6.2 命名规范](#62-命名规范)
- [7. 中国传统色彩库](#7-中国传统色彩库)
- [8. 工具类](#8-工具类)

---

## 1. 颜色系统

### 1.1 基础颜色

项目中定义了一套基础颜色变量，用于保持视觉一致性。

```scss
// 状态颜色
$--color-red: #fc625d;      // 错误/危险
$--color-warn: #fcbc40;     // 警告
$--color-success: #34c749;  // 成功
```

### 1.2 语义颜色

默认主题色：`#51d6a9` (碧空绿)

推荐主题色：

| 颜色名称 | HEX 值 | 预览 | CMYK | RGB |
|---------|--------|------|------|-----|
| 碧空绿 | `#51d6a9` | 🟢 | [62, 0, 21, 16] | [81, 214, 169] |
| 涧石蓝 | `#66a9c9` | 🔵 | [73, 17, 20, 1] | [102, 169, 201] |
| 茉莉黄 | `#f8df72` | 🟡 | [4, 13, 67, 0] | [248, 223, 114] |
| 深海蓝 | `#3c7eff` | 🔷 | [76, 51, 0, 0] | [60, 126, 255] |

### 1.3 文字颜色

```scss
// 文字颜色层级
$--color-text: #1d2129;    // 主文字颜色
$--color-text-1: #4e5969;  // 次要文字
$--color-text-2: #86909c;  // 辅助文字
$--color-text-3: #c9cdd4;  // 禁用文字
$--color-text-4: #f2f3f5;  // 深色背景上的文字
```

### 1.4 背景颜色

#### 浅色背景

```scss
$--color-light-bg: #fff;       // 纯白
$--color-light-bg-1: #fafafc;  // 一级背景
$--color-light-bg-2: #f2f3f5;  // 二级背景
$--color-light-bg-3: #e5e6eb;  // 三级背景
$--color-light-bg-4: #e3e3e4;  // 四级背景
$--color-light-bg-5: #bebebe;  // 五级背景
```

#### 深色背景

```scss
$--color-dark-black: #000;     // 纯黑
$--color-dark-bg-1: #18181c;   // 一级背景
$--color-dark-bg-2: #232324;   // 二级背景
$--color-dark-bg-3: #2a2a2b;   // 三级背景
$--color-dark-bg-4: #313132;   // 四级背景
$--color-dark-bg-5: #373739;   // 五级背景
```

---

## 2. 主题系统

项目支持深色和浅色两种主题，通过 CSS 变量和 SCSS mixin 实现主题切换。

### 2.1 深色主题 (Dark)

深色主题是默认主题，适用于大屏展示场景。

```scss
$dark: (
  // 文字颜色
  color: $--color-text-4,

  // 背景颜色
  background-color: $--color-dark-bg-1,
  background-color1: $--color-dark-bg-1,
  background-color2: $--color-dark-bg-2,
  background-color3: $--color-dark-bg-3,
  background-color4: $--color-dark-bg-4,
  background-color5: $--color-dark-bg-5,

  // 毛玻璃背景
  filter-color: rgba(35, 35, 36, 0.7),
  filter-color-shallow: rgba(35, 35, 36, 0.3),

  // hover 边框颜色
  hover-border-color: $--color-dark-bg-5,
  hover-border-color-shallow: $--color-dark-bg-3,

  // 阴影
  box-shadow: 0 8px 10px #1e1e1e1f
);
```

### 2.2 浅色主题 (Light)

```scss
$light: (
  // 文字颜色
  color: $--color-text,

  // 背景颜色
  background-color: $--color-light-bg-3,
  background-color1: $--color-light-bg-1,
  background-color2: $--color-light-bg-2,
  background-color3: $--color-light-bg-3,
  background-color4: $--color-light-bg-4,
  background-color5: $--color-light-bg-5,

  // 毛玻璃背景
  filter-color: rgba(240, 240, 240, 0.7),
  filter-color-shallow: rgba(240, 240, 240, 0.3),

  // hover 边框颜色
  hover-border-color: $--color-light-bg-4,
  hover-border-color-shallow: $--color-light-bg-3,

  // 阴影
  box-shadow: 0 8px 10px #00000012
);
```

### 2.3 主题切换

主题通过 `data-theme` 属性控制：

```typescript
// 主题枚举
export enum ThemeEnum {
  DARK = 'dark',
  LIGHT = 'light'
}
```

在 SCSS 中使用主题：

```scss
// 使用 themeify mixin 应用主题样式
@mixin themeify {
  @each $theme-name, $theme-map in $themes {
    $theme-map: $theme-map !global;
    [data-theme='#{$theme-name}'] & {
      @content;
    }
  }
}

// 获取主题变量
@function themed($key) {
  @return map-get($theme-map, $key);
}

// 使用示例
.my-component {
  @include fetch-bg-color("background-color1");
  @include fetch-theme("color");
}
```

---

## 3. 布局规范

### 3.1 尺寸常量

```typescript
// 图表初始配置(px)
export const chartInitConfig = {
  x: 50,        // 初始 X 坐标
  y: 50,        // 初始 Y 坐标
  w: 500,       // 默认宽度
  h: 300,       // 默认高度
  offsetX: 0,   // X 偏移
  offsetY: 0,   // Y 偏移
}

// 侧边栏宽度
export const asideWidth = '270'

// 侧边栏折叠后的宽度
export const asideCollapsedWidth = 60

// 弹窗图标大小
export const dialogIconSize = '20'

// 全局边框圆角
export const borderRadius = '4px'
```

```scss
// SCSS 布局变量
$--max-width: 1920px;       // 最大宽度
$--header-height: 60px;     // 顶部高度
$--footer-height: 50px;     // 底部高度
$--border-radius-base: 8px; // 边框圆角
```

### 3.2 间距系统

项目采用基于 `em` 的间距系统，提供一致的间距规范。

```scss
$spacing-base-size: 1em;

// 间距类型
$spacing-types: (
  m: margin,   // 外边距
  p: padding,  // 内边距
);

// 方向
$spacing-directions: (
  t: top,      // 上
  r: right,    // 右
  b: bottom,   // 下
  l: left,     // 左
);

// 尺寸级别
$spacing-sizes: (
  0: 0,
  1: 0.25,    // 小间距
  2: 0.5,     // 中小间距
  3: 1,       // 标准间距
  4: 1.5,     // 中大间距
  5: 2.5,     // 大间距
);
```

**使用方式：**

```html
<!-- 全方向 margin: 0.25em -->
<div class="go-m-1">...</div>

<!-- margin-top: 0.5em -->
<div class="go-mt-2">...</div>

<!-- 水平 padding: 1em -->
<div class="go-px-3">...</div>

<!-- 垂直 margin: 1.5em -->
<div class="go-my-4">...</div>
```

### 3.3 边框与圆角

```scss
// 边框圆角
$--border-radius-base: 8px;

// 阴影
$--border-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);

// 毛玻璃效果
$--filter-blur-base: blur(20px);
```

---

## 4. 动画效果

### 4.1 过渡动画

```scss
// 标准过渡
.go-transition {
  transition: all 0.4s;
}

// 快速过渡
.go-transition-quick {
  transition: all 0.2s;
}
```

### 4.2 组件动画

项目内置了丰富的动画效果，基于 `animate.css`：

#### 强调动画

| 动画名称 | CSS 类名 | 描述 |
|---------|---------|------|
| 弹跳 | `bounce` | 弹跳效果 |
| 闪烁 | `flash` | 闪烁效果 |
| 放大缩小 | `pulse` | 脉冲缩放 |
| 放大缩小弹簧 | `rubberBand` | 弹性缩放 |
| 左右晃动 | `headShake` | 头部晃动 |
| 左右扇形摇摆 | `swing` | 摇摆效果 |
| 放大晃动缩小 | `tada` | tada 效果 |
| 扇形摇摆 | `wobble` | 摇晃效果 |
| 左右上下晃动 | `jello` | 果冻效果 |

#### 移入动画

| 动画名称 | CSS 类名 | 描述 |
|---------|---------|------|
| 渐显 | `fadeIn` | 淡入 |
| 向右进入 | `fadeInLeft` | 从左淡入 |
| 向左进入 | `fadeInRight` | 从右淡入 |
| 向上进入 | `fadeInUp` | 从下淡入 |
| 向下进入 | `fadeInDown` | 从上淡入 |
| 旋转进入 | `rotateIn` | 旋转进入 |
| 弹入 | `bounceIn` | 弹跳进入 |
| 光速进入 | `lightSpeedInRight` | 光速效果 |
| Y轴旋转 | `flip` | 翻转效果 |
| 由小变大进入 | `zoomIn` | 缩放进入 |
| 滑动展开 | `slideInLeft` | 滑动进入 |

#### 内置 CSS 动画

```scss
// 闪烁动画
.go-animation-twinkle {
  animation: twinkle 2s ease infinite;
}

@keyframes twinkle {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

// Vue 过渡动画
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

// 列表动画
.list-complete-item {
  transition: all 1s;
}
.list-complete-enter-from,
.list-complete-leave-to {
  opacity: 0;
  transform: translateY(30px);
}
```

---

## 5. 图表主题

### 5.1 预设主题

项目内置了 12 种 ECharts 图表主题：

| 主题名称 | 主色调 | 描述 |
|---------|--------|------|
| `dark` | 蓝绿 | 深色主题 (默认) |
| `customed` | 蓝绿 | 自定义主题 |
| `macarons` | 青紫 | 马卡龙配色 |
| `walden` | 蓝绿 | 瓦尔登湖 |
| `purplePassion` | 紫粉 | 紫色激情 |
| `vintage` | 红绿 | 复古风格 |
| `chalk` | 粉绿 | 粉笔配色 |
| `westeros` | 蓝粉 | 维斯特洛 |
| `wonderland` | 绿青 | 仙境配色 |
| `essos` | 红橙 | 厄索斯 |
| `shine` | 红蓝 | 闪耀配色 |
| `roma` | 红紫 | 罗马配色 |

#### 主题颜色预览

```typescript
// 主题渐变色配置 [主色1, 主色2, 阴影, 渐变1, 渐变2]
export const chartColorsSearch = {
  dark: ['#4992ff', '#7cffb2', 'rgba(68, 181, 226, 0.3)', 'rgba(73, 146, 255, 0.5)', 'rgba(124, 255, 178, 0.5)'],
  customed: ['#5470c6', '#91cc75', 'rgba(84, 112, 198, 0.5)', 'rgba(84, 112, 198, 0.5)', 'rgba(145, 204, 117, 0.5)'],
  macarons: ['#2ec7c9', '#b6a2de', 'rgba(182, 162, 222, 0.3)', 'rgba(46, 199, 201, 0.5)', 'rgba(182, 162, 222, 0.5)'],
  // ... 更多主题
}
```

### 5.2 全局图表配置

图表的全局样式配置：

```json
{
  "title": {
    "show": true,
    "textStyle": {
      "color": "#BFBFBF",
      "fontSize": 18
    },
    "subtextStyle": {
      "color": "#A2A2A2",
      "fontSize": 14
    }
  },
  "xAxis": {
    "nameTextStyle": {
      "color": "#B9B8CE",
      "fontSize": 12
    },
    "axisLabel": {
      "fontSize": 12,
      "color": "#B9B8CE"
    },
    "axisLine": {
      "lineStyle": {
        "color": "#B9B8CE",
        "width": 1
      }
    },
    "splitLine": {
      "lineStyle": {
        "color": "#484753",
        "width": 1,
        "type": "solid"
      }
    }
  },
  "legend": {
    "type": "scroll",
    "textStyle": {
      "color": "#B9B8CE",
      "fontSize": 18
    },
    "itemHeight": 15,
    "itemWidth": 15
  },
  "grid": {
    "left": "10%",
    "top": "60",
    "right": "10%",
    "bottom": "60"
  }
}
```

---

## 6. 组件规范

### 6.1 组件分类

| 分类 | 枚举值 | 描述 |
|------|--------|------|
| 图表 | `Charts` | 柱状图、折线图、饼图、散点图、地图等 |
| 信息 | `Informations` | 文本、数字、时间等信息展示 |
| 表格 | `Tables` | 数据表格组件 |
| 装饰 | `Decorates` | 边框、背景装饰 |
| 图标 | `Icons` | 图标库 |
| WebGL | `Webgl` | 3D 组件 |
| 基础 | `Basics` | 布局组件 |
| 交互 | `WebInteraction` | 按钮、输入框等交互组件 |
| 自定义 | `CustomComponents` | 自定义组件 |
| 视频流 | `VideoStreams` | 视频播放组件 |

### 6.2 命名规范

#### 组件命名空间

```scss
$namespace: 'go';      // 全局命名空间前缀
$state-prefix: 'is-';  // 状态前缀
```

#### CSS 类名规范

```scss
// 使用 go mixin 创建命名空间组件
@mixin go($block) {
  $B: $namespace + '-' + $block;
  .#{$B} {
    @content;
  }
}

// 使用示例
@include go('chart') {
  // 生成 .go-chart { ... }
}

// 状态类
@mixin when($state) {
  @at-root {
    &.#{$state-prefix + $state} {
      @content;
    }
  }
}

// 使用示例
.go-button {
  @include when('disabled') {
    // 生成 .go-button.is-disabled { ... }
  }
}
```

---

## 7. 中国传统色彩库

项目内置了完整的中国传统色彩库（约 500+ 颜色），可用于设计配色参考。

示例颜色：

| 颜色名称 | HEX | 拼音 |
|---------|-----|------|
| 乳白 | `#f9f4dc` | rubai |
| 杏仁黄 | `#f7e8aa` | xingrenhuang |
| 茉莉黄 | `#f8df72` | molihuang |
| 油菜花黄 | `#fbda41` | youcaihuahuang |
| 柠檬黄 | `#fcd337` | ningmenghuang |
| 藤黄 | `#ffd111` | tenghuang |

完整颜色库位于：`src/settings/designColor.json`

---

## 8. 工具类

### 布局工具类

```scss
// Flexbox 居中
.go-flex-center {
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
}

// Flex 垂直居中
.go-flex-items-center {
  display: flex;
  align-items: center;
  text-align: center;
}

// 不换行
.go-flex-no-wrap {
  flex-wrap: nowrap !important;
}

// 绝对定位居中
.go-absolute-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
```

### 交互工具类

```scss
// 鼠标指针
.go-cursor-pointer {
  cursor: pointer;
}

// IE 盒模型
.go-boderbox {
  box-sizing: border-box;
}
```

### 视觉效果工具类

```scss
// 毛玻璃效果
.go-background-filter {
  backdrop-filter: blur(20px);
  @include fetch-bg-color("filter-color");
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

// 浅色毛玻璃
.go-background-filter-shallow {
  backdrop-filter: blur(20px);
  @include fetch-bg-color("filter-color-shallow");
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

// 边框圆角
.go-border-radius {
  border-radius: 8px;
  overflow: hidden;
}

// 斑点背景
.go-point-bg {
  @include fetch-theme-custom("background-color", "background-color1");
  background-size: 15px 15px, 15px 15px;
}
```

### 文本工具类

```scss
// 单行省略
.go-ellipsis-1 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: break-all;
}
```

### 显示工具类

```scss
.go-d-inline-block {
  display: inline-block;
}

.go-d-block {
  display: block;
}
```

### 滚动条样式

```scss
/* 设置滚动条的样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

/* 滚动槽 */
::-webkit-scrollbar-track {
  -webkit-box-shadow: inset 0 0 6px rgba(0, 0, 0, 0);
  border-radius: 2px;
}

/* 滚动条滑块 */
::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: #a3a3a3;
}
```

---

## 附录

### 设计配置常量

```typescript
// 水印文字
export const watermarkText = "VfView 低代码平台"

// 分组默认名称
export const groupTitle = "分组"

// 弹窗是否可以通过点击遮罩关闭
export const maskClosable = false

// 轮播间隔 (ms)
export const carouselInterval = 4000

// 背景图片大小限制 (5M)
export const backgroundImageSize = 5

// 编辑工作台同步到 JSON 的轮询间隔 (5S)
export const editToJsonInterval = 5000

// 数据请求间隔 (秒)
export const requestInterval = 30

// 工作区域历史记录存储最大数量
export const editHistoryMax = 100

// 拖拽时蒙层的 z-index
export const canvasModelIndex = 9999

// 框选时蒙层的 z-index
export const selectBoxIndex = canvasModelIndex + 10
```

### 用户设置配置

```typescript
export const systemSetting = {
  // 侧边栏折叠是否隐藏全部
  ASIDE_ALL_COLLAPSED: true,

  // 拖拽页面左侧表单分类只有一项时是否隐藏
  HIDE_PACKAGE_ONE_CATEGORY: true,

  // 切换语言是否进行路由刷新
  CHANGE_LANG_RELOAD: false,

  // 图表移动时按方向键移动的距离 (px)
  CHART_MOVE_DISTANCE: 5,

  // 图表拖拽时的吸附距离 (px)
  CHART_ALIGN_RANGE: 10,
}
```

### 预览展示方式

```typescript
export enum PreviewScaleEnum {
  FIT = 'fit',        // 自适应
  SCROLL_Y = 'scrollY', // Y轴滚动
  SCROLL_X = 'scrollX', // X轴滚动
  FULL = 'full'       // 全屏
}
```

---

## 更新日志

- **2026-01-21**: 初始版本，整理了项目 UI 风格规范
