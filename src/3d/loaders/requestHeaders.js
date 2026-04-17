import { formatToken, getToken } from "@/utils/auth";

function isSameOriginRequest(url) {
  const targetUrl = String(url || "").trim();
  if (!targetUrl) return false;
  if (targetUrl.startsWith("blob:") || targetUrl.startsWith("data:")) {
    return false;
  }

  if (typeof window === "undefined") return true;

  try {
    const resolved = new URL(targetUrl, window.location.origin);
    return resolved.origin === window.location.origin;
  } catch {
    return !/^[a-z][a-z0-9+.-]*:/i.test(targetUrl);
  }
}

export function getModelRequestHeaders(url) {
  if (!isSameOriginRequest(url)) return {};

  const token = getToken()?.accessToken;
  if (!token) return {};

  return {
    Authorization: formatToken(token)
  };
}

export function applyModelRequestHeaders(loader, url) {
  const headers = getModelRequestHeaders(url);
  if (headers.Authorization && typeof loader?.setRequestHeader === "function") {
    loader.setRequestHeader(headers);
  }
  return headers;
}
