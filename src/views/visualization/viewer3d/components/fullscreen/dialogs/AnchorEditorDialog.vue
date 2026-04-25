<script setup>
import { computed } from "vue";

const visible = defineModel("visible", {
  type: Boolean,
  default: false
});

const formModel = defineModel("form", {
  type: Object,
  default: () => ({})
});

const props = defineProps({
  minimized: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ""
  },
  kind: {
    type: String,
    default: "anchor"
  },
  sceneObjectOptions: {
    type: Array,
    default: () => []
  },
  deviceKksOptions: {
    type: Array,
    default: () => []
  },
  anchorMeasurementOptions: {
    type: Array,
    default: () => []
  },
  cameraTypeOptions: {
    type: Array,
    default: () => []
  },
  sceneAnchorTypeOptions: {
    type: Array,
    default: () => []
  },
  cameraStreamTypeOptions: {
    type: Array,
    default: () => []
  },
  cameraWindowModeOptions: {
    type: Array,
    default: () => []
  },
  anchorBindingTypeOptions: {
    type: Array,
    default: () => []
  },
  anchorIconOptions: {
    type: Array,
    default: () => []
  },
  cameraIconOptions: {
    type: Array,
    default: () => []
  },
  positionPickingActive: {
    type: Boolean,
    default: false
  },
  pickedPositionText: {
    type: String,
    default: ""
  }
});

const emit = defineEmits([
  "closed",
  "start-position-picking",
  "submit",
  "confirm-picked-position",
  "cancel-position-picking"
]);

const currentIconOptions = computed(() =>
  props.kind === "camera" ? props.cameraIconOptions : props.anchorIconOptions
);

function ensureFormStyle() {
  if (!formModel.value.style || typeof formModel.value.style !== "object") {
    formModel.value.style = {};
  }
  return formModel.value.style;
}

const selectedIcon = computed(() => {
  const style = formModel.value?.style || {};
  const iconKey = style.iconKey || "";
  const iconUrl = style.iconUrl || "";
  const matched = currentIconOptions.value.find(
    item =>
      (iconKey && item.key === iconKey) || (iconUrl && item.url === iconUrl)
  );
  if (matched) return matched;
  if (iconUrl) {
    return {
      key: "",
      label: style.iconLabel || "自定义图标",
      url: iconUrl
    };
  }
  return null;
});

const selectedIconKey = computed({
  get() {
    return selectedIcon.value?.key || "";
  },
  set(value) {
    const style = ensureFormStyle();
    const icon = currentIconOptions.value.find(item => item.key === value);
    if (!icon) {
      style.iconKey = "";
      style.iconUrl = "";
      style.iconLabel = "";
      return;
    }
    style.iconKey = icon.key;
    style.iconUrl = icon.url;
    style.iconLabel = icon.label;
  }
});
</script>

