function buildImagesFromCount(baseId, photosCount) {
  const count = Number(photosCount);
  if (!baseId || !Number.isFinite(count) || count <= 0) return [];
  return Array.from({ length: count }, (_, index) => `assets/pizzas/${baseId}/${index + 1}.jpg`);
}

function normalizeMenuItem(item) {
  const id = String(item?.id ?? item?.slug ?? "");
  const title = String(item?.title ?? "");
  const description = String(item?.desc ?? item?.description ?? "");
  const price = Number(item?.price ?? 0);
  const images = Array.isArray(item?.images) ? item.images.filter(Boolean).map(String) : [];
  const slugBase = String(item?.slug ?? item?.id ?? "");
  const resolvedImages = images.length ? images : buildImagesFromCount(slugBase, item?.photosCount);
  return {
    id,
    title,
    price,
    description,
    desc: description,
    tags: Array.isArray(item?.tags) ? item.tags.map(String) : [],
    isAvailable: typeof item?.isAvailable === "boolean" ? item.isAvailable : true,
    images: resolvedImages,
  };
}

function parseMenuPayload(payload) {
  const itemsPayload = Array.isArray(payload) ? payload : payload?.items || [];
  const categories = Array.isArray(payload?.categories) ? payload.categories : [];
  const items = itemsPayload.map(normalizeMenuItem).filter((item) => item.id && item.title);
  return { items, categories };
}

export async function fetchMenu() {
  const response = await fetch("data/menu.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (text.trim().startsWith("<")) {
    throw new Error("menu.json returned HTML (wrong path)");
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error("menu.json is not valid JSON");
  }
  return parseMenuPayload(payload);
}
