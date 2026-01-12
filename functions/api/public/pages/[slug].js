import { json, handleError, RequestError } from "../../_utils.js";

export async function onRequestGet({ env, params }) {
  try {
    const slug = params.slug;
    const page = await env.DB.prepare(
      "SELECT id, slug, title, updated_at FROM pages WHERE slug = ? LIMIT 1"
    )
      .bind(slug)
      .first();
    if (!page) throw new RequestError(404, "Page not found");

    const blocksResult = await env.DB.prepare(
      "SELECT id, page_id, sort, type, props_json, updated_at FROM page_blocks WHERE page_id = ? ORDER BY sort ASC, id ASC"
    )
      .bind(page.id)
      .all();

    const blocks = (blocksResult.results || []).map((block) => ({
      ...block,
      props: block.props_json ? JSON.parse(block.props_json) : {},
    }));

    return json({ page, blocks });
  } catch (err) {
    return handleError(err);
  }
}
