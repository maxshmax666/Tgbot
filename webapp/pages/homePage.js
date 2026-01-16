import { clearElement, createElement } from "../ui/dom.js";
import { getMenuState, loadMenu, subscribeMenu } from "../store/menuStore.js";
import { createButton } from "../ui/button.js";
import { createCard, createCardFooter } from "../ui/card.js";
import { createSection } from "../ui/section.js";
import { createLoadingState } from "../ui/loadingState.js";
import { createErrorState } from "../ui/errorState.js";
import { createEmptyState } from "../ui/emptyState.js";
import { createSkeletonGrid } from "../ui/skeleton.js";
import { createChip } from "../ui/chip.js";
import { createGallery } from "../ui/gallery.js";
import { createPriceTag } from "../ui/priceTag.js";
import { formatPrice } from "../services/format.js";

const HOME_MENU_PREVIEW_LIMIT = 4;
let homeFirstRenderLogged = false;

function createMenuPreviewCard(item, navigate) {
  const itemSlug = item.slug || item.id;
  const card = createCard({ interactive: true });
  const gallery = createGallery(item.images, { large: false });
  const title = createElement("h3", { className: "card-title", text: item.title });
  const description = createElement("p", { className: "card-description", text: item.description });

  const footer = createCardFooter();
  const price = createPriceTag({ value: formatPrice(item.price) });
  const openButton = createButton({
    label: "Открыть",
    onClick: (event) => {
      event.stopPropagation();
      navigate(`/pizza/${itemSlug}`);
    },
  });
  footer.append(price, openButton);

  card.append(gallery, title, description, footer);
  card.addEventListener("click", () => navigate(`/pizza/${itemSlug}`));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate(`/pizza/${itemSlug}`);
    }
  });

  return card;
}

export function renderHomePage({ navigate }) {
  const initialMenuState = getMenuState();
  if (!homeFirstRenderLogged) {
    console.info("[home] first-render", {
      status: initialMenuState.status,
      items: initialMenuState.items.length,
    });
    homeFirstRenderLogged = true;
  }
  const root = createElement("section", { className: "list" });

  const hero = createSection({ className: "home-hero" });
  hero.appendChild(createElement("h2", { className: "title", text: "Добро пожаловать в Пиццерию Тагил" }));
  hero.appendChild(
    createElement("p", {
      className: "helper",
      text: "Быстрое оформление заказа, персональные акции и горячие пиццы прямо из печи.",
    })
  );

  const heroActions = createCardFooter({ className: "home-actions" });
  heroActions.append(
    createButton({ label: "Перейти в меню", onClick: () => navigate("/menu") }),
    createButton({ label: "Смотреть акции", variant: "secondary", onClick: () => navigate("/promos") })
  );
  hero.appendChild(heroActions);

  const cards = createElement("div", { className: "menu-grid" });

  const promoCard = createCard({ className: "home-card" });
  promoCard.appendChild(createElement("h3", { className: "card-title", text: "Акции дня" }));
  promoCard.appendChild(
    createElement("p", { className: "card-description", text: "Скидки, комбо и промокоды на каждый день." })
  );
  const promoFooter = createCardFooter();
  promoFooter.appendChild(createButton({ label: "Открыть акции", onClick: () => navigate("/promos") }));
  promoCard.appendChild(promoFooter);

  const menuCard = createCard({ className: "home-card" });
  menuCard.appendChild(createElement("h3", { className: "card-title", text: "Каталог пицц" }));
  menuCard.appendChild(
    createElement("p", { className: "card-description", text: "Быстрый выбор по фильтрам и категориям." })
  );
  const menuFooter = createCardFooter();
  menuFooter.appendChild(createButton({ label: "Перейти в меню", onClick: () => navigate("/menu") }));
  menuCard.appendChild(menuFooter);

  cards.append(promoCard, menuCard);

  const menuSection = createSection({ className: "home-menu" });
  menuSection.appendChild(createElement("h3", { className: "section-title", text: "Меню и категории" }));
  const menuContent = createElement("div");
  menuSection.appendChild(menuContent);

  root.append(hero, cards, menuSection);

  const renderMenuState = (state) => {
    clearElement(menuContent);

    if (state.status === "loading" || state.status === "idle") {
      menuContent.appendChild(
        createLoadingState({
          text: "Загружаем меню…",
          content: createSkeletonGrid(HOME_MENU_PREVIEW_LIMIT),
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
      menuContent.appendChild(
        createErrorState({
          title: "Ошибка загрузки меню",
          description: state.error || "Не удалось получить меню. Попробуйте ещё раз.",
          action: retry,
        })
      );
      return;
    }

    if (!state.items.length) {
      menuContent.appendChild(
        createEmptyState({
          title: "Меню пока пустое",
          description: "Скоро добавим новые позиции. Загляните чуть позже.",
        })
      );
      return;
    }

    if (state.categories.length) {
      const categoriesRow = createElement("div", { className: "filter-row" });
      state.categories.forEach((category) => {
        const chip = createChip({
          label: category.title,
          ariaLabel: `Категория: ${category.title}`,
          onClick: () => navigate("/menu"),
        });
        categoriesRow.appendChild(chip);
      });
      menuContent.appendChild(categoriesRow);
    }

    const previewGrid = createElement("div", { className: "menu-grid" });
    const previewItems = state.items.slice(0, HOME_MENU_PREVIEW_LIMIT);
    previewItems.forEach((item) => previewGrid.appendChild(createMenuPreviewCard(item, navigate)));
    menuContent.appendChild(previewGrid);

    const menuAction = createCardFooter();
    menuAction.appendChild(createButton({ label: "Смотреть все меню", onClick: () => navigate("/menu") }));
    menuContent.appendChild(menuAction);
  };

  const unsubscribe = subscribeMenu(renderMenuState);
  loadMenu().catch(() => null);

  return { element: root, cleanup: () => unsubscribe() };
}
