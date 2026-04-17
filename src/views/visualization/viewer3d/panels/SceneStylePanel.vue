<script setup>
import { reactive, watch } from "vue";

defineOptions({
  name: "SceneStylePanel"
});

const props = defineProps({
  anchorStyle: {
    type: Object,
    default: () => ({})
  },
  cameraStyle: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(["save-style"]);

const form = reactive({
  anchor: {},
  camera: {}
});

function cloneStyle(style) {
  return JSON.parse(JSON.stringify(style || {}));
}

watch(
  () => props.anchorStyle,
  value => {
    form.anchor = cloneStyle(value);
  },
  { immediate: true, deep: true }
);

watch(
  () => props.cameraStyle,
  value => {
    form.camera = cloneStyle(value);
  },
  { immediate: true, deep: true }
);

function saveStyle(kind) {
  emit("save-style", {
    kind,
    style: cloneStyle(form[kind])
  });
}
</script>

<template>
  <div class="h-full">
    <el-scrollbar height="100%">
      <div class="space-y-4 pr-1">
        <section class="rounded border border-[var(--el-border-color)] p-3">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <div class="text-sm font-semibold">普通点位公共样式</div>
              <div class="text-xs text-[var(--el-text-color-secondary)]">
                全场景普通点位统一使用
              </div>
            </div>
            <el-button size="small" type="primary" @click="saveStyle('anchor')">
              保存
            </el-button>
          </div>
          <el-form label-width="92px">
            <el-form-item label="点位大小">
              <el-input-number
                v-model="form.anchor.markerSize"
                :min="0.05"
                :max="6"
                :step="0.05"
                controls-position="right"
                class="w-full"
              />
            </el-form-item>
            <el-form-item label="显示标签">
              <el-switch v-model="form.anchor.showLabel" />
            </el-form-item>
            <template v-if="form.anchor.showLabel">
              <el-form-item label="标签颜色">
                <el-input
                  v-model="form.anchor.labelColor"
                  placeholder="#ffffff / rgb(...)"
                />
              </el-form-item>
              <el-form-item label="标签大小">
                <el-input-number
                  v-model="form.anchor.labelFontSize"
                  :min="10"
                  :max="72"
                  :step="1"
                  controls-position="right"
                  class="w-full"
                />
              </el-form-item>
              <el-form-item label="高度偏移">
                <el-input-number
                  v-model="form.anchor.labelOffsetY"
                  :min="0.05"
                  :max="6"
                  :step="0.05"
                  controls-position="right"
                  class="w-full"
                />
              </el-form-item>
              <el-form-item label="点位颜色">
                <el-input
                  v-model="form.anchor.color"
                  placeholder="#22c55e / rgb(...)"
                />
              </el-form-item>
            </template>
          </el-form>
        </section>

        <section class="rounded border border-[var(--el-border-color)] p-3">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <div class="text-sm font-semibold">摄像头公共样式</div>
              <div class="text-xs text-[var(--el-text-color-secondary)]">
                全场景摄像头点位统一使用
              </div>
            </div>
            <el-button size="small" type="primary" @click="saveStyle('camera')">
              保存
            </el-button>
          </div>
          <el-form label-width="92px">
            <el-form-item label="图标大小">
              <el-input-number
                v-model="form.camera.markerSize"
                :min="0.05"
                :max="6"
                :step="0.05"
                controls-position="right"
                class="w-full"
              />
            </el-form-item>
            <el-form-item label="图标透视缩放">
              <el-switch v-model="form.camera.iconSizeAttenuation" />
            </el-form-item>
            <el-form-item label="显示标签">
              <el-switch v-model="form.camera.showLabel" />
            </el-form-item>
            <template v-if="form.camera.showLabel">
              <el-form-item label="标签颜色">
                <el-input
                  v-model="form.camera.labelColor"
                  placeholder="#e6f4ff / rgb(...)"
                />
              </el-form-item>
              <el-form-item label="标签大小">
                <el-input-number
                  v-model="form.camera.labelFontSize"
                  :min="10"
                  :max="72"
                  :step="1"
                  controls-position="right"
                  class="w-full"
                />
              </el-form-item>
              <el-form-item label="高度偏移">
                <el-input-number
                  v-model="form.camera.labelOffsetY"
                  :min="0.05"
                  :max="6"
                  :step="0.05"
                  controls-position="right"
                  class="w-full"
                />
              </el-form-item>
              <el-form-item label="图标颜色">
                <el-input
                  v-model="form.camera.color"
                  placeholder="#0f766e / rgb(...)"
                />
              </el-form-item>
            </template>
          </el-form>
        </section>
      </div>
    </el-scrollbar>
  </div>
</template>
