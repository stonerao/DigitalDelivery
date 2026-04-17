<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { message } from "@/utils/message";

defineOptions({
  name: "UploadDialog"
});

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: "上传文件"
  },
  showTransferDepth: {
    type: Boolean,
    default: true
  },
  currentFolderLabel: {
    type: String,
    default: ""
  },
  nodeTreeData: {
    type: Array,
    default: () => []
  },
  kksOptions: {
    type: Array,
    default: () => []
  },
  showAssociations: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["update:modelValue", "uploaded"]);

const uploadRef = ref();
const uploadFiles = ref([]);
const transferDepth = ref("archive");
const uploading = ref(false);
const uploadProgress = ref(0);
const nodeIds = ref([]);
const kksRefs = ref([]);
let progressTimer;

const visible = computed({
  get() {
    return props.modelValue;
  },
  set(value) {
    emit("update:modelValue", value);
  }
});

const canClose = computed(() => !uploading.value);

function getTransferDepthLabel(value) {
  switch (value) {
    case "archive":
      return "存档级";
    case "browse":
      return "浏览级";
    case "engineering":
      return "工程级";
    default:
      return String(value || "");
  }
}

function resetState() {
  uploading.value = false;
  uploadProgress.value = 0;
  transferDepth.value = "archive";
  uploadFiles.value = [];
  nodeIds.value = [];
  kksRefs.value = [];
  uploadRef.value?.clearFiles?.();
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = undefined;
  }
}

function handleChange(_file, fileList) {
  uploadFiles.value = fileList;
}

function handleRemove(_file, fileList) {
  uploadFiles.value = fileList;
}

function handleCancel() {
  if (!canClose.value) return;
  visible.value = false;
  resetState();
}

function confirmUpload() {
  if (uploadFiles.value.length === 0) {
    message("请先选择要上传的文件", { type: "warning" });
    return;
  }
  uploading.value = true;
  uploadProgress.value = 0;

  progressTimer = setInterval(() => {
    uploadProgress.value = Math.min(100, uploadProgress.value + 8);
    if (uploadProgress.value >= 100) {
      clearInterval(progressTimer);
      progressTimer = undefined;

      const payload = {
        files: [...uploadFiles.value],
        transferDepth: transferDepth.value,
        transferDepthLabel: getTransferDepthLabel(transferDepth.value),
        nodeIds: [...nodeIds.value],
        kksRefs: [...kksRefs.value]
      };

      emit("uploaded", payload);
      message("上传完成", { type: "success" });
      visible.value = false;
      resetState();
    }
  }, 200);
}

function handleBeforeClose(done) {
  if (!canClose.value) return;
  done();
  resetState();
}

watch(
  () => props.modelValue,
  value => {
    if (!value) resetState();
  }
);

onBeforeUnmount(() => {
  if (progressTimer) clearInterval(progressTimer);
});
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="520px"
    :close-on-click-modal="canClose"
    :close-on-press-escape="canClose"
    :before-close="handleBeforeClose"
  >
    <el-upload
      ref="uploadRef"
      drag
      multiple
      :auto-upload="false"
      :file-list="uploadFiles"
      :disabled="uploading"
      :on-change="handleChange"
      :on-remove="handleRemove"
    >
      <div class="el-upload__text">
        拖放文件到此处或点击上传
        <div class="text-xs text-[var(--el-text-color-secondary)] mt-2">
          支持 PDF、DWG、DOC、XLS、RVT 等格式，最大支持 10GB
        </div>
      </div>
    </el-upload>

    <div v-if="showTransferDepth" class="mt-4">
      <div class="mb-2 font-semibold">移交深度：</div>
      <el-select v-model="transferDepth" class="w-full" :disabled="uploading">
        <el-option label="存档级" value="archive" />
        <el-option label="浏览级" value="browse" />
        <el-option label="工程级" value="engineering" />
      </el-select>
    </div>

    <div v-if="showAssociations" class="mt-4 grid gap-4">
      <div v-if="currentFolderLabel" class="text-sm">
        <span class="font-semibold">目标目录：</span>{{ currentFolderLabel }}
      </div>

      <div>
        <div class="mb-2 font-semibold">关联系统：</div>
        <el-tree-select
          v-model="nodeIds"
          :data="nodeTreeData"
          multiple
          show-checkbox
          check-strictly
          node-key="value"
          filterable
          clearable
          class="w-full"
          :disabled="uploading"
        />
      </div>

      <div>
        <div class="mb-2 font-semibold">对象编码：</div>
        <el-select
          v-model="kksRefs"
          multiple
          filterable
          clearable
          class="w-full"
          :disabled="uploading"
        >
          <el-option
            v-for="item in kksOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>
    </div>

    <div v-if="uploading" class="mt-4">
      <el-progress :percentage="uploadProgress" />
    </div>

    <template #footer>
      <el-button :disabled="uploading" @click="handleCancel">取消</el-button>
      <el-button type="primary" :loading="uploading" @click="confirmUpload">
        开始上传
      </el-button>
    </template>
  </el-dialog>
</template>
