import { createElement, clearElement } from "../ui/dom.js";
import { createButton, setButtonPressed } from "../ui/button.js";
import { createCard, createCardFooter } from "../ui/card.js";
import { createIconButton } from "../ui/iconButton.js";
import { createPriceTag } from "../ui/priceTag.js";
import { createSection } from "../ui/section.js";
import { createGallery } from "../ui/gallery.js";
import { formatPrice } from "../services/format.js";
import { add } from "../store/cartStore.js";
import { getMenuItemById, loadMenu, subscribeMenu, getMenuState } from "../store/menuStore.js";
import { getFavorites, setFavorites, getOrders } from "../services/storageService.js";
import { showToast } from "../ui/toast.js";
import { createBreadcrumbs } from "../ui/breadcrumbs.js";
import { filterMenuItems, getPopularIds } from "../services/menuFilterService.js";

export function renderPizzaPage({ navigate, params }) {
  const root = createElement("section", { className: "list" });
  const content = createElement("div", { className: "fade-in" });
  root.appendChild(content);
  let touchStartX = 0;
  let touchEndX = 0;

  const getNavigableItems = () => {
    const menuState = getMenuState();
    const categoryIds = new Set(menuState.categories.map((category) => String(category.id)));
    const filterId = new URLSearchParams(window.location.search).get("from") || "all";
    const popularIds = getPopularIds(getOrders(), 3);
    const filteredItems = filterMenuItems(menuState.items, {
      filterId,
      favorites: getFavorites(),
      popularIds,
      categoryIds,
    });
    const currentIndex = filteredItems.findIndex((menuItem) => menuItem.id === params.id);
    if (currentIndex === -1 || filteredItems.length === 0) {
      const fallbackItems = filterMenuItems(menuState.items, {
        filterId: "all",
        favorites: getFavorites(),
        popularIds,
        categoryIds,
      });
      return { items: fallbackItems, filterId: "all" };
    }
    return { items: filteredItems, filterId };
  };

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

    const { items: navigableItems, filterId } = getNavigableItems();
    const currentIndex = navigableItems.findIndex((menuItem) => menuItem.id === item.id);
    const prevItem = currentIndex > 0 ? navigableItems[currentIndex - 1] : null;
    const nextItem =
      currentIndex >= 0 && currentIndex < navigableItems.length - 1 ? navigableItems[currentIndex + 1] : null;

    const crumbs = createBreadcrumbs([
      { label: "Меню", onClick: () => navigate("/menu") },
      { label: "Пиццы", onClick: () => navigate("/menu") },
      { label: item.title },
    ]);

    const card = createCard({ className: "pizza-card" });
    card.appendChild(createGallery(item.images, { large: true, enableZoom: true }));
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

    const navRow = createElement("div", { className: "pizza-nav" });
    const prevButton = createButton({
      label: "← Предыдущая пицца",
      variant: "secondary",
      ariaLabel: "Предыдущая пицца",
      onClick: () => {
        if (prevItem) navigate(`/pizza/${prevItem.id}?from=${encodeURIComponent(filterId)}`);
      },
    });
    const nextButton = createButton({
      label: "Следующая пицца →",
      variant: "secondary",
      ariaLabel: "Следующая пицца",
      onClick: () => {
        if (nextItem) navigate(`/pizza/${nextItem.id}?from=${encodeURIComponent(filterId)}`);
      },
    });
    prevButton.disabled = !prevItem;
    nextButton.disabled = !nextItem;
    navRow.append(prevButton, nextButton);

    const actions = createCardFooter({ className: "pizza-actions" });
    const back = createButton({
      label: "Назад в меню",
      variant: "secondary",
      onClick: () => navigate("/menu"),
    });
    const addButton = createButton({
      label: "Добавить в корзину",
      onClick: () =>
        add({
          id: item.id,
          title: item.title,
          price: item.price,
          image: item.images?.[0] || "",
        }),
    });
    addButton.addEventListener("click", () => showToast("Добавлено в корзину", "success"));
    actions.append(back, addButton);
    card.append(favButton, navRow, actions);
    content.append(crumbs, card);
  };

  const unsubscribe = subscribeMenu(renderState);
  loadMenu().catch(() => null);

  const handleTouchStart = (event) => {
    touchStartX = event.changedTouches[0]?.screenX || 0;
  };
  const handleTouchEnd = (event) => {
    touchEndX = event.changedTouches[0]?.screenX || 0;
    const delta = touchEndX - touchStartX;
    if (Math.abs(delta) < 50) return;
    const { items: navigableItems, filterId } = getNavigableItems();
    const currentIndex = navigableItems.findIndex((menuItem) => menuItem.id === params.id);
    if (currentIndex < 0) return;
    if (delta < 0 && currentIndex < navigableItems.length - 1) {
      navigate(`/pizza/${navigableItems[currentIndex + 1].id}?from=${encodeURIComponent(filterId)}`);
    }
    if (delta > 0 && currentIndex > 0) {
      navigate(`/pizza/${navigableItems[currentIndex - 1].id}?from=${encodeURIComponent(filterId)}`);
    }
  };

  content.addEventListener("touchstart", handleTouchStart, { passive: true });
  content.addEventListener("touchend", handleTouchEnd, { passive: true });

  return {
    element: root,
    cleanup: () => {
      unsubscribe();
      content.removeEventListener("touchstart", handleTouchStart);
      content.removeEventListener("touchend", handleTouchEnd);
    },
  };
}
