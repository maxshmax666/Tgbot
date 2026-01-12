import { createElement } from "./dom.js";
import { createButton } from "./button.js";
import { createGallery } from "./gallery.js";
import { createCard } from "./card.js";
import { createChip } from "./chip.js";
import { createPriceTag } from "./priceTag.js";

export function createPizzaCard({
  item,
  priceText,
  favorites,
  onToggleFavorite,
  onAdd,
  onOpen,
} = {}) {
  const card = createCard({ variant: "card", as: "article", clickable: true, className: "pizza-card" });
  const gallery = createGallery(item.images, { large: false });
  const title = createElement("h3", { className: "card-title", text: item.title });
  const description = createElement("p", { className: "card-description", text: item.description });
  const tags = createElement("div", { className: "tag-row" });
  item.tags.forEach((tag) => tags.appendChild(createChip({ label: tag, variant: "tag" })));

  const favButton = createElement("button", {
    className: ["fav-button", "ui-control", favorites?.has(item.id) ? "active" : ""]
      .filter(Boolean)
      .join(" "),
    attrs: { type: "button", "aria-label": "В избранное" },
    text: "❤",
  });
  favButton.addEventListener("click", (event) => {
    event.stopPropagation();
    onToggleFavorite?.(item, favButton);
  });

  const footer = createElement("div", { className: "card-footer" });
  const price = createPriceTag({ text: priceText, className: "card-price" });
  const addButton = createButton({
    label: "Добавить",
    onClick: (event) => {
      event.stopPropagation();
      onAdd?.(item);
    },
  });

  footer.append(price, addButton);

  card.append(gallery, favButton, title, description);
  if (item.tags.length) {
    card.append(tags);
  }
  card.append(footer);

  if (onOpen) {
    card.addEventListener("click", () => onOpen(item));
  }

  return card;
}
