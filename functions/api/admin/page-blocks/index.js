import { z } from "zod";
import { json, handleError, parseJsonBody, requireAuth, ensureOwner } from "../../_utils.js";

const blockSchema = z.object({
  pageId: z.number().int().positive(),
  sort: z.number().int().nonnegative().default(0),
  type: z.string().min(1),
  props: z.record(z.any()).default({}),
});

export async function onRequest({ env, request }) {
  try {
    await ensureOwner(env);
    await requireAuth(request, env);

    if (request.method === "GET") {
      const url = new URL(request.url);
      const pageId = Number(url.searchParams.get("page_id"));
      if (!pageId) return json({ items: [] });
      const result = await env.DB.prepare(
        "SELECT id, page_id, sort, type, props_json, updated_at FROM page_blocks WHERE page_id = ? ORDER BY sort ASC, id ASC"
      )
        .bind(pageId)
        .all();
      const items = (result.results || []).map((row) => ({
        ...row,
        props: row.props_json ? JSON.parse(row.props_json) : {},
      }));
      return json({ items });
    }

    if (request.method === "POST") {
      const body = await parseJsonBody(request, blockSchema);
      const result = await env.DB.prepare(
        "INSERT INTO page_blocks (page_id, sort, type, props_json, updated_at) VALUES (?, ?, ?, ?, datetime('now'))"
      )
        .bind(body.pageId, body.sort, body.type, JSON.stringify(body.props))
        .run();
      return json({ id: result.meta.last_row_id }, 201);
    }

    return json({ error: { message: "Method not allowed" } }, 405);
  } catch (err) {
    return handleError(err);
  }
}
