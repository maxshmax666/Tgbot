import { createElement, clearElement } from "../ui/dom.js";
import { createButton } from "../ui/button.js";
import { createEmptyState } from "../ui/emptyState.js";
import { createSection } from "../ui/section.js";
import { formatPrice } from "../services/format.js";
import { subscribeCart, setQty, remove, total, getState } from "../store/cartStore.js";
import { showToast } from "../ui/toast.js";
import { applyImageFallback, PLACEHOLDER_IMAGE } from "../ui/image.js";

function createCartItemRow(item) {
  const row = createSection({ className: "cart-item" });
  const header = createElement("div", { className: "cart-row" });
  const product = createElement("div", { className: "cart-cell cart-product" });
  const productLabel = createElement("span", { className: "cart-cell-label", text: "Товар" });
  const previewSrc = item.image || PLACEHOLDER_IMAGE;
  const preview = createElement("img", {
    className: "cart-preview",
    attrs: { src: previewSrc, alt: item.title || "Пицца" },
  });
  applyImageFallback(preview);
  const title = createElement("div", { className: "cart-title", text: item.title });
  product.append(productLabel, preview, title);

  const price = createElement("div", { className: "cart-cell cart-price" });
  price.append(
    createElement("span", { className: "cart-cell-label", text: "Цена" }),
    createElement("span", { text: formatPrice(item.price) })
  );

  const qtyCell = createElement("div", { className: "cart-cell cart-qty" });
  qtyCell.appendChild(createElement("span", { className: "cart-cell-label", text: "Количество" }));

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
  qtyCell.appendChild(controls);

  const lineTotal = item.price * item.qty;
  const sum = createElement("div", { className: "cart-cell cart-sum" });
  sum.append(
    createElement("span", { className: "cart-cell-label", text: "Сумма" }),
    createElement("span", { text: formatPrice(lineTotal) })
  );

  header.append(product, price, qtyCell, sum);

  const removeButton = createButton({
    label: "Удалить",
    variant: "ghost",
    className: "cart-remove",
    ariaLabel: `Удалить ${item.title}`,
    onClick: () => {
      remove(item.id);
      showToast("Позиция удалена", "info");
    },
  });

  row.append(removeButton, header);
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

    const list = createElement("div", { className: "list cart-list" });
    const listHeader = createElement("div", { className: "cart-header" });
    listHeader.append(
      createElement("span", { text: "Товар" }),
      createElement("span", { text: "Цена" }),
      createElement("span", { text: "Количество" }),
      createElement("span", { text: "Сумма" })
    );
    content.appendChild(listHeader);
    state.items.forEach((item) => list.appendChild(createCartItemRow(item)));
    content.appendChild(list);

    const summary = createSection({ className: "cart-summary" });
    const totalRow = createElement("div", { className: "total-row" });
    totalRow.append(createElement("span", { text: "Итого" }), createElement("span", { text: formatPrice(total()) }));
    summary.appendChild(totalRow);
    summary.appendChild(
      createButton({
        label: "Оформить заказ",
        className: "cart-checkout",
        onClick: () => navigate("/checkout"),
      })
    );
    content.appendChild(summary);
  };

  const unsubscribe = subscribeCart(renderState);
  renderState(getState());
  return { element: root, cleanup: unsubscribe };
}
