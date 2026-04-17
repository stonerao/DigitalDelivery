import { createDefaultClippingState } from "@/3d/runtime/clipping/clippingState";

const PROJECT_PACKAGE_STORAGE_KEY = "dd-viewer-project-packages";
const PROJECT_PACKAGE_BUNDLE_FORMAT = "dd-project-package-bundle";

function getStorageMap(storageKey = PROJECT_PACKAGE_STORAGE_KEY) {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || "{}");
  } catch {
    return {};
  }
}

function saveStorageMap(payload, storageKey = PROJECT_PACKAGE_STORAGE_KEY) {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(storageKey, JSON.stringify(payload));
}

export function createEmptyProjectPackage(scope, metadata = {}) {
  return {
    version: "1.0.0",
    scope,
    metadata: {
      modelId: metadata.modelId || "",
      modelName: metadata.modelName || "",
      modelUrl: metadata.modelUrl || ""
    },
    scene: {
      navigationTree: [],
      anchors: [],
      cameras: [],
      measurements: [],
      schemes: [],
      clipping: createDefaultClippingState(),
      clippingPresets: [],
      anchorStyleDefaults: {
        anchor: {},
        camera: {}
      }
    },
    scripts: {
      animations: [],
      triggers: []
    },
    assets: {
      sceneManifest: {
        manifestVersion: "1.0.0",
        defaultModelUrl: metadata.modelUrl || "",
        qualityProfiles: {
          high: metadata.modelUrl || "",
          medium: "",
          low: ""
        },
        groups: [],
        lodLevels: []
      }
    },
    integrations: {
      realtime: {
        enabled: false,
        transport: "mock",
        interval: 3000,
        points: []
      },
      backendBridge: {
        enabled: false,
        transport: "mock",
        endpoint: ""
      }
    },
    updatedAt: Date.now()
  };
}

function createBaseSections(projectPackage) {
  const payload = projectPackage || createEmptyProjectPackage("");
  return {
    "project.json": {
      version: payload.version || "1.0.0",
      scope: payload.scope || "",
      metadata: payload.metadata || {},
      updatedAt: payload.updatedAt || Date.now()
    },
    "scene/anchors.json": payload.scene?.anchors || [],
    "scene/navigation-tree.json": payload.scene?.navigationTree || [],
    "scene/cameras.json": payload.scene?.cameras || [],
    "scene/measurements.json": payload.scene?.measurements || [],
    "scene/schemes.json": payload.scene?.schemes || [],
    "scene/clipping.json":
      payload.scene?.clipping || createDefaultClippingState(),
    "scene/clipping-presets.json": payload.scene?.clippingPresets || [],
    "scene/anchor-style-defaults.json": payload.scene?.anchorStyleDefaults || {
      anchor: {},
      camera: {}
    },
    "scripts/animations.json": payload.scripts?.animations || [],
    "scripts/triggers.json": payload.scripts?.triggers || [],
    "assets/scene-manifest.json": payload.assets?.sceneManifest || {},
    "integrations/realtime.json": payload.integrations?.realtime || {},
    "integrations/backend-bridge.json":
      payload.integrations?.backendBridge || {}
  };
}

export function createProjectPackageBundle(projectPackage) {
  return {
    format: PROJECT_PACKAGE_BUNDLE_FORMAT,
    bundleVersion: "1.0.0",
    files: createBaseSections(projectPackage)
  };
}

export function parseProjectPackageBundle(bundle, metadata = {}) {
  const files = bundle?.files || {};
  const manifest = files["project.json"] || {};
  return {
    ...createEmptyProjectPackage(manifest.scope || "", metadata),
    version: manifest.version || "1.0.0",
    scope: manifest.scope || "",
    metadata: {
      ...createEmptyProjectPackage(manifest.scope || "", metadata).metadata,
      ...(manifest.metadata || {})
    },
    updatedAt: manifest.updatedAt || Date.now(),
    scene: {
      navigationTree: files["scene/navigation-tree.json"] || [],
      anchors: files["scene/anchors.json"] || [],
      cameras: files["scene/cameras.json"] || [],
      measurements: files["scene/measurements.json"] || [],
      schemes: files["scene/schemes.json"] || [],
      clipping: files["scene/clipping.json"] || createDefaultClippingState(),
      clippingPresets: files["scene/clipping-presets.json"] || [],
      anchorStyleDefaults: files["scene/anchor-style-defaults.json"] || {
        anchor: {},
        camera: {}
      }
    },
    scripts: {
      animations: files["scripts/animations.json"] || [],
      triggers: files["scripts/triggers.json"] || []
    },
    assets: {
      sceneManifest: files["assets/scene-manifest.json"] || {}
    },
    integrations: {
      realtime: files["integrations/realtime.json"] || {},
      backendBridge: files["integrations/backend-bridge.json"] || {}
    }
  };
}

