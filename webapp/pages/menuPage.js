import { createElement, clearElement } from "../ui/dom.js";
import { createButton } from "../ui/button.js";
import { createGallery } from "../ui/gallery.js";
import { createSkeletonGrid } from "../ui/skeleton.js";
import { formatPrice } from "../services/format.js";
import { loadMenu, subscribeMenu } from "../store/menuStore.js";
import { addToCart } from "../store/cartStore.js";

function createMenuCard(item, navigate) {
  const card = createElement("article", { className: "card clickable" });
  const gallery = createGallery(item.images, { large: false });
  const title = createElement("h3", { className: "card-title", text: item.title });
  const description = createElement("p", { className: "card-description", text: item.description });
  const tags = createElement("div", { className: "tag-row" });
  item.tags.forEach((tag) => tags.appendChild(createElement("span", { className: "badge", text: tag })));

  const footer = createElement("div", { className: "card-footer" });
  const price = createElement("div", { className: "card-price", text: formatPrice(item.price) });
  const addButton = createButton({
    label: "Добавить",
    onClick: (event) => {
      event.stopPropagation();
      addToCart({
        id: item.id,
        title: item.title,
        price: item.price,
        image: item.images?.[0] || "",
      });
    },
  });

  footer.append(price, addButton);

  card.append(gallery, title, description);
  if (item.tags.length) {
    card.append(tags);
  }
  card.append(footer);

  card.addEventListener("click", () => navigate(`/pizza/${item.id}`));

  return card;
}

export function renderMenuPage({ navigate }) {
  const root = createElement("section", { className: "list" });
  const content = createElement("div");
  root.appendChild(content);

  const renderState = (state) => {
    clearElement(content);

    if (state.status === "loading" || state.status === "idle") {
      content.appendChild(createSkeletonGrid(4));
      return;
    }

    if (state.status === "error") {
      const panel = createElement("div", { className: "panel" });
      panel.appendChild(createElement("p", { className: "helper", text: state.error || "Ошибка загрузки" }));
      const retry = createButton({
        label: "Повторить",
        variant: "secondary",
        onClick: () => loadMenu().catch(() => null),
      });
      panel.appendChild(retry);
      content.appendChild(panel);
      return;
    }

    if (!state.items.length) {
      const empty = createElement("div", { className: "panel" });
      empty.appendChild(createElement("p", { className: "helper", text: "Меню временно пустое." }));
      content.appendChild(empty);
      return;
    }

    const grid = createElement("div", { className: "menu-grid" });
    state.items.forEach((item) => grid.appendChild(createMenuCard(item, navigate)));
    content.appendChild(grid);
  };

  const unsubscribe = subscribeMenu(renderState);
  loadMenu().catch(() => null);

  return { element: root, cleanup: unsubscribe };
}
