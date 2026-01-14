import { createElement, clearElement } from "../ui/dom.js";
import { createButton } from "../ui/button.js";
import {
  getLastOrderStatus,
  getOrders,
  updateOrderStatusFromApi,
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
  const baseDelay = 2000;
  let retryDelay = baseDelay;
  let retryTimer = null;
  let transientError = null;

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
    if (transientError) {
      panel.appendChild(
        createElement("div", {
          className: "helper",
          text: transientError,
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

  const poll = async () => {
    const orders = getOrders();
    const latest = orders[0];
    const orderId = latest?.order_id;

    if (!orderId) return;

    try {
      const res = await fetch(`/api/public/orders/${encodeURIComponent(orderId)}`);
      if (res.status === 404) {
        transientError = "Не удалось обновить, повторим позже";
      } else if (!res.ok) {
        throw new Error(`Status ${res.status}`);
      } else {
        const data = await res.json();
        updateOrderStatusFromApi(data.order_id, data.status, data.updated_at);
        transientError = null;
      }
    } catch (error) {
      console.warn("Order status poll failed", error);
      transientError = "Не удалось обновить, повторим позже";
    } finally {
      render();
      retryDelay = Math.min(Math.round(retryDelay * 1.6), 30000);
      retryTimer = setTimeout(poll, retryDelay);
    }
  };

  render();
  retryTimer = setTimeout(poll, retryDelay);
  return {
    element: root,
    cleanup: () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    },
  };
}
