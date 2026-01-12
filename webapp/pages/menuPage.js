import { createElement, clearElement } from "../ui/dom.js";
import { createButton, setButtonPressed } from "../ui/button.js";
import { createLinkButton } from "../ui/linkButton.js";
import { createCard, createCardFooter } from "../ui/card.js";
import { createChip } from "../ui/chip.js";
import { createEmptyState } from "../ui/emptyState.js";
import { createErrorState } from "../ui/errorState.js";
import { createIconButton } from "../ui/iconButton.js";
import { createInput } from "../ui/input.js";
import { createLoadingState } from "../ui/loadingState.js";
import { createPriceTag } from "../ui/priceTag.js";
import { createSection } from "../ui/section.js";
import { createGallery } from "../ui/gallery.js";
import { createSkeletonGrid } from "../ui/skeleton.js";
import { formatPrice } from "../services/format.js";
import { loadMenu, subscribeMenu } from "../store/menuStore.js";
import { add } from "../store/cartStore.js";
import { fetchConfig } from "../services/configService.js";
import { getFavorites, setFavorites, getOrders } from "../services/storageService.js";
import { showToast } from "../ui/toast.js";

const DEFAULT_FILTERS = [
  { id: "all", label: "Все" },
  { id: "favorite", label: "Избранное" },
];

function createMenuCard(item, navigate, favorites) {
  const card = createCard({ interactive: true });
  const gallery = createGallery(item.images, { large: false });
  const title = createElement("h3", { className: "card-title", text: item.title });
  const description = createElement("p", { className: "card-description", text: item.description });
  const tags = createElement("div", { className: "tag-row" });
  item.tags.forEach((tag) => tags.appendChild(createElement("span", { className: "badge", text: tag })));

  const isFav = favorites.has(item.id);
  const favButton = createIconButton({
    icon: "❤",
    ariaLabel: isFav ? "Убрать из избранного" : "В избранное",
    active: isFav,
    className: "favorite-toggle",
  });
  favButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (favorites.has(item.id)) {
      favorites.delete(item.id);
      showToast("Удалено из избранного", "info");
      favButton.setAttribute("aria-label", "В избранное");
    } else {
      favorites.add(item.id);
      showToast("Добавлено в избранное", "success");
      favButton.setAttribute("aria-label", "Убрать из избранного");
    }
    favButton.classList.toggle("is-active");
    setButtonPressed(favButton, favorites.has(item.id));
    setFavorites(favorites);
  });

  const footer = createCardFooter();
  const price = createPriceTag({ value: formatPrice(item.price) });
  const addButton = createButton({
    label: "Добавить",
    onClick: (event) => {
      event.stopPropagation();
      add({
        id: item.id,
        title: item.title,
        price: item.price,
        image: item.images?.[0] || "",
      });
      showToast("Добавлено в корзину", "success");
    },
  });

  footer.append(price, addButton);

  card.append(gallery, favButton, title, description);
  if (item.tags.length) {
    card.append(tags);
  }
  card.append(footer);

  card.addEventListener("click", () => navigate(`/pizza/${item.id}`));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate(`/pizza/${item.id}`);
    }
  });

  return card;
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
      content.appendChild(
        createLoadingState({
          text: "Загружаем меню…",
          content: createSkeletonGrid(4),
        })
      );
      return;
    }

    if (state.status === "error") {
      const retry = createButton({
        label: "Повторить",
        variant: "secondary",
        onClick: () => loadMenu().catch(() => null),
      });
      content.appendChild(
        createErrorState({
          title: "Ошибка загрузки",
          description: state.error || "Не удалось получить меню. Попробуйте ещё раз.",
          action: retry,
        })
      );
      return;
    }

    if (!state.items.length) {
      content.appendChild(
        createEmptyState({
          title: "Меню временно пустое",
          description: "Мы уже обновляем ассортимент. Проверьте чуть позже.",
        })
      );
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
      const button = createChip({
        label: filter.label,
        active: currentFilter === filter.id,
        ariaLabel: `Фильтр: ${filter.label}`,
        onClick: () => {
          currentFilter = filter.id;
          renderState(state);
        },
      });
      filtersRow.appendChild(button);
    });

    const searchInput = createInput({
      type: "search",
      placeholder: "Поиск по названию",
      ariaLabel: "Поиск по названию",
      value: searchValue,
      onInput: (event) => {
        searchValue = event.target.value.trim().toLowerCase();
        renderState(state);
      },
    });

    const banner = createSection({ className: "banner" });
    banner.appendChild(createElement("div", { text: config?.bannerText || "Доставка 45 минут" }));
    banner.appendChild(
      createElement("div", {
        className: "helper",
        text: `Телефон: ${config?.supportPhone || ""}`,
      })
    );
    const contacts = createCardFooter();
    const callLink = createLinkButton({
      label: "Позвонить",
      variant: "secondary",
      href: `tel:${config?.supportPhone || ""}`,
      ariaLabel: "Позвонить в поддержку",
    });
    const chatLink = createLinkButton({
      label: "Написать",
      variant: "secondary",
      href: config?.supportChat || "#",
      ariaLabel: "Написать в поддержку",
      target: "_blank",
      rel: "noopener noreferrer",
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
      content.appendChild(
        createEmptyState({
          title: "Ничего не найдено",
          description: "Попробуйте другой фильтр или очистите поиск.",
        })
      );
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
