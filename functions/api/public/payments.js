import { z } from "zod";
import { getRequestId, json, handleError, parseJsonBody, RequestError, requireDb, requireEnv } from "../_utils.js";

const paymentSchema = z.object({
  order_id: z.string().min(1),
  method: z.enum(["card", "sbp"]),
  items: z
    .array(
      z.object({
        id: z.number().int().positive(),
        qty: z.number().int().positive(),
      })
    )
    .min(1),
  total: z.number().nonnegative(),
  customer: z
    .object({
      name: z.string().min(1).optional().nullable(),
      phone: z.string().min(3).optional().nullable(),
      email: z.string().email().optional().nullable(),
    })
    .optional()
    .nullable(),
});

const normalizeMoney = (value) => Math.round(value * 100) / 100;
const formatAmount = (value) => Number(value).toFixed(2);

const createYooKassaPayment = async ({ env, request, orderId, method, total }) => {
  const shopId = requireEnv(env.YOOKASSA_SHOP_ID, "YOOKASSA_SHOP_ID");
  const secretKey = requireEnv(env.YOOKASSA_SECRET_KEY, "YOOKASSA_SECRET_KEY");
  const returnUrl = env.PAYMENT_RETURN_URL || `${new URL(request.url).origin}/order-status`;

  const payload = {
    amount: { value: formatAmount(total), currency: "RUB" },
    capture: true,
    confirmation: method === "sbp" ? { type: "qr" } : { type: "redirect", return_url: returnUrl },
    payment_method_data: method === "sbp" ? { type: "sbp" } : { type: "bank_card" },
    description: `Order ${orderId}`,
    metadata: { order_id: orderId },
  };

  const authToken = btoa(`${shopId}:${secretKey}`);
  const response = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      authorization: `Basic ${authToken}`,
      "content-type": "application/json",
      "idempotence-key": `${orderId}-${method}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new RequestError(502, "Payment provider error", {
      provider: "yookassa",
      status: response.status,
      details: data,
    });
  }
  if (!data?.id) {
    throw new RequestError(502, "Payment provider error", {
      provider: "yookassa",
      status: response.status,
      details: data,
    });
  }
  return {
    payment_id: data.id,
    status: data.status,
    confirmation: data.confirmation,
    payment_url: data.confirmation?.confirmation_url,
  };
};

export async function onRequestPost({ env, request }) {
  const requestId = getRequestId(request);
  let orderId = null;

  try {
    const db = requireDb(env);
    const body = await parseJsonBody(request, paymentSchema);
    orderId = body.order_id;

    const productIds = [...new Set(body.items.map((item) => item.id))];
    const placeholders = productIds.map(() => "?").join(", ");
    const productsResult = await db
      .prepare(`SELECT id, title, price FROM products WHERE is_active = 1 AND id IN (${placeholders})`)
      .bind(...productIds)
      .all();
    const products = productsResult.results || [];
    const productMap = new Map(products.map((product) => [product.id, product]));
    const missingIds = productIds.filter((id) => !productMap.has(id));

    if (missingIds.length) {
      throw new RequestError(400, "Some products are missing or inactive", { missingIds });
    }

    const computedTotal = normalizeMoney(
      body.items.reduce((sum, item) => {
        const product = productMap.get(item.id);
        return sum + item.qty * product.price;
      }, 0)
    );
    const clientTotal = normalizeMoney(body.total);

    if (Math.abs(clientTotal - computedTotal) > 0.01) {
      throw new RequestError(400, "Total mismatch", { expectedTotal: computedTotal });
    }

    const provider = String(env.PAYMENT_PROVIDER || "yookassa").toLowerCase();
    let payment;
    if (provider === "yookassa") {
      payment = await createYooKassaPayment({
        env,
        request,
        orderId,
        method: body.method,
        total: computedTotal,
      });
    } else {
      throw new RequestError(500, "Unsupported payment provider");
    }

    return json(
      {
        ...payment,
        method: body.method,
      },
      200,
      { "x-request-id": requestId }
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        request_id: requestId,
        order_id: orderId,
        message: "payment_failed",
        error: String(err?.message || err),
      })
    );
    return handleError(err, requestId);
  }
}
