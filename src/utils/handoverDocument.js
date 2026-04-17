function isAbsoluteUrl(url = "") {
  return /^(https?:)?\/\//i.test(url) || /^(blob|data):/i.test(url);
}

function normalizeUrlPath(url = "") {
  return String(url || "").trim();
}

function isBlobLike(value) {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

const DEV_REMOTE_ORIGIN = String(
  import.meta.env.VITE_DOCUMENT_DEV_REMOTE_ORIGIN || ""
).trim();

function getNormalizedExtension(input = "") {
  const source = normalizeUrlPath(input).toLowerCase();
  if (!source) return "";
  const clean = source.split("?")[0].split("#")[0];
  const filename = clean.split("/").pop() || clean;
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index + 1) : "";
}

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp"
]);
const MARKDOWN_EXTENSIONS = new Set(["md"]);
const TEXT_EXTENSIONS = new Set([
  "txt",
  "json",
  "xml",
  "csv",
  "log",
  "yml",
  "yaml",
  "ini",
  "conf",
  "js",
  "ts",
  "jsx",
  "tsx",
  "css",
  "scss",
  "less",
  "html",
  "htm",
  "java",
  "py",
  "sql",
  "sh",
  "bat"
]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "ogg", "mov", "m4v"]);
const DOCX_EXTENSIONS = new Set(["docx"]);
const EXCEL_EXTENSIONS = new Set(["xls", "xlsx"]);
const OFFICE_EXTENSIONS = new Set(["doc", "ppt", "pptx"]);

export function getLatestHandoverDocumentVersion(doc) {
  const versions = Array.isArray(doc?.versions) ? doc.versions : [];
  if (!versions.length) return null;

  return [...versions].filter(Boolean).sort((a, b) => {
    const versionDelta =
      Number(b?.versionNumber || 0) - Number(a?.versionNumber || 0);
    if (versionDelta !== 0) return versionDelta;
    return (
      new Date(b?.uploadedAt || 0).getTime() -
      new Date(a?.uploadedAt || 0).getTime()
    );
  })[0];
}

export function resolveHandoverDocumentUrl(url = "") {
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

export async function unwrapHandoverDocumentFileResponse(
  response,
  fallbackMessage
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

export function createHandoverDocumentObjectUrl(blob) {
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

export function triggerHandoverDocumentDownload(blob, fileName = "download") {
  const { url, revoke } = createHandoverDocumentObjectUrl(blob);
  if (!url) return false;

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(revoke, 1000);
  return true;
}

export function getHandoverDocumentUrl(doc) {
  const directUrl = normalizeUrlPath(doc?.url);
  if (directUrl) return resolveHandoverDocumentUrl(directUrl);

  const latestVersion = getLatestHandoverDocumentVersion(doc);
  const versionUrl = normalizeUrlPath(latestVersion?.url);
  if (versionUrl) return resolveHandoverDocumentUrl(versionUrl);

  return "";
}

export function getHandoverDocumentPreviewKind(doc) {
  const type = String(doc?.type || "")
    .trim()
    .toUpperCase();
  const mime = String(doc?.mime || "")
    .trim()
    .toLowerCase();
  const url = String(getHandoverDocumentUrl(doc) || doc?.url || "").trim();
  const extension =
    getNormalizedExtension(doc?.name) || getNormalizedExtension(url);

  if (type === "PDF" || mime.includes("pdf") || extension === "pdf") {
    return "pdf";
  }
  if (
    type === "IMAGE" ||
    mime.startsWith("image/") ||
    IMAGE_EXTENSIONS.has(extension)
  ) {
    return "image";
  }
  if (
    type === "MD" ||
    type === "MARKDOWN" ||
    mime === "text/markdown" ||
    MARKDOWN_EXTENSIONS.has(extension)
  ) {
    return "markdown";
  }
  if (
    type === "TEXT" ||
    mime.startsWith("text/") ||
    mime.includes("json") ||
    mime.endsWith("/xml") ||
    mime.endsWith("+xml") ||
    mime.includes("javascript") ||
    TEXT_EXTENSIONS.has(extension)
  ) {
    return "text";
  }
  if (
    type === "AUDIO" ||
    mime.startsWith("audio/") ||
    AUDIO_EXTENSIONS.has(extension)
  ) {
    return "audio";
  }
  if (
    type === "VIDEO" ||
    mime.startsWith("video/") ||
    VIDEO_EXTENSIONS.has(extension)
  ) {
    return "video";
  }
  if (
    type === "DOCX" ||
    mime.includes("wordprocessingml") ||
    DOCX_EXTENSIONS.has(extension)
  ) {
    return "docx";
  }
  if (
    type === "XLS" ||
    type === "XLSX" ||
    mime.includes("spreadsheetml") ||
    mime.includes("ms-excel") ||
    EXCEL_EXTENSIONS.has(extension)
  ) {
    return "excel";
  }
  if (
    type === "DOC" ||
    type === "PPT" ||
    type === "PPTX" ||
    mime.includes("presentationml") ||
    mime.includes("msword") ||
    mime.includes("ms-powerpoint") ||
    OFFICE_EXTENSIONS.has(extension)
  ) {
    return "office";
  }
  return "unknown";
}

export function isHandoverDocumentPreviewable(doc) {
  return getHandoverDocumentPreviewKind(doc) !== "unknown";
}

export function normalizeHandoverDocumentRecord(doc) {
  if (!doc || typeof doc !== "object") return doc;
  const latestVersion = getLatestHandoverDocumentVersion(doc);
  const url = getHandoverDocumentUrl(doc);
  const mime =
    String(doc?.mime || "").trim() || String(latestVersion?.mime || "").trim();
  const previewKind = getHandoverDocumentPreviewKind({
    ...doc,
    url,
    mime
  });

  return {
    ...doc,
    url,
    mime,
    previewKind,
    versions: Array.isArray(doc?.versions) ? doc.versions : []
  };
}
