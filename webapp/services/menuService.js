import { STORAGE_KEYS, storage } from "./storageService.js";

function buildImages(slug, photosCount) {
  if (!slug || !photosCount) return [];
  const total = Math.max(0, Number(photosCount) || 0);
  if (!total) return [];
  const list = [];
  for (let i = 1; i <= total; i += 1) {
    const index = String(i).padStart(2, "0");
    list.push(`/assets/pizzas/${slug}/${slug}_${index}.jpg`);
  }
  return list;
}

function normalizeMenu(items) {
  if (!Array.isArray(items)) throw new Error("Invalid menu format");
  return items
    .map((item) => {
      const id = String(item.id || item.slug || "");
      const slug = String(item.slug || item.id || "");
      const photosCount = Number(item.photosCount || 0);
      return {
        id,
        slug,
        title: String(item.title || ""),
        price: Number(item.price || 0),
        description: String(item.desc || item.description || ""),
        tags: Array.isArray(item.tags) ? item.tags : [],
        isAvailable: item.isAvailable !== false,
        images: buildImages(slug, photosCount),
        photosCount,
      };
    })
    .filter((item) => item.id && item.title);
}

export async function fetchMenu() {
  const cached = storage.read(STORAGE_KEYS.adminMenu, null);
  if (cached?.items && Array.isArray(cached.items)) {
    return normalizeMenu(cached.items);
  }

  const response = await fetch("/data/menu.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const items = await response.json();
  return normalizeMenu(items);
}
