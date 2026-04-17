<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { message } from "@/utils/message";
import { setConfig } from "@/config";
import { useDdLinkageStoreHook } from "@/store/modules/ddLinkage";

defineOptions({
  name: "SystemSettings"
});

const STORAGE_KEY = "dd_platform_settings";
const ddStore = useDdLinkageStoreHook();

const loading = ref(false);
const importInputRef = ref(null);

const form = reactive({
  platformName: "数字化移交平台",
  platformShortName: "DigitalDelivery",
  publicPath: "/",
  ssoEnabled: false,
  tokenExpireMinutes: 120,
  passwordMinLength: 8,
  passwordMustIncludeNumber: true,
  auditEnabled: true
});

const loadedFrom = ref("默认值");
const viewer3dBindings = ref([]);

const nodeOptions = computed(() => ddStore.nodeOptions || []);

const bindingSummary = computed(() => {
  const rows = viewer3dBindings.value || [];
  const validRows = rows.filter(item => String(item.kks || "").trim()).length;
  return {
    total: rows.length,
    valid: validRows,
    empty: rows.length - validRows
  };
});

function createEmptyBinding() {
  return {
    id: `binding-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    kks: "",
    nodeId: "",
    matchAnyText: "",
    matchName: "",
    matchPath: "",
    matchRegex: ""
  };
}

function normalizeBindings(bindings = []) {
  return bindings.map(item => ({
    id:
      item.id ||
      `binding-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    kks: String(item.kks || ""),
    nodeId: String(item.nodeId || ""),
    matchAnyText: Array.isArray(item.matchAny)
      ? item.matchAny.join(", ")
      : String(item.matchAnyText || ""),
    matchName: String(item.matchName || ""),
    matchPath: String(item.matchPath || ""),
    matchRegex: String(item.matchRegex || "")
  }));
}

function serializeBindings() {
  return viewer3dBindings.value
    .map(item => ({
      kks: String(item.kks || "").trim(),
      nodeId: String(item.nodeId || "").trim(),
      matchAny: String(item.matchAnyText || "")
        .split(/[,，\n]/)
        .map(entry => entry.trim())
        .filter(Boolean),
      matchName: String(item.matchName || "").trim(),
      matchPath: String(item.matchPath || "").trim(),
      matchRegex: String(item.matchRegex || "").trim()
    }))
    .filter(item => item.kks);
}

function validateBindings() {
  const rows = serializeBindings();
  const seenKks = new Set();

  for (const item of rows) {
    if (seenKks.has(item.kks)) {
      return `存在重复 KKS：${item.kks}`;
    }
    seenKks.add(item.kks);

    if (
      !item.nodeId &&
      !item.matchAny.length &&
      !item.matchName &&
      !item.matchPath &&
      !item.matchRegex
    ) {
      return `绑定 ${item.kks} 缺少匹配条件，至少需要系统节点或一种匹配规则`;
    }

    if (item.matchRegex) {
      try {
        // 仅校验正则可编译，不在此处执行匹配
        new RegExp(item.matchRegex);
      } catch {
        return `绑定 ${item.kks} 的正则表达式无效`;
      }
    }
  }

  return "";
}

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function loadDefaultPlatformConfig() {
  // 对齐 public/platform-config.json（只取少量字段用于原型展示）
  try {
    const res = await fetch("/platform-config.json", { cache: "no-store" });
    if (!res.ok) return;
    const cfg = await res.json();
    if (cfg?.title) form.platformName = cfg.title;
    if (cfg?.shortName) form.platformShortName = cfg.shortName;
    if (cfg?.publicPath) form.publicPath = cfg.publicPath;
    const bindings = Array.isArray(cfg?.Viewer3D?.ModelObjectBindings)
      ? cfg.Viewer3D.ModelObjectBindings
      : [];
    viewer3dBindings.value = normalizeBindings(bindings);
  } catch {
    // 忽略：某些环境下可能无法 fetch
  }
}

