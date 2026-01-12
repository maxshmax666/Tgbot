import { z } from "zod";
import { json, handleError, parseJsonBody, requireAuth, ensureOwner } from "../../_utils.js";

const pageSchema = z.object({
  slug: z.string().min(1).max(80),
  title: z.string().min(1),
});

export async function onRequest({ env, request }) {
  try {
    await ensureOwner(env);
    await requireAuth(request, env);

    if (request.method === "GET") {
      const result = await env.DB.prepare(
        "SELECT id, slug, title, updated_at FROM pages ORDER BY updated_at DESC, id DESC"
      ).all();
      return json({ items: result.results || [] });
    }

    if (request.method === "POST") {
      const body = await parseJsonBody(request, pageSchema);
      const result = await env.DB.prepare(
        "INSERT INTO pages (slug, title, updated_at) VALUES (?, ?, datetime('now'))"
      )
        .bind(body.slug, body.title)
        .run();
      return json({ id: result.meta.last_row_id }, 201);
    }

    return json({ error: { message: "Method not allowed" } }, 405);
  } catch (err) {
    return handleError(err);
  }
}
