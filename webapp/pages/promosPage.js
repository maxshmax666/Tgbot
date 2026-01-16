import { createElement, clearElement } from "../ui/dom.js";
import { createCard, createCardFooter } from "../ui/card.js";
import { createButton } from "../ui/button.js";
import { createLoadingState } from "../ui/loadingState.js";
import { createErrorState } from "../ui/errorState.js";
import { createEmptyState } from "../ui/emptyState.js";
import { createBreadcrumbs } from "../ui/breadcrumbs.js";
import { loadPromos, subscribePromos } from "../store/promoStore.js";
import { setSelectedPromo } from "../services/storageService.js";
import { showToast } from "../ui/toast.js";

function formatCountdown(expiresAt) {
  if (!expiresAt) return "Без ограничения по времени";
  const expires = Date.parse(expiresAt);
  if (Number.isNaN(expires)) return "Без ограничения по времени";
  const diff = expires - Date.now();
  if (diff <= 0) return "Акция завершена";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const pad = (value) => String(value).padStart(2, "0");
  return `До конца акции: ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function isPromoExpired(expiresAt) {
  if (!expiresAt) return false;
  const expires = Date.parse(expiresAt);
  if (Number.isNaN(expires)) return false;
  return expires <= Date.now();
}

function createPromoCard(promo) {
  const card = createCard({ className: "promo-card" });
  card.appendChild(createElement("h3", { className: "card-title", text: promo.title }));
  card.appendChild(createElement("p", { className: "card-description", text: promo.description }));
  if (promo.code) {
    card.appendChild(createElement("div", { className: "promo-code", text: `Промокод: ${promo.code}` }));
  }

  const timer = createElement("div", { className: "promo-timer", text: formatCountdown(promo.expiresAt) });
  let intervalId = window.setInterval(() => {
    timer.textContent = formatCountdown(promo.expiresAt);
  }, 1000);

  const footer = createCardFooter({ className: "promo-actions" });
  const isInactive = promo.active === false || isPromoExpired(promo.expiresAt);
  const applyButton = createButton({
    label: "Применить к корзине",
    onClick: () => {
      setSelectedPromo(promo);
      showToast("Акция применена к корзине", "success");
    },
  });
  applyButton.disabled = isInactive;
  footer.append(applyButton);

  card.append(timer, footer);
  return { card, cleanup: () => window.clearInterval(intervalId) };
}

export function renderPromosPage({ navigate }) {
  const root = createElement("section", { className: "list" });
  const content = createElement("div");
  root.appendChild(content);

  const cleanupTimers = new Set();

  const renderState = (state) => {
    clearElement(content);
    cleanupTimers.forEach((fn) => fn());
    cleanupTimers.clear();

    const crumbs = createBreadcrumbs([
      { label: "Главная", onClick: () => navigate("/") },
      { label: "Акции" },
    ]);

    if (state.status === "loading" || state.status === "idle") {
      content.append(
        crumbs,
        createLoadingState({
          text: "Загружаем акции…",
        })
      );
      return;
    }

    if (state.status === "error") {
      const retry = createButton({
        label: "Повторить",
        variant: "secondary",
        onClick: () => loadPromos().catch(() => null),
      });
      content.append(
        crumbs,
        createErrorState({
          title: "Ошибка загрузки",
          description: state.error || "Не удалось загрузить акции.",
          action: retry,
        })
      );
      return;
    }

    if (!state.items.length) {
      content.append(
        crumbs,
        createEmptyState({
          title: "Сейчас нет акций",
          description: "Попробуйте заглянуть позже.",
        })
      );
      return;
    }

    content.appendChild(crumbs);
    state.items.forEach((promo) => {
      const { card, cleanup } = createPromoCard(promo);
      cleanupTimers.add(cleanup);
      content.appendChild(card);
    });
  };

  const unsubscribe = subscribePromos(renderState);
  loadPromos().catch(() => null);

  return {
    element: root,
    cleanup: () => {
      cleanupTimers.forEach((fn) => fn());
      cleanupTimers.clear();
      unsubscribe();
    },
  };
}
