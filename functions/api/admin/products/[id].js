import { z } from "zod";
import { json, handleError, parseJsonBody, requireAuth, ensureOwner, idSchema } from "../../_utils.js";

const imageSchema = z.object({
  url: z.string().url(),
  sort: z.number().int().nonnegative().default(0),
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
});

export async function onRequest({ env, request, params }) {
  try {
    await ensureOwner(env);
    await requireAuth(request, env);
    const id = idSchema.parse(params.id);

    if (request.method === "GET") {
      const product = await env.DB.prepare(
        "SELECT id, category_id, title, description, price, is_active, is_featured, sort, created_at, updated_at FROM products WHERE id = ? LIMIT 1"
      )
        .bind(id)
        .first();
      if (!product) return json({ item: null }, 404);
      const imagesResult = await env.DB.prepare(
        "SELECT id, product_id, url, sort FROM product_images WHERE product_id = ? ORDER BY sort ASC, id ASC"
      )
        .bind(id)
        .all();
      return json({ item: { ...product, images: imagesResult.results || [] } });
    }

    if (request.method === "PUT") {
      const body = await parseJsonBody(request, productSchema);
      await env.DB.prepare(
        `UPDATE products
         SET category_id = ?, title = ?, description = ?, price = ?, is_active = ?, is_featured = ?, sort = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
        .bind(
          body.categoryId || null,
          body.title,
          body.description || null,
          body.price,
          body.isActive ? 1 : 0,
          body.isFeatured ? 1 : 0,
          body.sort,
          id
        )
        .run();

      await env.DB.prepare("DELETE FROM product_images WHERE product_id = ?").bind(id).run();
      if (body.images.length) {
        const stmt = env.DB.prepare(
          "INSERT INTO product_images (product_id, url, sort) VALUES (?, ?, ?)"
        );
        for (const image of body.images) {
          await stmt.bind(id, image.url, image.sort).run();
        }
      }
      return json({ ok: true });
    }

    if (request.method === "DELETE") {
      await env.DB.prepare("DELETE FROM product_images WHERE product_id = ?").bind(id).run();
      await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }

    return json({ error: { message: "Method not allowed" } }, 405);
  } catch (err) {
    return handleError(err);
  }
}
