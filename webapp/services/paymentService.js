export const PAYMENT_METHODS = {
  card: "card",
  sbp: "sbp",
  cash: "cash",
};

export const PAYMENT_STATUSES = {
  pending: "pending",
  ready: "ready",
  error: "error",
};

export async function preparePayment(order, method) {
  if (!order || !method) {
    return { status: PAYMENT_STATUSES.error, message: "Метод оплаты не выбран" };
  }

  return {
    status: PAYMENT_STATUSES.pending,
    method,
    metadata: {
      orderId: order.id,
    },
  };
}