<template>
  <el-dialog
    v-if="visible && !minimized"
    :model-value="visible"
    :title="title"
    width="560px"
    :close-on-click-modal="true"
    class="dd-anchor-dialog"
    destroy-on-close
    @update:model-value="visible = $event"
    @closed="emit('closed')"
  >
    <el-form label-width="108px" class="pr-4">
      <el-form-item :label="kind === 'camera' ? '名称' : '点位名称'">
        <el-input
          v-model="formModel.name"
          :placeholder="kind === 'camera' ? '摄像头点位名称' : '请输入点位名称'"
        />
      </el-form-item>
      <el-form-item label="编码">
        <el-input v-model="formModel.code" placeholder="可选编码" />
      </el-form-item>
      <template v-if="kind === 'camera'">
        <el-form-item label="摄像头类型">
          <el-select v-model="formModel.cameraType" class="w-full">
            <el-option
              v-for="item in cameraTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="摄像头编码">
          <el-input v-model="formModel.cameraCode" placeholder="摄像头编码" />
        </el-form-item>
      </template>
      <template v-else>
        <el-form-item label="点位类型">
          <el-select v-model="formModel.type" class="w-full">
            <el-option
              v-for="item in sceneAnchorTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </template>

      <el-form-item label="图标">
        <div class="dd-icon-picker">
          <el-select
            v-model="selectedIconKey"
            class="dd-icon-picker__select"
            filterable
            placeholder="默认图标"
          >
            <el-option label="默认图标" value="">
              <div class="dd-icon-option">
                <span class="dd-icon-option__empty">默认</span>
                <span>默认图标</span>
              </div>
            </el-option>
            <el-option
              v-for="item in currentIconOptions"
              :key="item.key"
              :label="item.label"
              :value="item.key"
            >
              <div class="dd-icon-option">
                <img :src="item.url" :alt="item.label" />
                <span>{{ item.label }}</span>
              </div>
            </el-option>
          </el-select>
          <div
            class="dd-icon-picker__preview"
            :class="{ 'is-empty': !selectedIcon }"
          >
            <img
              v-if="selectedIcon"
              :src="selectedIcon.url"
              :alt="selectedIcon.label"
            />
            <span v-else>默认</span>
          </div>
        </div>
      </el-form-item>

      <el-form-item label="定位方式">
        <el-radio-group v-model="formModel.anchorMode">
          <el-radio label="object">绑定构件</el-radio>
          <el-radio label="world">世界坐标</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item v-if="formModel.anchorMode === 'object'" label="绑定构件">
        <el-select v-model="formModel.objectUuid" class="w-full" filterable>
          <el-option
            v-for="item in sceneObjectOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item v-else label="世界坐标">
        <div class="w-full space-y-2">
          <div class="grid grid-cols-3 gap-2">
            <el-input-number
              v-model="formModel.worldPosition[0]"
              :step="0.1"
              controls-position="right"
            />
            <el-input-number
              v-model="formModel.worldPosition[1]"
              :step="0.1"
              controls-position="right"
            />
            <el-input-number
              v-model="formModel.worldPosition[2]"
              :step="0.1"
              controls-position="right"
            />
          </div>
          <div class="flex flex-wrap gap-2">
            <el-button size="small" @click="emit('start-position-picking')">
              {{ positionPickingActive ? "继续拾取" : "模型拾取" }}
            </el-button>
            <span class="text-xs text-[var(--el-text-color-secondary)]">
              未知坐标时可点击模型表面取点
            </span>
          </div>
        </div>
      </el-form-item>

      <el-form-item v-if="kind !== 'camera'" label="显示偏移">
        <div class="grid w-full grid-cols-3 gap-2">
          <el-input-number
            v-model="formModel.offset[0]"
            :step="0.05"
            controls-position="right"
          />
          <el-input-number
            v-model="formModel.offset[1]"
            :step="0.05"
            controls-position="right"
          />
          <el-input-number
            v-model="formModel.offset[2]"
            :step="0.05"
            controls-position="right"
          />
        </div>
      </el-form-item>

      <template v-if="kind === 'camera'">
        <el-form-item label="绑定设备">
          <el-select
            v-model="formModel.bindDeviceKks"
            class="w-full"
            clearable
            filterable
          >
            <el-option
              v-for="item in deviceKksOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="流类型">
          <el-select v-model="formModel.streamType" class="w-full">
            <el-option
              v-for="item in cameraStreamTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="接入地址">
          <el-input
            v-model="formModel.streamUrl"
            placeholder="请输入视频流地址"
          />
        </el-form-item>
        <el-form-item label="打开方式">
          <el-select v-model="formModel.defaultWindowMode" class="w-full">
            <el-option
              v-for="item in cameraWindowModeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </template>

      <template v-else>
        <el-form-item label="绑定类型">
          <el-select
            v-model="formModel.businessBinding.bindingType"
            class="w-full"
          >
            <el-option
              v-for="item in anchorBindingTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="formModel.businessBinding.bindingType !== 'custom'"
          label="绑定设备"
        >
          <el-select
            v-model="formModel.businessBinding.kks"
            class="w-full"
            clearable
            filterable
          >
            <el-option
              v-for="item in deviceKksOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="formModel.businessBinding.bindingType === 'measurement'"
          label="绑定测点"
        >
          <el-select
            v-model="formModel.businessBinding.tag"
            class="w-full"
            clearable
            filterable
          >
            <el-option
              v-for="item in anchorMeasurementOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="formModel.businessBinding.bindingType === 'custom'"
          label="显示文本"
        >
          <el-input
            v-model="formModel.payload.displayText"
            placeholder="自定义显示文本"
          />
        </el-form-item>
        <el-form-item
          v-if="formModel.businessBinding.bindingType === 'custom'"
          label="数值"
        >
          <div class="grid w-full grid-cols-[minmax(0,1fr)_120px] gap-2">
            <el-input v-model="formModel.payload.value" placeholder="值" />
            <el-input v-model="formModel.payload.unit" placeholder="单位" />
          </div>
        </el-form-item>
      </template>

      <el-form-item label="描述">
        <el-input
          v-model="formModel.description"
          type="textarea"
          :rows="3"
          placeholder="可选描述"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="emit('submit')">确定</el-button>
    </template>
  </el-dialog>

  <div v-if="visible && minimized" class="dd-anchor-picking-panel">
    <div class="text-sm text-[var(--el-text-color-secondary)]">
      {{ kind === "camera" ? "摄像头" : "点位" }}位置拾取中
    </div>
    <div
      class="rounded border border-[var(--el-border-color)] px-3 py-2 text-sm"
    >
      {{ pickedPositionText }}
    </div>
    <div class="flex flex-wrap gap-2">
      <el-button type="primary" @click="emit('confirm-picked-position')">
        确认位置
      </el-button>
      <el-button @click="emit('start-position-picking')">重新拾取</el-button>
      <el-button @click="emit('cancel-position-picking')">取消拾取</el-button>
    </div>
    <div class="text-xs text-[var(--el-text-color-secondary)]">
      点击模型表面拾取坐标，确认后会回填到世界坐标。
    </div>
  </div>
</template>

<style scoped>
.dd-anchor-picking-panel {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 3001;
  width: 360px;
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color-overlay);
  box-shadow: var(--el-box-shadow-light);
}

.dd-icon-picker {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 56px;
  gap: 10px;
  align-items: center;
  width: 100%;
}

.dd-icon-picker__select {
  width: 100%;
}

.dd-icon-picker__preview {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  overflow: hidden;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
}

.dd-icon-picker__preview img {
  max-width: 40px;
  max-height: 40px;
  object-fit: contain;
}

.dd-icon-picker__preview.is-empty {
  background: var(--el-fill-color-blank);
}

.dd-icon-option {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.dd-icon-option img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.dd-icon-option__empty {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}
</style>
