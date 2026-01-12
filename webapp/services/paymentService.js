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

  return {
    status: PAYMENT_STATUSES.pending,
    method,
    metadata: {
      orderId: order.order_id,
    },
  };
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
