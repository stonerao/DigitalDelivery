<script setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { ElMessageBox } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import { message } from "@/utils/message";
import ModelPreviewUploadDialog from "../components/ModelPreviewUploadDialog.vue";
import {
  deleteHandoverModel,
  getHandoverModelDetail,
  getHandoverModelList,
  getHandoverModelUploadTask,
  updateHandoverModel,
  uploadHandoverModel
} from "@/api/handoverModels";

defineOptions({
  name: "HandoverModels"
});

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const models = ref([]);

function unwrapData(resp) {
  return resp?.data ?? resp ?? {};
}

function readRecords(data) {
  return Array.isArray(data?.records) ? data.records : [];
}

function normalizeModelItem(item) {
  return {
    id: item?.id || "",
    name: item?.name || "未命名模型",
    lod: item?.lod || "LOD300",
    components: Number(item?.components || 0),
    updatedAt: item?.updatedAt || "-",
    nodeIds: Array.isArray(item?.nodeIds) ? item.nodeIds : [],
    kksRefs: Array.isArray(item?.kksRefs) ? item.kksRefs : [],
    url: item?.url || ""
  };
}

async function loadModels(showSuccess = false) {
  loading.value = true;
  try {
    const res = await getHandoverModelList({ page: 1, size: 20 });
    const data = unwrapData(res);
    models.value = readRecords(data).map(normalizeModelItem);
    if (showSuccess) {
      message("模型列表已刷新", { type: "success" });
    }
  } catch (error) {
    console.error("load models failed", error);
    message("获取模型列表失败", { type: "error" });
  } finally {
    loading.value = false;
  }
}

const highlightModelId = ref("");

function locateModelById() {
  const id = route.query?.id;
  if (typeof id !== "string") return;
  const modelId = id.trim();
  if (!modelId) return;

  const model = models.value.find(item => item.id === modelId);
  if (!model) return;

  highlightModelId.value = modelId;
  openView(model);

  nextTick(() => {
    const el = document.getElementById(`model-card-${modelId}`);
    el?.scrollIntoView?.({ block: "center", inline: "nearest" });
  });
}

const uploadVisible = ref(false);
function openUpload() {
  uploadVisible.value = true;
}

function modelCheck() {
  loadModels(true);
}

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

async function waitUploadTask(taskId) {
  if (!taskId) return;
  const doneStatus = ["done", "success", "completed", "finish", "finished"];
  const failedStatus = ["failed", "error"];

  for (let i = 0; i < 20; i++) {
    const res = await getHandoverModelUploadTask({ taskId });
    const data = unwrapData(res);
    const status = String(data?.status || "").toLowerCase();
    if (doneStatus.some(s => status.includes(s))) return;
    if (failedStatus.some(s => status.includes(s))) {
      throw new Error("模型上传任务执行失败");
    }
    await sleep(1200);
  }
}

async function onConfirmUpload(payload) {
  const { file, thumbnail } = payload;
  if (!file) return;

  const formData = new FormData();
  formData.append("files", file, file.name || "model");
  formData.append("lod", "LOD300");
  formData.append("thumbnail", thumbnail, "thumbnail.jpg");

  try {
    const uploadRes = await uploadHandoverModel({ data: formData });
    const uploadData = unwrapData(uploadRes);
    await waitUploadTask(uploadData?.taskId || "");
    message("模型已上传并完成入库", { type: "success" });
    loadModels();
  } catch (error) {
    console.error("upload model failed", error);
    message(error?.message || "上传模型失败", { type: "error" });
  }
}

const detailVisible = ref(false);
const detailModel = ref(null);
async function openView(model) {
  if (!model?.id) return;
  try {
    const detailRes = await getHandoverModelDetail({ id: model.id });
    const detail = unwrapData(detailRes);
    detailModel.value = {
      ...normalizeModelItem(model),
      ...normalizeModelItem(detail),
      meta: detail?.meta || {}
    };
  } catch (error) {
    console.error("get model detail failed", error);
    detailModel.value = normalizeModelItem(model);
    message("获取模型详情失败，已显示列表数据", { type: "warning" });
  }
  detailVisible.value = true;
}

function openPreview(model) {
  if (!model) return;

  const url =
    (typeof model.url === "string" && model.url.trim()) ||
    `${import.meta.env.BASE_URL || "/"}model/test.glb`;

  router.push({
    path: "/visualization/3d-viewer",
    query: {
      id: model.id,
      name: model.name || "",
      url
    }
  });
}

const editVisible = ref(false);
const editModel = ref(null);
const editName = ref("");
const editLod = ref("LOD300");
function openEdit(model) {
  editModel.value = model;
  editName.value = model.name;
  editLod.value = model.lod;
  editVisible.value = true;
}

