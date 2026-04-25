<script setup>
import { computed } from "vue";

defineOptions({
  name: "ObjectInfoPanel"
});

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  selectedObjectInfo: {
    type: Object,
    default: null
  },
  selectedSceneDevice: {
    type: Object,
    default: null
  },
  selectedDeviceProfile: {
    type: Object,
    default: null
  },
  selectedKksDetail: {
    type: Object,
    default: null
  },
  selectedKksDetailLoading: {
    type: Boolean,
    default: false
  },
  selectedKksDetailError: {
    type: String,
    default: ""
  },
  currentMeasurementPoints: {
    type: Array,
    default: () => []
  },
  pointMarkersVisible: {
    type: Boolean,
    default: true
  },
  selectedBoundDocuments: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits([
  "close",
  "update:pointMarkersVisible",
  "document-detail",
  "document-preview",
  "document-download"
]);

const hasDeviceLedger = computed(() => {
  const profile = props.selectedDeviceProfile;
  if (!profile) return false;
  return [
    profile.ledgerNo,
    profile.manufacturer,
    profile.model,
    profile.ratedPower,
    profile.ratedVoltage,
    profile.medium,
    profile.functionDesc,
    profile.updatedAt
  ].some(Boolean);
});

const hasDeviceStructure = computed(
  () =>
    Array.isArray(props.selectedDeviceProfile?.structureParams) &&
    props.selectedDeviceProfile.structureParams.length > 0
);

const hasDeviceRunning = computed(
  () =>
    Array.isArray(props.selectedDeviceProfile?.runningParams) &&
    props.selectedDeviceProfile.runningParams.length > 0
);
</script>

