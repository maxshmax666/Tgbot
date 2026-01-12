import { createElement, clearElement } from "../ui/dom.js";
import { createButton } from "../ui/button.js";
import { formatPrice } from "../services/format.js";
import { subscribeCart, setQty, remove, total, getState } from "../store/cartStore.js";
import { showToast } from "../ui/toast.js";
import { createCartLineItem } from "../ui/cartLineItem.js";
import { createCheckoutSummary } from "../ui/checkoutSummary.js";

function buildCartItemRow(item) {
  return createCartLineItem({
    item,
    priceText: formatPrice(item.price),
    onDecrement: () => setQty(item.id, item.qty - 1),
    onIncrement: () => setQty(item.id, item.qty + 1),
    onRemove: () => {
      remove(item.id);
      showToast("Позиция удалена", "info");
    },
  });
}

export function renderCartPage({ navigate }) {
  const root = createElement("section", { className: "list" });
  const content = createElement("div");
  root.appendChild(content);

  const renderState = (state) => {
    clearElement(content);
    if (!state.items.length) {
      const empty = createElement("div", { className: "panel" });
      empty.appendChild(createElement("p", { className: "helper", text: "Корзина пуста — добавьте любимую пиццу." }));
      empty.appendChild(
        createButton({
          label: "Перейти в меню",
          variant: "secondary",
          onClick: () => navigate("/menu"),
        })
      );
      content.appendChild(empty);
      return;
    }

    const list = createElement("div", { className: "list" });
    state.items.forEach((item) => list.appendChild(buildCartItemRow(item)));
    content.appendChild(list);

    const summary = createCheckoutSummary({
      rows: [{ label: "Итого", value: formatPrice(total()) }],
      children: [
        createButton({
          label: "Оформить заказ",
          onClick: () => navigate("/checkout"),
        }),
      ],
    });

    content.appendChild(summary);
  };

  const unsubscribe = subscribeCart(renderState);
  renderState(getState());
  return { element: root, cleanup: unsubscribe };
}
