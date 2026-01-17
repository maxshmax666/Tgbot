import { createElement, clearElement } from "../ui/dom.js";
import { createButton, setButtonPressed } from "../ui/button.js";
import { createCard } from "../ui/card.js";
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
import { getFavorites, setFavorites, getOrders, storage, STORAGE_KEYS } from "../services/storageService.js";
import { createBreadcrumbs } from "../ui/breadcrumbs.js";
import { showToast } from "../ui/toast.js";
import { QUICK_FILTERS, filterMenuItems, getPopularIds } from "../services/menuFilterService.js";

const DEFAULT_FILTERS = [
  { id: "all", label: "Все" },
  { id: "favorite", label: "Избранное" },
];
const MENU_SCROLL_THROTTLE_MS = 160;
const MENU_STATE_DEFAULT = {
  currentFilter: "all",
  scrollByFilter: {},
};

function getScrollKey(filterId) {
  return `menuScroll:${filterId || "all"}`;
}

function readMenuState() {
  const raw = storage.read(STORAGE_KEYS.menuState, MENU_STATE_DEFAULT);
  const scrollByFilter =
    raw && typeof raw.scrollByFilter === "object" && raw.scrollByFilter !== null ? raw.scrollByFilter : {};
  return {
    currentFilter: typeof raw?.currentFilter === "string" ? raw.currentFilter : "all",
    scrollByFilter,
  };
}

function writeMenuState(next) {
  storage.write(STORAGE_KEYS.menuState, next);
}

function createMenuCard(item, navigate, favorites, { filterId } = {}) {
  const itemSlug = item.slug || item.id;
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
        doughType: "poolish",
      });
      showToast("Добавлено в корзину", {
        variant: "success",
        durationMs: 2000,
        actionLabel: "Открыть корзину",
        onAction: () => navigate("/cart"),
      });
      console.info("cart:add", { source: "menu", itemId: item.id, doughType: "poolish", toast: "Добавлено в корзину" });
    },
  });

  footer.append(price, addButton);

  card.append(gallery, favButton, title, description);
  if (item.tags.length) {
    card.append(tags);
  }
  card.append(footer);

  const query = filterId && filterId !== "all" ? `?from=${encodeURIComponent(filterId)}` : "";
  card.addEventListener("click", () => navigate(`/pizza/${itemSlug}${query}`));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate(`/pizza/${itemSlug}${query}`);
    }
  });

  return card;
}

