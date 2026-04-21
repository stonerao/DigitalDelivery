<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  activeCameraDetail: {
    type: Object,
    default: null
  },
  videoLoading: {
    type: Boolean,
    default: false
  },
  videoPreviewSupported: {
    type: Boolean,
    default: false
  },
  videoErrorText: {
    type: String,
    default: ""
  }
});

const emit = defineEmits(["update:modelValue", "closed", "video-ref-change"]);
const videoElementRef = ref(null);

watch(
  videoElementRef,
  value => {
    emit("video-ref-change", value || null);
  },
  { immediate: true }
);
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="视频接入"
    width="640px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
    @closed="emit('closed')"
  >
    <div v-if="activeCameraDetail" class="space-y-4">
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="摄像头名称">
          {{ activeCameraDetail.cameraName || activeCameraDetail.name }}
        </el-descriptions-item>
        <el-descriptions-item label="摄像头类型">
          {{ activeCameraDetail.cameraType || "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="流类型">
          {{ activeCameraDetail.streamType || "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="接入状态">
          {{ activeCameraDetail.status || "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="绑定设备">
          {{ activeCameraDetail.bindDeviceKks || "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="打开方式">
          {{ activeCameraDetail.defaultWindowMode || "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="接入地址" :span="2">
          <span class="break-all">{{
            activeCameraDetail.streamUrl || "-"
          }}</span>
        </el-descriptions-item>
      </el-descriptions>

      <div
        v-loading="videoLoading"
        class="flex min-h-[260px] items-center justify-center rounded border border-[var(--el-border-color)] bg-[var(--el-fill-color-light)]"
      >
        <video
          v-if="videoPreviewSupported"
          ref="videoElementRef"
          controls
          playsinline
          class="max-h-[320px] w-full rounded"
        />
        <div
          v-else
          class="px-6 text-center text-sm text-[var(--el-text-color-secondary)]"
        >
          当前流类型暂不支持直接播放，可查看接入信息后切换到兼容播放器。
        </div>
      </div>
      <el-alert
        v-if="videoErrorText"
        :title="videoErrorText"
        type="error"
        :closable="false"
      />
    </div>
  </el-dialog>
</template>
