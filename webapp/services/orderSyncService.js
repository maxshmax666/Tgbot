import { getPendingOrders, removePendingOrder, updateOrderStatus } from "./storageService.js";

let syncing = false;

async function sendOrderPayload(payload) {
  const response = await fetch("/api/public/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Order sync failed: ${response.status}`);
  }
}

export async function syncPendingOrders() {
  if (syncing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const queue = getPendingOrders();
  if (!queue.length) return;

  syncing = true;
  try {
    for (const order of queue) {
      try {
        await sendOrderPayload(order.payload);
        removePendingOrder(order.order_id);
        updateOrderStatus(order.order_id, "order:sent");
      } catch (error) {
        console.warn("Pending order sync failed", error);
      }
    }
  } finally {
    syncing = false;
  }
}
