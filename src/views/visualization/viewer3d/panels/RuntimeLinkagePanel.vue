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
  <div class="flex h-full flex-col">
    <div class="mb-3 flex items-center justify-between gap-2">
      <span class="font-semibold text-sm">联动运行时</span>
      <div class="flex items-center gap-2">
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

    <div class="grid grid-cols-1 gap-3">
      <el-card shadow="never">
        <div class="text-xs text-[var(--el-text-color-secondary)]">
          Realtime
        </div>
        <div class="mt-1 text-sm">
          {{ realtimeState.running ? "运行中" : "未运行" }}
        </div>
        <div class="text-xs text-[var(--el-text-color-secondary)]">
          transport: {{ realtimeState.transport || "-" }} / tick:
          {{ realtimeState.tick ?? 0 }}
        </div>
      </el-card>

      <el-card shadow="never">
        <div class="text-xs text-[var(--el-text-color-secondary)]">
          ScriptEngine
        </div>
        <div class="mt-1 text-sm">
          {{ scriptState.running ? "运行中" : "未运行" }}
        </div>
        <div class="text-xs text-[var(--el-text-color-secondary)]">
          triggers: {{ scriptState.triggerCount ?? 0 }} / animations:
          {{ scriptState.animationCount ?? 0 }}
        </div>
      </el-card>

      <el-card shadow="never">
        <div class="text-xs text-[var(--el-text-color-secondary)]">
          BackendBridge
        </div>
        <div class="mt-1 text-sm">
          {{ backendState.running ? "运行中" : "未运行" }}
        </div>
        <div class="text-xs text-[var(--el-text-color-secondary)]">
          transport: {{ backendState.transport || "-" }}
        </div>
      </el-card>
    </div>

    <div class="mt-3 flex items-center justify-between gap-2">
      <span class="font-semibold text-sm">运行日志</span>
      <el-button size="small" link type="danger" @click="emit('clear-logs')">
        清空
      </el-button>
    </div>

    <el-scrollbar height="100%">
      <div v-if="runtimeLogs.length" class="space-y-2 pr-1">
        <div
          v-for="item in runtimeLogs"
          :key="item.timestamp + item.message"
          class="rounded border border-[var(--el-border-color)] px-3 py-2"
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
