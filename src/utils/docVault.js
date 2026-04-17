import { localForage } from "@/utils/localforage";

const KEY_PREFIX = "dd-docvault:";
const SESSION_KEY_PREFIX = "dd-docvault-key:";

function toBase64(uint8) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < uint8.length; i += chunk) {
    binary += String.fromCharCode(...uint8.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function ensureUserKey(username) {
  const user = String(username || "anonymous");
  const cacheKey = `${SESSION_KEY_PREFIX}${user}`;

  const existing = sessionStorage.getItem(cacheKey);
  if (existing) {
    const raw = fromBase64(existing);
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt"
    ]);
  }

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  sessionStorage.setItem(cacheKey, toBase64(raw));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt"
  ]);
}

function normalizeFileLike(fileLike) {
  if (!fileLike) return null;
  return fileLike.raw || fileLike;
}

function guessMime(fileLike, fallbackType = "application/octet-stream") {
  const raw = normalizeFileLike(fileLike);
  return raw?.type || fallbackType;
}

export function makeVaultRef({ docId, versionId }) {
  return `${String(docId || "")}:${String(versionId || "")}`;
}

export async function encryptToVault({ username, docId, versionId, fileLike }) {
  const raw = normalizeFileLike(fileLike);
  if (!(raw instanceof Blob)) {
    return { vaultRef: "", mime: "", size: 0 };
  }

  const key = await ensureUserKey(username);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new Uint8Array(await raw.arrayBuffer());
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plain
  );

  const cipher = new Uint8Array(cipherBuf);
  const vaultRef = makeVaultRef({ docId, versionId });
  const mime = guessMime(raw);

  await localForage().setItem(`${KEY_PREFIX}${vaultRef}`, {
    iv: toBase64(iv),
    cipher: toBase64(cipher),
    mime,
    size: raw.size || cipher.length
  });

  return { vaultRef, mime, size: raw.size || cipher.length };
}

export async function decryptVaultToBlob({ username, vaultRef }) {
  const key = await ensureUserKey(username);
  const record = await localForage().getItem(`${KEY_PREFIX}${vaultRef}`);
  if (!record) return null;

  const iv = fromBase64(record.iv);
  const cipher = fromBase64(record.cipher);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipher
  );
  const blob = new Blob([plainBuf], {
    type: record.mime || "application/octet-stream"
  });
  return blob;
}

export async function getVaultObjectUrl({ username, vaultRef }) {
  const blob = await decryptVaultToBlob({ username, vaultRef });
  if (!blob) return { url: "", revoke: () => {} };
  const url = URL.createObjectURL(blob);
  const revoke = () => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };
  return { url, revoke, blob };
}

export async function removeVault({ vaultRef }) {
  await localForage().removeItem(`${KEY_PREFIX}${vaultRef}`);
}