export function renderMenuPage({ navigate }) {
  const root = createElement("section", { className: "list" });
  const content = createElement("div");
  root.appendChild(content);

  const scrollContainer = document.scrollingElement || document.documentElement;
  const initialMenuState = readMenuState();
  let currentFilter = initialMenuState.currentFilter || "all";
  let searchValue = "";
  let config = null;
  let shouldRestoreScroll = true;
  let scrollSaveTimeout = 0;
  let lastSavedScroll = -1;

  const persistMenuState = (next = {}) => {
    const updated = {
      ...readMenuState(),
      ...next,
    };
    writeMenuState(updated);
    return updated;
  };

  const saveScrollPosition = () => {
    if (!scrollContainer) return;
    const scrollTop = Math.max(0, Math.round(scrollContainer.scrollTop));
    const state = persistMenuState();
    const key = getScrollKey(currentFilter);
    state.scrollByFilter[key] = scrollTop;
    state.currentFilter = currentFilter;
    writeMenuState(state);
    if (scrollTop !== lastSavedScroll) {
      lastSavedScroll = scrollTop;
      console.info(`[menu] saveScroll=${scrollTop}`);
    }
  };

  const scheduleSaveScroll = () => {
    if (!scrollContainer) return;
    if (scrollSaveTimeout) {
      window.clearTimeout(scrollSaveTimeout);
    }
    scrollSaveTimeout = window.setTimeout(() => {
      saveScrollPosition();
    }, MENU_SCROLL_THROTTLE_MS);
  };

  const restoreScrollPosition = () => {
    if (!scrollContainer) return;
    const state = readMenuState();
    const key = getScrollKey(currentFilter);
    const target = Math.max(0, Number(state.scrollByFilter?.[key] ?? 0));
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        scrollContainer.scrollTo({ top: target, behavior: "auto" });
        const success = Math.abs(scrollContainer.scrollTop - target) < 2;
        if (!success) {
          window.setTimeout(() => {
            scrollContainer.scrollTo({ top: target, behavior: "auto" });
            const retrySuccess = Math.abs(scrollContainer.scrollTop - target) < 2;
            console.info(
              `[menu] restoreScroll=${Math.round(target)} success=${retrySuccess} retry=true`
            );
          }, 120);
        } else {
          console.info(`[menu] restoreScroll=${Math.round(target)} success=${success}`);
        }
      }, 0);
    });
  };

  const handleScroll = () => {
    scheduleSaveScroll();
  };

  scrollContainer?.addEventListener("scroll", handleScroll, { passive: true });

  const remindRestore = () => {
    if (!shouldRestoreScroll) return;
    shouldRestoreScroll = false;
    restoreScrollPosition();
  };

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
          title: "Меню пустое",
          description: "Добавьте товары в админке.",
        })
      );
      return;
    }

    const favorites = getFavorites();
    const filtersRow = createElement("div", { className: "filter-row" });
    const quickFiltersRow = createElement("div", { className: "filter-row quick-filters" });
    const crumbs = createBreadcrumbs([
      { label: "Меню", onClick: () => navigate("/menu") },
      { label: "Пиццы" },
    ]);
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
          persistMenuState({ currentFilter });
          shouldRestoreScroll = true;
          renderState(state);
        },
      });
      filtersRow.appendChild(button);
    });
    QUICK_FILTERS.forEach((filter) => {
      const button = createChip({
        label: filter.label,
        active: currentFilter === filter.id,
        ariaLabel: `Быстрый фильтр: ${filter.label}`,
        onClick: () => {
          currentFilter = filter.id;
          persistMenuState({ currentFilter });
          shouldRestoreScroll = true;
          renderState(state);
        },
      });
      quickFiltersRow.appendChild(button);
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
    banner.appendChild(createElement("div", { text: config?.bannerText || "Горячая пицца и любимые хиты каждый день" }));
    const phoneValue = config?.supportPhone || "";
    if (phoneValue) {
      banner.appendChild(
        createElement("div", {
          className: "helper",
          text: `Телефон: ${phoneValue}`,
        })
      );
    }

    const orders = getOrders();
    const topIds = getPopularIds(orders, 3);
    const recommended = state.items.filter((item) => topIds.includes(item.id));
    const recommendedIds = new Set(recommended.map((item) => item.id));
    const showRecommended = recommended.length > 0;

    const grid = createElement("div", { className: "menu-grid" });
    const categoryIds = new Set(state.categories.map((category) => String(category.id)));
    const filtered = filterMenuItems(state.items, {
      filterId: currentFilter,
      favorites,
      popularIds: topIds,
      categoryIds,
    })
      .filter((item) => (searchValue ? item.title.toLowerCase().includes(searchValue) : true))
      .filter((item) => !showRecommended || !recommendedIds.has(item.id));

    content.append(crumbs, banner, searchInput, filtersRow, quickFiltersRow);
    if (showRecommended) {
      const recTitle = createElement("h3", { className: "section-title", text: "Топ продаж" });
      const recGrid = createElement("div", { className: "menu-grid" });
      recommended.forEach((item) =>
        recGrid.appendChild(createMenuCard(item, navigate, favorites, { filterId: currentFilter }))
      );
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

    filtered.forEach((item) =>
      grid.appendChild(createMenuCard(item, navigate, favorites, { filterId: currentFilter }))
    );
    content.appendChild(grid);

    remindRestore();
  };

  const unsubscribe = subscribeMenu(renderState);
  fetchConfig().then((configValue) => {
    config = configValue;
    loadMenu().catch(() => null);
  });

  return {
    element: root,
    cleanup: () => {
      unsubscribe();
      if (scrollSaveTimeout) {
        window.clearTimeout(scrollSaveTimeout);
      }
      scrollContainer?.removeEventListener("scroll", handleScroll);
      saveScrollPosition();
    },
    restoreScroll: () => {
      shouldRestoreScroll = true;
      restoreScrollPosition();
    },
  };
}
