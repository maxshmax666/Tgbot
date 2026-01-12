import { createElement, clearElement } from "../ui/dom.js";
import { createButton, setButtonPressed } from "../ui/button.js";
import { createCard, createCardFooter } from "../ui/card.js";
import { createIconButton } from "../ui/iconButton.js";
import { createPriceTag } from "../ui/priceTag.js";
import { createSection } from "../ui/section.js";
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
      const panel = createSection();
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

    const card = createCard({ className: "pizza-card" });
    card.appendChild(createGallery(item.images, { large: true }));
    card.appendChild(createElement("h2", { className: "title", text: item.title }));
    card.appendChild(createElement("p", { className: "helper", text: item.description }));
    card.appendChild(createPriceTag({ value: formatPrice(item.price) }));

    const favorites = getFavorites();
    const isFav = favorites.has(item.id);
    const favButton = createIconButton({
      icon: isFav ? "♥" : "♡",
      ariaLabel: isFav ? "Убрать из избранного" : "Добавить в избранное",
      active: isFav,
      className: "favorite-chip",
    });
    favButton.addEventListener("click", () => {
      if (favorites.has(item.id)) {
        favorites.delete(item.id);
        favButton.textContent = "♡";
        favButton.classList.remove("is-active");
        favButton.setAttribute("aria-label", "Добавить в избранное");
      } else {
        favorites.add(item.id);
        favButton.textContent = "♥";
        favButton.classList.add("is-active");
        favButton.setAttribute("aria-label", "Убрать из избранного");
      }
      setButtonPressed(favButton, favorites.has(item.id));
      setFavorites(favorites);
    });

    const actions = createCardFooter();
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
