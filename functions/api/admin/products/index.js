import { z } from "zod";
import { json, handleError, parseJsonBody, ensureOwner } from "../../_utils.js";

const imageSchema = z.object({
  url: z.string().url(),
  sort: z.number().int().nonnegative().default(0),
});

const ingredientSchema = z.object({
  ingredientId: z.number().int().positive(),
  qtyGrams: z.number().positive(),
});

const productSchema = z.object({
  categoryId: z.number().int().positive().nullable().optional(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  price: z.number().nonnegative(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sort: z.number().int().nonnegative().default(0),
  images: z.array(imageSchema).default([]),
  ingredients: z.array(ingredientSchema).default([]),
});

function normalizeImages(images) {
  return images.map((img) => ({ id: img.id, url: img.url, sort: img.sort }));
}

export async function onRequest({ env, request }) {
  try {
    await ensureOwner(request, env);

    if (request.method === "GET") {
      const productsResult = await env.DB.prepare(
        "SELECT id, category_id, title, description, price, is_active, is_featured, sort, created_at, updated_at FROM products ORDER BY sort ASC, id ASC"
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

      const ingredientsResult = await env.DB.prepare(
        `SELECT pi.product_id, pi.ingredient_id, pi.qty_grams, i.title, i.unit
         FROM product_ingredients pi
         JOIN ingredients i ON i.id = pi.ingredient_id
         WHERE pi.product_id IN (${placeholders})
         ORDER BY i.title ASC`
      )
        .bind(...ids)
        .all();
      const ingredientMap = new Map();
      (ingredientsResult.results || []).forEach((row) => {
        if (!ingredientMap.has(row.product_id)) ingredientMap.set(row.product_id, []);
        ingredientMap.get(row.product_id).push(row);
      });

      const items = products.map((product) => ({
        ...product,
        images: normalizeImages(imageMap.get(product.id) || []),
        ingredients: ingredientMap.get(product.id) || [],
      }));
      return json({ items });
    }

    if (request.method === "POST") {
      const body = await parseJsonBody(request, productSchema);
      const result = await env.DB.prepare(
        `INSERT INTO products
          (category_id, title, description, price, is_active, is_featured, sort, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      )
        .bind(
          body.categoryId || null,
          body.title,
          body.description || null,
          body.price,
          body.isActive ? 1 : 0,
          body.isFeatured ? 1 : 0,
          body.sort
        )
        .run();
      const productId = result.meta.last_row_id;
      if (body.images.length) {
        const stmt = env.DB.prepare(
          "INSERT INTO product_images (product_id, url, sort) VALUES (?, ?, ?)"
        );
        for (const image of body.images) {
          await stmt.bind(productId, image.url, image.sort).run();
        }
      }
      if (body.ingredients.length) {
        const stmt = env.DB.prepare(
          "INSERT INTO product_ingredients (product_id, ingredient_id, qty_grams) VALUES (?, ?, ?)"
        );
        for (const ingredient of body.ingredients) {
          await stmt.bind(productId, ingredient.ingredientId, ingredient.qtyGrams).run();
        }
      }
      return json({ id: productId }, 201);
    }

    return json({ error: { message: "Method not allowed" } }, 405);
  } catch (err) {
    return handleError(err);
  }
}
