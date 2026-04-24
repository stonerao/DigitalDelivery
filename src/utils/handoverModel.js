function isAbsoluteUrl(url = "") {
  return /^(https?:)?\/\//i.test(url) || /^(blob|data):/i.test(url);
}

function normalizeUrlPath(url = "") {
  return String(url || "").trim();
}

function isLoopbackHost(hostname = "") {
  const value = String(hostname || "")
    .trim()
    .toLowerCase();
  return value === "localhost" || value === "127.0.0.1" || value === "::1";
}

function rewriteLoopbackUrlToCurrentOrigin(url = "") {
  if (typeof window === "undefined") return url;
  try {
    const parsed = new URL(url);
    const currentOrigin = new URL(window.location.origin);
    if (!isLoopbackHost(parsed.hostname)) return url;
    if (isLoopbackHost(currentOrigin.hostname)) return url;
    return new URL(
      `${parsed.pathname}${parsed.search}${parsed.hash}`,
      currentOrigin.origin
    ).href;
  } catch {
    return url;
  }
}

function isBlobLike(value) {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

const DEV_REMOTE_ORIGIN = String(
  import.meta.env.VITE_DOCUMENT_DEV_REMOTE_ORIGIN || ""
).trim();

export function resolveHandoverModelUrl(url = "") {
  const text = normalizeUrlPath(url);
  if (!text) return "";

  if (isAbsoluteUrl(text)) {
    const loopbackRewrittenUrl = rewriteLoopbackUrlToCurrentOrigin(text);
    if (loopbackRewrittenUrl !== text) {
      return loopbackRewrittenUrl;
    }
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
    url: resolveHandoverModelUrl(model.url),
    thumbnailUrl: resolveHandoverModelUrl(
      model.thumbnailUrl || model.thumbnail || ""
    )
  };
}

export async function unwrapHandoverModelThumbnailResponse(
  response,
  fallbackMessage = "获取模型预览图失败"
) {
  const blob = isBlobLike(response)
    ? response
    : isBlobLike(response?.data)
      ? response.data
      : null;

  if (!blob) {
    throw new Error(fallbackMessage);
  }

  const mime = String(blob.type || "").toLowerCase();
  if (mime.includes("application/json") || mime.startsWith("text/")) {
    try {
      const text = await blob.text();
      const parsed = JSON.parse(text);
      throw new Error(parsed?.message || fallbackMessage);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(fallbackMessage);
    }
  }

  return blob;
}

export function createHandoverModelObjectUrl(blob) {
  if (!isBlobLike(blob) || typeof URL?.createObjectURL !== "function") {
    return {
      url: "",
      revoke: () => {}
    };
  }

  const url = URL.createObjectURL(blob);
  return {
    url,
    revoke: () => {
      URL.revokeObjectURL(url);
    }
  };
}
