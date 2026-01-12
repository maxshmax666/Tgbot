let cachedBaseUrl = null;

function normalizeBaseUrl(value) {
  if (!value) return "";
  return String(value).trim().replace(/\/+$/, "");
}

export function getPublicMediaBaseUrl() {
  if (cachedBaseUrl !== null) return cachedBaseUrl;
  cachedBaseUrl = normalizeBaseUrl(globalThis.PUBLIC_MEDIA_BASE_URL);
  return cachedBaseUrl;
}

export function resolveMediaUrl(url) {
  if (!url) return "";
  const raw = String(url).trim();
  if (!raw) return "";
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("blob:")) {
    return raw;
  }
  const base = getPublicMediaBaseUrl();
  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  return base ? `${base}${normalized}` : normalized;
}