function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  const parsed = safeParse(raw);
  if (!parsed) return false;
  Object.assign(form, {
    platformName: parsed.platformName ?? form.platformName,
    platformShortName: parsed.platformShortName ?? form.platformShortName,
    publicPath: parsed.publicPath ?? form.publicPath,
    ssoEnabled: parsed.ssoEnabled ?? form.ssoEnabled,
    tokenExpireMinutes: parsed.tokenExpireMinutes ?? form.tokenExpireMinutes,
    passwordMinLength: parsed.passwordMinLength ?? form.passwordMinLength,
    passwordMustIncludeNumber:
      parsed.passwordMustIncludeNumber ?? form.passwordMustIncludeNumber,
    auditEnabled: parsed.auditEnabled ?? form.auditEnabled
  });
  if (Array.isArray(parsed.viewer3dBindings)) {
    viewer3dBindings.value = normalizeBindings(parsed.viewer3dBindings);
  }
  loadedFrom.value = "localStorage";
  return true;
}

function saveToStorage() {
  const errorText = validateBindings();
  if (errorText) {
    message(errorText, { type: "warning" });
    return;
  }

  const payload = {
    ...form,
    viewer3dBindings: serializeBindings()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  setConfig({
    Title: form.platformName,
    Viewer3D: {
      ModelObjectBindings: payload.viewer3dBindings
    }
  });
  loadedFrom.value = "localStorage";
  message("已保存系统配置（演示）", { type: "success" });
}

function exportBindings() {
  const payload = {
    exportedAt: new Date().toISOString(),
    viewer3dBindings: serializeBindings()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `viewer3d-bindings-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  message("已导出三维对象绑定", { type: "success" });
}

function triggerImportBindings() {
  importInputRef.value?.click?.();
}

function handleImportBindings(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const parsed = safeParse(String(reader.result || ""));
    const imported = Array.isArray(parsed?.viewer3dBindings)
      ? parsed.viewer3dBindings
      : Array.isArray(parsed)
        ? parsed
        : null;

    if (!imported) {
      message("导入失败：文件内容不是有效的绑定配置", { type: "warning" });
      event.target.value = "";
      return;
    }

    viewer3dBindings.value = normalizeBindings(imported);
    if (!viewer3dBindings.value.length) {
      viewer3dBindings.value = [createEmptyBinding()];
    }
    message(`已导入 ${viewer3dBindings.value.length} 条绑定规则`, {
      type: "success"
    });
    event.target.value = "";
  };
  reader.onerror = () => {
    message("导入失败：文件读取异常", { type: "warning" });
    event.target.value = "";
  };
  reader.readAsText(file, "utf-8");
}

async function resetToDefault() {
  localStorage.removeItem(STORAGE_KEY);
  loadedFrom.value = "默认值";
  await init();
  message("已恢复默认配置（演示）", { type: "success" });
}

function addBinding() {
  viewer3dBindings.value.push(createEmptyBinding());
}

function removeBinding(index) {
  viewer3dBindings.value.splice(index, 1);
}

async function init() {
  loading.value = true;
  viewer3dBindings.value = [];
  await loadDefaultPlatformConfig();
  loadFromStorage();
  if (!viewer3dBindings.value.length) {
    viewer3dBindings.value = [createEmptyBinding()];
  }
  loading.value = false;
}

onMounted(() => {
  init();
});
</script>

<template>
  <div class="dd-page">
    <el-card v-loading="loading" shadow="never" class="mb-4">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="font-semibold">基础配置</div>
          <div class="text-xs text-[var(--el-text-color-secondary)]">
            当前来源：{{ loadedFrom }}
          </div>
        </div>
      </template>

      <el-form label-width="120px">
        <el-form-item label="平台名称">
          <el-input
            v-model="form.platformName"
            placeholder="例如：数字化移交平台"
          />
        </el-form-item>
        <el-form-item label="平台简称">
          <el-input
            v-model="form.platformShortName"
            placeholder="例如：交付平台"
          />
        </el-form-item>
        <el-form-item label="资源路径">
          <el-input v-model="form.publicPath" placeholder="例如：/" />
          <div class="text-xs text-[var(--el-text-color-secondary)] mt-1">
            说明：该项仅用于原型展示，实际以构建配置为准。
          </div>
        </el-form-item>
        <el-form-item label="启用单点登录">
          <el-switch v-model="form.ssoEnabled" />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="mb-4">
      <template #header>
        <div class="font-semibold">安全策略</div>
      </template>

      <el-form label-width="120px">
        <el-form-item label="令牌过期（分钟）">
          <el-input-number
            v-model="form.tokenExpireMinutes"
            :min="5"
            :max="1440"
          />
        </el-form-item>
        <el-form-item label="最小密码长度">
          <el-input-number
            v-model="form.passwordMinLength"
            :min="6"
            :max="32"
          />
        </el-form-item>
        <el-form-item label="必须包含数字">
          <el-switch v-model="form.passwordMustIncludeNumber" />
        </el-form-item>
        <el-form-item label="启用审计">
          <el-switch v-model="form.auditEnabled" />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="mb-4">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="font-semibold">三维对象绑定</div>
          <el-space wrap>
            <el-button size="small" @click="triggerImportBindings">
              导入 JSON
            </el-button>
            <el-button size="small" @click="exportBindings">
              导出 JSON
            </el-button>
            <el-button size="small" @click="addBinding">新增绑定</el-button>
          </el-space>
        </div>
      </template>

      <input
        ref="importInputRef"
        type="file"
        accept="application/json,.json"
        class="hidden"
        @change="handleImportBindings"
      />

      <div class="text-xs text-[var(--el-text-color-secondary)] mb-3">
        说明：优先用于三维模型对象和
        KKS/系统节点的显式匹配。保存后，主三维页与全屏三维页都会优先读取这些规则。
      </div>

      <div
        class="mb-3 flex flex-wrap gap-2 text-xs text-[var(--el-text-color-secondary)]"
      >
        <span>总行数：{{ bindingSummary.total }}</span>
        <span>有效绑定：{{ bindingSummary.valid }}</span>
        <span>空白行：{{ bindingSummary.empty }}</span>
      </div>

      <div class="space-y-3">
        <div
          v-for="(item, index) in viewer3dBindings"
          :key="item.id"
          class="rounded border border-[var(--el-border-color)] p-3"
        >
          <div class="mb-3 flex items-center justify-between gap-2">
            <div class="font-medium">绑定 {{ index + 1 }}</div>
            <el-button size="small" link @click="removeBinding(index)">
              删除
            </el-button>
          </div>

          <el-form label-width="110px">
            <el-form-item label="KKS">
              <el-input v-model="item.kks" placeholder="例如：10LAC10AP001" />
            </el-form-item>
            <el-form-item label="系统节点">
              <el-select
                v-model="item.nodeId"
                clearable
                filterable
                placeholder="选择所属系统节点"
                class="w-full"
              >
                <el-option
                  v-for="option in nodeOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="关键词匹配">
              <el-input
                v-model="item.matchAnyText"
                type="textarea"
                :rows="2"
                placeholder="多个关键词用逗号或换行分隔，例如：10lac10ap001, 主给水泵A, feedpumpa"
              />
            </el-form-item>
            <el-form-item label="名称匹配">
              <el-input
                v-model="item.matchName"
                placeholder="可选：对对象名称做精确/包含匹配"
              />
            </el-form-item>
            <el-form-item label="路径匹配">
              <el-input
                v-model="item.matchPath"
                placeholder="可选：对对象层级路径做匹配"
              />
            </el-form-item>
            <el-form-item label="正则匹配">
              <el-input
                v-model="item.matchRegex"
                placeholder="可选：例如 ^PUMP_A_|10LAC10AP001"
              />
            </el-form-item>
          </el-form>
        </div>
      </div>
    </el-card>

    <el-space wrap>
      <el-button type="primary" @click="saveToStorage">保存配置</el-button>
      <el-button @click="resetToDefault">恢复默认</el-button>
    </el-space>
    <div class="text-xs text-[var(--el-text-color-secondary)] mt-3">
      注：配置保存到浏览器 localStorage，用于原型演示；支持导入导出
      JSON，后续可接入后端持久化。
    </div>
  </div>
</template>
