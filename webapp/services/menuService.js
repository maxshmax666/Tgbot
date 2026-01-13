import { resolveMediaUrl } from "./mediaBase.js";

function buildImagesFromCount(baseId, photosCount) {
  const count = Number(photosCount);
  if (!baseId || !Number.isFinite(count) || count <= 0) return [];
  return Array.from({ length: count }, (_, index) =>
    resolveMediaUrl(`assets/pizzas/${baseId}/${baseId}_${String(index + 1).padStart(2, "0")}.jpg`)
  );
}

function normalizeMenuItem(item) {
  const id = String(item?.id ?? item?.slug ?? "");
  const title = String(item?.title ?? "");
  const description = String(item?.desc ?? item?.description ?? "");
  const price = Number(item?.price ?? 0);
  const images = Array.isArray(item?.images)
    ? item.images
        .filter(Boolean)
        .map((image) => (typeof image === "string" ? image : image?.url))
        .filter(Boolean)
        .map(String)
    : [];
  const slugBase = String(item?.slug ?? item?.id ?? "");
  const resolvedImages = (images.length ? images : buildImagesFromCount(slugBase, item?.photosCount)).map(
    resolveMediaUrl
  );
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

function collectPayloadKeys(value) {
  if (!value || typeof value !== "object") return [];
  return Object.keys(value);
}

function firstArrayCandidate(...candidates) {
  return candidates.find(Array.isArray);
}

function parseMenuPayload(payload) {
  const rawItemsPayload = firstArrayCandidate(
    payload,
    payload?.items,
    payload?.items?.items,
    payload?.data?.items,
    payload?.data?.items?.items,
    payload?.result?.items
  );
  const itemsPayload = Array.isArray(rawItemsPayload) ? rawItemsPayload : [];
  if (!Array.isArray(rawItemsPayload)) {
    const diagnostic = {
      message: "Menu items payload has unexpected shape.",
      payloadKeys: collectPayloadKeys(payload),
      dataKeys: collectPayloadKeys(payload?.data),
      resultKeys: collectPayloadKeys(payload?.result),
      itemsKeys: collectPayloadKeys(payload?.items),
    };
    console.error(diagnostic);
  }
  if (!Array.isArray(itemsPayload)) {
    throw new Error("Menu items payload is not an array after normalization.");
  }

  const rawCategoriesPayload = firstArrayCandidate(
    payload?.categories,
    payload?.categories?.items,
    payload?.categories?.items?.items,
    payload?.data?.items,
    payload?.data?.items?.items,
    payload?.data?.categories,
    payload?.data?.categories?.items,
    payload?.data?.categories?.items?.items,
    payload?.result?.items,
    payload?.result?.items?.items,
    payload?.result?.categories,
    payload?.result?.categories?.items,
    payload?.result?.categories?.items?.items
  );
  const categories = Array.isArray(rawCategoriesPayload) ? rawCategoriesPayload : [];
  if (!Array.isArray(rawCategoriesPayload)) {
    const diagnostic = {
      message: "Menu categories payload has unexpected shape.",
      payloadKeys: collectPayloadKeys(payload),
      dataKeys: collectPayloadKeys(payload?.data),
      resultKeys: collectPayloadKeys(payload?.result),
      categoriesKeys: collectPayloadKeys(payload?.categories),
    };
    console.error(diagnostic);
  }
  if (!Array.isArray(categories)) {
    throw new Error("Menu categories payload is not an array after normalization.");
  }

  const items = itemsPayload.map(normalizeMenuItem).filter((item) => item.id && item.title);
  return { items, categories };
}

async function fetchLocalMenu() {
  const response = await fetch("/data/menu.json", { cache: "no-store" });
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

function isFallbackEligible(error) {
  return error?.isFallback === true;
}

async function fetchApiJson(url) {
  let response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (error) {
    const networkError = new Error(`Network error while fetching ${url}`);
    networkError.cause = error;
    networkError.isFallback = true;
    throw networkError;
  }
  if (!response.ok) {
    const httpError = new Error(`HTTP ${response.status} for ${url}`);
    httpError.isFallback = response.status >= 500;
    httpError.status = response.status;
    httpError.cause = response;
    throw httpError;
  }
  return response.json();
}

export async function fetchMenu() {
  try {
    const [productsResponse, categoriesResponse] = await Promise.all([
      fetchApiJson("/api/public/products"),
      fetchApiJson("/api/public/categories"),
    ]);
    return parseMenuPayload({
      items: productsResponse.items ?? productsResponse,
      categories: categoriesResponse.items ?? categoriesResponse,
    });
  } catch (error) {
    if (!isFallbackEligible(error)) {
      throw error;
    }
    try {
      return await fetchLocalMenu();
    } catch (fallbackError) {
      const combinedError = new Error("Menu fetch failed (API and local fallback).");
      combinedError.cause = { api: error, fallback: fallbackError };
      combinedError.apiError = error;
      combinedError.fallbackError = fallbackError;
      throw combinedError;
    }
  }
}
