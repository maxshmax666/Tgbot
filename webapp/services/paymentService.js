import { STORAGE_KEYS } from "./storageService.js";

export const PAYMENT_METHODS = {
  card: "card",
  sbp: "sbp",
  cash: "cash",
};

export const PAYMENT_STATUSES = {
  pending: "pending",
  ok: "ok",
  failed: "failed",
};

export async function preparePayment(order, method) {
  if (!order || !method) {
    return { status: PAYMENT_STATUSES.failed, message: "Метод оплаты не выбран" };
  }
  if (method === PAYMENT_METHODS.cash) {
    return {
      status: PAYMENT_STATUSES.pending,
      method,
      payment_id: null,
      metadata: {
        orderId: order.order_id,
      },
    };
  }

  try {
    const response = await fetch("/api/public/payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        order_id: order.order_id,
        method,
        total: Number(order.total),
        items: order.items.map((item) => ({
          id: Number(item.id),
          qty: Number(item.qty),
        })),
        customer: {
          name: order.customer?.name,
          phone: order.customer?.phone,
        },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error?.message || "Ошибка создания платежа";
      throw new Error(message);
    }
    return {
      status: payload.status || PAYMENT_STATUSES.pending,
      method,
      payment_id: payload.payment_id,
      payment_url: payload.payment_url,
      confirmation: payload.confirmation,
      metadata: {
        orderId: order.order_id,
      },
    };
  } catch (error) {
    console.error("Payment create failed", error);
    return {
      status: PAYMENT_STATUSES.failed,
      method,
      message: error?.message || "Не удалось создать платеж",
      metadata: {
        orderId: order.order_id,
      },
    };
  }
}

export function getPromoList(storageService) {
  if (!storageService) return [];
  const promos = storageService.read(STORAGE_KEYS.adminPromos, []);
  return Array.isArray(promos) ? promos : [];
}

export function applyPromo(total, promo) {
  if (!promo || !promo.active) return { total, discount: 0 };
  if (promo.expiresAt) {
    const now = Date.now();
    const expires = Date.parse(promo.expiresAt);
    if (!Number.isNaN(expires) && now > expires) {
      return { total, discount: 0 };
    }
  }
  const value = Number(promo.value || 0);
  if (promo.type === "percent") {
    const discount = Math.round((total * value) / 100);
    return { total: Math.max(0, total - discount), discount };
  }
  const discount = Math.min(total, value);
  return { total: Math.max(0, total - discount), discount };
}
