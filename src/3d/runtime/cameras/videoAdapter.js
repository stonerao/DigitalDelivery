const FLV_CDN_URLS = [
  "https://cdn.jsdelivr.net/npm/flv.js@1.6.2/dist/flv.min.js",
  "https://unpkg.com/flv.js@1.6.2/dist/flv.min.js"
];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existed = document.querySelector(
      `script[data-video-adapter="${src}"]`
    );
    if (existed) {
      if (window.flvjs) resolve(window.flvjs);
      else
        existed.addEventListener("load", () => resolve(window.flvjs), {
          once: true
        });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.videoAdapter = src;
    script.onload = () => resolve(window.flvjs);
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureFlvJs() {
  if (window.flvjs) return window.flvjs;
  let lastError = null;
  for (const url of FLV_CDN_URLS) {
    try {
      const flvjs = await loadScript(url);
      if (flvjs) return flvjs;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("FLV adapter unavailable");
}

export function createVideoAdapter() {
  let player = null;
  let mountedElement = null;
  let activeSource = null;

  function destroy() {
    if (player?.destroy) player.destroy();
    player = null;
    if (mountedElement) {
      mountedElement.pause?.();
      mountedElement.removeAttribute("src");
      mountedElement.load?.();
    }
    mountedElement = null;
    activeSource = null;
  }

  function canPlay(streamType = "", url = "") {
    const type = String(streamType || "").toLowerCase();
    if (type === "mp4") return true;
    if (type === "flv") return true;
    if (!type && /\.mp4($|\?)/i.test(url)) return true;
    if (!type && /\.flv($|\?)/i.test(url)) return true;
    return false;
  }

  async function mount(videoElement, source = {}) {
    if (!videoElement) throw new Error("Missing video element");
    const streamType = String(source.streamType || "").toLowerCase();
    const streamUrl = String(source.streamUrl || "").trim();
    if (!streamUrl) throw new Error("Missing stream url");

    destroy();
    mountedElement = videoElement;
    activeSource = source;

    if (
      streamType === "mp4" ||
      (!streamType && /\.mp4($|\?)/i.test(streamUrl))
    ) {
      videoElement.src = streamUrl;
      videoElement.load?.();
      return { mode: "native" };
    }

    if (streamType === "flv" || /\.flv($|\?)/i.test(streamUrl)) {
      const flvjs = await ensureFlvJs();
      if (!flvjs?.isSupported?.()) {
        throw new Error("Current browser does not support FLV playback");
      }
      player = flvjs.createPlayer(
        {
          type: "flv",
          url: streamUrl
        },
        {
          enableWorker: true,
          stashInitialSize: 128
        }
      );
      player.attachMediaElement(videoElement);
      player.load();
      return { mode: "flv" };
    }

    throw new Error(`Unsupported stream type: ${streamType || "unknown"}`);
  }

  return {
    canPlay,
    mount,
    destroy,
    getActiveSource: () => activeSource
  };
}
