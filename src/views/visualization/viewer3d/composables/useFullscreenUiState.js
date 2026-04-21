import { computed, ref } from "vue";
import { createDefaultDocumentBindingPagination } from "../services/sceneDocumentBindingService";
import { createEmptyPropertyForm } from "../services/scenePropertyService";
import { createEmptyAnchorForm } from "../services/sceneAnchorService";

export function useFullscreenUiState({
  videoAdapter,
  activeCameraDetail,
  positionPickingState,
  anchorDialogKind,
  anchorDialogMode,
  ctxMenuNode,
  documentDialogScope,
  documentDialogMode,
  documentDialogSelectedDocuments
}) {
  const modelPickerVisible = ref(false);
  const modelPickerSelection = ref([]);
  const modelPickerNodeId = ref("");

  const navNodeDialogVisible = ref(false);
  const navNodeDialogMode = ref("create");
  const navNodeDialogParentId = ref("");
  const navNodeDialogTargetId = ref("");
  const navNodeForm = ref({
    label: ""
  });

  const documentDialogVisible = ref(false);
  const documentDialogLoading = ref(false);
  const documentDialogKeyword = ref("");
  const documentDialogRecords = ref([]);
  const documentDialogPagination = ref(
    createDefaultDocumentBindingPagination()
  );
  const documentDialogTargetId = ref("");
  const documentDialogTargetLabel = ref("");
  const documentDialogTableRef = ref(null);
  const documentDialogSourceId = ref("");

  const propDialogVisible = ref(false);
  const propDialogMode = ref("bind");
  const propEditForm = ref(createEmptyPropertyForm());
  const propertyBindingLoading = ref(false);
  const propertyBindingKeyword = ref("");
  const propertyBindingRecords = ref([]);
  const selectedPropertyBindingKks = ref("");
  const propertyBindingPagination = ref({
    page: 1,
    size: 20,
    total: 0
  });

  const anchorDialogVisible = ref(false);
  const anchorForm = ref(createEmptyAnchorForm());
  const settingsDialogVisible = ref(false);
  const anchorDialogMinimized = ref(false);
  const anchorDetailVisible = ref(false);

  const videoElementRef = ref(null);
  const videoLoading = ref(false);
  const videoErrorText = ref("");

  const currentPropertyTargetName = computed(() => {
    return String(
      ctxMenuNode.value?.raw?.name ||
        ctxMenuNode.value?.label ||
        ctxMenuNode.value?.name ||
        "-"
    ).trim();
  });

  const documentDialogTitle = computed(() => {
    const scopeLabel = documentDialogScope.value === "object" ? "构件" : "节点";
    return documentDialogMode.value === "view"
      ? `查看${scopeLabel}绑定文件`
      : `绑定${scopeLabel}文件`;
  });

  const currentDocumentBoundCount = computed(
    () => documentDialogSelectedDocuments.value.length
  );

  const documentDialogCurrentLabel = computed(() =>
    documentDialogScope.value === "object" ? "当前构件" : "当前节点"
  );

  const documentDialogEmptyText = computed(() =>
    documentDialogScope.value === "object"
      ? "当前构件尚未绑定文档"
      : "当前节点尚未绑定文档"
  );

  const propDialogTitle = computed(() => {
    const map = {
      bind: "绑定业务数据",
      edit: "更换业务数据",
      clear: "解除业务数据"
    };
    return map[propDialogMode.value] || "属性";
  });

  const pickedPositionText = computed(() => {
    const position = positionPickingState.value.pickedPosition;
    if (!Array.isArray(position) || position.length < 3) return "未拾取位置";
    return position.map(item => Number(item || 0).toFixed(3)).join(", ");
  });

  const anchorDialogTitle = computed(() => {
    const text = anchorDialogKind.value === "camera" ? "摄像头" : "点位";
    return `${anchorDialogMode.value === "edit" ? "编辑" : "新增"}${text}`;
  });

  const videoPreviewSupported = computed(() => {
    return videoAdapter.canPlay(
      activeCameraDetail.value?.streamType,
      activeCameraDetail.value?.streamUrl
    );
  });

  return {
    modelPickerVisible,
    modelPickerSelection,
    modelPickerNodeId,
    navNodeDialogVisible,
    navNodeDialogMode,
    navNodeDialogParentId,
    navNodeDialogTargetId,
    navNodeForm,
    documentDialogVisible,
    documentDialogLoading,
    documentDialogKeyword,
    documentDialogRecords,
    documentDialogPagination,
    documentDialogTargetId,
    documentDialogTargetLabel,
    documentDialogTableRef,
    documentDialogSourceId,
    propDialogVisible,
    propDialogMode,
    propEditForm,
    propertyBindingLoading,
    propertyBindingKeyword,
    propertyBindingRecords,
    selectedPropertyBindingKks,
    propertyBindingPagination,
    anchorDialogVisible,
    anchorForm,
    settingsDialogVisible,
    anchorDialogMinimized,
    anchorDetailVisible,
    videoElementRef,
    videoLoading,
    videoErrorText,
    currentPropertyTargetName,
    documentDialogTitle,
    currentDocumentBoundCount,
    documentDialogCurrentLabel,
    documentDialogEmptyText,
    propDialogTitle,
    pickedPositionText,
    anchorDialogTitle,
    videoPreviewSupported
  };
}
