function isAbsoluteUrl(url = "") {
  return /^(https?:)?\/\//i.test(url) || /^(blob|data):/i.test(url);
}

function normalizeUrlPath(url = "") {
  return String(url || "").trim();
}

const DEV_REMOTE_ORIGIN = String(
  import.meta.env.VITE_DOCUMENT_DEV_REMOTE_ORIGIN || ""
).trim();

export function resolveHandoverModelUrl(url = "") {
  const text = normalizeUrlPath(url);
  if (!text) return "";

  if (isAbsoluteUrl(text)) {
    if (
      import.meta.env.DEV &&
      DEV_REMOTE_ORIGIN &&
      typeof window !== "undefined"
    ) {
      try {
        const parsed = new URL(text);
        const remoteOrigin = new URL(DEV_REMOTE_ORIGIN);
        if (parsed.origin === remoteOrigin.origin) {
          return new URL(
            `${parsed.pathname}${parsed.search}${parsed.hash}`,
            window.location.origin
          ).href;
        }
      } catch {
        return text;
      }
    }
    return text;
  }

  const normalizedPath = `/${text.replace(/^\/+/, "")}`;
  if (typeof window === "undefined") return normalizedPath;
  return new URL(normalizedPath, window.location.origin).href;
}

export function normalizeHandoverModelRecord(model) {
  if (!model || typeof model !== "object") return model;
  return {
    ...model,
    url: resolveHandoverModelUrl(model.url)
  };
}
