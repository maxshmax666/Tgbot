import { createElement, clearElement } from "../ui/dom.js";
import { createButton } from "../ui/button.js";
import { formatPrice } from "../services/format.js";
import { PAYMENT_METHODS, preparePayment } from "../services/paymentService.js";
import { sendOrderToTelegram, showTelegramAlert } from "../services/telegramService.js";
import { clearCart, getCartItems, getCartTotal, subscribeCart } from "../store/cartStore.js";

const PAYMENT_OPTIONS = [
  { id: PAYMENT_METHODS.card, label: "Карта" },
  { id: PAYMENT_METHODS.sbp, label: "СБП (QR)" },
  { id: PAYMENT_METHODS.cash, label: "Наличные" },
];

function renderOrderItems(container, items) {
  const list = createElement("div", { className: "list" });
  items.forEach((item) => {
    const row = createElement("div", { className: "panel" });
    row.appendChild(createElement("div", { text: item.title }));
    row.appendChild(createElement("div", { className: "helper", text: `${item.qty} × ${formatPrice(item.price)}` }));
    row.appendChild(createElement("div", { className: "helper", text: `Сумма: ${formatPrice(item.price * item.qty)}` }));
    list.appendChild(row);
  });
  clearElement(container);
  container.appendChild(list);
}

export function renderCheckoutPage({ navigate }) {
  const root = createElement("section", { className: "list" });
  const content = createElement("div");
  root.appendChild(content);

  let submitting = false;
  let selectedMethod = PAYMENT_METHODS.card;

  const renderState = (state) => {
    clearElement(content);

    if (!state.items.length) {
      const empty = createElement("div", { className: "panel" });
      empty.appendChild(createElement("p", { className: "helper", text: "Корзина пуста. Нечего оформлять." }));
      empty.appendChild(
        createButton({
          label: "Вернуться в меню",
          variant: "secondary",
          onClick: () => navigate("/menu"),
        })
      );
      content.appendChild(empty);
      return;
    }

    const itemsBlock = createElement("div");
    renderOrderItems(itemsBlock, state.items);

    const summary = createElement("div", { className: "panel" });
    const total = createElement("div", { className: "total-row" });
    total.append(createElement("span", { text: "Итого" }), createElement("span", { text: formatPrice(getCartTotal()) }));
    summary.appendChild(total);

    const commentLabel = createElement("label", { className: "helper", text: "Комментарий к заказу" });
    const commentInput = createElement("textarea", {
      className: "input",
      attrs: { placeholder: "Например: без лука, курьер позвонить" },
    });

    const paymentLabel = createElement("div", { className: "helper", text: "Способ оплаты" });
    const paymentOptions = createElement("div", { className: "list" });
    PAYMENT_OPTIONS.forEach((option) => {
      const optionRow = createElement("label", { className: "panel" });
      const input = createElement("input", {
        attrs: {
          type: "radio",
          name: "payment",
          value: option.id,
        },
      });
      input.checked = option.id === selectedMethod;
      input.addEventListener("change", () => {
        selectedMethod = option.id;
      });
      optionRow.append(input, createElement("span", { text: option.label }));
      paymentOptions.appendChild(optionRow);
    });

    const error = createElement("div", { className: "error" });
    error.hidden = true;

    const submit = createButton({
      label: "Оформить заказ",
      onClick: async () => {
        if (submitting) return;
        error.hidden = true;

        if (!getCartItems().length) {
          error.textContent = "Корзина пуста.";
          error.hidden = false;
          return;
        }

        submitting = true;
        submit.disabled = true;

        const order = {
          items: getCartItems().map((item) => ({
            id: item.id,
            title: item.title,
            price: item.price,
            qty: item.qty,
            subtotal: item.price * item.qty,
          })),
          total: getCartTotal(),
          comment: commentInput.value.trim(),
          createdAt: new Date().toISOString(),
        };

        try {
          const payment = await preparePayment(order, selectedMethod);
          order.payment = payment;
          sendOrderToTelegram(order);
          clearCart();
          showTelegramAlert("Заказ отправлен в бот ✅");
          navigate("/menu");
        } catch (err) {
          console.error("Checkout failed", err);
          error.textContent = "Не удалось отправить заказ. Попробуйте позже.";
          error.hidden = false;
        } finally {
          submitting = false;
          submit.disabled = false;
        }
      },
    });

    summary.append(commentLabel, commentInput, paymentLabel, paymentOptions, error, submit);
    content.append(itemsBlock, summary);
  };

  const unsubscribe = subscribeCart(renderState);
  return { element: root, cleanup: unsubscribe };
}
