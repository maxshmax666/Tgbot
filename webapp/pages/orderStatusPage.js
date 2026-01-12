import { createElement, clearElement } from "../ui/dom.js";
import { createButton } from "../ui/button.js";
import { getLastOrderStatus, getOrders } from "../services/storageService.js";
import { formatPrice } from "../services/format.js";

const STATUS_LABELS = {
  "order:creating": "Создаём заказ",
  "order:sent": "Заказ отправлен",
  "order:success": "Заказ принят",
  "order:error": "Ошибка отправки",
};

export function renderOrderStatusPage({ navigate }) {
  const root = createElement("section", { className: "list" });
  const content = createElement("div");
  root.appendChild(content);

  const render = () => {
    clearElement(content);
    const status = getLastOrderStatus();
    const orders = getOrders();
    const latest = orders[0];

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
    if (latest) {
      panel.appendChild(
        createElement("div", {
          className: "helper",
          text: `Сумма: ${formatPrice(latest.total)}`,
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

  render();
  return { element: root };
}
