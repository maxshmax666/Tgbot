function normalizeProducts(items, categories) {
  if (!Array.isArray(items)) throw new Error("Invalid products format");
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  return items
    .map((item) => {
      const category = categoryMap.get(item.category_id) || null;
      return {
        id: String(item.id),
        title: String(item.title || ""),
        price: Number(item.price || 0),
        description: String(item.description || ""),
        tags: category ? [category.title] : [],
        isAvailable: item.is_active !== 0,
        images: Array.isArray(item.images) ? item.images.map((img) => img.url) : [],
        categoryId: item.category_id,
        categoryTitle: category?.title || "",
      };
    })
    .filter((item) => item.id && item.title);
}

export async function fetchMenu() {
  const [categoriesResponse, productsResponse] = await Promise.all([
    fetch("/api/public/categories", { cache: "no-store" }),
    fetch("/api/public/products", { cache: "no-store" }),
  ]);
  if (!categoriesResponse.ok) throw new Error(`HTTP ${categoriesResponse.status}`);
  if (!productsResponse.ok) throw new Error(`HTTP ${productsResponse.status}`);
  const categoriesPayload = await categoriesResponse.json();
  const productsPayload = await productsResponse.json();
  const categories = categoriesPayload.items || [];
  const items = normalizeProducts(productsPayload.items || [], categories);
  return { items, categories };
}
