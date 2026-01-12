import { createElement, clearElement } from "../ui/dom.js";
import { createButton } from "../ui/button.js";
import { createEmptyState } from "../ui/emptyState.js";
import { createSection } from "../ui/section.js";
import { formatPrice } from "../services/format.js";
import { subscribeCart, setQty, remove, total, getState } from "../store/cartStore.js";
import { showToast } from "../ui/toast.js";

function createCartItemRow(item) {
  const row = createSection({ className: "cart-item" });
  const header = createElement("div", { className: "cart-row" });
  const info = createElement("div");
  const title = createElement("div", { text: item.title });
  const price = createElement("div", { className: "helper", text: formatPrice(item.price) });
  info.append(title, price);

  const controls = createElement("div", { className: "qty-controls" });
  const dec = createButton({
    label: "−",
    variant: "qty",
    size: "sm",
    ariaLabel: "Уменьшить количество",
    onClick: () => setQty(item.id, item.qty - 1),
  });
  const qty = createElement("span", { className: "qty-label", text: String(item.qty) });
  const inc = createButton({
    label: "+",
    variant: "qty",
    size: "sm",
    ariaLabel: "Увеличить количество",
    onClick: () => setQty(item.id, item.qty + 1),
  });

  controls.append(dec, qty, inc);
  header.append(info, controls);

  const removeButton = createButton({
    label: "Удалить",
    variant: "ghost",
    onClick: () => {
      remove(item.id);
      showToast("Позиция удалена", "info");
    },
  });

  row.append(header, removeButton);
  return row;
}

export function renderCartPage({ navigate }) {
  const root = createElement("section", { className: "list" });
  const content = createElement("div");
  root.appendChild(content);

  const renderState = (state) => {
    clearElement(content);
    if (!state.items.length) {
      content.appendChild(
        createEmptyState({
          title: "Корзина пуста",
          description: "Добавьте любимую пиццу из меню.",
          action: createButton({
            label: "Перейти в меню",
            variant: "secondary",
            onClick: () => navigate("/menu"),
          }),
        })
      );
      return;
    }

    const list = createElement("div", { className: "list" });
    state.items.forEach((item) => list.appendChild(createCartItemRow(item)));
    content.appendChild(list);

    const summary = createSection({ className: "cart-summary" });
    const totalRow = createElement("div", { className: "total-row" });
    totalRow.append(createElement("span", { text: "Итого" }), createElement("span", { text: formatPrice(total()) }));
    summary.appendChild(totalRow);
    summary.appendChild(
      createButton({
        label: "Оформить заказ",
        onClick: () => navigate("/checkout"),
      })
    );
    content.appendChild(summary);
  };

  const unsubscribe = subscribeCart(renderState);
  renderState(getState());
  return { element: root, cleanup: unsubscribe };
}
