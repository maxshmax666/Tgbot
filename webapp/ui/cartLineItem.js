import { createElement } from "./dom.js";
import { createButton } from "./button.js";
import { createCard } from "./card.js";
import { createPriceTag } from "./priceTag.js";
import { createQuantityStepper } from "./quantityStepper.js";

export function createCartLineItem({ item, priceText, onIncrement, onDecrement, onRemove } = {}) {
  const row = createCard({ variant: "panel", className: "cart-line-item" });
  const header = createElement("div", { className: "cart-row" });
  const info = createElement("div", { className: "cart-line-info" });
  const title = createElement("div", { text: item.title });
  const price = createPriceTag({ text: priceText, className: "cart-line-price" });
  info.append(title, price);

  const controls = createQuantityStepper({
    value: item.qty,
    onDecrement,
    onIncrement,
  });

  header.append(info, controls);

  const removeButton = createButton({
    label: "Удалить",
    variant: "ghost",
    onClick: onRemove,
  });

  row.append(header, removeButton);
  return row;
}
