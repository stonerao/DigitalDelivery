<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { getHandoverModelThumbnail } from "@/api/handoverModels";
import {
  createHandoverModelObjectUrl,
  unwrapHandoverModelThumbnailResponse
} from "@/utils/handoverModel";

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  modelPickerSelection: {
    type: Array,
    default: () => []
  },
  selectableModelOptions: {
    type: Array,
    default: () => []
  },
  loadingModelOptions: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  "update:modelValue",
  "update:modelPickerSelection",
  "confirm"
]);

const keyword = ref("");
const thumbnailObjectUrls = ref({});
const loadingThumbnailKeys = ref(new Set());
const failedThumbnailSources = ref(new Set());
const thumbnailRevokeMap = new Map();

const selectedSet = computed(() => new Set(props.modelPickerSelection));
const addableModelOptions = computed(() =>
  props.selectableModelOptions.filter(item => !isOptionDisabled(item))
);
const loadedModelCount = computed(
  () => props.selectableModelOptions.filter(isOptionLoaded).length
);
const thumbnailOptionSignature = computed(() =>
  props.selectableModelOptions.map(getThumbnailKey).join("|")
);

const filteredModelOptions = computed(() => {
  const text = keyword.value.trim().toLowerCase();
  if (!text) return props.selectableModelOptions;
  return props.selectableModelOptions.filter(item => {
    const model = getOptionModel(item);
    return [
      item.label,
      model.name,
      model.lod,
      model.updatedAt,
      getOptionVersionLabel(item),
      getOptionUploader(item),
      getOptionChangeLog(item),
      getOptionStatusLabel(item),
      isOptionLoaded(item) ? "已加载" : "可添加"
    ]
      .map(value => String(value || "").toLowerCase())
      .some(value => value.includes(text));
  });
});

function getOptionModel(option = {}) {
  return option.raw || option;
}

function firstText(...values) {
  const hit = values
    .map(value => String(value ?? "").trim())
    .find(value => value && value !== "-");
  return hit || "";
}

function getOptionVersionLabel(option = {}) {
  const model = getOptionModel(option);
  return (
    firstText(
      model.versionName,
      model.version,
      model.modelVersion,
      model.versionNo,
      model.revision,
      model.metadata?.versionName,
      model.metadata?.modelVersion
    ) || "未提供"
  );
}

function getOptionUploader(option = {}) {
  const model = getOptionModel(option);
  return (
    firstText(
      model.uploadedBy,
      model.uploadUserName,
      model.createdBy,
      model.updatedBy,
      model.metadata?.uploadedBy
    ) || "未提供"
  );
}

function getOptionChangeLog(option = {}) {
  const model = getOptionModel(option);
  return firstText(
    model.changeLog,
    model.changeRemark,
    model.remark,
    model.description,
    model.metadata?.changeLog
  );
}

function getThumbnailKey(option) {
  const model = getOptionModel(option);
  return `${model?.id || option?.value || ""}|${model?.thumbnailUrl || ""}`;
}

function isOptionLoaded(option) {
  return option?.loaded === true;
}

function isOptionDisabled(option) {
  return option?.disabled === true || isOptionLoaded(option);
}

function getOptionStatusLabel(option) {
  const model = getOptionModel(option);
  return String(
    option?.statusLabel ||
      model?.statusLabel ||
      model?.statusName ||
      model?.convertStatus ||
      model?.status ||
      ""
  ).trim();
}

function getOptionStatusTagType(option) {
  const status = getOptionStatusLabel(option).toLowerCase();
  if (!status) return "info";
  if (
    ["fail", "failed", "error", "失败", "异常"].some(item =>
      status.includes(item)
    )
  ) {
    return "danger";
  }
  if (
    [
      "process",
      "processing",
      "upload",
      "convert",
      "上传",
      "转换",
      "处理中"
    ].some(item => status.includes(item))
  ) {
    return "warning";
  }
  if (
    ["success", "ready", "done", "完成", "成功", "可预览"].some(item =>
      status.includes(item)
    )
  ) {
    return "success";
  }
  return "info";
}

function getThumbnailSrc(option) {
  const model = getOptionModel(option);
  const key = getThumbnailKey(option);
  return thumbnailObjectUrls.value[key] || String(model?.thumbnailUrl || "");
}

function hasThumbnailImage(option) {
  const src = getThumbnailSrc(option).trim();
  return Boolean(src) && !failedThumbnailSources.value.has(src);
}

