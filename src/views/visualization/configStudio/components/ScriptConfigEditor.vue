<script setup>
const actionTypeOptions = [
  { label: "聚焦对象", value: "focus-object" },
  { label: "飞向对象", value: "fly-to-object" },
  { label: "高亮对象", value: "highlight-object" },
  { label: "隔离对象", value: "isolate-object" },
  { label: "清除隔离", value: "clear-isolation" },
  { label: "设置透明度", value: "set-object-opacity" },
  { label: "切换透明模式", value: "set-transparent-mode" },
  { label: "切换材质主题", value: "set-material-theme" },
  { label: "预设视角", value: "set-preset-view" },
  { label: "应用书签", value: "apply-bookmark" },
  { label: "聚焦测量", value: "focus-measurement" },
  { label: "打开视频", value: "open-video" },
  { label: "切换显示模式", value: "set-display-mode" },
  { label: "切换测量模式", value: "set-measurement-mode" },
  { label: "切换点位显隐", value: "toggle-anchor-visibility" },
  { label: "设置点位状态", value: "set-anchor-state" },
  { label: "切换测点显隐", value: "toggle-point-markers" },
  { label: "后台命令", value: "backend-command" },
  { label: "消息提示", value: "message" }
];

const triggerEventOptions = [
  { label: "手动触发", value: "manual" },
  { label: "实时数据更新", value: "runtime.realtimeUpdated" },
  { label: "对象选择", value: "viewer.objectSelected" },
  { label: "测量变化", value: "viewer.measurementChanged" },
  { label: "点位点击", value: "anchor.clicked" },
  { label: "摄像头点击", value: "camera.clicked" }
];

defineOptions({
  name: "ScriptConfigEditor"
});

