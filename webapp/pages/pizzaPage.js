import { createElement, clearElement } from "../ui/dom.js";
import { createButton } from "../ui/button.js";
import { createGallery } from "../ui/gallery.js";
import { formatPrice } from "../services/format.js";
import { addToCart } from "../store/cartStore.js";
import { getMenuItemById, loadMenu, subscribeMenu } from "../store/menuStore.js";

export function renderPizzaPage({ navigate, params }) {
  const root = createElement("section", { className: "list" });
  const content = createElement("div", { className: "fade-in" });
  root.appendChild(content);

  const renderState = () => {
    clearElement(content);
    const item = getMenuItemById(params.id);
    if (!item) {
      const panel = createElement("div", { className: "panel" });
      panel.appendChild(createElement("p", { className: "helper", text: "Пицца не найдена." }));
      panel.appendChild(
        createButton({
          label: "Назад в меню",
          variant: "secondary",
          onClick: () => navigate("/menu"),
        })
      );
      content.appendChild(panel);
      return;
    }

    const card = createElement("div", { className: "panel" });
    card.appendChild(createGallery(item.images, { large: true }));
    card.appendChild(createElement("h2", { className: "title", text: item.title }));
    card.appendChild(createElement("p", { className: "helper", text: item.description }));
    card.appendChild(createElement("div", { className: "card-price", text: formatPrice(item.price) }));

    const actions = createElement("div", { className: "card-footer" });
    const back = createButton({
      label: "Назад",
      variant: "secondary",
      onClick: () => navigate("/menu"),
    });
    const add = createButton({
      label: "Добавить в корзину",
      onClick: () =>
        addToCart({
          id: item.id,
          title: item.title,
          price: item.price,
          image: item.images?.[0] || "",
        }),
    });
    actions.append(back, add);
    card.appendChild(actions);
    content.appendChild(card);
  };

  const unsubscribe = subscribeMenu(renderState);
  loadMenu().catch(() => null);

  return { element: root, cleanup: unsubscribe };
}
