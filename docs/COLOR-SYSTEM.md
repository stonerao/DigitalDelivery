# VFD 颜色系统参考

本文档提供 VFD 项目中使用的完整颜色系统参考。

## 主题色

### 推荐主题色

默认主题色为 **碧空绿** `#51d6a9`

| 颜色名 | HEX | RGB | 色块 |
|--------|-----|-----|------|
| 碧空绿 | `#51d6a9` | rgb(81, 214, 169) | ![#51d6a9](https://via.placeholder.com/50/51d6a9/51d6a9) |
| 涧石蓝 | `#66a9c9` | rgb(102, 169, 201) | ![#66a9c9](https://via.placeholder.com/50/66a9c9/66a9c9) |
| 茉莉黄 | `#f8df72` | rgb(248, 223, 114) | ![#f8df72](https://via.placeholder.com/50/f8df72/f8df72) |
| 深海蓝 | `#3c7eff` | rgb(60, 126, 255) | ![#3c7eff](https://via.placeholder.com/50/3c7eff/3c7eff) |

---

## 语义颜色

### 状态颜色

| 用途 | 颜色名 | HEX | 使用场景 |
|------|--------|-----|----------|
| 成功 | 成功绿 | `#34c749` | 成功提示、完成状态 |
| 警告 | 警告黄 | `#fcbc40` | 警告提示、注意状态 |
| 错误 | 错误红 | `#fc625d` | 错误提示、危险操作 |

---

## 文字颜色

| 级别 | 变量名 | HEX | 使用场景 |
|------|--------|-----|----------|
| 主要 | `$--color-text` | `#1d2129` | 标题、重要文字 |
| 次要 | `$--color-text-1` | `#4e5969` | 正文、常规文字 |
| 辅助 | `$--color-text-2` | `#86909c` | 辅助说明、次要文字 |
| 禁用 | `$--color-text-3` | `#c9cdd4` | 禁用状态、占位符 |
| 反色 | `$--color-text-4` | `#f2f3f5` | 深色背景上的文字 |

---

## 背景颜色

### 深色主题背景

适用于大屏展示、深色模式。

| 级别 | 变量名 | HEX | 使用场景 |
|------|--------|-----|----------|
| 基础 | `$--color-dark-black` | `#000000` | 纯黑背景 |
| 一级 | `$--color-dark-bg-1` | `#18181c` | 页面主背景 |
| 二级 | `$--color-dark-bg-2` | `#232324` | 卡片、面板背景 |
| 三级 | `$--color-dark-bg-3` | `#2a2a2b` | 输入框、下拉框背景 |
| 四级 | `$--color-dark-bg-4` | `#313132` | hover 状态背景 |
| 五级 | `$--color-dark-bg-5` | `#373739` | 激活状态背景 |

### 浅色主题背景

适用于日常使用、浅色模式。

| 级别 | 变量名 | HEX | 使用场景 |
|------|--------|-----|----------|
| 基础 | `$--color-light-bg` | `#ffffff` | 纯白背景 |
| 一级 | `$--color-light-bg-1` | `#fafafc` | 页面主背景 |
| 二级 | `$--color-light-bg-2` | `#f2f3f5` | 卡片、面板背景 |
| 三级 | `$--color-light-bg-3` | `#e5e6eb` | 输入框、下拉框背景 |
| 四级 | `$--color-light-bg-4` | `#e3e3e4` | hover 状态背景 |
| 五级 | `$--color-light-bg-5` | `#bebebe` | 激活状态背景 |

---

## 图表主题颜色

### 颜色选择器预设颜色

```javascript
const swatchesColors = [
  '#232324', // 深灰
  '#2a2a2b', // 灰色
  '#313132', // 中灰
  '#373739', // 浅深灰
  '#757575', // 银灰
  '#e0e0e0', // 浅灰
  '#eeeeee', // 更浅灰
  '#fafafa'  // 近白
]
```

### 图表主题配色方案

#### Dark 主题
```
主色1: #4992ff (蓝)
主色2: #7cffb2 (绿)
阴影: rgba(68, 181, 226, 0.3)
```

#### Customed 主题
```
主色1: #5470c6 (深蓝)
主色2: #91cc75 (青绿)
阴影: rgba(84, 112, 198, 0.5)
```

#### Macarons 主题
```
主色1: #2ec7c9 (青)
主色2: #b6a2de (紫)
阴影: rgba(182, 162, 222, 0.3)
```

#### Walden 主题
```
主色1: #3fb1e3 (天蓝)
主色2: #6be6c1 (薄荷)
阴影: rgba(68, 181, 226, 0.3)
```

#### Purple Passion 主题
```
主色1: #9b8bba (淡紫)
主色2: #e098c7 (粉)
阴影: rgba(182, 162, 222, 0.3)
```

#### Vintage 主题
```
主色1: #d87c7c (暖红)
主色2: #919e8b (橄榄)
阴影: rgba(182, 162, 222, 0.3)
```

#### Chalk 主题
```
主色1: #fc97af (粉红)
主色2: #87f7cf (薄荷)
阴影: rgba(135, 247, 207, 0.3)
```

#### Westeros 主题
```
主色1: #516b91 (藏蓝)
主色2: #edafda (浅粉)
阴影: rgba(81, 107, 145, 0.3)
```

#### Wonderland 主题
```
主色1: #4ea397 (青瓷)
主色2: #22c3aa (翠绿)
阴影: rgba(68, 181, 226, 0.3)
```

#### Essos 主题
```
主色1: #893448 (酒红)
主色2: #d95850 (红)
阴影: rgba(137, 52, 72, 0.3)
```

#### Shine 主题
```
主色1: #c12e34 (鲜红)
主色2: #0098d9 (蓝)
阴影: rgba(137, 52, 72, 0.3)
```

#### Roma 主题
```
主色1: #e01f54 (玫红)
主色2: #5e4ea5 (紫)
阴影: rgba(137, 52, 72, 0.3)
```

---

## 特效颜色

### 毛玻璃效果

#### 深色主题
```scss
// 标准毛玻璃
background: rgba(35, 35, 36, 0.7);
backdrop-filter: blur(20px);

// 浅色毛玻璃
background: rgba(35, 35, 36, 0.3);
backdrop-filter: blur(20px);
```

#### 浅色主题
```scss
// 标准毛玻璃
background: rgba(240, 240, 240, 0.7);
backdrop-filter: blur(20px);

// 浅色毛玻璃
background: rgba(240, 240, 240, 0.3);
backdrop-filter: blur(20px);
```

### 阴影

```scss
// 深色主题阴影
box-shadow: 0 8px 10px #1e1e1e1f;

// 浅色主题阴影
box-shadow: 0 8px 10px #00000012;

// 通用强调阴影
box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
```

---

## 图表配色参考

### 坐标轴颜色

```json
{
  "axisLabel": {
    "color": "#B9B8CE"
  },
  "axisLine": {
    "lineStyle": {
      "color": "#B9B8CE"
    }
  },
  "splitLine": {
    "lineStyle": {
      "color": "#484753"
    }
  }
}
```

### 标题颜色

```json
{
  "title": {
    "textStyle": {
      "color": "#BFBFBF"
    },
    "subtextStyle": {
      "color": "#A2A2A2"
    }
  }
}
```

### 图例颜色

```json
{
  "legend": {
    "textStyle": {
      "color": "#B9B8CE"
    },
    "pageTextStyle": {
      "color": "#B9B8CE"
    }
  }
}
```

---

## 使用指南

### 在 SCSS 中使用

```scss
@import '@/styles/common/var.scss';

.my-component {
  // 使用状态颜色
  &.success { color: $--color-success; }
  &.warning { color: $--color-warn; }
  &.error { color: $--color-red; }

  // 使用文字颜色
  .title { color: $--color-text; }
  .description { color: $--color-text-1; }
  .hint { color: $--color-text-2; }

  // 使用背景颜色（深色主题）
  background: $--color-dark-bg-2;
}
```

### 在 JavaScript/TypeScript 中使用

```typescript
import designColor from '@/settings/designColor.json'
import { chartColorsSearch } from '@/settings/chartThemes'

// 获取传统色
const randomColor = designColor[Math.floor(Math.random() * designColor.length)]
console.log(randomColor.name, randomColor.hex)

// 获取图表主题色
const darkThemeColors = chartColorsSearch.dark
```

---

## 配色建议

1. **深色主题优先**：大屏展示场景使用深色主题，减少视觉疲劳
2. **对比度**：确保文字与背景的对比度符合 WCAG 标准
3. **语义化**：使用语义颜色表达状态（成功、警告、错误）
4. **一致性**：同一界面中保持配色方案的一致性
5. **中国传统色**：可使用内置的中国传统色彩库丰富视觉效果
