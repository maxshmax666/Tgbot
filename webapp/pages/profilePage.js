import { createElement, clearElement } from "../ui/dom.js";
import { createButton } from "../ui/button.js";
import { formatPrice } from "../services/format.js";
import { getOrders, getFavorites } from "../services/storageService.js";
import { setState } from "../store/cartStore.js";
import { sendData, showTelegramAlert } from "../services/telegramService.js";
import { showToast } from "../ui/toast.js";

function computeStats(orders) {
  const totalOrders = orders.length;
  const totalSpent = orders.reduce((sum, order) => sum + (order.total || 0), 0);
  const avgCheck = totalOrders ? Math.round(totalSpent / totalOrders) : 0;
  const favMap = new Map();
  orders.forEach((order) => {
    order.items?.forEach((item) => {
      favMap.set(item.title, (favMap.get(item.title) || 0) + item.qty);
    });
  });
  const favorite = Array.from(favMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  return { totalOrders, totalSpent, avgCheck, favorite };
}

const STATUS_LABELS = {
  "order:sent": "Отправлен",
  "order:pending_sync": "Ожидает синхронизации",
  "order:error": "Ошибка",
  "order:success": "Отправлен",
};

function getStatusLabel(status) {
  return STATUS_LABELS[status] || "Отправлен";
}

export function renderProfilePage({ navigate }) {
  const root = createElement("section", { className: "list" });
  const content = createElement("div");
  root.appendChild(content);

  const render = () => {
    clearElement(content);
    const orders = getOrders();
    const favorites = getFavorites();
    const stats = computeStats(orders);

    const summary = createElement("div", { className: "panel" });
    summary.appendChild(createElement("h2", { className: "title", text: "Профиль" }));
    summary.appendChild(createElement("div", { className: "helper", text: `Заказов: ${stats.totalOrders}` }));
    summary.appendChild(createElement("div", { className: "helper", text: `Средний чек: ${formatPrice(stats.avgCheck)}` }));
    summary.appendChild(createElement("div", { className: "helper", text: `Любимая пицца: ${stats.favorite}` }));
    summary.appendChild(createElement("div", { className: "helper", text: `Потрачено: ${formatPrice(stats.totalSpent)}` }));

    const favPanel = createElement("div", { className: "panel" });
    favPanel.appendChild(createElement("h3", { className: "section-title", text: "Избранное" }));
    if (!favorites.size) {
      favPanel.appendChild(createElement("p", { className: "helper", text: "Избранных пицц пока нет." }));
    } else {
      favPanel.appendChild(
        createElement("p", { className: "helper", text: `В избранном: ${favorites.size}` })
      );
    }

    const history = createElement("div", { className: "panel" });
    history.appendChild(createElement("h3", { className: "section-title", text: "Последние заказы" }));
    if (!orders.length) {
      history.appendChild(createElement("p", { className: "helper", text: "История заказов пуста." }));
    } else {
      orders.slice(0, 10).forEach((order) => {
        const row = createElement("div", { className: "order-row" });
        row.appendChild(
          createElement("div", {
            text: `#${order.order_id || "—"} • ${formatPrice(order.total || 0)}`,
          })
        );
        const status = createElement("div", {
          className: "helper",
          text: getStatusLabel(order.status),
        });
        const items = createElement("div", {
          className: "helper",
          text: order.items?.map((item) => `${item.title} × ${item.qty}`).join(", ") || "",
        });
        const repeat = createButton({
          label: "Повторить заказ",
          variant: "secondary",
          onClick: () => {
            setState(order.items || []);
            showToast("Позиции добавлены в корзину", "success");
            navigate("/cart");
          },
        });
        row.append(status, items, repeat);
        history.appendChild(row);
      });
    }

    const feedback = createElement("div", { className: "panel" });
    feedback.appendChild(createElement("h3", { className: "section-title", text: "Оставить отзыв" }));
    const feedbackInput = createElement("textarea", {
      className: "input",
      attrs: { placeholder: "Напишите отзыв или пожелание" },
    });
    const feedbackButton = createButton({
      label: "Отправить",
      onClick: () => {
        const message = feedbackInput.value.trim();
        if (!message) {
          showToast("Введите отзыв", "info");
          return;
        }
        const sent = sendData({ type: "feedback_v1", message, ts: Date.now() });
        if (sent) {
          showTelegramAlert("Спасибо за отзыв!");
        } else {
          showToast("Отзыв сохранён локально", "info");
        }
        feedbackInput.value = "";
      },
    });
    feedback.append(feedbackInput, feedbackButton);

    content.append(summary, favPanel, history, feedback);
  };

  render();
  return { element: root };
}
