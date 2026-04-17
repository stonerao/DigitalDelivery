# VFD 组件开发规范

本文档介绍 VFD 大屏编辑器中组件的开发规范，包括组件结构、命名规范、样式规范等。

## 目录

- [1. 组件分类体系](#1-组件分类体系)
- [2. 组件目录结构](#2-组件目录结构)
- [3. 组件配置规范](#3-组件配置规范)
- [4. 命名规范](#4-命名规范)
- [5. 样式规范](#5-样式规范)
- [6. 数据框架规范](#6-数据框架规范)
- [7. 视觉通道规范](#7-视觉通道规范)

---

## 1. 组件分类体系

### 组件分类枚举

```typescript
export enum PackagesCategoryEnum {
  CHARTS = 'Charts',             // 图表组件
  INFORMATIONS = 'Informations', // 信息展示
  TABLES = 'Tables',             // 表格组件
  DECORATES = 'Decorates',       // 装饰组件
  ICONS = 'Icons',               // 图标组件
  WEBGL = 'Webgl',               // 3D 组件
  BASICS = 'Basics',             // 基础布局
  WEB_INTERACTION = 'WebInteraction', // 交互组件
  CUSTOM_COMPONENTS = 'CustomComponents', // 自定义组件
  VIDEO_STREAMS = 'VideoStreams', // 视频流组件
}
```

### 图表子分类

| 分类 | 路径 | 包含组件 |
|------|------|----------|
| Bars | `Charts/Bars/` | 柱状图、条形图 |
| Lines | `Charts/Lines/` | 折线图、面积图 |
| Pies | `Charts/Pies/` | 饼图、环形图 |
| Scatters | `Charts/Scatters/` | 散点图 |
| Maps | `Charts/Maps/` | 地图组件 |
| Mores | `Charts/Mores/` | 其他图表 |

---

## 2. 组件目录结构

每个组件应遵循以下目录结构：

```
packages/components/
└── [Category]/           # 组件分类
    └── [ComponentName]/  # 组件名称
        ├── config.ts     # 组件配置类
        ├── config.vue    # 配置面板组件
        ├── index.vue     # 展示组件
        └── index.d.ts    # 类型定义（可选）
```

### 示例结构

```
packages/components/
└── Charts/
    └── Bars/
        └── BarCommon/
            ├── config.ts
            ├── config.vue
            ├── index.vue
            └── index.d.ts
```

---

## 3. 组件配置规范

### 配置类型定义

```typescript
export type ConfigType = {
  // 组件唯一标识
  key: string

  // 画布组件 key
  chartKey: string

  // 配置面板组件 key
  conKey: string

  // 组件标题
  title: string

  // 组件分类
  category: string

  // 分类名称（显示用）
  categoryName: string

  // 所属包
  package: PackagesCategoryEnum

  // 数据框架类型
  chartFrame?: ChartFrameEnum

  // 预览图路径
  image: string

  // 重定向组件路径（可选）
  redirectComponent?: string

  // 预设数据集（可选）
  dataset?: any

  // 是否禁用拖拽生成
  disabled?: boolean

  // 图标（可选）
  icon?: string

  // 事件配置
  configEvents?: { [T: string]: Function }

  // 视觉通道配置
  visualChannels?: VisualChannel[]
}
```

### 配置类示例

```typescript
// config.ts
import { PublicConfigClass } from '@/packages/public'
import { ChartFrameEnum, ConfigType } from '@/packages/index.d'
import { BarCommonConfig } from './index'

export const option = {
  // ECharts 配置项
  xAxis: { /* ... */ },
  yAxis: { /* ... */ },
  series: [{ /* ... */ }]
}

export default class Config extends PublicConfigClass implements ConfigType {
  key = 'BarCommon'
  chartKey = 'VBarCommon'
  conKey = 'VCBarCommon'
  title = '柱状图'
  category = 'Bars'
  categoryName = '柱状图'
  package = 'Charts'
  chartFrame = ChartFrameEnum.ECHARTS
  image = 'bar_common.png'

  option = option
}
```

---

## 4. 命名规范

### 组件命名

| 类型 | 前缀 | 示例 |
|------|------|------|
| 展示组件 | `V` | `VBarCommon` |
| 配置组件 | `VC` | `VCBarCommon` |
| 配置类 | 无 | `BarCommonConfig` |

### CSS 命名空间

```scss
// 全局命名空间
$namespace: 'go';

// 状态前缀
$state-prefix: 'is-';

// 主题标识
$theme-light: 'light';
$theme-dark: 'dark';
```

### CSS 类名规范

使用 BEM 变体命名规范：

```scss
// 块（Block）
.go-chart { }

// 元素（Element）
.go-chart__header { }
.go-chart__body { }

// 修饰符（Modifier）
.go-chart--large { }
.go-chart--disabled { }

// 状态
.go-chart.is-active { }
.go-chart.is-loading { }
```

### 使用 Mixin 生成类名

```scss
@include go('chart') {
  // 生成 .go-chart
  width: 100%;

  &__header {
    // 生成 .go-chart__header
    padding: 10px;
  }

  @include when('active') {
    // 生成 .go-chart.is-active
    border-color: var(--primary-color);
  }
}
```

---

## 5. 样式规范

### 主题适配

组件样式需要同时支持深色和浅色主题：

```scss
@import '@/styles/common/mixins/mixins.scss';

.my-component {
  // 使用主题 mixin
  @include fetch-theme('color');
  @include fetch-bg-color('background-color1');

  // 或使用自定义映射
  @include fetch-theme-custom('border-color', 'hover-border-color');
}
```

### 深色主题专用样式

```scss
@include dark {
  .my-component {
    // 仅在深色主题下生效
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  }
}
```

### 过渡动画

所有交互状态变化应添加过渡动画：

```scss
.my-component {
  // 标准过渡（0.4s）
  @extend .go-transition;

  // 或快速过渡（0.2s）
  @extend .go-transition-quick;

  // 或自定义
  transition: background-color 0.3s ease, transform 0.2s ease;
}
```

### 滚动条样式

组件内的滚动区域应使用统一的滚动条样式：

```scss
.scrollable-area {
  overflow: auto;

  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    border-radius: 2px;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 4px;
    background: #a3a3a3;
  }
}
```

---

## 6. 数据框架规范

### 框架类型

```typescript
export enum ChartFrameEnum {
  // ECharts 框架（支持 dataset）
  ECHARTS = 'echarts',

  // VChart 框架
  VCHART = 'VChart',

  // Naive UI 组件
  NAIVE_UI = 'naiveUI',

  // 自定义数据组件
  COMMON = 'common',

  // 静态组件（无数据变更）
  STATIC = 'static'
}
```

### ECharts 组件数据格式

```typescript
interface EchartsDataType {
  dimensions: string[]  // 维度名称
  source: any[]         // 数据源
}

// 示例
const dataset: EchartsDataType = {
  dimensions: ['product', 'value'],
  source: [
    { product: '产品A', value: 100 },
    { product: '产品B', value: 200 },
    { product: '产品C', value: 150 }
  ]
}
```

---

## 7. 视觉通道规范

视觉通道用于定义组件的数据映射配置。

### 视觉通道类型

```typescript
export interface VisualChannel {
  // 通道键名，对应 encode 的 key
  key: string

  // 显示名称
  name: string

  // 描述信息
  description?: string

  // 建议的字段类型
  type?: 'dimension' | 'metric' | 'any'

  // 是否必填
  required?: boolean

  // 是否支持多字段映射
  multiple?: boolean

  // 最大字段数量
  max?: number
}
```

### 常用视觉通道

| 通道 Key | 名称 | 类型 | 说明 |
|----------|------|------|------|
| `x` | X轴 | dimension | 类目轴 |
| `y` | Y轴 | metric | 数值轴 |
| `seriesName` | 系列名 | dimension | 分组字段 |
| `tooltip` | 提示框 | any | 悬浮提示 |
| `value` | 数值 | metric | 主要数值 |
| `name` | 名称 | dimension | 数据项名称 |

### 配置示例

```typescript
const visualChannels: VisualChannel[] = [
  {
    key: 'x',
    name: 'X轴（类目）',
    type: 'dimension',
    required: true
  },
  {
    key: 'y',
    name: 'Y轴（数值）',
    type: 'metric',
    required: true,
    multiple: true,
    max: 5
  },
  {
    key: 'seriesName',
    name: '分组',
    type: 'dimension',
    required: false
  }
]
```

---

## 附录

### 组件状态

```typescript
export interface StatusType {
  lock: boolean  // 是否锁定
  hide: boolean  // 是否隐藏
}
```

### 滤镜/变换配置

```typescript
export enum FilterEnum {
  // 是否启用滤镜
  FILTERS_SHOW = 'filterShow',

  // 滤镜效果
  OPACITY = 'opacity',       // 透明度
  SATURATE = 'saturate',     // 饱和度
  CONTRAST = 'contrast',     // 对比度
  HUE_ROTATE = 'hueRotate',  // 色相
  BRIGHTNESS = 'brightness', // 亮度

  // 变换效果
  ROTATE_Z = 'rotateZ',      // Z轴旋转
  ROTATE_X = 'rotateX',      // X轴旋转
  ROTATE_Y = 'rotateY',      // Y轴旋转
}
```

### 组件加载优化

项目使用组件缓存提升加载速度：

```typescript
// 组件缓存映射
const componentCacheMap = new Map<string, any>()

const loadConfig = (packageName: string, categoryName: string, keyName: string) => {
  const key = packageName + categoryName + keyName
  if (!componentCacheMap.has(key)) {
    componentCacheMap.set(key, import(`./components/${packageName}/${categoryName}/${keyName}/config.ts`))
  }
  return componentCacheMap.get(key)
}
```

---

## 最佳实践

1. **组件解耦**：展示组件和配置组件分离
2. **类型安全**：使用 TypeScript 定义完整的类型
3. **主题适配**：所有样式支持深色/浅色主题切换
4. **性能优化**：使用组件缓存和懒加载
5. **文档完善**：每个组件提供清晰的配置说明
6. **一致性**：遵循统一的命名和代码风格
