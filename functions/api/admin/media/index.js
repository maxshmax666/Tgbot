import { json, handleError, ensureOwner } from "../../_utils.js";

async function loadStaticMedia(request) {
  try {
    const response = await fetch(new URL("/data/menu.json", request.url));
    if (!response.ok) return [];
    const payload = await response.json();
    if (!Array.isArray(payload)) return [];
    const urls = payload.flatMap((item) => (Array.isArray(item.images) ? item.images : []));
    const unique = Array.from(new Set(urls.filter(Boolean).map(String)));
    return unique.map((url) => ({
      id: `static:${url}`,
      key: url,
      url,
      created_at: null,
      meta: { name: url.split("/").pop() || url },
    }));
  } catch (error) {
    console.warn("Failed to load static media list", error);
    return [];
  }
}

export async function onRequestGet({ env, request }) {
  try {
    await ensureOwner(request, env);
    const result = await env.DB.prepare(
      "SELECT id, key, url, created_at, meta_json FROM media ORDER BY created_at DESC, id DESC"
    ).all();
    const dbItems = (result.results || []).map((row) => ({
      ...row,
      meta: row.meta_json ? JSON.parse(row.meta_json) : {},
    }));
    const staticItems = await loadStaticMedia(request);
    const items = [...dbItems, ...staticItems];
    return json({ items });
  } catch (err) {
    return handleError(err);
  }
}
