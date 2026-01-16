export const QUICK_FILTERS = [
  { id: "spicy", label: "Острые" },
  { id: "meatless", label: "Без мяса" },
  { id: "kids", label: "Детские" },
  { id: "popular", label: "Популярные" },
];

export function getPopularIds(orders = [], limit = 3) {
  const counts = new Map();
  orders.forEach((order) => {
    order.items?.forEach((item) => {
      counts.set(item.id, (counts.get(item.id) || 0) + (item.qty || 0));
    });
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => String(id));
}

export function filterMenuItems(items, { filterId, favorites, popularIds, categoryIds }) {
  const normalizedFilter = String(filterId || "all");
  const activeFavorites = favorites instanceof Set ? favorites : new Set();
  const popularSet = new Set(popularIds || []);

  return (Array.isArray(items) ? items : [])
    .filter((item) => item.isAvailable !== false)
    .filter((item) => {
      const tags = Array.isArray(item.tags) ? item.tags : [];
      if (normalizedFilter === "favorite") return activeFavorites.has(item.id);
      if (normalizedFilter === "popular") return popularSet.has(item.id);
      if (normalizedFilter === "spicy") return tags.includes("spicy");
      if (normalizedFilter === "kids") return tags.includes("kids");
      if (normalizedFilter === "meatless") return !tags.includes("meat");
      if (categoryIds?.has(normalizedFilter)) return String(item.categoryId || "") === normalizedFilter;
      return true;
    });
}
