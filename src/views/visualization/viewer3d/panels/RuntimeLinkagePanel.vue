<script setup>
defineOptions({
  name: "RuntimeLinkagePanel"
});

defineProps({
  realtimeState: {
    type: Object,
    default: () => ({})
  },
  scriptState: {
    type: Object,
    default: () => ({})
  },
  backendState: {
    type: Object,
    default: () => ({})
  },
  runtimeLogs: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits([
  "restart-realtime",
  "run-manual-trigger",
  "send-backend-command",
  "clear-logs"
]);
</script>

<template>
  <div class="dd-inspector-module">
    <div class="dd-inspector-module__head">
      <span class="dd-inspector-module__title">联动运行时</span>
      <div class="dd-inspector-module__actions">
        <el-button size="small" link @click="emit('restart-realtime')">
          重启实时
        </el-button>
        <el-button size="small" link @click="emit('run-manual-trigger')">
          手动触发
        </el-button>
        <el-button size="small" link @click="emit('send-backend-command')">
          后台命令
        </el-button>
      </div>
    </div>

    <div class="dd-runtime-grid">
      <section class="dd-runtime-card">
        <div class="dd-runtime-card__label">
          Realtime
        </div>
        <div class="dd-runtime-card__value">
          {{ realtimeState.running ? "运行中" : "未运行" }}
        </div>
        <div class="dd-runtime-card__meta">
          transport: {{ realtimeState.transport || "-" }} / tick:
          {{ realtimeState.tick ?? 0 }}
        </div>
      </section>

      <section class="dd-runtime-card">
        <div class="dd-runtime-card__label">
          ScriptEngine
        </div>
        <div class="dd-runtime-card__value">
          {{ scriptState.running ? "运行中" : "未运行" }}
        </div>
        <div class="dd-runtime-card__meta">
          triggers: {{ scriptState.triggerCount ?? 0 }} / animations:
          {{ scriptState.animationCount ?? 0 }}
        </div>
      </section>

      <section class="dd-runtime-card">
        <div class="dd-runtime-card__label">
          BackendBridge
        </div>
        <div class="dd-runtime-card__value">
          {{ backendState.running ? "运行中" : "未运行" }}
        </div>
        <div class="dd-runtime-card__meta">
          transport: {{ backendState.transport || "-" }}
        </div>
      </section>
    </div>

    <div class="dd-log-head">
      <span class="dd-inspector-module__title">运行日志</span>
      <button
        type="button"
        class="dd-text-action is-danger"
        @click="emit('clear-logs')"
      >
        清空
      </button>
    </div>

    <el-scrollbar height="100%">
      <div v-if="runtimeLogs.length" class="space-y-2 pr-1">
        <div
          v-for="item in runtimeLogs"
          :key="item.timestamp + item.message"
          class="dd-list-row rounded border border-[var(--el-border-color)] px-3 py-2"
        >
          <div class="text-xs text-[var(--el-text-color-secondary)]">
            {{ item.type }} /
            {{ new Date(item.timestamp).toLocaleTimeString() }}
          </div>
          <div class="text-sm">{{ item.message }}</div>
          <div
            v-if="item.payload"
            class="mt-1 whitespace-pre-wrap break-all text-xs text-[var(--el-text-color-secondary)]"
          >
            {{
              typeof item.payload === "string"
                ? item.payload
                : JSON.stringify(item.payload, null, 2)
            }}
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无运行日志" :image-size="88" />
    </el-scrollbar>
  </div>
</template>

<style scoped>
.dd-inspector-module {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.dd-inspector-module__head,
.dd-log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  margin-bottom: 12px;
}

.dd-inspector-module__title {
  font-size: 15px;
  font-weight: 760;
  color: #172033;
}

.dd-inspector-module__actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.dd-runtime-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.dd-runtime-card {
  padding: 12px;
  background: rgb(255 255 255 / 48%);
  border: 1px solid #e5edf7;
  border-radius: 10px;
}

.dd-runtime-card__label,
.dd-runtime-card__meta {
  font-size: 12px;
  color: #94a3b8;
}

.dd-runtime-card__value {
  margin-top: 4px;
  font-size: 14px;
  font-weight: 760;
  color: #172033;
}

.dd-log-head {
  padding-top: 14px;
  margin-top: 14px;
  border-top: 1px solid #e5edf7;
}

.dd-text-action {
  padding: 0;
  font-size: 13px;
  font-weight: 650;
  color: #64748b;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.dd-text-action:hover {
  color: #0b73ff;
}

.dd-text-action.is-danger:hover {
  color: #dc2626;
}

.dd-list-row {
  border-radius: 10px;
}
</style>
