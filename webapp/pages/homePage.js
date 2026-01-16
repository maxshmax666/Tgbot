import { createElement } from "../ui/dom.js";
import { getMenuState } from "../store/menuStore.js";
import { createButton } from "../ui/button.js";
import { createCard, createCardFooter } from "../ui/card.js";
import { createSection } from "../ui/section.js";

export function renderHomePage({ navigate }) {
  const menuState = getMenuState();
  const loading = menuState.status === "loading" || menuState.status === "idle";
  const hasData = menuState.items.length > 0;
  const error = Boolean(menuState.error);
  console.log("[home] render", { loading, hasData, error });
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

  root.append(hero, cards);
  return { element: root };
}
