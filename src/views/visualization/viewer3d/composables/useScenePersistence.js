export function useScenePersistence({
  handoverProjectId,
  handoverProjectName,
  currentProjectContext,
  savingProject,
  modelId,
  modelName,
  modelUrl,
  currentSceneSchemeScope,
  sceneModels,
  activeSceneModelId,
  activeSceneModel,
  systemNodeTree,
  sceneDevices,
  anchors,
  cameraAnchors,
  anchorStyleDefaults,
  measurementRecords,
  sceneSchemes,
  bookmarks,
  assetGroups,
  quality,
  materialTheme,
  activeTool,
  measurementMode,
  displayMode,
  transparent,
  roamingEnabled,
  showStats,
  showSidePanel,
  activeSideTab,
  pointMarkersVisible,
  anchorMarkersVisible,
  cameraMarkersVisible,
  selectedObjectInfo,
  selectedDeviceUuid,
  selectedAnchorId,
  selectedCameraId,
  selectedSystemNodeId,
  selectedQuickKks,
  currentNavNodeKey,
  layerCheckedKeys,
  projectClippingState,
  clippingPresets,
  scriptDefinitions,
  integrationConfigs,
  savedObjectBindings,
  runtimeStore,
  projectStore,
  message,
  getHandoverProjectDetail,
  updateHandoverProject,
  parseViewerProjectInfo,
  patchProjectPackage,
  loadProjectPackage,
  parseImportedProjectPackage,
  saveProjectPackage,
  hasProjectPackageContent,
  serializeSceneModels,
  serializeSceneObjectBindings,
  resolveRestoredViewerProjectState,
  applyRestoredViewerProjectState,
  normalizeSavedObjectBinding,
  mapSystemTreeNodes,
  buildStyledAnchorForm,
  createDefaultClippingState,
  normalizeClippingState,
  updateSceneModelNodeLabels,
  initializeSceneModels
}) {
  function getProjectMetadata() {
    return {
      projectId: handoverProjectId.value,
      projectName: handoverProjectName.value,
      modelId: modelId.value,
      modelName: modelName.value,
      modelUrl: modelUrl.value
    };
  }

  function applyProjectPackagePatch(patch = {}) {
    const nextPackage = patchProjectPackage(
      currentSceneSchemeScope.value,
      patch,
      getProjectMetadata()
    );
    projectStore.setProjectPackage(nextPackage);
    return nextPackage;
  }

  function patchSceneProjectPackage(scenePatch = {}) {
    return applyProjectPackagePatch({
      metadata: getProjectMetadata(),
      scene: scenePatch
    });
  }

  function patchAssetsProjectPackage(assetsPatch = {}) {
    return applyProjectPackagePatch({
      assets: assetsPatch
    });
  }

  async function loadHandoverProjectContext() {
    if (!handoverProjectId.value) {
      handoverProjectName.value = "";
      currentProjectContext.value = null;
      return null;
    }

    try {
      const response = await getHandoverProjectDetail(handoverProjectId.value);
      const project = response?.data ?? response ?? {};
      handoverProjectName.value = project?.projectName || "";
      projectStore.setProjectInfo({
        projectId: handoverProjectId.value,
        projectName: handoverProjectName.value || modelName.value
      });
      currentProjectContext.value = {
        ...project,
        parsedProjectInfo: parseViewerProjectInfo(project?.projectInfo)
      };
      return currentProjectContext.value;
    } catch (error) {
      console.error("load handover project detail failed", error);
      message(error?.message || "获取项目详情失败", { type: "error" });
      currentProjectContext.value = null;
      return null;
    }
  }

  function createScopedProjectPackage(scope, rawPackage = null) {
    const metadata = getProjectMetadata();
    const basePackage = loadProjectPackage(scope, metadata);
    if (!rawPackage) return basePackage;

    const parsedPackage = parseImportedProjectPackage(rawPackage, metadata);
    return {
      ...basePackage,
      ...parsedPackage,
      scope,
      metadata: {
        ...basePackage.metadata,
        ...(parsedPackage.metadata || {}),
        ...metadata
      },
      scene: {
        ...basePackage.scene,
        ...(parsedPackage.scene || {})
      },
      scripts: {
        ...basePackage.scripts,
        ...(parsedPackage.scripts || {})
      },
      assets: {
        ...basePackage.assets,
        ...(parsedPackage.assets || {}),
        sceneManifest: {
          ...basePackage.assets?.sceneManifest,
          ...(parsedPackage.assets?.sceneManifest || {})
        }
      },
      integrations: {
        ...basePackage.integrations,
        ...(parsedPackage.integrations || {})
      }
    };
  }

  function resolvePersistedProjectPackage(
    projectInfo = null,
    {
      preferProjectInfo = true,
      persistResolvedPackage = preferProjectInfo
    } = {}
  ) {
    const backendPackage = projectInfo?.projectPackage
      ? createScopedProjectPackage(
          currentSceneSchemeScope.value,
          projectInfo.projectPackage
        )
      : null;

    if (preferProjectInfo && backendPackage) {
      if (persistResolvedPackage) {
        saveProjectPackage(currentSceneSchemeScope.value, backendPackage);
      }
      return backendPackage;
    }

    const currentPackage = loadProjectPackage(
      currentSceneSchemeScope.value,
      getProjectMetadata()
    );
    if (hasProjectPackageContent(currentPackage) || !backendPackage) {
      return currentPackage;
    }

    if (persistResolvedPackage) {
      saveProjectPackage(currentSceneSchemeScope.value, backendPackage);
    }
    return backendPackage;
  }

  function loadPersistedProjectState(
    projectInfo = null,
    {
      preferProjectInfo = true,
      persistResolvedPackage = preferProjectInfo
    } = {}
  ) {
    const projectPackage = resolvePersistedProjectPackage(projectInfo, {
      preferProjectInfo,
      persistResolvedPackage
    });
    const restoredState = resolveRestoredViewerProjectState({
      projectInfo,
      projectPackage,
      preferProjectInfo,
      normalizeSavedObjectBinding,
      mapSystemTreeNodes,
      buildStyledAnchorForm,
      createDefaultClippingState,
      normalizeClippingState,
      currentRuntime: {
        materialTheme: materialTheme.value,
        activeTool: activeTool.value,
        measurementMode: measurementMode.value,
        displayMode: displayMode.value
      }
    });

    applyRestoredViewerProjectState({
      restoredState,
      projectPackage,
      projectStore,
      runtimeStore,
      updateSceneModelNodeLabels,
      setSavedObjectBindings: value => {
        savedObjectBindings.value = value;
      },
      setSystemNodeTree: value => {
        systemNodeTree.value = value;
      },
      setAnchorStyleDefaults: value => {
        anchorStyleDefaults.value = value;
      },
      setAnchors: value => {
        anchors.value = value;
      },
      setCameraAnchors: value => {
        cameraAnchors.value = value;
      },
      setMeasurementRecords: value => {
        measurementRecords.value = value;
      },
      setSceneSchemes: value => {
        sceneSchemes.value = value;
      },
      setBookmarks: value => {
        bookmarks.value = value;
      },
      setAssetGroups: value => {
        assetGroups.value = value;
      },
      setQuality: value => {
        quality.value = value;
      },
      setMaterialTheme: value => {
        materialTheme.value = value;
      },
      setActiveTool: value => {
        activeTool.value = value;
      },
      setMeasurementMode: value => {
        measurementMode.value = value;
      },
      setDisplayMode: value => {
        displayMode.value = value;
      },
      setShowStats: value => {
        showStats.value = value;
      },
      setShowSidePanel: value => {
        showSidePanel.value = value;
      },
      setActiveSideTab: value => {
        activeSideTab.value = value;
      },
      setTransparent: value => {
        transparent.value = value;
      },
      setPointMarkersVisible: value => {
        pointMarkersVisible.value = value;
      },
      setAnchorMarkersVisible: value => {
        anchorMarkersVisible.value = value;
      },
      setCameraMarkersVisible: value => {
        cameraMarkersVisible.value = value;
      },
      setSelectedDeviceUuid: value => {
        selectedDeviceUuid.value = value;
      },
      setSelectedAnchorId: value => {
        selectedAnchorId.value = value;
      },
      setSelectedCameraId: value => {
        selectedCameraId.value = value;
      },
      setSelectedSystemNodeId: value => {
        selectedSystemNodeId.value = value;
      },
      setSelectedQuickKks: value => {
        selectedQuickKks.value = value;
      },
      setCurrentNavNodeKey: value => {
        currentNavNodeKey.value = value;
      }
    });
  }

  async function reloadProjectSceneContext() {
    const project = await loadHandoverProjectContext();
    await initializeSceneModels(project?.parsedProjectInfo);
    loadPersistedProjectState(project?.parsedProjectInfo);
    return project;
  }

  function buildProjectInfoPayload() {
    const serializedSceneModels = serializeSceneModels(sceneModels.value, {
      mapMetadata: item => ({
        ...(item.metadata || {}),
        quality: item.modelId === activeSceneModelId.value ? quality.value : ""
      })
    });
    const serializedObjectBindings = serializeSceneObjectBindings(
      sceneDevices.value,
      {
        bindingIdBuilder: item => `binding-${item.uuid}`,
        resolveInstanceId: item =>
          item.instanceId || activeSceneModel.value?.instanceId || "",
        includeTypeInProperties: true
      }
    );

    return {
      version: "2.0.0",
      schema: "dd-handover-project-scene",
      project: {
        id: handoverProjectId.value || projectStore.projectId || "",
        name: handoverProjectName.value || projectStore.projectName || "",
        updatedAt: Date.now()
      },
      metadata: {
        projectId: handoverProjectId.value || projectStore.projectId || "",
        projectName:
          handoverProjectName.value || projectStore.projectName || "",
        modelId: modelId.value,
        modelName: modelName.value,
        modelUrl: modelUrl.value
      },
      scene: {
        activeModelId: activeSceneModelId.value || modelId.value,
        navigationTree: systemNodeTree.value,
        models: serializedSceneModels,
        bindings: {
          objectBindings: serializedObjectBindings
        },
        anchors: anchors.value,
        cameras: cameraAnchors.value,
        anchorStyleDefaults: anchorStyleDefaults.value,
        measurements: measurementRecords.value,
        schemes: sceneSchemes.value,
        bookmarks: bookmarks.value,
        assetGroups: assetGroups.value,
        clipping: projectClippingState.value,
        clippingPresets: clippingPresets.value
      },
      runtime: {
        quality: quality.value,
        materialTheme: materialTheme.value,
        activeTool: activeTool.value,
        measurementMode: measurementMode.value,
        displayMode: displayMode.value,
        transparentEnabled: transparent.value,
        roamingEnabled: roamingEnabled.value,
        showStats: showStats.value,
        showSidePanel: showSidePanel.value,
        activeSideTab: activeSideTab.value,
        pointMarkersVisible: pointMarkersVisible.value,
        anchorMarkersVisible: anchorMarkersVisible.value,
        cameraMarkersVisible: cameraMarkersVisible.value,
        selectedObjectRef:
          selectedObjectInfo.value?.objectUuid || selectedObjectInfo.value?.uuid
            ? {
                instanceId:
                  selectedObjectInfo.value?.userData?.sceneModelInstanceId ||
                  activeSceneModel.value?.instanceId ||
                  "",
                objectUuid:
                  selectedObjectInfo.value?.objectUuid ||
                  selectedObjectInfo.value?.uuid ||
                  ""
              }
            : null,
        selectedDeviceUuid: selectedDeviceUuid.value,
        selectedAnchorId: selectedAnchorId.value,
        selectedCameraId: selectedCameraId.value,
        selectedSystemNodeId: selectedSystemNodeId.value,
        selectedQuickKks: selectedQuickKks.value,
        currentNavNodeKey: currentNavNodeKey.value,
        layerCheckedObjectRefs: sceneDevices.value
          .filter(item => layerCheckedKeys.value.includes(item.uuid))
          .map(item => ({
            instanceId:
              item.instanceId || activeSceneModel.value?.instanceId || "",
            objectUuid: item.uuid
          }))
      },
      projectPackage: {
        ...(projectStore.projectPackage || {}),
        metadata: {
          ...(projectStore.projectPackage?.metadata || {}),
          projectId: handoverProjectId.value || projectStore.projectId || "",
          projectName:
            handoverProjectName.value || projectStore.projectName || "",
          modelId: modelId.value,
          modelName: modelName.value,
          modelUrl: modelUrl.value
        },
        scene: {
          ...(projectStore.projectPackage?.scene || {}),
          navigationTree: systemNodeTree.value,
          models: sceneModels.value,
          bindings: {
            ...(projectStore.projectPackage?.scene?.bindings || {}),
            objectBindings: serializedObjectBindings
          },
          anchors: anchors.value,
          cameras: cameraAnchors.value,
          measurements: measurementRecords.value,
          schemes: sceneSchemes.value,
          bookmarks: bookmarks.value,
          clipping: projectClippingState.value,
          clippingPresets: clippingPresets.value
        },
        assets: {
          ...(projectStore.projectPackage?.assets || {}),
          sceneManifest: {
            ...(projectStore.projectPackage?.assets?.sceneManifest || {}),
            groups: assetGroups.value
          }
        },
        scripts: {
          animations: scriptDefinitions.value?.animations || [],
          triggers: scriptDefinitions.value?.triggers || []
        },
        integrations: {
          realtime: integrationConfigs.value?.realtime || {},
          backendBridge: integrationConfigs.value?.backendBridge || {}
        },
        updatedAt: Date.now()
      }
    };
  }

  async function saveCurrentProject() {
    if (!handoverProjectId.value) {
      message("当前全屏页面未绑定项目，无法保存", { type: "warning" });
      return;
    }

    savingProject.value = true;
    try {
      const project = await loadHandoverProjectContext();
      if (!project?.id) {
        throw new Error("未找到当前项目");
      }
      const payload = buildProjectInfoPayload();
      const response = await updateHandoverProject({
        id: project.id,
        projectName: project.projectName || handoverProjectName.value || "",
        projectInfo: JSON.stringify(payload)
      });
      const success =
        response?.success === true ||
        response?.code === 200 ||
        response?.code === 0;
      if (!success) {
        throw new Error(response?.message || "保存项目失败");
      }
      currentProjectContext.value = project
        ? {
            ...project,
            projectInfo: JSON.stringify(payload),
            parsedProjectInfo: payload
          }
        : {
            id: handoverProjectId.value,
            projectName: handoverProjectName.value,
            projectInfo: JSON.stringify(payload),
            parsedProjectInfo: payload
          };
      message("项目已保存", { type: "success" });
    } catch (error) {
      console.error("save current fullscreen project failed", error);
      message(error?.message || "保存项目失败", { type: "error" });
    } finally {
      savingProject.value = false;
    }
  }

  return {
    getProjectMetadata,
    applyProjectPackagePatch,
    patchSceneProjectPackage,
    patchAssetsProjectPackage,
    loadHandoverProjectContext,
    reloadProjectSceneContext,
    buildProjectInfoPayload,
    saveCurrentProject,
    createScopedProjectPackage,
    resolvePersistedProjectPackage,
    loadPersistedProjectState
  };
}
