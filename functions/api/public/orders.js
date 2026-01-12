import { z } from "zod";
import { json, handleError, parseJsonBody, RequestError, requireDb } from "../_utils.js";

const orderSchema = z.object({
  customerName: z.string().min(1),
  phone: z.string().min(3),
  address: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      title: z.string().min(1),
      qty: z.number().int().positive(),
      price: z.number().nonnegative(),
    })
  ),
  total: z.number().nonnegative(),
});

const normalizeMoney = (value) => Math.round(value * 100) / 100;

export async function onRequestPost({ env, request }) {
  try {
    const db = requireDb(env);
    const body = await parseJsonBody(request, orderSchema);

    if (!body.items.length) {
      throw new RequestError(400, "Items are required");
    }

    const productIds = [...new Set(body.items.map((item) => item.id))];
    const placeholders = productIds.map(() => "?").join(", ");
    const productsResult = await db
      .prepare(
        `SELECT id, title, price FROM products WHERE is_active = 1 AND id IN (${placeholders})`
      )
      .bind(...productIds)
      .all();
    const products = productsResult.results || [];
    const productMap = new Map(products.map((product) => [product.id, product]));
    const missingIds = productIds.filter((id) => !productMap.has(id));

    if (missingIds.length) {
      throw new RequestError(400, "Some products are missing or inactive", { missingIds });
    }

    const normalizedItems = body.items.map((item) => {
      const product = productMap.get(item.id);
      return {
        id: product.id,
        title: product.title,
        qty: item.qty,
        unit_price: product.price,
      };
    });

    const computedTotal = normalizeMoney(
      normalizedItems.reduce((sum, item) => sum + item.qty * item.unit_price, 0)
    );
    const clientTotal = normalizeMoney(body.total);

    if (Math.abs(clientTotal - computedTotal) > 0.01) {
      throw new RequestError(400, "Total mismatch", { expectedTotal: computedTotal });
    }

    const result = await db
      .prepare(
        `INSERT INTO orders (created_at, status, customer_name, phone, address, comment, items_json, total)
         VALUES (datetime('now'), 'new', ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        body.customerName,
        body.phone,
        body.address || null,
        body.comment || null,
        JSON.stringify(normalizedItems),
        computedTotal
      )
      .run();

    return json({ id: result.meta.last_row_id, status: "new" }, 201);
  } catch (err) {
    return handleError(err);
  }
}