function onThumbnailError(option) {
  const src = getThumbnailSrc(option).trim();
  if (!src) return;
  failedThumbnailSources.value = new Set([
    ...failedThumbnailSources.value,
    src
  ]);
}

function setThumbnailLoading(key, value) {
  const next = new Set(loadingThumbnailKeys.value);
  if (value) {
    next.add(key);
  } else {
    next.delete(key);
  }
  loadingThumbnailKeys.value = next;
}

function isThumbnailLoading(option) {
  return loadingThumbnailKeys.value.has(getThumbnailKey(option));
}

function revokeThumbnailObjectUrl(key) {
  const revoke = thumbnailRevokeMap.get(key);
  if (revoke) {
    revoke();
    thumbnailRevokeMap.delete(key);
  }

  if (thumbnailObjectUrls.value[key]) {
    const next = { ...thumbnailObjectUrls.value };
    delete next[key];
    thumbnailObjectUrls.value = next;
  }
}

function revokeStaleThumbnailObjectUrls(options = []) {
  const activeKeys = new Set(options.map(getThumbnailKey).filter(Boolean));
  Object.keys(thumbnailObjectUrls.value).forEach(key => {
    if (!activeKeys.has(key)) {
      revokeThumbnailObjectUrl(key);
    }
  });
}

async function loadModelThumbnail(option) {
  const model = getOptionModel(option);
  const key = getThumbnailKey(option);
  if (!key || !model?.id || !model?.thumbnailUrl) return;
  if (thumbnailObjectUrls.value[key] || loadingThumbnailKeys.value.has(key)) {
    return;
  }

  setThumbnailLoading(key, true);
  try {
    const response = await getHandoverModelThumbnail(model.id);
    const blob = await unwrapHandoverModelThumbnailResponse(response);
    const { url, revoke } = createHandoverModelObjectUrl(blob);
    if (!url) throw new Error("模型预览图地址生成失败");

    revokeThumbnailObjectUrl(key);
    thumbnailRevokeMap.set(key, revoke);
    thumbnailObjectUrls.value = {
      ...thumbnailObjectUrls.value,
      [key]: url
    };
  } catch (error) {
    console.error("[viewer3d/model-picker] load thumbnail failed:", error);
  } finally {
    setThumbnailLoading(key, false);
  }
}

function loadModelThumbnails(options = filteredModelOptions.value) {
  revokeStaleThumbnailObjectUrls(props.selectableModelOptions);
  options.forEach(item => {
    loadModelThumbnail(item);
  });
}

function revokeAllThumbnailObjectUrls() {
  [...thumbnailRevokeMap.values()].forEach(revoke => revoke());
  thumbnailRevokeMap.clear();
  thumbnailObjectUrls.value = {};
}

function toggleSelection(option) {
  if (isOptionDisabled(option)) return;
  const value = option?.value;
  if (!value) return;
  const next = new Set(props.modelPickerSelection);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  emit("update:modelPickerSelection", Array.from(next));
}

function clearSelection() {
  emit("update:modelPickerSelection", []);
}