const props = defineProps({
  animations: {
    type: Array,
    default: () => []
  },
  triggers: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(["update:animations", "update:triggers"]);

function clonePayload(payload) {
  return JSON.parse(JSON.stringify(payload));
}

function updateAnimations(mutator) {
  const next = clonePayload(props.animations || []);
  mutator(next);
  emit("update:animations", next);
}

function updateTriggers(mutator) {
  const next = clonePayload(props.triggers || []);
  mutator(next);
  emit("update:triggers", next);
}

function createAnimation() {
  return {
    id: `animation-${Date.now()}`,
    name: "新动画",
    description: "",
    actions: []
  };
}

function createAction() {
  return {
    type: "message",
    text: "联动已执行",
    level: "info",
    delay: 0
  };
}

function createTrigger(animationId = "") {
  return {
    id: `trigger-${Date.now()}`,
    name: "新触发器",
    event: "manual",
    animationId
  };
}

function addAnimation() {
  updateAnimations(list => {
    list.push(createAnimation());
  });
}

function removeAnimation(index) {
  updateAnimations(list => {
    list.splice(index, 1);
  });
}

function patchAnimation(index, patch) {
  updateAnimations(list => {
    list[index] = {
      ...(list[index] || {}),
      ...patch
    };
  });
}

function addAction(animationIndex) {
  updateAnimations(list => {
    list[animationIndex].actions = Array.isArray(list[animationIndex].actions)
      ? list[animationIndex].actions
      : [];
    list[animationIndex].actions.push(createAction());
  });
}

function patchAction(animationIndex, actionIndex, patch) {
  updateAnimations(list => {
    const actions = Array.isArray(list[animationIndex].actions)
      ? list[animationIndex].actions
      : [];
    actions[actionIndex] = {
      ...(actions[actionIndex] || {}),
      ...patch
    };
    list[animationIndex].actions = actions;
  });
}

function removeAction(animationIndex, actionIndex) {
  updateAnimations(list => {
    list[animationIndex].actions.splice(actionIndex, 1);
  });
}

function addTrigger() {
  updateTriggers(list => {
    list.push(createTrigger(props.animations?.[0]?.id || ""));
  });
}

function removeTrigger(index) {
  updateTriggers(list => {
    list.splice(index, 1);
  });
}

function patchTrigger(index, patch) {
  updateTriggers(list => {
    list[index] = {
      ...(list[index] || {}),
      ...patch
    };
  });
}
</script>

<template>
  <div class="space-y-4">
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <span class="font-semibold">动画定义</span>
          <el-button size="small" type="primary" @click="addAnimation">
            新增动画
          </el-button>
        </div>
      </template>

      <div v-if="animations.length" class="space-y-4">
        <el-card
          v-for="(animation, animationIndex) in animations"
          :key="animation.id || animationIndex"
          shadow="hover"
        >
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">{{
                animation.name || "未命名动画"
              }}</span>
              <el-button
                size="small"
                type="danger"
                link
                @click="removeAnimation(animationIndex)"
              >
                删除
              </el-button>
            </div>
          </template>

          <el-form
            label-width="96px"
            class="grid grid-cols-1 gap-x-4 lg:grid-cols-2"
          >
            <el-form-item label="动画 ID">
              <el-input
                :model-value="animation.id"
                @update:model-value="
                  patchAnimation(animationIndex, { id: $event })
                "
              />
            </el-form-item>
            <el-form-item label="动画名称">
              <el-input
                :model-value="animation.name"
                @update:model-value="
                  patchAnimation(animationIndex, { name: $event })
                "
              />
            </el-form-item>
            <el-form-item label="描述" class="lg:col-span-2">
              <el-input
                type="textarea"
                :rows="2"
                :model-value="animation.description"
                @update:model-value="
                  patchAnimation(animationIndex, { description: $event })
                "
              />
            </el-form-item>
          </el-form>

          <div class="mb-3 flex items-center justify-between gap-2">
            <span class="font-medium text-sm">动作序列</span>
            <el-button size="small" link @click="addAction(animationIndex)">
              新增动作
            </el-button>
          </div>

          <div v-if="animation.actions?.length" class="space-y-3">
            <div
              v-for="(action, actionIndex) in animation.actions"
              :key="`${animation.id}-${actionIndex}`"
              class="rounded border border-[var(--el-border-color)] p-3"
            >
              <div class="mb-3 flex items-center justify-between gap-2">
                <span class="text-sm font-medium"
                  >动作 {{ actionIndex + 1 }}</span
                >
                <el-button
                  size="small"
                  type="danger"
                  link
                  @click="removeAction(animationIndex, actionIndex)"
                >
                  删除
                </el-button>
              </div>

              <el-form
                label-width="88px"
                class="grid grid-cols-1 gap-x-4 lg:grid-cols-2"
              >
                <el-form-item label="类型">
                  <el-select
                    :model-value="action.type"
                    @update:model-value="
                      patchAction(animationIndex, actionIndex, { type: $event })
                    "
                  >
                    <el-option
                      v-for="option in actionTypeOptions"
                      :key="option.value"
                      :label="option.label"
                      :value="option.value"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="延迟(ms)">
                  <el-input-number
                    :model-value="Number(action.delay || 0)"
                    :min="0"
                    :step="100"
                    @update:model-value="
                      patchAction(animationIndex, actionIndex, {
                        delay: $event
                      })
                    "
                  />
                </el-form-item>
                <el-form-item label="对象 UUID">
                  <el-input
                    :model-value="action.uuid"
                    @update:model-value="
                      patchAction(animationIndex, actionIndex, { uuid: $event })
                    "
                  />
                </el-form-item>
                <el-form-item label="摄像头 ID">
                  <el-input
                    :model-value="action.cameraId"
                    @update:model-value="
                      patchAction(animationIndex, actionIndex, {
                        cameraId: $event
                      })
                    "
                  />
                </el-form-item>
                <el-form-item label="显示模式">
                  <el-input
                    :model-value="action.mode"
                    @update:model-value="
                      patchAction(animationIndex, actionIndex, { mode: $event })
                    "
                  />
                </el-form-item>
                <el-form-item label="预设视角">
                  <el-select
                    :model-value="action.preset"
                    @update:model-value="
                      patchAction(animationIndex, actionIndex, {
                        preset: $event
                      })
                    "
                  >
                    <el-option label="前视图" value="front" />
                    <el-option label="后视图" value="back" />
                    <el-option label="左视图" value="left" />
                    <el-option label="右视图" value="right" />
                    <el-option label="顶视图" value="top" />
                    <el-option label="底视图" value="bottom" />
                    <el-option label="等轴视图" value="isometric" />
                  </el-select>
                </el-form-item>
                <el-form-item label="点位类型">
                  <el-select
                    :model-value="action.kind || 'anchor'"
                    @update:model-value="
                      patchAction(animationIndex, actionIndex, { kind: $event })
                    "
                  >
                    <el-option label="普通点位" value="anchor" />
                    <el-option label="摄像头点位" value="camera" />
                  </el-select>
                </el-form-item>
                <el-form-item label="点位 ID">
                  <el-input
                    :model-value="action.anchorId"
                    @update:model-value="
                      patchAction(animationIndex, actionIndex, {
                        anchorId: $event
                      })
                    "
                  />
                </el-form-item>
                <el-form-item label="显示">
                  <el-switch
                    :model-value="action.visible !== false"
                    @update:model-value="
                      patchAction(animationIndex, actionIndex, {
                        visible: $event
                      })
                    "
                  />
                </el-form-item>
                <el-form-item label="透明模式">
                  <el-switch
                    :model-value="action.enabled !== false"
                    @update:model-value="
                      patchAction(animationIndex, actionIndex, {
                        enabled: $event
                      })
                    "
                  />
                </el-form-item>
                <el-form-item label="材质主题">
                  <el-select
                    :model-value="action.theme || 'textured-basic'"
                    @update:model-value="
                      patchAction(animationIndex, actionIndex, {
                        theme: $event
                      })
                    "
                  >
                    <el-option label="Original" value="original" />
                    <el-option label="Textured Basic" value="textured-basic" />
                    <el-option label="Basic" value="basic" />
                  </el-select>
                </el-form-item>
                <el-form-item label="状态">
                  <el-select
                    :model-value="action.status || 'normal'"
                    @update:model-value="
                      patchAction(animationIndex, actionIndex, {
                        status: $event
                      })
                    "
                  >
                    <el-option label="Normal" value="normal" />
                    <el-option label="Warning" value="warning" />
                    <el-option label="Alarm" value="alarm" />
                    <el-option label="Offline" value="offline" />
                  </el-select>
                </el-form-item>
                <el-form-item label="显示文本">
                  <el-input
                    :model-value="action.displayText"
                    @update:model-value="
                      patchAction(animationIndex, actionIndex, {
                        displayText: $event
                      })
                    "
                  />
                </el-form-item>
                <el-form-item label="数值">
                  <el-input
                    :model-value="action.value"
                    @update:model-value="
                      patchAction(animationIndex, actionIndex, {
                        value: $event
                      })
                    "
                  />
                </el-form-item>
                <el-form-item label="书签">
                  <el-input
                    :model-value="action.bookmarkName"
                    @update:model-value="
                      patchAction(animationIndex, actionIndex, {
                        bookmarkName: $event
                      })
                    "
                  />
                </el-form-item>
                <el-form-item label="测量 ID">
                  <el-input
                    :model-value="action.measurementId"
                    @update:model-value="
                      patchAction(animationIndex, actionIndex, {
                        measurementId: $event
                      })
                    "
                  />
                </el-form-item>
                <el-form-item label="透明度">
                  <el-input-number
                    :model-value="Number(action.opacity ?? 0.3)"
                    :min="0"
                    :max="1"
                    :step="0.1"
                    @update:model-value="
                      patchAction(animationIndex, actionIndex, {
                        opacity: $event
                      })
                    "
                  />
                </el-form-item>
                <el-form-item label="消息级别">
                  <el-select
                    :model-value="action.level || 'info'"
                    @update:model-value="
                      patchAction(animationIndex, actionIndex, {
                        level: $event
                      })
                    "
                  >
                    <el-option label="Info" value="info" />
                    <el-option label="Success" value="success" />
                    <el-option label="Warning" value="warning" />
                    <el-option label="Error" value="error" />
                  </el-select>
                </el-form-item>
                <el-form-item label="命令" class="lg:col-span-2">
                  <el-input
                    :model-value="action.command"
                    @update:model-value="
                      patchAction(animationIndex, actionIndex, {
                        command: $event
                      })
                    "
                  />
                </el-form-item>
                <el-form-item label="消息" class="lg:col-span-2">
                  <el-input
                    :model-value="action.text"
                    @update:model-value="
                      patchAction(animationIndex, actionIndex, { text: $event })
                    "
                  />
                </el-form-item>
              </el-form>
            </div>
          </div>
          <el-empty v-else description="当前动画还没有动作" :image-size="80" />
        </el-card>
      </div>
      <el-empty v-else description="还没有配置动画" :image-size="88" />
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <span class="font-semibold">触发器定义</span>
          <el-button size="small" type="primary" @click="addTrigger">
            新增触发器
          </el-button>
        </div>
      </template>

      <div v-if="triggers.length" class="space-y-3">
        <div
          v-for="(trigger, triggerIndex) in triggers"
          :key="trigger.id || triggerIndex"
          class="rounded border border-[var(--el-border-color)] p-3"
        >
          <div class="mb-3 flex items-center justify-between gap-2">
            <span class="font-medium">{{
              trigger.name || "未命名触发器"
            }}</span>
            <el-button
              size="small"
              type="danger"
              link
              @click="removeTrigger(triggerIndex)"
            >
              删除
            </el-button>
          </div>

          <el-form
            label-width="96px"
            class="grid grid-cols-1 gap-x-4 lg:grid-cols-2"
          >
            <el-form-item label="触发器 ID">
              <el-input
                :model-value="trigger.id"
                @update:model-value="patchTrigger(triggerIndex, { id: $event })"
              />
            </el-form-item>
            <el-form-item label="名称">
              <el-input
                :model-value="trigger.name"
                @update:model-value="
                  patchTrigger(triggerIndex, { name: $event })
                "
              />
            </el-form-item>
            <el-form-item label="事件">
              <el-select
                :model-value="trigger.event"
                @update:model-value="
                  patchTrigger(triggerIndex, { event: $event })
                "
              >
                <el-option
                  v-for="option in triggerEventOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="关联动画">
              <el-select
                :model-value="trigger.animationId"
                placeholder="请选择动画"
                @update:model-value="
                  patchTrigger(triggerIndex, { animationId: $event })
                "
              >
                <el-option
                  v-for="animation in animations"
                  :key="animation.id"
                  :label="animation.name || animation.id"
                  :value="animation.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="pointKey">
              <el-input
                :model-value="trigger.pointKey"
                @update:model-value="
                  patchTrigger(triggerIndex, { pointKey: $event })
                "
              />
            </el-form-item>
            <el-form-item label="KKS">
              <el-input
                :model-value="trigger.kks"
                @update:model-value="
                  patchTrigger(triggerIndex, { kks: $event })
                "
              />
            </el-form-item>
            <el-form-item label="状态">
              <el-input
                :model-value="trigger.status"
                @update:model-value="
                  patchTrigger(triggerIndex, { status: $event })
                "
              />
            </el-form-item>
            <el-form-item label="equals">
              <el-input
                :model-value="trigger.equals"
                @update:model-value="
                  patchTrigger(triggerIndex, { equals: $event })
                "
              />
            </el-form-item>
            <el-form-item label="greaterThan">
              <el-input
                :model-value="trigger.greaterThan"
                @update:model-value="
                  patchTrigger(triggerIndex, { greaterThan: $event })
                "
              />
            </el-form-item>
            <el-form-item label="lessThan">
              <el-input
                :model-value="trigger.lessThan"
                @update:model-value="
                  patchTrigger(triggerIndex, { lessThan: $event })
                "
              />
            </el-form-item>
          </el-form>
        </div>
      </div>
      <el-empty v-else description="还没有配置触发器" :image-size="88" />
    </el-card>
  </div>
</template>
