<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { message } from "@/utils/message";
import {
  createEmptyProjectPackage,
  exportProjectPackage,
  exportProjectPackageBundle,
  loadProjectPackage,
  parseImportedProjectPackage,
  saveProjectPackage
} from "../viewer3d/services/projectPackageService";
import ScenePackageEditor from "./components/ScenePackageEditor.vue";
import ScriptConfigEditor from "./components/ScriptConfigEditor.vue";
import IntegrationConfigEditor from "./components/IntegrationConfigEditor.vue";
import ProjectPackageValidation from "./components/ProjectPackageValidation.vue";
import AssetManifestEditor from "./components/AssetManifestEditor.vue";
import { validateProjectPackage } from "./services/projectPackageValidator";

defineOptions({
  name: "VisualizationConfigStudio"
});

const route = useRoute();
const importInputRef = ref(null);
const activeTab = ref("scene");
const rawJson = ref("");
const editorPackage = ref(createEmptyProjectPackage(""));

const modelId = computed(() => String(route.query?.id || "").trim());
const modelName = computed(() => String(route.query?.name || "").trim());
const modelUrl = computed(() => String(route.query?.url || "").trim());
const scope = computed(() =>
  [modelName.value || "-", modelUrl.value || "-"].join("|")
);
const validationReport = computed(() =>
  validateProjectPackage(editorPackage.value)
);

function getMetadata() {
  return {
    modelId: modelId.value,
    modelName: modelName.value,
    modelUrl: modelUrl.value
  };
}

function clonePayload(payload) {
  return JSON.parse(JSON.stringify(payload));
}

function createBasePackage() {
  return createEmptyProjectPackage(scope.value, getMetadata());
}

function validatePackageShape(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("工程包必须是 JSON 对象");
  }
  if (!payload.scene || typeof payload.scene !== "object") {
    throw new Error("缺少 scene 配置");
  }
  if (!payload.scripts || typeof payload.scripts !== "object") {
    throw new Error("缺少 scripts 配置");
  }
  if (!payload.integrations || typeof payload.integrations !== "object") {
    throw new Error("缺少 integrations 配置");
  }
}

function normalizePayload(payload) {
  const base = createBasePackage();
  return {
    ...base,
    ...payload,
    metadata: {
      ...base.metadata,
      ...(payload.metadata || {}),
      ...getMetadata()
    },
    scene: {
      ...base.scene,
      ...(payload.scene || {})
    },
    scripts: {
      ...base.scripts,
      ...(payload.scripts || {})
    },
    assets: {
      ...base.assets,
      ...(payload.assets || {}),
      sceneManifest: {
        ...base.assets.sceneManifest,
        ...(payload.assets?.sceneManifest || {})
      }
    },
    integrations: {
      ...base.integrations,
      ...(payload.integrations || {})
    }
  };
}

function reloadPackage() {
  const payload = loadProjectPackage(scope.value, getMetadata());
  editorPackage.value = normalizePayload(payload);
}

function saveCurrentPackage() {
  try {
    const payload = clonePayload(editorPackage.value);
    validatePackageShape(payload);
    saveProjectPackage(scope.value, normalizePayload(payload));
    message("工程包已保存", { type: "success" });
    reloadPackage();
  } catch (error) {
    message(error?.message || "工程包保存失败", { type: "warning" });
  }
}

function downloadTextFile(content, filename) {
  const blob = new Blob([content], {
    type: "application/json;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportCurrentPackage() {
  downloadTextFile(
    exportProjectPackage(scope.value, getMetadata()),
    `project-package-${new Date().toISOString().slice(0, 10)}.json`
  );
}

function exportBundlePackage() {
  downloadTextFile(
    exportProjectPackageBundle(scope.value, getMetadata()),
    `project-bundle-${new Date().toISOString().slice(0, 10)}.json`
  );
}

function triggerImport() {
  importInputRef.value?.click?.();
}

function handleImport(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = parseImportedProjectPackage(
        JSON.parse(String(reader.result || "{}")),
        getMetadata()
      );
      validatePackageShape(payload);
      editorPackage.value = normalizePayload(payload);
      message("工程包已导入到编辑器", { type: "success" });
    } catch (error) {
      message(error?.message || "工程包导入失败", { type: "warning" });
    } finally {
      event.target.value = "";
    }
  };
  reader.onerror = () => {
    message("工程包读取失败", { type: "warning" });
    event.target.value = "";
  };
  reader.readAsText(file, "utf-8");
}

function applyRawJsonToEditor() {
  try {
    const payload = parseImportedProjectPackage(
      JSON.parse(rawJson.value || "{}"),
      getMetadata()
    );
    validatePackageShape(payload);
    editorPackage.value = normalizePayload(payload);
    message("原始 JSON 已同步到表单", { type: "success" });
  } catch (error) {
    message(error?.message || "原始 JSON 解析失败", { type: "warning" });
  }
}

function updateAnimations(value) {
  editorPackage.value = {
    ...editorPackage.value,
    scripts: {
      ...editorPackage.value.scripts,
      animations: value
    }
  };
}

