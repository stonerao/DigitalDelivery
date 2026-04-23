function normalizeRelationPart(value) {
  return String(value || "").trim();
}

function escapeRelationPart(value) {
  return normalizeRelationPart(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function unescapeRelationPart(value) {
  return String(value || "")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .trim();
}

export function buildModelNodeRelationName({
  modelId = "",
  nodeName = ""
} = {}) {
  const normalizedModelId = normalizeRelationPart(modelId);
  const normalizedNodeName = normalizeRelationPart(nodeName);
  if (!normalizedModelId || !normalizedNodeName) return "";
  return `['${escapeRelationPart(normalizedModelId)}', '${escapeRelationPart(normalizedNodeName)}']`;
}

export function parseModelNodeRelationName(value = "") {
  const text = normalizeRelationPart(value);
  const match = text.match(
    /^\[\s*(['"])((?:\\.|(?!\1).)*)\1\s*,\s*(['"])((?:\\.|(?!\3).)*)\3\s*\]$/
  );
  if (!match) {
    return {
      modelId: "",
      nodeName: ""
    };
  }

  return {
    modelId: unescapeRelationPart(match[2]),
    nodeName: unescapeRelationPart(match[4])
  };
}

export function getModelNodeRelationKey({ modelId = "", nodeName = "" } = {}) {
  const normalizedModelId = normalizeRelationPart(modelId);
  const normalizedNodeName = normalizeRelationPart(nodeName);
  if (!normalizedModelId || !normalizedNodeName) return "";
  return `${normalizedModelId}::${normalizedNodeName}`;
}

export function getRelationRecordModelNodeKey(record) {
  const sourceId = normalizeRelationPart(record?.sourceId);
  const parsed = parseModelNodeRelationName(record?.nodeName);
  return getModelNodeRelationKey({
    modelId: parsed.modelId || sourceId,
    nodeName: parsed.nodeName
  });
}