watch(
  () => [props.modelValue, thumbnailOptionSignature.value, keyword.value],
  () => {
    if (!props.modelValue) return;
    loadModelThumbnails();
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  revokeAllThumbnailObjectUrls();
});
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="添加模型到场景"
    width="820px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="dd-model-picker">
      <div class="dd-model-picker__toolbar">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索模型名称 / LOD / 版本 / 上传人"
          class="dd-model-picker__search"
        />
        <div class="dd-model-picker__summary">
          已选 {{ modelPickerSelection.length }} / 可添加
          {{ addableModelOptions.length }} / 已加载 {{ loadedModelCount }}
        </div>
      </div>

      <div v-loading="loadingModelOptions" class="dd-model-picker__body">
        <div v-if="filteredModelOptions.length" class="dd-model-picker__grid">
          <button
            v-for="item in filteredModelOptions"
            :key="item.value"
            type="button"
            class="dd-model-picker-card"
            :class="{
              'is-selected': selectedSet.has(item.value),
              'is-loaded': isOptionLoaded(item),
              'is-disabled': isOptionDisabled(item)
            }"
            :disabled="isOptionDisabled(item)"
            @click="toggleSelection(item)"
          >
            <span class="dd-model-picker-card__thumb">
              <img
                v-if="hasThumbnailImage(item)"
                :src="getThumbnailSrc(item)"
                :alt="`${item.label || '模型'}预览图`"
                class="dd-model-picker-card__image"
                loading="lazy"
                decoding="async"
                @error.stop="onThumbnailError(item)"
              />
              <span v-else class="dd-model-picker-card__placeholder">
                {{ isThumbnailLoading(item) ? "加载中" : "暂无预览图" }}
              </span>
            </span>
            <span class="dd-model-picker-card__content">
              <span class="dd-model-picker-card__name">
                {{ item.label }}
              </span>
              <span class="dd-model-picker-card__tags">
                <el-tag v-if="item.active" size="small" type="primary">
                  当前
                </el-tag>
                <el-tag v-else-if="isOptionLoaded(item)" size="small">
                  已加载
                </el-tag>
                <el-tag
                  v-if="getOptionStatusLabel(item)"
                  size="small"
                  effect="plain"
                  :type="getOptionStatusTagType(item)"
                >
                  {{ getOptionStatusLabel(item) }}
                </el-tag>
              </span>
              <span class="dd-model-picker-card__meta">
                精度：{{ getOptionModel(item).lod || "LOD300" }} / 构件：{{
                  getOptionModel(item).components || 0
                }}
              </span>
              <span class="dd-model-picker-card__meta">
                版本：{{ getOptionVersionLabel(item) }} / 上传人：{{
                  getOptionUploader(item)
                }}
              </span>
              <span class="dd-model-picker-card__time">
                更新：{{ getOptionModel(item).updatedAt || "-" }}
              </span>
              <span
                v-if="getOptionChangeLog(item)"
                class="dd-model-picker-card__time"
              >
                变更：{{ getOptionChangeLog(item) }}
              </span>
            </span>
            <span class="dd-model-picker-card__check">
              <el-checkbox
                :model-value="selectedSet.has(item.value)"
                :disabled="isOptionDisabled(item)"
                @click.stop
                @update:model-value="toggleSelection(item)"
              />
            </span>
          </button>
        </div>
        <el-empty v-else description="未匹配到模型" :image-size="88" />
      </div>
    </div>
    <template #footer>
      <el-button
        :disabled="!modelPickerSelection.length"
        @click="clearSelection"
      >
        清空选择
      </el-button>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button
        type="primary"
        :disabled="!modelPickerSelection.length"
        @click="emit('confirm')"
      >
        添加
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.dd-model-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dd-model-picker__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dd-model-picker__search {
  max-width: 360px;
}

.dd-model-picker__summary {
  flex: 0 0 auto;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.dd-model-picker__body {
  min-height: 320px;
  max-height: 560px;
  overflow: auto;
}

.dd-model-picker__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.dd-model-picker-card {
  position: relative;
  display: grid;
  grid-template-columns: 144px minmax(0, 1fr);
  gap: 12px;
  width: 100%;
  padding: 10px;
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background-color 0.18s ease;
}

.dd-model-picker-card:hover,
.dd-model-picker-card.is-selected {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
}

.dd-model-picker-card.is-selected {
  box-shadow: 0 0 0 1px var(--el-color-primary-light-5);
}

.dd-model-picker-card.is-loaded {
  background: var(--el-fill-color-extra-light);
}

.dd-model-picker-card.is-disabled {
  cursor: not-allowed;
  opacity: 0.78;
}

.dd-model-picker-card.is-disabled:hover {
  background: var(--el-fill-color-extra-light);
  border-color: var(--el-border-color);
  box-shadow: none;
}

.dd-model-picker-card__thumb {
  position: relative;
  display: block;
  width: 144px;
  overflow: hidden;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  aspect-ratio: 16 / 9;
}

.dd-model-picker-card__image,
.dd-model-picker-card__placeholder {
  width: 100%;
  height: 100%;
}

.dd-model-picker-card__image {
  display: block;
  object-fit: cover;
}

.dd-model-picker-card__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.dd-model-picker-card__content {
  display: flex;
  min-width: 0;
  padding-right: 28px;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}

.dd-model-picker-card__name {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dd-model-picker-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 20px;
}

.dd-model-picker-card__meta,
.dd-model-picker-card__time {
  overflow: hidden;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dd-model-picker-card__check {
  position: absolute;
  top: 8px;
  right: 10px;
}

@media (width <= 760px) {
  .dd-model-picker__toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .dd-model-picker__search {
    max-width: none;
  }

  .dd-model-picker__grid {
    grid-template-columns: 1fr;
  }
}

@media (width <= 520px) {
  .dd-model-picker-card {
    grid-template-columns: 1fr;
  }

  .dd-model-picker-card__thumb {
    width: 100%;
  }
}
</style>
