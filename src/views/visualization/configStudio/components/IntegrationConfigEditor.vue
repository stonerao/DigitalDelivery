<script setup>
defineOptions({
  name: "IntegrationConfigEditor"
});

const props = defineProps({
  realtime: {
    type: Object,
    default: () => ({})
  },
  backendBridge: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(["update:realtime", "update:backend-bridge"]);

function clonePayload(payload) {
  return JSON.parse(JSON.stringify(payload || {}));
}

function stringifyObject(value) {
  return JSON.stringify(value || {}, null, 2);
}

function stringifyArray(value) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function parseObject(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

function parseArray(value) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function patchRealtime(patch) {
  emit("update:realtime", {
    ...clonePayload(props.realtime),
    ...patch
  });
}

function patchBackendBridge(patch) {
  emit("update:backend-bridge", {
    ...clonePayload(props.backendBridge),
    ...patch
  });
}

function createPoint() {
  return {
    id: `point-${Date.now()}`,
    key: `point-key-${Date.now()}`,
    type: "measurement",
    unit: "",
    mode: "random",
    min: 0,
    max: 100,
    fixed: 2,
    warningThreshold: 80,
    values: []
  };
}

function addPoint() {
  const next = clonePayload(props.realtime);
  next.points = Array.isArray(next.points) ? next.points : [];
  next.points.push(createPoint());
  emit("update:realtime", next);
}

function patchPoint(index, patch) {
  const next = clonePayload(props.realtime);
  next.points = Array.isArray(next.points) ? next.points : [];
  next.points[index] = {
    ...(next.points[index] || {}),
    ...patch
  };
  emit("update:realtime", next);
}

function removePoint(index) {
  const next = clonePayload(props.realtime);
  next.points = Array.isArray(next.points) ? next.points : [];
  next.points.splice(index, 1);
  emit("update:realtime", next);
}
</script>

<template>
  <div class="space-y-4">
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <span class="font-semibold">RealtimeDataAdapter</span>
          <el-switch
            :model-value="realtime.enabled !== false"
            active-text="启用"
            inactive-text="停用"
            @update:model-value="patchRealtime({ enabled: $event })"
          />
        </div>
      </template>

      <el-form
        label-width="110px"
        class="grid grid-cols-1 gap-x-4 lg:grid-cols-2"
      >
        <el-form-item label="协议">
          <el-select
            :model-value="realtime.transport || 'mock'"
            @update:model-value="patchRealtime({ transport: $event })"
          >
            <el-option label="Mock" value="mock" />
            <el-option label="HTTP Polling" value="http" />
          </el-select>
        </el-form-item>
        <el-form-item label="轮询间隔(ms)">
          <el-input-number
            :model-value="Number(realtime.interval || 3000)"
            :min="500"
            :step="500"
            @update:model-value="patchRealtime({ interval: $event })"
          />
        </el-form-item>
        <el-form-item label="URL" class="lg:col-span-2">
          <el-input
            :model-value="realtime.url"
            @update:model-value="patchRealtime({ url: $event })"
          />
        </el-form-item>
        <el-form-item label="Headers" class="lg:col-span-2">
          <el-input
            type="textarea"
            :rows="4"
            :model-value="stringifyObject(realtime.headers)"
            @update:model-value="
              patchRealtime({ headers: parseObject($event) })
            "
          />
        </el-form-item>
      </el-form>

      <div class="mb-3 mt-2 flex items-center justify-between gap-2">
        <span class="font-medium text-sm">实时点位</span>
        <el-button size="small" link @click="addPoint">新增点位</el-button>
      </div>

      <div v-if="realtime.points?.length" class="space-y-3">
        <div
          v-for="(point, pointIndex) in realtime.points"
          :key="point.id || pointIndex"
          class="rounded border border-[var(--el-border-color)] p-3"
        >
          <div class="mb-3 flex items-center justify-between gap-2">
            <span class="font-medium">{{ point.key || point.id }}</span>
            <el-button
              size="small"
              type="danger"
              link
              @click="removePoint(pointIndex)"
            >
              删除
            </el-button>
          </div>

          <el-form
            label-width="96px"
            class="grid grid-cols-1 gap-x-4 lg:grid-cols-2"
          >
            <el-form-item label="ID">
              <el-input
                :model-value="point.id"
                @update:model-value="patchPoint(pointIndex, { id: $event })"
              />
            </el-form-item>
            <el-form-item label="Key">
              <el-input
                :model-value="point.key"
                @update:model-value="patchPoint(pointIndex, { key: $event })"
              />
            </el-form-item>
            <el-form-item label="类型">
              <el-select
                :model-value="point.type || 'measurement'"
                @update:model-value="patchPoint(pointIndex, { type: $event })"
              >
                <el-option label="Measurement" value="measurement" />
                <el-option label="Device Status" value="device-status" />
              </el-select>
            </el-form-item>
            <el-form-item label="模式">
              <el-select
                :model-value="point.mode || 'random'"
                @update:model-value="patchPoint(pointIndex, { mode: $event })"
              >
                <el-option label="Random" value="random" />
                <el-option label="Toggle" value="toggle" />
                <el-option label="Sequence" value="sequence" />
              </el-select>
            </el-form-item>
            <el-form-item label="单位">
              <el-input
                :model-value="point.unit"
                @update:model-value="patchPoint(pointIndex, { unit: $event })"
              />
            </el-form-item>
            <el-form-item label="KKS">
              <el-input
                :model-value="point.kks"
                @update:model-value="patchPoint(pointIndex, { kks: $event })"
              />
            </el-form-item>
            <el-form-item label="目标 UUID">
              <el-input
                :model-value="point.targetUuid"
                @update:model-value="
                  patchPoint(pointIndex, { targetUuid: $event })
                "
              />
            </el-form-item>
            <el-form-item label="阈值">
              <el-input-number
                :model-value="Number(point.warningThreshold || 0)"
                :step="1"
                @update:model-value="
                  patchPoint(pointIndex, { warningThreshold: $event })
                "
              />
            </el-form-item>
            <el-form-item label="最小值">
              <el-input-number
                :model-value="Number(point.min || 0)"
                :step="1"
                @update:model-value="patchPoint(pointIndex, { min: $event })"
              />
            </el-form-item>
            <el-form-item label="最大值">
              <el-input-number
                :model-value="Number(point.max || 100)"
                :step="1"
                @update:model-value="patchPoint(pointIndex, { max: $event })"
              />
            </el-form-item>
            <el-form-item label="小数位">
              <el-input-number
                :model-value="Number(point.fixed || 2)"
                :min="0"
                :max="6"
                @update:model-value="patchPoint(pointIndex, { fixed: $event })"
              />
            </el-form-item>
            <el-form-item label="序列值" class="lg:col-span-2">
              <el-input
                :model-value="stringifyArray(point.values)"
                placeholder="使用逗号分隔"
                @update:model-value="
                  patchPoint(pointIndex, { values: parseArray($event) })
                "
              />
            </el-form-item>
          </el-form>
        </div>
      </div>
      <el-empty v-else description="还没有配置实时点位" :image-size="88" />
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <span class="font-semibold">BackendBridge</span>
          <el-switch
            :model-value="backendBridge.enabled !== false"
            active-text="启用"
            inactive-text="停用"
            @update:model-value="patchBackendBridge({ enabled: $event })"
          />
        </div>
      </template>

      <el-form
        label-width="110px"
        class="grid grid-cols-1 gap-x-4 lg:grid-cols-2"
      >
        <el-form-item label="协议">
          <el-select
            :model-value="backendBridge.transport || 'mock'"
            @update:model-value="patchBackendBridge({ transport: $event })"
          >
            <el-option label="Mock" value="mock" />
            <el-option label="HTTP" value="http" />
          </el-select>
        </el-form-item>
        <el-form-item label="Mock Delay(ms)">
          <el-input-number
            :model-value="Number(backendBridge.mockDelay || 300)"
            :min="0"
            :step="100"
            @update:model-value="patchBackendBridge({ mockDelay: $event })"
          />
        </el-form-item>
        <el-form-item label="Endpoint" class="lg:col-span-2">
          <el-input
            :model-value="backendBridge.endpoint"
            @update:model-value="patchBackendBridge({ endpoint: $event })"
          />
        </el-form-item>
        <el-form-item label="Headers" class="lg:col-span-2">
          <el-input
            type="textarea"
            :rows="4"
            :model-value="stringifyObject(backendBridge.headers)"
            @update:model-value="
              patchBackendBridge({ headers: parseObject($event) })
            "
          />
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>