function confirmEdit() {
  const value = editName.value.trim();
  if (!value) {
    message("模型名称不能为空", { type: "warning" });
    return;
  }
  updateHandoverModel({
    id: editModel.value.id,
    name: value,
    lod: editLod.value
  })
    .then(() => {
      editVisible.value = false;
      message("已更新模型信息", { type: "success" });
      loadModels();
    })
    .catch(error => {
      console.error("update model failed", error);
      message("更新模型失败", { type: "error" });
    });
}

async function removeModel(model) {
  if (!model?.id) return;
  try {
    await ElMessageBox.confirm(`确认删除模型“${model.name}”吗？`, "删除确认", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消"
    });
    await deleteHandoverModel({ ids: [model.id] });
    message("已删除模型", { type: "success" });
    loadModels();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    console.error("delete model failed", error);
    message("删除模型失败", { type: "error" });
  }
}

const gridModels = computed(() => models.value || []);

onMounted(() => {
  loadModels().then(() => locateModelById());
});

watch(
  () => route.query?.id,
  () => {
    locateModelById();
  }
);

watch(
  () => models.value.length,
  () => {
    locateModelById();
  }
);
</script>

<template>
  <div class="dd-page">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex gap-2">
        <el-button type="primary" @click="openUpload">上传模型</el-button>
        <el-button @click="modelCheck">模型检查</el-button>
      </div>
    </div>

    <el-row v-loading="loading" :gutter="16">
      <el-col
        v-for="model in gridModels"
        :key="model.id"
        :xs="24"
        :sm="12"
        :md="8"
        class="mb-4"
      >
        <el-card
          :id="`model-card-${model.id}`"
          shadow="never"
          :class="model.id === highlightModelId ? 'dd-model-highlight' : ''"
        >
          <div
            class="mb-3 p-4 rounded text-center bg-[var(--el-fill-color-light)]"
          >
            <span class="text-sm text-[var(--el-text-color-secondary)]">
              模型预览
            </span>
          </div>
          <div class="font-semibold truncate">{{ model.name }}</div>
          <div class="text-sm text-[var(--el-text-color-secondary)] mt-1">
            精度：{{ model.lod }}，构件：{{ model.components }} 个
          </div>
          <div class="text-xs text-[var(--el-text-color-secondary)] mt-1">
            更新：{{ model.updatedAt }}
          </div>
          <div class="mt-3 flex gap-2">
            <el-button
              type="primary"
              class="flex-1"
              @click="openPreview(model)"
            >
              预览
            </el-button>
            <el-button class="flex-1" @click="openView(model)">查看</el-button>
            <el-button class="flex-1" @click="openEdit(model)">编辑</el-button>
            <el-button
              class="flex-1"
              type="danger"
              plain
              @click="removeModel(model)"
            >
              删除
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <ModelPreviewUploadDialog
      v-model="uploadVisible"
      @confirm="onConfirmUpload"
    />

    <el-dialog v-model="detailVisible" title="模型详情" width="560px">
      <div v-if="detailModel" class="text-sm">
        <div class="mb-2">
          <span class="font-semibold">名称：</span>{{ detailModel.name }}
        </div>
        <div class="mb-2">
          <span class="font-semibold">精度：</span>{{ detailModel.lod }}
        </div>
        <div class="mb-2">
          <span class="font-semibold">构件数：</span
          >{{ detailModel.components }}
        </div>
        <div>
          <span class="font-semibold">更新时间：</span
          >{{ detailModel.updatedAt }}
        </div>
        <div v-if="detailModel.meta" class="mt-2">
          <span class="font-semibold">作者：</span
          >{{ detailModel.meta.author || "-" }} ，<span class="font-semibold"
            >版本：</span
          >{{ detailModel.meta.version || "-" }}
        </div>
        <div class="mt-3 text-[var(--el-text-color-secondary)]">
          可从此处进入“三维查看”进行预览。
        </div>
      </div>
      <template #footer>
        <el-button v-if="detailModel" @click="openPreview(detailModel)">
          进入三维查看
        </el-button>
        <el-button type="primary" @click="detailVisible = false"
          >关闭</el-button
        >
      </template>
    </el-dialog>

    <el-dialog v-model="editVisible" title="编辑模型" width="520px">
      <div class="mb-3">
        <div class="mb-2 font-semibold">模型名称</div>
        <el-input v-model="editName" placeholder="请输入模型名称" />
      </div>
      <div>
        <div class="mb-2 font-semibold">精度等级</div>
        <el-select v-model="editLod" class="w-full">
          <el-option label="LOD300" value="LOD300" />
          <el-option label="LOD350" value="LOD350" />
          <el-option label="LOD400" value="LOD400" />
        </el-select>
      </div>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmEdit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.dd-model-highlight {
  border-color: var(--el-color-primary) !important;
}
</style>
