import { createElement, clearElement } from "../ui/dom.js";
import { createButton } from "../ui/button.js";
import { formatPrice } from "../services/format.js";
import { subscribeCart, setQty, remove, total, getState } from "../store/cartStore.js";
import { showToast } from "../ui/toast.js";

function createCartItemRow(item) {
  const row = createElement("div", { className: "panel" });
  const header = createElement("div", { className: "cart-row" });
  const info = createElement("div");
  const title = createElement("div", { text: item.title });
  const price = createElement("div", { className: "helper", text: formatPrice(item.price) });
  info.append(title, price);

  const controls = createElement("div", { className: "qty-controls" });
  const dec = createElement("button", { className: "qty-button", text: "−", attrs: { type: "button" } });
  const qty = createElement("span", { className: "qty-label", text: String(item.qty) });
  const inc = createElement("button", { className: "qty-button", text: "+", attrs: { type: "button" } });

  dec.addEventListener("click", () => setQty(item.id, item.qty - 1));
  inc.addEventListener("click", () => setQty(item.id, item.qty + 1));

  controls.append(dec, qty, inc);
  header.append(info, controls);

  const remove = createButton({
    label: "Удалить",
    variant: "ghost",
    onClick: () => {
      remove(item.id);
      showToast("Позиция удалена", "info");
    },
  });

  row.append(header, remove);
  return row;
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
    state.items.forEach((item) => list.appendChild(createCartItemRow(item)));
    content.appendChild(list);

    const summary = createElement("div", { className: "panel" });
    const total = createElement("div", { className: "total-row" });
    total.append(createElement("span", { text: "Итого" }), createElement("span", { text: formatPrice(total()) }));
    summary.appendChild(total);
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
