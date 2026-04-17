# VFD 动画效果参考

本文档列出了 VFD 项目中可用的所有动画效果，基于 animate.css 和自定义动画。

## 目录

- [1. 强调动画](#1-强调动画)
- [2. 移入动画](#2-移入动画)
- [3. 内置 CSS 动画](#3-内置-css-动画)
- [4. Vue 过渡动画](#4-vue-过渡动画)
- [5. 使用指南](#5-使用指南)

---

## 1. 强调动画

适用于吸引用户注意力的场景。

| 中文名称 | CSS 类名 | 效果描述 |
|---------|----------|----------|
| 弹跳 | `bounce` | 元素上下弹跳 |
| 闪烁 | `flash` | 元素快速闪烁 |
| 放大缩小 | `pulse` | 元素脉冲式缩放 |
| 放大缩小弹簧 | `rubberBand` | 弹性拉伸效果 |
| 左右晃动 | `headShake` | 类似摇头效果 |
| 左右扇形摇摆 | `swing` | 钟摆式摇摆 |
| 放大晃动缩小 | `tada` | 欢呼式晃动 |
| 扇形摇摆 | `wobble` | 不稳定摇晃 |
| 左右上下晃动 | `jello` | 果冻抖动效果 |

### 使用示例

```vue
<template>
  <div class="animate__animated animate__bounce">
    弹跳效果
  </div>
</template>
```

---

## 2. 移入动画

适用于元素进入页面的场景。

### 淡入系列

| 中文名称 | CSS 类名 | 效果描述 |
|---------|----------|----------|
| 渐显 | `fadeIn` | 透明度渐变显示 |
| 向右进入 | `fadeInLeft` | 从左侧淡入 |
| 向左进入 | `fadeInRight` | 从右侧淡入 |
| 向上进入 | `fadeInUp` | 从下方淡入 |
| 向下进入 | `fadeInDown` | 从上方淡入 |
| 向右长距进入 | `fadeInLeftBig` | 从左远处淡入 |
| 向左长距进入 | `fadeInRightBig` | 从右远处淡入 |
| 向上长距进入 | `fadeInUpBig` | 从下远处淡入 |
| 向下长距进入 | `fadeInDownBig` | 从上远处淡入 |

### 旋转系列

| 中文名称 | CSS 类名 | 效果描述 |
|---------|----------|----------|
| 旋转进入 | `rotateIn` | 旋转显示 |
| 左顺时针旋转 | `rotateInDownLeft` | 从左上角顺时针旋入 |
| 右逆时针旋转 | `rotateInDownRight` | 从右上角逆时针旋入 |
| 左逆时针旋转 | `rotateInUpLeft` | 从左下角逆时针旋入 |
| 右逆时针旋转 | `rotateInUpRight` | 从右下角逆时针旋入 |

### 弹入系列

| 中文名称 | CSS 类名 | 效果描述 |
|---------|----------|----------|
| 弹入 | `bounceIn` | 弹跳进入 |
| 向右弹入 | `bounceInLeft` | 从左弹入 |
| 向左弹入 | `bounceInRight` | 从右弹入 |
| 向上弹入 | `bounceInUp` | 从下弹入 |
| 向下弹入 | `bounceInDown` | 从上弹入 |

### 光速系列

| 中文名称 | CSS 类名 | 效果描述 |
|---------|----------|----------|
| 光速从右进入 | `lightSpeedInRight` | 高速从右滑入 |
| 光速从左进入 | `lightSpeedInLeft` | 高速从左滑入 |
| 光速从右退出 | `lightSpeedOutRight` | 高速向右滑出 |
| 光速从左退出 | `lightSpeedOutLeft` | 高速向左滑出 |

### 翻转系列

| 中文名称 | CSS 类名 | 效果描述 |
|---------|----------|----------|
| Y轴旋转 | `flip` | 沿Y轴翻转 |
| 中心X轴旋转 | `flipInX` | 沿X轴翻转进入 |
| 中心Y轴旋转 | `flipInY` | 沿Y轴翻转进入 |

### 缩放系列

| 中文名称 | CSS 类名 | 效果描述 |
|---------|----------|----------|
| 由小变大进入 | `zoomIn` | 从中心放大进入 |
| 左变大进入 | `zoomInLeft` | 从左放大进入 |
| 右变大进入 | `zoomInRight` | 从右放大进入 |
| 向上变大进入 | `zoomInUp` | 从下放大进入 |
| 向下变大进入 | `zoomInDown` | 从上放大进入 |

### 滑动系列

| 中文名称 | CSS 类名 | 效果描述 |
|---------|----------|----------|
| 向右滑动展开 | `slideInLeft` | 从左滑入 |
| 向左滑动展开 | `slideInRight` | 从右滑入 |
| 向上滑动展开 | `slideInUp` | 从下滑入 |
| 向下滑动展开 | `slideInDown` | 从上滑入 |

### 其他

| 中文名称 | CSS 类名 | 效果描述 |
|---------|----------|----------|
| 左长半径旋转 | `rollIn` | 滚动进入 |

---

## 3. 内置 CSS 动画

### 闪烁动画

```scss
.go-animation-twinkle {
  animation: twinkle 2s ease infinite;
  opacity: 1;
}

@keyframes twinkle {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}
```

### 模态框动画

```scss
// 进入动画
.v-modal-enter {
  animation: v-modal-in 0.2s ease;
}

// 退出动画
.v-modal-leave {
  animation: v-modal-out 0.2s ease forwards;
}

@keyframes v-modal-in {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

@keyframes v-modal-out {
  0% { opacity: 1; }
  100% { opacity: 0; }
}
```

---

## 4. Vue 过渡动画

### 淡入淡出

```vue
<template>
  <Transition name="fade">
    <div v-if="show">内容</div>
  </Transition>
</template>

<style>
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
</style>
```

### 列表动画

```vue
<template>
  <TransitionGroup name="list-complete">
    <div v-for="item in items" :key="item.id" class="list-complete-item">
      {{ item.text }}
    </div>
  </TransitionGroup>
</template>

<style>
.list-complete-item {
  transition: all 1s;
}

.list-complete-enter-from,
.list-complete-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

.list-complete-leave-active {
  position: absolute;
}
</style>
```

---

## 5. 使用指南

### 基本过渡类

```html
<!-- 标准过渡（0.4s） -->
<div class="go-transition">内容</div>

<!-- 快速过渡（0.2s） -->
<div class="go-transition-quick">内容</div>
```

### 在组件中使用 animate.css

```vue
<script setup>
import { ref } from 'vue'

const animationClass = ref('animate__fadeIn')
</script>

<template>
  <div :class="['animate__animated', animationClass]">
    动画内容
  </div>
</template>
```

### 配置动画选项

在组件配置中设置动画：

```typescript
// 动画配置结构
interface AnimationConfig {
  animationName: string    // 动画名称
  animationDuration: number // 持续时间(ms)
  animationDelay: number   // 延迟时间(ms)
  animationIteration: number | 'infinite' // 循环次数
}

// 示例配置
const animation: AnimationConfig = {
  animationName: 'fadeIn',
  animationDuration: 1000,
  animationDelay: 0,
  animationIteration: 1
}
```

### 动画工具函数

```typescript
import { animations } from '@/settings/animations'

// 获取所有动画选项
const allAnimations = animations

// 按类型获取动画
const emphasisAnimations = animations.find(g => g.label === '强调动画')?.children
const entranceAnimations = animations.find(g => g.label === '移入动画')?.children
```

---

## 动画配置参考

### 推荐组合

| 场景 | 推荐动画 | 配置 |
|------|----------|------|
| 页面加载 | `fadeIn` | duration: 500ms |
| 弹窗显示 | `zoomIn` | duration: 300ms |
| 列表项 | `fadeInUp` | duration: 400ms, delay: index * 100ms |
| 数据更新 | `pulse` | duration: 1000ms |
| 警告提示 | `headShake` | duration: 800ms |
| 成功反馈 | `bounceIn` | duration: 600ms |

### 性能建议

1. **避免频繁触发**：不要在高频更新的元素上使用动画
2. **使用 transform**：优先使用 transform 和 opacity 进行动画
3. **硬件加速**：对动画元素添加 `will-change: transform`
4. **控制数量**：同时播放的动画数量不宜过多
5. **适度使用**：动画是点缀，不是必需品

```scss
// 启用硬件加速
.animated-element {
  will-change: transform, opacity;
  transform: translateZ(0);
}
```


关联文件
packages\vfd\src\packages\components\CustomComponents\Custom\CustomComponentRenderer\index.vue
packages\vfd\src\packages\components\CustomComponents\index.ts
packages\vfd\src\packages\index.ts
packages\vfd\src\views\chart\ContentPages\index.vue
packages\vfd\src\views\chart\ContentPages\components\ChartsList.vue
组件分类接口 /form/systemForm/v1/getPageDefinition{getCategoryDefinitions}
请求body
{
    "codename": "CustomComponent_scada2",
    "needPageDefinition": true,
    "needTotalCount": false,
    "pagecode": "0",
    "pageTypeId": "1",
    "fieldBlockDesiredPageType": 0,
    "desiredPageType": 0
}
返回结果{
    "confirmMessages": [],
    "content": {
        "actionDefinition": {},
        "businessModelDefinitionId": "795839468211814400",
        "canAdd": true,
        "canDelete": true,
        "canUpdate": true,
        "code": "CustomComponent",
        "codename": "CustomComponent_scada2",
        "controlDefinition": {
            "asyncOpenFlow": false,
            "enableGlobalSearch": true,
            "enableAdvanceSearch": true,
            "isCollapsedFlowOnPC": false,
            "selectNextApprovalHook": null,
            "isShowFlowTableOnMobile": true
        },
        "dataModelDefinition": {

        },
        "description": "",
        "detailPageDefinitionId": "0",
        "enumDefinitions": {},
        "excludeGlobalCodenameButton": false,
        "excludeGlobalCodenameButtonIds": [],
        "fieldBlockDefinition": [
            {
                "aggregateDefinition": [],
                "allFields": [
                    "name_scada2",
                    "description_scada2",
                    "type_scada2",
                    "createTime",
                    "lastModifyTime"
                ],

                "fieldMapIds": [
                    "802430908329115648",
                ],
                "fieldMaps": {

                    "802430908329115648": {
                        "autoCompleteDefinition": {
                            "type": 2,
                            "isNew": true,
                            "keyValues": [
                                {
                                    "id": "65d977c3-a574-4a70-8bfb-e41b32770f4b",
                                    "key": "1",
                                    "value": "基础组件",
                                    "value-zh-cn": "基础组件"
                                },
                                {
                                    "id": "2e3ac71d-c34b-4f23-a703-9bc79b7e7a1b",
                                    "key": "2",
                                    "value": "Web交互",
                                    "value-zh-cn": "Web交互"
                                },
                                {
                                    "id": "cd8f655d-7980-48e3-a9e5-d0ceda043e66",
                                    "key": "3",
                                    "value": "柱状图/折线图",
                                    "value-zh-cn": "柱状图/折线图"
                                },
                                {
                                    "id": "641d296f-2937-4b2a-94ee-5be8dc59dbcc",
                                    "key": "4",
                                    "value": "饼图/占比图",
                                    "value-zh-cn": "饼图/占比图"
                                },
                                {
                                    "id": "4e884b18-8f50-49ed-be6a-384f2589df92",
                                    "key": "5",
                                    "value": "地图",
                                    "value-zh-cn": "地图"
                                },
                                {
                                    "id": "f0efb3b6-bb10-4c2c-9685-707251459ce0",
                                    "key": "6",
                                    "value": "关系图",
                                    "value-zh-cn": "关系图"
                                },
                                {
                                    "id": "fdf2697b-6bd2-4dc5-a93b-1165ad3490a9",
                                    "key": "7",
                                    "value": "散点图",
                                    "value-zh-cn": "散点图"
                                },
                                {
                                    "id": "124f3838-1168-4e89-b136-cb93b65ea1a4",
                                    "key": "8",
                                    "value": "热力图",
                                    "value-zh-cn": "热力图"
                                },
                                {
                                    "id": "6392a582-421b-443c-ad5b-3bff42a47cbb",
                                    "key": "9",
                                    "value": "表格",
                                    "value-zh-cn": "表格"
                                },
                                {
                                    "id": "91122cd0-c8ec-4e6d-a7f7-19bea3fb4549",
                                    "key": "10",
                                    "value": "小组件",
                                    "value-zh-cn": "小组件"
                                },
                                {
                                    "id": "eb35b756-a9f7-453c-81cc-8b601dfa8b83",
                                    "key": "11",
                                    "value": "图标",
                                    "value-zh-cn": "图标"
                                },
                                {
                                    "id": "8d708099-062b-4c00-9ec4-bf35ab361a30",
                                    "key": "12",
                                    "value": "视频流",
                                    "value-zh-cn": "视频流"
                                },
                                {
                                    "id": "e1d9cd40-c859-4628-9080-8d199e2a1cad",
                                    "key": "13",
                                    "value": "Webgl",
                                    "value-zh-cn": "Webgl"
                                },
                                {
                                    "id": "ef5c8307-d942-485e-8153-066ae762b30e",
                                    "key": "14",
                                    "value": "自定义组件",
                                    "value-zh-cn": "自定义组件"
                                }
                            ],
                            "formulaData": "",
                            "hiddenField": ""
                        },
                        "businessModelDefinitionId": "795839468211814400",
                        "codename": "CustomComponent_scada2",
                        "columnLabelValue": "",
                        "conditionControlDefinition": [],

                        "description": "分类",
                        "fetchFormatPath": "",
                        "fetchValuePath": "",
                        "fieldDefinitionId": "802430279183515648",
                        "fieldMapType": "0",
                        "fieldName": "type_scada2",
                        "fieldValueDataType": "19",
                        "files": [],
                        "formulaDefinition": {},
                        "id": "802430908329115648",
                        "jsonSchema": {},
                        "mapName": "分类",

                    }
                },
                "files": [],

            }
        ],
        "files": [],

    },
    "direct": null,
    "errorCode": "",

}


找到分类的属性
const fields = Object.values(content.fieldBlockDefinition[0].fieldMaps).find((item)=>item.mapName === '分类')
field.autoCompleteDefinition.keyValues 为分类的属性值数组

获取分类数组后进行下一步修改
packages\vfd\src\packages\components\CustomComponents\index.ts  /form/generalForm/v1/getObjects接口为获取自定义组件的列表

接口返回数据
{
    "confirmMessages": [],
    "content": {
        "aggregateResult": null,
        "canAdd": true,
        "canDelete": true,
        "canUpdate": true,
        "data": [
            {
                "createTime": "2026-01-19 08:59:04",
                "description_scada2": "超链接",
                "id": "801012844249235456",
                "lastModifyTime": "2026-01-24 12:43:01",
                "name_scada2": "超链接",
                "rowVersion": "943867696",
                "type_scada2": "13"
            },
            {
                "createTime": "2026-01-05 03:12:34",
                "description_scada2": "测试组件",
                "id": "795852216668798976",
                "lastModifyTime": "2026-01-25 09:10:50",
                "name_scada2": "测试组件",
                "rowVersion": "943910019",
                "type_scada2": "14"
            }
        ],
        "fields": [
            "createTime",
            "description_scada2",
            "lastModifyTime",
            "name_scada2",
            "type_scada2",
            "id",
            "rowVersion"
        ],
        "pageDefinition": null,
        "requestId": ""
    },
    "direct": null,
    "errorCode": "",
    "exceptionMessage": "",
    "infoMessages": [],
    "innerErrorMessage": "",
    "message": "",
    "requestId": "",
    "securityRequires": [],
    "successful": true,
    "totalCount": "2"
}

在组件中参数中type_scada2参数对应组件分类.于field.autoCompleteDefinition.keyValues中的id对齐
组件页面packages\vfd\src\views\chart\ContentPages\components\ChartsList.vue
对应匹配后，把对应的组件添加到对应的分组内packagesList[]。如果没有匹配到的分类，则添加到自定义组件分类。
-不生成文档
