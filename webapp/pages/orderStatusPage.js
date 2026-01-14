import { createElement, clearElement } from "../ui/dom.js";
import { createButton } from "../ui/button.js";
import {
  getLastOrderStatus,
  getOrders,
  setLastOrderStatus,
  updateOrderStatus,
} from "../services/storageService.js";
import { formatPrice } from "../services/format.js";

const STATUS_LABELS = {
  "order:creating": "Создаём заказ",
  "order:sent": "Заказ отправлен",
  "order:success": "Заказ принят",
  "order:pending_sync": "Ожидает синхронизации",
  "order:error": "Ошибка отправки",
};

export function renderOrderStatusPage({ navigate }) {
  const root = createElement("section", { className: "list" });
  const content = createElement("div");
  root.appendChild(content);
  let statusError = null;
  let pollTimeout = null;
  const minDelayMs = 2000;
  const maxDelayMs = 30000;
  const delayMultiplier = 1.6;
  let currentDelayMs = minDelayMs;

  const resolveQrSrc = (confirmation) => {
    const raw = confirmation?.confirmation_data || confirmation?.confirmation_url;
    if (!raw) return null;
    if (raw.startsWith("data:")) return raw;
    if (/^[A-Za-z0-9+/=]+$/.test(raw)) {
      return `data:image/png;base64,${raw}`;
    }
    if (/^https?:\/\//.test(raw)) return raw;
    return null;
  };

  const render = () => {
    clearElement(content);
    const status = getLastOrderStatus();
    const orders = getOrders();
    const latest = orders[0];
    const requestId = latest?.request_id || status?.request_id;
    const payment = latest?.payment;

    const panel = createElement("div", { className: "panel" });
    panel.appendChild(
      createElement("h2", {
        className: "title",
        text: "Статус заказа",
      })
    );
    panel.appendChild(
      createElement("p", {
        className: "helper",
        text: status ? STATUS_LABELS[status.status] || status.status : "Нет активного заказа.",
      })
    );
    if (statusError) {
      panel.appendChild(
        createElement("div", {
          className: "helper",
          text: statusError,
        })
      );
    }
    if (latest) {
      panel.appendChild(
        createElement("div", {
          className: "helper",
          text: `Сумма: ${formatPrice(latest.total)}`,
        })
      );
    }
    if (payment?.payment_id) {
      panel.appendChild(
        createElement("div", {
          className: "helper",
          text: `Платёж: ${payment.payment_id} (${payment.status || "pending"})`,
        })
      );
    }
    if (requestId) {
      panel.appendChild(
        createElement("div", {
          className: "helper",
          text: `Request ID: ${requestId}`,
        })
      );
    }
    if (payment?.confirmation?.type === "qr") {
      const qrSrc = resolveQrSrc(payment.confirmation);
      panel.appendChild(
        createElement("div", {
          className: "helper",
          text: "СБП: отсканируйте QR-код для оплаты.",
        })
      );
      if (qrSrc) {
        panel.appendChild(
          createElement("img", {
            attrs: { src: qrSrc, alt: "QR для оплаты", style: "max-width: 220px; width: 100%;" },
          })
        );
      } else if (payment.payment_url) {
        panel.appendChild(
          createElement("a", {
            className: "helper",
            text: "Открыть ссылку для оплаты",
            attrs: { href: payment.payment_url, target: "_blank", rel: "noopener noreferrer" },
          })
        );
      }
    } else if (payment?.payment_url) {
      panel.appendChild(
        createElement("a", {
          className: "helper",
          text: "Перейти к оплате",
          attrs: { href: payment.payment_url, target: "_blank", rel: "noopener noreferrer" },
        })
      );
    }

    panel.appendChild(
      createButton({
        label: "Перейти в профиль",
        onClick: () => navigate("/profile"),
      })
    );
    content.appendChild(panel);
  };

  const scheduleNextPoll = () => {
    pollTimeout = window.setTimeout(async () => {
      const currentStatus = getLastOrderStatus();
      const orders = getOrders();
      const latest = orders[0];
      const orderId = latest?.order_id || currentStatus?.order_id;
      if (!orderId) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        statusError = "Не удалось обновить, повторим позже.";
        currentDelayMs = Math.min(maxDelayMs, Math.round(currentDelayMs * delayMultiplier));
        render();
        scheduleNextPoll();
        return;
      }
      try {
        const response = await fetch(`/api/public/orders/${encodeURIComponent(orderId)}`, {
          cache: "no-store",
        });
        if (response.status === 404) {
          throw new Error("Order not found");
        }
        if (!response.ok) {
          throw new Error(`Order status fetch failed: ${response.status}`);
        }
        const data = await response.json();
        if (data?.status) {
          updateOrderStatus(orderId, data.status, data.updated_at);
          setLastOrderStatus({
            status: data.status,
            order_id: orderId,
            request_id: currentStatus?.request_id,
            updated_at: data.updated_at || undefined,
          });
        }
        statusError = null;
        currentDelayMs = minDelayMs;
        render();
      } catch (error) {
        statusError = "Не удалось обновить, повторим позже.";
        currentDelayMs = Math.min(maxDelayMs, Math.round(currentDelayMs * delayMultiplier));
        render();
      } finally {
        scheduleNextPoll();
      }
    }, currentDelayMs);
  };

  render();
  scheduleNextPoll();
  return {
    element: root,
    cleanup: () => {
      if (pollTimeout) {
        window.clearTimeout(pollTimeout);
      }
    },
  };
}
