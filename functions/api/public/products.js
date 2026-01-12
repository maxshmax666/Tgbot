import { json, handleError } from "../_utils.js";

function normalizeImages(images) {
  return images.map((img) => ({ id: img.id, url: img.url, sort: img.sort }));
}

export async function onRequestGet({ env }) {
  try {
    const productsResult = await env.DB.prepare(
      "SELECT id, category_id, title, description, price, is_active, is_featured, sort, created_at, updated_at FROM products WHERE is_active = 1 ORDER BY sort ASC, id ASC"
    ).all();
    const products = productsResult.results || [];

    if (!products.length) return json({ items: [] });

    const ids = products.map((item) => item.id);
    const placeholders = ids.map(() => "?").join(", ");
    const imagesResult = await env.DB.prepare(
      `SELECT id, product_id, url, sort FROM product_images WHERE product_id IN (${placeholders}) ORDER BY sort ASC, id ASC`
    )
      .bind(...ids)
      .all();

    const imageMap = new Map();
    (imagesResult.results || []).forEach((img) => {
      if (!imageMap.has(img.product_id)) imageMap.set(img.product_id, []);
      imageMap.get(img.product_id).push(img);
    });

    const items = products.map((product) => ({
      ...product,
      images: normalizeImages(imageMap.get(product.id) || []),
    }));

    return json({ items });
  } catch (err) {
    return handleError(err);
  }
}
