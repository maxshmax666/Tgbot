import { json, handleError, ensureOwner } from "../../_utils.js";

export async function onRequest({ env, request }) {
  try {
    await ensureOwner(request, env);

    if (request.method === "GET") {
      const result = await env.DB.prepare(
        `SELECT ingredients.id,
                ingredients.title,
                ingredients.unit,
                ingredients.is_active,
                COALESCE(inventory.qty_available, 0) AS qty_available
         FROM ingredients
         LEFT JOIN inventory ON inventory.ingredient_id = ingredients.id
         ORDER BY ingredients.title ASC`
      ).all();
      return json({ items: result.results || [] });
    }

    return json({ error: { message: "Method not allowed" } }, 405);
  } catch (err) {
    return handleError(err);
  }
}