function updateTriggers(value) {
  editorPackage.value = {
    ...editorPackage.value,
    scripts: {
      ...editorPackage.value.scripts,
      triggers: value
    }
  };
}

function updateRealtime(value) {
  editorPackage.value = {
    ...editorPackage.value,
    integrations: {
      ...editorPackage.value.integrations,
      realtime: value
    }
  };
}

function updateBackendBridge(value) {
  editorPackage.value = {
    ...editorPackage.value,
    integrations: {
      ...editorPackage.value.integrations,
      backendBridge: value
    }
  };
}

function updateSceneManifest(value) {
  editorPackage.value = {
    ...editorPackage.value,
    assets: {
      ...editorPackage.value.assets,
      sceneManifest: value
    }
  };
}

watch(
  editorPackage,
  value => {
    rawJson.value = JSON.stringify(value, null, 2);
  },
  { deep: true, immediate: true }
);

onMounted(() => {
  reloadPackage();
});
</script>

<template>
  <div class="dd-page config-studio-page">
    <el-card shadow="never" class="mb-4">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="font-semibold">工程配置工作台</div>
            <div class="mt-1 text-xs text-[var(--el-text-color-secondary)]">
              当前模型：{{ modelName || "未指定" }}
            </div>
          </div>
          <el-space wrap>
            <input
              ref="importInputRef"
              type="file"
              accept="application/json,.json"
              class="hidden"
              @change="handleImport"
            />
            <el-button size="small" @click="reloadPackage">刷新</el-button>
            <el-button size="small" @click="triggerImport">导入</el-button>
            <el-button size="small" @click="exportCurrentPackage">
              导出标准包
            </el-button>
            <el-button size="small" @click="exportBundlePackage">
              导出 Bundle
            </el-button>
            <el-button type="primary" size="small" @click="saveCurrentPackage">
              保存
            </el-button>
          </el-space>
        </div>
      </template>

      <el-alert
        title="该页面用于独立维护工程包，把场景、脚本、资产清单、集成配置从运行时页面里剥离出来。导入时兼容标准包和 bundle 包。"
        type="info"
        :closable="false"
        class="mb-4"
      />

      <el-tabs v-model="activeTab" class="config-studio-tabs">
        <el-tab-pane label="工程概览" name="scene">
          <div class="mb-3 text-xs text-[var(--el-text-color-secondary)]">
            对应文档中的工程目录编辑器基础能力，当前聚焦于场景包结构和运行时资产统计。
          </div>
          <ScenePackageEditor :project-package="editorPackage" />
        </el-tab-pane>

        <el-tab-pane label="脚本编辑" name="scripts">
          <div class="mb-3 text-xs text-[var(--el-text-color-secondary)]">
            对应文档中的动画脚本编辑器，直接维护 ScriptEngine
            的动作和触发器定义。
          </div>
          <ScriptConfigEditor
            :animations="editorPackage.scripts?.animations || []"
            :triggers="editorPackage.scripts?.triggers || []"
            @update:animations="updateAnimations"
            @update:triggers="updateTriggers"
          />
        </el-tab-pane>

        <el-tab-pane label="集成配置" name="integrations">
          <div class="mb-3 text-xs text-[var(--el-text-color-secondary)]">
            对应文档中的后台交互配置器，维护 RealtimeDataAdapter 和
            BackendBridge 的接入参数。
          </div>
          <IntegrationConfigEditor
            :realtime="editorPackage.integrations?.realtime || {}"
            :backend-bridge="editorPackage.integrations?.backendBridge || {}"
            @update:realtime="updateRealtime"
            @update:backend-bridge="updateBackendBridge"
          />
        </el-tab-pane>

        <el-tab-pane label="资产清单" name="assets">
          <div class="mb-3 text-xs text-[var(--el-text-color-secondary)]">
            对应文档中的 scene-manifest.json，维护质量档模型、资源分组和 LOD
            清单。
          </div>
          <AssetManifestEditor
            :scene-manifest="editorPackage.assets?.sceneManifest || {}"
            @update:scene-manifest="updateSceneManifest"
          />
        </el-tab-pane>

        <el-tab-pane label="原始 JSON" name="raw">
          <div class="mb-3 flex items-center justify-between gap-2">
            <span class="text-xs text-[var(--el-text-color-secondary)]">
              保留原始工程包编辑能力，用于处理当前表单尚未覆盖的字段。
            </span>
            <el-button size="small" @click="applyRawJsonToEditor">
              同步到表单
            </el-button>
          </div>
          <el-input
            v-model="rawJson"
            type="textarea"
            :rows="28"
            placeholder="请输入工程包 JSON 或 bundle JSON"
          />
        </el-tab-pane>

        <el-tab-pane label="校验结果" name="validation">
          <div class="mb-3 text-xs text-[var(--el-text-color-secondary)]">
            对工程包的结构完整性、动作引用关系、资产清单和集成配置字段进行基础校验。
          </div>
          <ProjectPackageValidation :report="validationReport" />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<style scoped>
.config-studio-page {
  padding: 16px;
}

.config-studio-tabs :deep(.el-tab-pane) {
  padding-top: 4px;
}
</style>
