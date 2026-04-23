<script setup>
import { Download, Upload, UploadFilled, Check } from "@element-plus/icons-vue";
import { reactive, ref, watch } from "vue";

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

const emit = defineEmits(["save-style", "import-data", "export-data"]);

const form = reactive({
  anchor: {},
  camera: {}
});

const importMode = reactive({
  anchor: "append",
  camera: "append"
});

const anchorJsonInputRef = ref(null);
const anchorExcelInputRef = ref(null);
const cameraJsonInputRef = ref(null);
const cameraExcelInputRef = ref(null);

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

function triggerImport(kind, format) {
  const refMap = {
    "anchor-json": anchorJsonInputRef,
    "anchor-excel": anchorExcelInputRef,
    "camera-json": cameraJsonInputRef,
    "camera-excel": cameraExcelInputRef
  };
  refMap[`${kind}-${format}`]?.value?.click?.();
}

function handleImport(event, kind, format) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  emit("import-data", {
    kind,
    format: format === "excel" ? "excel" : "json",
    mode: importMode[kind],
    file
  });
  event.target.value = "";
}

function exportData(kind, format) {
  emit("export-data", { kind, format });
}
</script>

<template>
  <div class="dd-style-panel">
    <el-scrollbar height="100%">
      <div class="dd-style-panel__stack">
        <section class="dd-style-card">
          <div class="dd-style-card__header">
            <div class="dd-style-card__heading">
              <div class="dd-style-card__title">普通点位公共样式</div>
              <div class="dd-style-card__desc">全场景普通点位统一使用</div>
            </div>
            <el-button
              size="small"
              type="primary"
              :icon="Check"
              class="dd-style-save-btn"
              @click="saveStyle('anchor')"
            >
              保存
            </el-button>
          </div>

          <div class="dd-style-card__section">
            <div class="dd-style-card__section-title">数据管理</div>
            <div class="dd-transfer-toolbar">
              <div class="dd-transfer-toolbar__actions">
                <el-button
                  size="small"
                  :icon="Download"
                  @click="exportData('anchor', 'json')"
                >
                  导出 JSON
                </el-button>
                <el-button
                  size="small"
                  :icon="Download"
                  @click="exportData('anchor', 'excel')"
                >
                  导出 Excel
                </el-button>
                <el-button
                  size="small"
                  :icon="Upload"
                  @click="triggerImport('anchor', 'json')"
                >
                  导入 JSON
                </el-button>
                <el-button
                  size="small"
                  :icon="UploadFilled"
                  @click="triggerImport('anchor', 'excel')"
                >
                  导入 Excel
                </el-button>
              </div>
              <div class="dd-transfer-toolbar__mode">
                <span class="dd-transfer-toolbar__label">导入模式</span>
                <el-radio-group v-model="importMode.anchor" size="small">
                  <el-radio-button label="append">追加导入</el-radio-button>
                  <el-radio-button label="replace">替换导入</el-radio-button>
                </el-radio-group>
              </div>
              <input
                ref="anchorJsonInputRef"
                class="hidden"
                type="file"
                accept=".json"
                @change="handleImport($event, 'anchor', 'json')"
              />
              <input
                ref="anchorExcelInputRef"
                class="hidden"
                type="file"
                accept=".xlsx,.xls"
                @change="handleImport($event, 'anchor', 'excel')"
              />
            </div>
          </div>

          <div class="dd-style-card__section">
            <div class="dd-style-card__section-title">样式参数</div>
            <div class="dd-style-form-grid">
              <el-form-item label="点位大小" class="dd-style-field">
                <el-input-number
                  v-model="form.anchor.markerSize"
                  :min="0.05"
                  :max="6"
                  :step="0.05"
                  controls-position="right"
                  class="dd-style-input"
                />
              </el-form-item>
              <el-form-item label="点位颜色" class="dd-style-field">
                <div class="dd-style-color-field">
                  <el-color-picker v-model="form.anchor.color" />
                  <el-input
                    v-model="form.anchor.color"
                    placeholder="#22c55e"
                    class="dd-style-color-input"
                  />
                </div>
              </el-form-item>
              <el-form-item label="显示标签" class="dd-style-field">
                <el-switch v-model="form.anchor.showLabel" />
              </el-form-item>
            </div>

            <div v-if="form.anchor.showLabel" class="dd-style-form-grid mt-4">
              <el-form-item label="标签颜色" class="dd-style-field">
                <div class="dd-style-color-field">
                  <el-color-picker v-model="form.anchor.labelColor" />
                  <el-input
                    v-model="form.anchor.labelColor"
                    placeholder="#ffffff"
                    class="dd-style-color-input"
                  />
                </div>
              </el-form-item>
              <el-form-item label="字体大小" class="dd-style-field">
                <el-input-number
                  v-model="form.anchor.labelFontSize"
                  :min="10"
                  :max="72"
                  :step="1"
                  controls-position="right"
                  class="dd-style-input"
                />
              </el-form-item>
              <el-form-item label="标签宽度" class="dd-style-field">
                <el-input-number
                  v-model="form.anchor.labelWidth"
                  :min="24"
                  :max="240"
                  :step="1"
                  controls-position="right"
                  class="dd-style-input"
                />
              </el-form-item>
              <el-form-item label="标签高度" class="dd-style-field">
                <el-input-number
                  v-model="form.anchor.labelHeight"
                  :min="24"
                  :max="240"
                  :step="1"
                  controls-position="right"
                  class="dd-style-input"
                />
              </el-form-item>
              <el-form-item label="高度偏移" class="dd-style-field">
                <el-input-number
                  v-model="form.anchor.labelOffsetY"
                  :min="0.05"
                  :max="6"
                  :step="0.05"
                  controls-position="right"
                  class="dd-style-input"
                />
              </el-form-item>
            </div>
          </div>
        </section>

        <section class="dd-style-card">
          <div class="dd-style-card__header">
            <div class="dd-style-card__heading">
              <div class="dd-style-card__title">摄像头公共样式</div>
              <div class="dd-style-card__desc">全场景摄像头点位统一使用</div>
            </div>
            <el-button
              size="small"
              type="primary"
              :icon="Check"
              class="dd-style-save-btn"
              @click="saveStyle('camera')"
            >
              保存
            </el-button>
          </div>

          <div class="dd-style-card__section">
            <div class="dd-style-card__section-title">数据管理</div>
            <div class="dd-transfer-toolbar">
              <div class="dd-transfer-toolbar__actions">
                <el-button
                  size="small"
                  :icon="Download"
                  @click="exportData('camera', 'json')"
                >
                  导出 JSON
                </el-button>
                <el-button
                  size="small"
                  :icon="Download"
                  @click="exportData('camera', 'excel')"
                >
                  导出 Excel
                </el-button>
                <el-button
                  size="small"
                  :icon="Upload"
                  @click="triggerImport('camera', 'json')"
                >
                  导入 JSON
                </el-button>
                <el-button
                  size="small"
                  :icon="UploadFilled"
                  @click="triggerImport('camera', 'excel')"
                >
                  导入 Excel
                </el-button>
              </div>
              <div class="dd-transfer-toolbar__mode">
                <span class="dd-transfer-toolbar__label">导入模式</span>
                <el-radio-group v-model="importMode.camera" size="small">
                  <el-radio-button label="append">追加导入</el-radio-button>
                  <el-radio-button label="replace">替换导入</el-radio-button>
                </el-radio-group>
              </div>
              <input
                ref="cameraJsonInputRef"
                class="hidden"
                type="file"
                accept=".json"
                @change="handleImport($event, 'camera', 'json')"
              />
              <input
                ref="cameraExcelInputRef"
                class="hidden"
                type="file"
                accept=".xlsx,.xls"
                @change="handleImport($event, 'camera', 'excel')"
              />
            </div>
          </div>

          <div class="dd-style-card__section">
            <div class="dd-style-card__section-title">样式参数</div>
            <div class="dd-style-form-grid">
              <el-form-item label="图标宽度" class="dd-style-field">
                <el-input-number
                  v-model="form.camera.iconWidth"
                  :min="24"
                  :max="240"
                  :step="1"
                  controls-position="right"
                  class="dd-style-input"
                />
              </el-form-item>
              <el-form-item label="图标颜色" class="dd-style-field">
                <div class="dd-style-color-field">
                  <el-color-picker v-model="form.camera.color" />
                  <el-input
                    v-model="form.camera.color"
                    placeholder="#0f766e"
                    class="dd-style-color-input"
                  />
                </div>
              </el-form-item>
              <el-form-item label="透视缩放" class="dd-style-field">
                <div class="dd-style-switch-block">
                  <el-switch v-model="form.camera.iconSizeAttenuation" />
                  <div class="dd-style-help">
                    开启后在透视相机下按距离缩放；关闭时按图标宽度固定显示。
                  </div>
                </div>
              </el-form-item>
              <el-form-item label="显示标签" class="dd-style-field">
                <el-switch v-model="form.camera.showLabel" />
              </el-form-item>
            </div>

            <div v-if="form.camera.showLabel" class="dd-style-form-grid mt-4">
              <el-form-item label="标签颜色" class="dd-style-field">
                <div class="dd-style-color-field">
                  <el-color-picker v-model="form.camera.labelColor" />
                  <el-input
                    v-model="form.camera.labelColor"
                    placeholder="#e6f4ff"
                    class="dd-style-color-input"
                  />
                </div>
              </el-form-item>
              <el-form-item label="字体大小" class="dd-style-field">
                <el-input-number
                  v-model="form.camera.labelFontSize"
                  :min="10"
                  :max="72"
                  :step="1"
                  controls-position="right"
                  class="dd-style-input"
                />
              </el-form-item>
              <el-form-item label="标签高度" class="dd-style-field">
                <el-input-number
                  v-model="form.camera.labelHeight"
                  :min="24"
                  :max="240"
                  :step="1"
                  controls-position="right"
                  class="dd-style-input"
                />
              </el-form-item>
              <el-form-item label="高度偏移" class="dd-style-field">
                <el-input-number
                  v-model="form.camera.labelOffsetY"
                  :min="0.05"
                  :max="6"
                  :step="0.05"
                  controls-position="right"
                  class="dd-style-input"
                />
              </el-form-item>
            </div>
          </div>
        </section>
      </div>
    </el-scrollbar>
  </div>
