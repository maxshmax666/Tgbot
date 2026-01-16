import { createElement, clearElement } from "../ui/dom.js";
import { createButton } from "../ui/button.js";
import { createLinkButton } from "../ui/linkButton.js";
import { createCard, createCardFooter } from "../ui/card.js";
import { createPriceTag } from "../ui/priceTag.js";
import { createSection } from "../ui/section.js";
import { applyImageFallback } from "../ui/image.js";
import { add } from "../store/cartStore.js";
import { formatPrice } from "../services/format.js";
import { loadMenu, getMenuState } from "../store/menuStore.js";
import { fetchPageBySlug } from "../services/pagesService.js";
import { showToast } from "../ui/toast.js";

function renderHero(props) {
  const section = createSection({
    title: props.title || "",
    titleTag: "h2",
    description: props.subtitle,
  });
  if (props.buttonLabel && props.buttonLink) {
    const link = createLinkButton({ label: props.buttonLabel, href: props.buttonLink });
    section.appendChild(link);
  }
  return section;
}

function renderBanner(props) {
  const section = createSection({ className: "banner" });
  section.appendChild(createElement("div", { text: props.text || "" }));
  return section;
}

function renderText(props) {
  const section = createSection();
  section.appendChild(createElement("p", { className: "helper", text: props.text || "" }));
  return section;
}

function renderGallery(props) {
  const section = createSection({ title: props.title || "" });
  const grid = createElement("div", { className: "menu-grid" });
  (props.images || []).forEach((url) => {
    const img = createElement("img", { className: "image", attrs: { src: url, alt: props.title || "" } });
    applyImageFallback(img);
    grid.appendChild(img);
  });
  section.appendChild(grid);
  return section;
}

function renderProductsGrid(props, items) {
  const section = createSection({ title: props.title || "" });
  const grid = createElement("div", { className: "menu-grid" });
  const displayIds = Array.isArray(props.items)
    ? props.items.filter((item) => item.visible !== false).map((item) => String(item.id))
    : Array.isArray(props.productIds)
      ? props.productIds.map(String)
      : [];
  const products = items.filter((item) => displayIds.includes(String(item.id)));
  products.forEach((item) => {
    const card = createCard();
    if (item.images?.[0]) {
      const img = createElement("img", { className: "image", attrs: { src: item.images[0], alt: item.title } });
      applyImageFallback(img);
      card.appendChild(img);
    }
    card.appendChild(createElement("h3", { className: "card-title", text: item.title }));
    card.appendChild(createElement("p", { className: "card-description", text: item.description }));
    const footer = createCardFooter();
    footer.appendChild(createPriceTag({ value: formatPrice(item.price) }));
    const addButton = createButton({
      label: "Добавить",
      onClick: () => {
        add({ id: item.id, title: item.title, price: item.price, image: item.images?.[0] || "", doughType: "poolish" });
        showToast("Добавлено в корзину", {
          variant: "success",
          durationMs: 2000,
          actionLabel: "Открыть корзину",
          onAction: () => window.appNavigate?.("/cart"),
        });
        console.info("cart:add", { source: "dynamic", itemId: item.id, doughType: "poolish", toast: "Добавлено в корзину" });
      },
    });
    footer.appendChild(addButton);
    card.appendChild(footer);
    grid.appendChild(card);
  });
  if (!products.length) {
    section.appendChild(createElement("p", { className: "helper", text: "Нет товаров для отображения." }));
  } else {
    section.appendChild(grid);
  }
  return section;
}

export function renderDynamicPage({ params }) {
  const root = createElement("section", { className: "list" });
  const content = createElement("div");
  root.appendChild(content);

  const renderState = async () => {
    clearElement(content);
    try {
      await loadMenu();
      const { items } = getMenuState();
      const { page, blocks } = await fetchPageBySlug(params.id);
      content.appendChild(createElement("h2", { className: "title", text: page.title }));
      blocks.forEach((block) => {
        switch (block.type) {
          case "hero":
            content.appendChild(renderHero(block.props || {}));
            break;
          case "banner":
            content.appendChild(renderBanner(block.props || {}));
            break;
          case "text":
            content.appendChild(renderText(block.props || {}));
            break;
          case "gallery":
            content.appendChild(renderGallery(block.props || {}));
            break;
          case "products-grid":
            content.appendChild(renderProductsGrid(block.props || {}, items));
            break;
          default:
            break;
        }
      });
    } catch (error) {
      content.appendChild(
        createElement("p", { className: "helper", text: "Не удалось загрузить страницу." })
      );
    }
  };

  renderState();

  return { element: root };
}
