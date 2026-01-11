export async function fetchMenu() {
  const response = await fetch("data/menu.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const items = await response.json();
  if (!Array.isArray(items)) {
    throw new Error("Invalid menu format");
  }
  return items.map((item) => ({
    id: String(item.id || ""),
    title: String(item.title || ""),
    price: Number(item.price || 0),
    description: String(item.description || ""),
    images: Array.isArray(item.images) ? item.images : [],
    tags: Array.isArray(item.tags) ? item.tags : [],
  }));
}