</template>

<style scoped>
.dd-style-panel {
  height: 70vh;
}

.dd-style-panel__stack {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
  padding: 2px 6px 2px 0;
}

.dd-style-card {
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  background: var(--el-bg-color);
  padding: 22px 22px 20px;
  box-shadow: 0 8px 24px rgb(15 23 42 / 0.04);
}

.dd-style-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgb(148 163 184 / 0.14);
}

.dd-style-card__title {
  font-size: 17px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--el-text-color-primary);
}

.dd-style-card__desc {
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.4;
  color: var(--el-text-color-secondary);
}

.dd-style-save-btn {
  min-width: 88px;
  height: 34px;
  padding-inline: 14px;
  box-shadow: 0 8px 18px rgb(59 130 246 / 0.18);
}

.dd-style-card__section + .dd-style-card__section {
  margin-top: 22px;
}

.dd-style-card__section-title {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.dd-transfer-toolbar {
  border: 1px solid rgb(148 163 184 / 0.12);
  border-radius: 10px;
  background: var(--el-fill-color-light);
  padding: 14px 16px;
}

.dd-transfer-toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.dd-transfer-toolbar__actions :deep(.el-button) {
  min-width: 104px;
  height: 34px;
  padding-inline: 14px;
}

.dd-transfer-toolbar__mode {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  margin-top: 14px;
}

.dd-transfer-toolbar__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

.dd-style-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 28px;
}

.dd-style-field {
  margin-bottom: 0;
  padding: 12px 14px;
  border: 1px solid rgb(148 163 184 / 0.12);
  border-radius: 10px;
  background: linear-gradient(
    180deg,
    rgb(255 255 255 / 0.92),
    rgb(248 250 252 / 0.92)
  );
}

.dd-style-field :deep(.el-form-item__label) {
  width: 88px;
  justify-content: flex-start;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.dd-style-field :deep(.el-form-item__content) {
  min-width: 0;
  min-height: 32px;
  align-items: center;
}

.dd-style-input {
  width: 252px;
  max-width: 100%;
}

.dd-style-color-field {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.dd-style-color-field :deep(.el-color-picker) {
  flex: 0 0 auto;
}

.dd-style-color-input {
  width: 178px;
  max-width: 100%;
}

.dd-style-switch-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.dd-style-help {
  max-width: 320px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.dd-transfer-toolbar__mode :deep(.el-radio-button__inner) {
  min-width: 96px;
}

@media (max-width: 900px) {
  .dd-style-form-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .dd-style-card {
    padding: 18px 16px;
  }

  .dd-style-input {
    width: 100%;
  }

  .dd-style-color-input {
    width: 100%;
  }
}
</style>
