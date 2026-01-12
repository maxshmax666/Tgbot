import { createElement, clearElement } from "../ui/dom.js";
import { createButton } from "../ui/button.js";
import { createGallery } from "../ui/gallery.js";
import { formatPrice } from "../services/format.js";
import { add } from "../store/cartStore.js";
import { getMenuItemById, loadMenu, subscribeMenu } from "../store/menuStore.js";
import { getFavorites, setFavorites } from "../services/storageService.js";
import { showToast } from "../ui/toast.js";

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

    const favorites = getFavorites();
    const favButton = createElement("button", {
      className: ["fav-button", favorites.has(item.id) ? "active" : ""].join(" ").trim(),
      attrs: { type: "button" },
      text: favorites.has(item.id) ? "♥ В избранном" : "♡ В избранное",
    });
    favButton.addEventListener("click", () => {
      if (favorites.has(item.id)) {
        favorites.delete(item.id);
        favButton.textContent = "♡ В избранное";
        favButton.classList.remove("active");
      } else {
        favorites.add(item.id);
        favButton.textContent = "♥ В избранном";
        favButton.classList.add("active");
      }
      setFavorites(favorites);
    });

    const actions = createElement("div", { className: "card-footer" });
    const back = createButton({
      label: "Назад",
      variant: "secondary",
      onClick: () => navigate("/menu"),
    });
    const add = createButton({
      label: "Добавить в корзину",
      onClick: () =>
        add({
          id: item.id,
          title: item.title,
          price: item.price,
          image: item.images?.[0] || "",
        }),
    });
    add.addEventListener("click", () => showToast("Добавлено в корзину", "success"));
    actions.append(back, add);
    card.append(favButton, actions);
    content.appendChild(card);
  };

  const unsubscribe = subscribeMenu(renderState);
  loadMenu().catch(() => null);

  return { element: root, cleanup: unsubscribe };
}