<template>
  <div v-show="visible" class="dd-object-panel">
    <el-card shadow="never" class="h-full">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="font-semibold text-sm">构件属性</span>
          <el-button size="small" link @click="emit('close')">关闭</el-button>
        </div>
      </template>

      <div v-if="selectedObjectInfo" class="space-y-4">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="名称">
            {{ selectedObjectInfo.name }}
          </el-descriptions-item>
          <el-descriptions-item label="KKS">
            {{ selectedSceneDevice?.kks || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="所属系统">
            {{
              selectedKksDetail?.systemName ||
              selectedKksDetail?.systemNodeLabel ||
              selectedKksDetail?.systemNodeName ||
              selectedKksDetail?.systemNodeId ||
              "-"
            }}
          </el-descriptions-item>
          <el-descriptions-item label="类型">
            {{ selectedObjectInfo.type }}
          </el-descriptions-item>
          <el-descriptions-item label="UUID">
            <span class="text-xs font-mono">
              {{ selectedObjectInfo.uuid?.slice(0, 8) }}...
            </span>
          </el-descriptions-item>
        </el-descriptions>

        <el-card v-if="selectedObjectInfo.geometry" shadow="never">
          <template #header>
            <span class="text-sm font-semibold">几何信息</span>
          </template>
          <el-descriptions :column="1" size="small">
            <el-descriptions-item label="顶点数">
              {{ selectedObjectInfo.geometry.vertices?.toLocaleString() }}
            </el-descriptions-item>
            <el-descriptions-item label="面数">
              {{ selectedObjectInfo.geometry.faces?.toLocaleString() }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card v-if="selectedObjectInfo.boundingBox" shadow="never">
          <template #header>
            <span class="text-sm font-semibold">边界框</span>
          </template>
          <el-descriptions :column="1" size="small">
            <el-descriptions-item label="尺寸">
              {{
                selectedObjectInfo.boundingBox.size
                  .map(value => value.toFixed(2))
                  .join(" × ")
              }}
            </el-descriptions-item>
            <el-descriptions-item label="中心">
              {{
                selectedObjectInfo.boundingBox.center
                  .map(value => value.toFixed(2))
                  .join(", ")
              }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card
          v-if="
            selectedObjectInfo.userData &&
            Object.keys(selectedObjectInfo.userData).length > 0
          "
          shadow="never"
        >
          <template #header>
            <span class="text-sm font-semibold">自定义属性</span>
          </template>
          <el-descriptions :column="1" size="small">
            <el-descriptions-item
              v-for="(val, key) in selectedObjectInfo.userData"
              :key="key"
              :label="key"
            >
              {{ typeof val === "object" ? JSON.stringify(val) : val }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <span class="text-sm font-semibold">业务属性</span>
          </template>
          <div v-loading="selectedKksDetailLoading">
            <el-descriptions
              v-if="selectedKksDetail"
              :column="1"
              size="small"
              border
            >
              <el-descriptions-item label="KKS编码">
                {{ selectedKksDetail.kks || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="名称">
                {{ selectedKksDetail.name || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="类型">
                {{ selectedKksDetail.type || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="状态">
                {{ selectedKksDetail.status || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="分类">
                {{ selectedKksDetail.category || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="系统节点ID">
                {{ selectedKksDetail.systemNodeId || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="所属系统">
                {{
                  selectedKksDetail.systemName ||
                  selectedKksDetail.systemNodeLabel ||
                  selectedKksDetail.systemNodeName ||
                  "-"
                }}
              </el-descriptions-item>
              <el-descriptions-item label="创建时间">
                {{ selectedKksDetail.createdAt || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="更新时间">
                {{ selectedKksDetail.updatedAt || "-" }}
              </el-descriptions-item>
            </el-descriptions>
            <div v-else class="text-sm text-[var(--el-text-color-secondary)]">
              {{ selectedKksDetailError || "当前构件未绑定 KKS 业务数据。" }}
            </div>
          </div>
        </el-card>

        <el-card v-if="hasDeviceLedger" shadow="never">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-semibold">设备台账</span>
              <el-tag
                v-if="selectedDeviceProfile?.dataSourceLabel"
                size="small"
                effect="plain"
              >
                {{ selectedDeviceProfile.dataSourceLabel }}
              </el-tag>
            </div>
          </template>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="设备台账号">
              {{ selectedDeviceProfile?.ledgerNo || "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="制造厂家">
              {{ selectedDeviceProfile?.manufacturer || "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="设备型号">
              {{ selectedDeviceProfile?.model || "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="额定功率">
              {{ selectedDeviceProfile?.ratedPower || "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="额定电压">
              {{ selectedDeviceProfile?.ratedVoltage || "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="介质">
              {{ selectedDeviceProfile?.medium || "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="功能说明">
              {{ selectedDeviceProfile?.functionDesc || "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="更新时间">
              {{ selectedDeviceProfile?.updatedAt || "-" }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card v-if="hasDeviceStructure" shadow="never">
          <template #header>
            <span class="text-sm font-semibold">结构参数</span>
          </template>
          <el-descriptions :column="1" size="small">
            <el-descriptions-item
              v-for="item in selectedDeviceProfile.structureParams"
              :key="item.label"
              :label="item.label"
            >
              {{ item.value || "-" }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card v-if="hasDeviceRunning" shadow="never">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-semibold">运行参数</span>
              <el-tag
                v-if="selectedDeviceProfile?.runningSourceLabel"
                size="small"
                type="success"
                effect="plain"
              >
                {{ selectedDeviceProfile.runningSourceLabel }}
              </el-tag>
            </div>
          </template>
          <div class="space-y-2">
            <div
              v-for="item in selectedDeviceProfile.runningParams"
              :key="item.label"
              class="flex items-center justify-between rounded bg-[var(--el-fill-color-light)] px-3 py-2"
            >
              <div class="text-sm">{{ item.label }}</div>
              <div class="flex items-center gap-2">
                <span class="font-semibold">
                  {{ item.value }}{{ item.unit }}
                </span>
                <el-tag
                  size="small"
                  :type="
                    item.status === 'warning'
                      ? 'warning'
                      : item.status === 'alarm'
                        ? 'danger'
                        : 'success'
                  "
                >
                  {{
                    item.status === "warning"
                      ? "预警"
                      : item.status === "alarm"
                        ? "告警"
                        : "正常"
                  }}
                </el-tag>
              </div>
            </div>
          </div>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <span class="text-sm font-semibold">绑定文件</span>
          </template>
          <div
            v-if="selectedBoundDocuments.length"
            class="text-xs text-[var(--el-text-color-secondary)]"
          >
            当前构件已绑定 {{ selectedBoundDocuments.length }} 个文件。
          </div>
          <div v-else class="text-sm text-[var(--el-text-color-secondary)]">
            当前构件未绑定文件。
          </div>
          <el-table
            v-if="selectedBoundDocuments.length"
            :data="selectedBoundDocuments"
            size="small"
            stripe
            class="mt-3"
          >
            <el-table-column
              prop="name"
              label="文档名称"
              min-width="180"
              show-overflow-tooltip
            />
            <el-table-column prop="type" label="类型" width="100" />
            <el-table-column
              prop="updatedAt"
              label="更新时间"
              min-width="140"
              show-overflow-tooltip
            />
            <el-table-column label="操作" width="138" fixed="right">
              <template #default="scope">
                <el-button
                  size="small"
                  link
                  type="primary"
                  @click="emit('document-preview', scope.row)"
                >
                  预览
                </el-button>
                <el-button
                  size="small"
                  link
                  @click="emit('document-detail', scope.row)"
                >
                  详情
                </el-button>
                <el-button
                  size="small"
                  link
                  @click="emit('document-download', scope.row)"
                >
                  下载
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-semibold">测点关联</span>
              <el-switch
                :model-value="pointMarkersVisible"
                @update:model-value="emit('update:pointMarkersVisible', $event)"
              />
            </div>
          </template>
          <div class="mb-3 text-xs text-[var(--el-text-color-secondary)]">
            已关联
            {{ currentMeasurementPoints.length }}
            个测点，支持在场景中显示/关闭。
          </div>
          <el-table :data="currentMeasurementPoints" size="small" stripe>
            <el-table-column prop="tag" label="测点" min-width="92" />
            <el-table-column prop="name" label="名称" min-width="120" />
            <el-table-column label="当前值" min-width="100">
              <template #default="scope">
                {{ scope.row.value }}{{ scope.row.unit }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80">
              <template #default="scope">
                <el-tag
                  size="small"
                  :type="
                    scope.row.status === 'warning'
                      ? 'warning'
                      : scope.row.status === 'alarm'
                        ? 'danger'
                        : 'success'
                  "
                >
                  {{
                    scope.row.status === "warning"
                      ? "预警"
                      : scope.row.status === "alarm"
                        ? "告警"
                        : "正常"
                  }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
      <div v-else class="py-10 text-center text-gray-400">
        请在场景中选择一个构件
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.dd-object-panel {
  position: fixed;
  bottom: var(--dd-bottom-reserve);
  left: var(--dd-gap);
  z-index: 1200;
  width: var(--dd-panel-width);
  max-height: 58vh;
  overflow: auto;
  box-shadow: var(--el-box-shadow-light);
}
</style>
