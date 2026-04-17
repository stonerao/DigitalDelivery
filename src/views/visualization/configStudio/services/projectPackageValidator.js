function createFinding(level, path, message) {
  return {
    id: `${level}-${path}-${message}`,
    level,
    path,
    message
  };
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateScene(scene, findings) {
  if (!isObject(scene)) {
    findings.push(createFinding("error", "scene", "scene 必须是对象"));
    return;
  }

  const collectionFields = ["anchors", "cameras", "measurements", "schemes"];
  collectionFields.forEach(field => {
    if (!Array.isArray(scene[field])) {
      findings.push(
        createFinding("error", `scene.${field}`, `${field} 必须是数组`)
      );
    }
  });
}

function validateScripts(scripts, findings) {
  if (!isObject(scripts)) {
    findings.push(createFinding("error", "scripts", "scripts 必须是对象"));
    return;
  }

  if (!Array.isArray(scripts.animations)) {
    findings.push(
      createFinding("error", "scripts.animations", "animations 必须是数组")
    );
  }
  if (!Array.isArray(scripts.triggers)) {
    findings.push(
      createFinding("error", "scripts.triggers", "triggers 必须是数组")
    );
  }

  const animationIds = new Set();
  (scripts.animations || []).forEach((item, index) => {
    const path = `scripts.animations[${index}]`;
    if (!item?.id) {
      findings.push(createFinding("error", `${path}.id`, "动画必须提供 id"));
    } else if (animationIds.has(item.id)) {
      findings.push(createFinding("error", `${path}.id`, "动画 id 不能重复"));
    } else {
      animationIds.add(item.id);
    }
    if (!Array.isArray(item?.actions)) {
      findings.push(
        createFinding("error", `${path}.actions`, "动画 actions 必须是数组")
      );
    }
  });

  (scripts.triggers || []).forEach((item, index) => {
    const path = `scripts.triggers[${index}]`;
    if (!item?.id) {
      findings.push(createFinding("error", `${path}.id`, "触发器必须提供 id"));
    }
    if (!item?.event) {
      findings.push(
        createFinding(
          "warning",
          `${path}.event`,
          "触发器缺少 event，运行时不会命中"
        )
      );
    }
    if (!item?.animationId) {
      findings.push(
        createFinding(
          "error",
          `${path}.animationId`,
          "触发器必须绑定 animationId"
        )
      );
    } else if (!animationIds.has(item.animationId)) {
      findings.push(
        createFinding(
          "error",
          `${path}.animationId`,
          "触发器引用了不存在的 animationId"
        )
      );
    }
  });
}

function validateIntegrations(integrations, findings) {
  if (!isObject(integrations)) {
    findings.push(
      createFinding("error", "integrations", "integrations 必须是对象")
    );
    return;
  }

  const realtime = integrations.realtime;
  const backendBridge = integrations.backendBridge;

  if (!isObject(realtime)) {
    findings.push(
      createFinding("error", "integrations.realtime", "realtime 必须是对象")
    );
  } else {
    if (realtime.transport === "http" && !String(realtime.url || "").trim()) {
      findings.push(
        createFinding(
          "warning",
          "integrations.realtime.url",
          "Realtime 使用 HTTP 模式时建议配置 url"
        )
      );
    }
    if (realtime.points && !Array.isArray(realtime.points)) {
      findings.push(
        createFinding(
          "error",
          "integrations.realtime.points",
          "realtime.points 必须是数组"
        )
      );
    }
  }

  if (!isObject(backendBridge)) {
    findings.push(
      createFinding(
        "error",
        "integrations.backendBridge",
        "backendBridge 必须是对象"
      )
    );
  } else if (
    backendBridge.transport === "http" &&
    !String(backendBridge.endpoint || "").trim()
  ) {
    findings.push(
      createFinding(
        "warning",
        "integrations.backendBridge.endpoint",
        "BackendBridge 使用 HTTP 模式时建议配置 endpoint"
      )
    );
  }
}

function validateAssets(assets, findings) {
  if (!isObject(assets)) {
    findings.push(createFinding("warning", "assets", "建议补充 assets 配置"));
    return;
  }

  const sceneManifest = assets.sceneManifest;
  if (!isObject(sceneManifest)) {
    findings.push(
      createFinding(
        "warning",
        "assets.sceneManifest",
        "建议补充 scene-manifest.json 配置"
      )
    );
    return;
  }

  const hasDefaultModel = String(sceneManifest.defaultModelUrl || "").trim();
  const profiles = sceneManifest.qualityProfiles || {};
  const hasQualityModel = ["high", "medium", "low"].some(key =>
    String(profiles[key] || "").trim()
  );

  if (!hasDefaultModel && !hasQualityModel) {
    findings.push(
      createFinding(
        "warning",
        "assets.sceneManifest",
        "sceneManifest 至少应配置默认模型或质量档模型 URL"
      )
    );
  }

  if (sceneManifest.groups && !Array.isArray(sceneManifest.groups)) {
    findings.push(
      createFinding(
        "error",
        "assets.sceneManifest.groups",
        "sceneManifest.groups 必须是数组"
      )
    );
  }
  (sceneManifest.groups || []).forEach((group, index) => {
    if (group?.uuids && !Array.isArray(group.uuids)) {
      findings.push(
        createFinding(
          "error",
          `assets.sceneManifest.groups[${index}].uuids`,
          "资源分组 uuids 必须是数组"
        )
      );
    }
  });

  if (sceneManifest.lodLevels && !Array.isArray(sceneManifest.lodLevels)) {
    findings.push(
      createFinding(
        "error",
        "assets.sceneManifest.lodLevels",
        "sceneManifest.lodLevels 必须是数组"
      )
    );
  }
}

export function validateProjectPackage(projectPackage) {
  const findings = [];
  if (!isObject(projectPackage)) {
    return {
      valid: false,
      errors: 1,
      warnings: 0,
      findings: [createFinding("error", "root", "工程包必须是对象")]
    };
  }

  if (!String(projectPackage.version || "").trim()) {
    findings.push(createFinding("warning", "version", "建议补充工程包版本号"));
  }

  validateScene(projectPackage.scene, findings);
  validateScripts(projectPackage.scripts, findings);
  validateAssets(projectPackage.assets, findings);
  validateIntegrations(projectPackage.integrations, findings);

  const errors = findings.filter(item => item.level === "error").length;
  const warnings = findings.filter(item => item.level === "warning").length;

  return {
    valid: errors === 0,
    errors,
    warnings,
    findings
  };
}

export default validateProjectPackage;