export function parseImportedProjectPackage(raw, metadata = {}) {
  if (!raw || typeof raw !== "object") {
    return createEmptyProjectPackage("", metadata);
  }
  if (raw.format === PROJECT_PACKAGE_BUNDLE_FORMAT) {
    return parseProjectPackageBundle(raw, metadata);
  }
  return raw;
}

function hasNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function hasClippingConfiguration(clipping) {
  if (!clipping || typeof clipping !== "object") return false;
  if (clipping.enabled || clipping.capEnabled) return true;
  if (clipping.mode === "box") {
    return ["x", "y", "z"].some(axis => Boolean(clipping.box?.[axis]?.enabled));
  }
  return Boolean(clipping.presetId);
}

export function hasProjectPackageContent(projectPackage) {
  if (!projectPackage || typeof projectPackage !== "object") return false;

  return Boolean(
    hasNonEmptyArray(projectPackage.scene?.anchors) ||
    hasNonEmptyArray(projectPackage.scene?.navigationTree) ||
    hasNonEmptyArray(projectPackage.scene?.cameras) ||
    hasNonEmptyArray(projectPackage.scene?.measurements) ||
    hasNonEmptyArray(projectPackage.scene?.schemes) ||
    hasNonEmptyArray(projectPackage.scene?.clippingPresets) ||
    Boolean(
      Object.keys(projectPackage.scene?.anchorStyleDefaults?.anchor || {})
        .length ||
      Object.keys(projectPackage.scene?.anchorStyleDefaults?.camera || {})
        .length
    ) ||
    hasClippingConfiguration(projectPackage.scene?.clipping) ||
    hasNonEmptyArray(projectPackage.assets?.sceneManifest?.groups) ||
    hasNonEmptyArray(projectPackage.assets?.sceneManifest?.lodLevels) ||
    hasNonEmptyArray(projectPackage.scripts?.animations) ||
    hasNonEmptyArray(projectPackage.scripts?.triggers) ||
    projectPackage.integrations?.realtime?.enabled ||
    projectPackage.integrations?.backendBridge?.enabled
  );
}

export function loadProjectPackage(scope, metadata = {}) {
  if (!scope) return createEmptyProjectPackage(scope, metadata);
  const storage = getStorageMap();
  const payload = storage[scope];
  if (!payload || typeof payload !== "object") {
    return createEmptyProjectPackage(scope, metadata);
  }
  return {
    ...createEmptyProjectPackage(scope, metadata),
    ...payload,
    metadata: {
      ...createEmptyProjectPackage(scope, metadata).metadata,
      ...(payload.metadata || {})
    },
    scene: {
      navigationTree: [],
      anchors: [],
      cameras: [],
      measurements: [],
      schemes: [],
      clipping: createDefaultClippingState(),
      clippingPresets: [],
      anchorStyleDefaults: {
        anchor: {},
        camera: {}
      },
      ...(payload.scene || {})
    },
    scripts: {
      animations: [],
      triggers: [],
      ...(payload.scripts || {})
    },
    assets: {
      sceneManifest: {
        ...createEmptyProjectPackage(scope, metadata).assets.sceneManifest,
        ...(payload.assets?.sceneManifest || {})
      },
      ...(payload.assets || {})
    },
    integrations: {
      realtime: {},
      backendBridge: {},
      ...(payload.integrations || {})
    }
  };
}

export function saveProjectPackage(scope, projectPackage) {
  if (!scope) return;
  const storage = getStorageMap();
  storage[scope] = {
    ...projectPackage,
    scope,
    updatedAt: Date.now()
  };
  saveStorageMap(storage);
}

export function patchProjectPackage(scope, patch, metadata = {}) {
  const current = loadProjectPackage(scope, metadata);
  const next = {
    ...current,
    ...patch,
    metadata: {
      ...current.metadata,
      ...(patch.metadata || {})
    },
    scene: {
      ...current.scene,
      ...(patch.scene || {})
    },
    scripts: {
      ...current.scripts,
      ...(patch.scripts || {})
    },
    integrations: {
      ...current.integrations,
      ...(patch.integrations || {})
    }
  };
  saveProjectPackage(scope, next);
  return next;
}

export function exportProjectPackage(scope, metadata = {}) {
  return JSON.stringify(loadProjectPackage(scope, metadata), null, 2);
}

export function exportProjectPackageBundle(scope, metadata = {}) {
  return JSON.stringify(
    createProjectPackageBundle(loadProjectPackage(scope, metadata)),
    null,
    2
  );
}

export function getProjectPackageStorageKey() {
  return PROJECT_PACKAGE_STORAGE_KEY;
}

export function getProjectPackageBundleFormat() {
  return PROJECT_PACKAGE_BUNDLE_FORMAT;
}
