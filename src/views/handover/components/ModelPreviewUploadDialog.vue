<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { message } from "@/utils/message";
import UploadModelPreviewScene from "./upload-preview/UploadModelPreviewScene.vue";

defineOptions({ name: "ModelPreviewUploadDialog" });

const props = defineProps({
  modelValue: { type: Boolean, default: false }
});

const emit = defineEmits(["update:modelValue", "confirm"]);

const visible = computed({
  get: () => props.modelValue,
  set: v => emit("update:modelValue", v)
});

// 步骤：select -> preview -> uploading
const step = ref("select");
const selectedFile = ref(null);
const previewUrl = ref("");
const viewerRef = ref(null);
const thumbnailBlob = ref(null);
const thumbnailPreview = ref("");
const uploading = ref(false);

const ACCEPTED_EXTENSIONS = [".gltf", ".glb", ".ifc", ".obj"];

function resetState() {
  step.value = "select";
  selectedFile.value = null;
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
  previewUrl.value = "";
  thumbnailBlob.value = null;
  if (thumbnailPreview.value) {
    URL.revokeObjectURL(thumbnailPreview.value);
  }
  thumbnailPreview.value = "";
  uploading.value = false;
}

function handleFileChange(uploadFile) {
  if (!uploadFile?.raw) return;
  const file = uploadFile.raw;
  const name = file.name?.toLowerCase() || "";
  const valid = ACCEPTED_EXTENSIONS.some(ext => name.endsWith(ext));
  if (!valid) {
    message("仅支持 .gltf / .glb / .ifc / .obj 格式的模型文件", {
      type: "warning"
    });
    return;
  }
  selectedFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
  step.value = "preview";
}

function backToSelect() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
  previewUrl.value = "";
  selectedFile.value = null;
  thumbnailBlob.value = null;
  if (thumbnailPreview.value) {
    URL.revokeObjectURL(thumbnailPreview.value);
  }
  thumbnailPreview.value = "";
  step.value = "select";
}

function captureThumbnail() {
  const viewer = viewerRef.value;
  if (!viewer) {
    throw new Error("查看器未就绪");
  }
  const dataUrl = viewer.captureScreenshot({
    width: 400,
    height: 400,
    format: "image/jpeg",
    quality: 0.9,
    backgroundColor: "#f5f5f5"
  });
  if (!dataUrl) {
    throw new Error("截图失败");
  }

  // 将 dataURL 转为 Blob
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  const blob = new Blob([u8arr], { type: mime });
  thumbnailBlob.value = blob;
  if (thumbnailPreview.value) {
    URL.revokeObjectURL(thumbnailPreview.value);
  }
  thumbnailPreview.value = URL.createObjectURL(blob);
}

async function confirmUpload() {
  if (!selectedFile.value) return;

  if (uploading.value) return;
  uploading.value = true;

  try {
    await nextTick();
    captureThumbnail();
    emit("confirm", {
      file: selectedFile.value,
      thumbnail: thumbnailBlob.value
    });
    visible.value = false;
    resetState();
  } catch (e) {
    console.error("auto capture thumbnail failed", e);
    message(e?.message || "自动生成缩略图失败", { type: "error" });
  } finally {
    uploading.value = false;
  }
}

function handleClose() {
  visible.value = false;
  resetState();
}

watch(
  () => props.modelValue,
  v => {
    if (!v) resetState();
  }
);

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  if (thumbnailPreview.value) URL.revokeObjectURL(thumbnailPreview.value);
});
</script>

<template>
  <el-dialog
    v-model="visible"
    title="上传模型"
    width="800px"
    :close-on-click-modal="false"
    :before-close="() => handleClose()"
    destroy-on-close
  >
    <!-- 步骤一：选择文件 -->
    <div v-if="step === 'select'">
      <el-upload
        drag
        :auto-upload="false"
        :show-file-list="false"
        accept=".gltf,.glb,.ifc,.obj"
        :on-change="handleFileChange"
      >
        <div class="el-upload__text">
          拖放模型文件到此处或点击选择
          <div class="text-xs text-[var(--el-text-color-secondary)] mt-2">
            支持 .gltf / .glb / .ifc / .obj 格式
          </div>
        </div>
      </el-upload>
    </div>

    <!-- 步骤二：预览 -->
    <div v-if="step === 'preview'">
      <div class="mb-3 text-sm text-[var(--el-text-color-secondary)]">
        文件：{{ selectedFile?.name }}
      </div>

      <div class="model-preview-container">
        <UploadModelPreviewScene
          ref="viewerRef"
          :model-url="previewUrl"
          :model-name="selectedFile?.name || ''"
          style="width: 100%; height: 100%"
          @error="() => message('模型加载失败', { type: 'error' })"
        />
      </div>

      <div class="mt-4 flex items-start gap-4">
        <div v-if="thumbnailPreview" class="thumbnail-preview">
          <img :src="thumbnailPreview" alt="缩略图预览" />
        </div>
      </div>
    </div>

    <template #footer>
      <template v-if="step === 'select'">
        <el-button @click="handleClose">取消</el-button>
      </template>
      <template v-if="step === 'preview'">
        <el-button :disabled="uploading" @click="backToSelect"
          >重新选择</el-button
        >
        <el-button type="primary" :loading="uploading" @click="confirmUpload">
          确认上传
        </el-button>
      </template>
    </template>
  </el-dialog>
</template>

<style scoped>
.model-preview-container {
  width: 100%;
  height: 420px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  overflow: hidden;
  background: var(--el-fill-color-light);
}

.thumbnail-preview {
  width: 80px;
  height: 80px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.thumbnail-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
