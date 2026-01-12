import { createElement, clearElement } from "../ui/dom.js";
import { createButton } from "../ui/button.js";
import { createSkeletonGrid } from "../ui/skeleton.js";
import { formatPrice } from "../services/format.js";
import { loadMenu, subscribeMenu } from "../store/menuStore.js";
import { add } from "../store/cartStore.js";
import { fetchConfig } from "../services/configService.js";
import { getFavorites, setFavorites, getOrders } from "../services/storageService.js";
import { showToast } from "../ui/toast.js";
import { createPizzaCard } from "../ui/pizzaCard.js";
import { createChip } from "../ui/chip.js";

const DEFAULT_FILTERS = [
  { id: "all", label: "Все" },
  { id: "favorite", label: "Избранное" },
];

function createMenuCard(item, navigate, favorites) {
  return createPizzaCard({
    item,
    priceText: formatPrice(item.price),
    favorites,
    onToggleFavorite: (targetItem, button) => {
      if (favorites.has(targetItem.id)) {
        favorites.delete(targetItem.id);
        showToast("Удалено из избранного", "info");
      } else {
        favorites.add(targetItem.id);
        showToast("Добавлено в избранное", "success");
      }
      button.classList.toggle("active");
      setFavorites(favorites);
    },
    onAdd: (targetItem) => {
      add({
        id: targetItem.id,
        title: targetItem.title,
        price: targetItem.price,
        image: targetItem.images?.[0] || "",
      });
      showToast("Добавлено в корзину", "success");
    },
    onOpen: (targetItem) => navigate(`/pizza/${targetItem.id}`),
  });
}

export function renderMenuPage({ navigate }) {
  const root = createElement("section", { className: "list" });
  const content = createElement("div");
  root.appendChild(content);

  let currentFilter = "all";
  let searchValue = "";
  let config = null;

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

    const favorites = getFavorites();
    const filtersRow = createElement("div", { className: "filter-row" });
    const categoryFilters = state.categories.map((category) => ({
      id: String(category.id),
      label: category.title,
    }));
    const filters = [...DEFAULT_FILTERS, ...categoryFilters];
    filters.forEach((filter) => {
      const chip = createChip({
        label: filter.label,
        active: currentFilter === filter.id,
        onClick: () => {
          currentFilter = filter.id;
          renderState(state);
        },
      });
      filtersRow.appendChild(chip);
    });

    const searchInput = createElement("input", {
      className: "input",
      attrs: { type: "search", placeholder: "Поиск по названию" },
    });
    searchInput.value = searchValue;
    searchInput.addEventListener("input", (event) => {
      searchValue = event.target.value.trim().toLowerCase();
      renderState(state);
    });

    const banner = createElement("div", { className: "panel banner" });
    banner.appendChild(createElement("div", { text: config?.bannerText || "Доставка 45 минут" }));
    banner.appendChild(
      createElement("div", {
        className: "helper",
        text: `Телефон: ${config?.supportPhone || ""}`,
      })
    );
    const contacts = createElement("div", { className: "card-footer" });
    const callLink = createElement("a", {
      className: "button secondary ui-control",
      attrs: { href: `tel:${config?.supportPhone || ""}` },
      text: "Позвонить",
    });
    const chatLink = createElement("a", {
      className: "button secondary ui-control",
      attrs: { href: config?.supportChat || "#", target: "_blank", rel: "noopener noreferrer" },
      text: "Написать",
    });
    contacts.append(callLink, chatLink);
    banner.appendChild(contacts);

    const grid = createElement("div", { className: "menu-grid" });
    const filtered = state.items
      .filter((item) => item.isAvailable !== false)
      .filter((item) => {
        if (currentFilter === "favorite") return favorites.has(item.id);
        if (currentFilter === "all") return true;
        return String(item.categoryId || "") === currentFilter;
      })
      .filter((item) => (searchValue ? item.title.toLowerCase().includes(searchValue) : true));

    const orders = getOrders();
    const topMap = new Map();
    orders.forEach((order) => {
      order.items?.forEach((item) => {
        topMap.set(item.id, (topMap.get(item.id) || 0) + item.qty);
      });
    });
    const topIds = Array.from(topMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);
    const recommended = state.items.filter((item) => topIds.includes(item.id));

    content.append(banner, searchInput, filtersRow);
    if (recommended.length) {
      const recTitle = createElement("h3", { className: "section-title", text: "Топ продаж" });
      const recGrid = createElement("div", { className: "menu-grid" });
      recommended.forEach((item) => recGrid.appendChild(createMenuCard(item, navigate, favorites)));
      content.append(recTitle, recGrid);
    }

    if (!filtered.length) {
      const empty = createElement("div", { className: "panel" });
      empty.appendChild(
        createElement("p", { className: "helper", text: "Ничего не найдено. Попробуйте другой фильтр." })
      );
      content.appendChild(empty);
      return;
    }

    filtered.forEach((item) => grid.appendChild(createMenuCard(item, navigate, favorites)));
    content.appendChild(grid);
  };

  const unsubscribe = subscribeMenu(renderState);
  fetchConfig().then((configValue) => {
    config = configValue;
    loadMenu().catch(() => null);
  });

  return { element: root, cleanup: unsubscribe };
}
