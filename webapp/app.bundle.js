// webapp/services/telegramService.js
import React, { useEffect, useState } from "https://esm.sh/react@18.2.0";
import { createPortal } from "https://esm.sh/react-dom@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
var getWebApp = () => window.Telegram?.WebApp || null;
var hasValidPlatform = (webApp) => Boolean(
  webApp && typeof webApp.platform === "string" && webApp.platform.trim().length > 0 && typeof webApp.version === "string" && webApp.version.trim().length > 0
);
var hasInitData = (webApp) => Boolean(webApp?.initData);
function getTelegramState() {
  const webApp = getWebApp();
  const available = hasValidPlatform(webApp);
  return {
    available,
    missingInitData: available && !hasInitData(webApp)
  };
}
function isTelegram() {
  return getTelegramState().available;
}
function initTelegram() {
  const webApp = getWebApp();
  const state3 = getTelegramState();
  if (!webApp || !state3.available) return { available: false, missingInitData: false };
  try {
    webApp.ready();
    webApp.expand();
    if (typeof webApp.setHeaderColor === "function") {
      webApp.setHeaderColor("#0f1115");
    }
    if (typeof webApp.setBackgroundColor === "function") {
      webApp.setBackgroundColor("#0f1115");
    }
  } catch (error) {
    console.warn("Telegram init failed", error);
  }
  return state3;
}
function getUser() {
  const webApp = getWebApp();
  return webApp?.initDataUnsafe?.user || null;
}
function showTelegramAlert(message) {
  const webApp = getWebApp();
  if (webApp?.showAlert) {
    webApp.showAlert(message);
    return;
  }
  window.alert(message);
}
function sendData(payload) {
  const webApp = getWebApp();
  if (!webApp) return false;
  try {
    webApp.sendData(JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn("Telegram sendData failed", error);
    return false;
  }
}

// webapp/services/storageService.js
var safeParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("Failed to parse storage value", error);
    return fallback;
  }
};
var STORAGE_KEYS = {
  cart: "pt_cart_v1",
  orders: "pt_orders_v1",
  pendingOrders: "pt_pending_orders_v1",
  favorites: "pt_favs_v1",
  adminAuth: "pt_admin_auth_v1",
  adminMenu: "pt_admin_menu_v1",
  adminConfig: "pt_admin_config_v1",
  adminPromos: "pt_admin_promos_v1",
  lastOrderStatus: "pt_last_order_status_v1"
};
var storage = {
  read(key, fallback) {
    try {
      return safeParse(localStorage.getItem(key), fallback);
    } catch (error) {
      console.warn("Storage read failed", error);
      return fallback;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("Storage write failed", error);
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn("Storage remove failed", error);
    }
  },
  has(key) {
    try {
      return localStorage.getItem(key) !== null;
    } catch (error) {
      return false;
    }
  }
};
function getOrders() {
  const items = storage.read(STORAGE_KEYS.orders, []);
  return Array.isArray(items) ? items : [];
}
function addOrder(order) {
  const items = getOrders();
  items.unshift(order);
  storage.write(STORAGE_KEYS.orders, items.slice(0, 50));
}
function updateOrderStatus(orderId, status) {
  if (!orderId) return;
  const items = getOrders();
  const index = items.findIndex((item) => item.order_id === orderId);
  if (index === -1) return;
  items[index] = { ...items[index], status };
  storage.write(STORAGE_KEYS.orders, items);
}
function getPendingOrders() {
  const items = storage.read(STORAGE_KEYS.pendingOrders, []);
  return Array.isArray(items) ? items : [];
}
function addPendingOrder(order) {
  const items = getPendingOrders();
  items.unshift(order);
  storage.write(STORAGE_KEYS.pendingOrders, items.slice(0, 50));
}
function removePendingOrder(orderId) {
  if (!orderId) return;
  const items = getPendingOrders().filter((item) => item.order_id !== orderId);
  storage.write(STORAGE_KEYS.pendingOrders, items);
}
function getFavorites() {
  const raw = storage.read(STORAGE_KEYS.favorites, []);
  return new Set(Array.isArray(raw) ? raw.map(String) : []);
}
function setFavorites(favorites) {
  storage.write(STORAGE_KEYS.favorites, Array.from(favorites));
}
function setLastOrderStatus(status) {
  storage.write(STORAGE_KEYS.lastOrderStatus, status);
}
function getLastOrderStatus() {
  return storage.read(STORAGE_KEYS.lastOrderStatus, null);
}

// webapp/store/cartStore.js
var state = {
  items: [],
  updatedAt: Date.now()
};
var listeners = /* @__PURE__ */ new Set();
function normalizeItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    id: String(item.id || ""),
    title: String(item.title || ""),
    price: Number(item.price || 0),
    image: item.image || "",
    qty: Number(item.qty || 0)
  })).filter((item) => item.id && item.qty > 0);
}
function persist(items) {
  storage.write(STORAGE_KEYS.cart, items);
}
function dispatchChange(nextState) {
  state.items = nextState.items;
  state.updatedAt = Date.now();
  listeners.forEach((listener) => listener(getState()));
  window.dispatchEvent(new CustomEvent("cart:changed", { detail: getState() }));
}
function hydrateCart() {
  const items = normalizeItems(storage.read(STORAGE_KEYS.cart, []));
  dispatchChange({ items });
}
function subscribeCart(listener) {
  listeners.add(listener);
  listener(getState());
  return () => listeners.delete(listener);
}
function getState() {
  return { items: [...state.items], updatedAt: state.updatedAt };
}
function setState(items) {
  const normalized = normalizeItems(items);
  persist(normalized);
  dispatchChange({ items: normalized });
}
function add(item) {
  const items = [...state.items];
  const existing = items.find((cartItem) => cartItem.id === item.id);
  if (existing) {
    existing.qty += 1;
  } else {
    items.push({
      id: String(item.id || ""),
      title: String(item.title || ""),
      price: Number(item.price || 0),
      image: item.image || "",
      qty: 1
    });
  }
  persist(items);
  dispatchChange({ items });
}
function setQty(id, qty) {
  const items = [...state.items];
  const target = items.find((item) => item.id === id);
  if (!target) return;
  target.qty = Math.max(0, qty);
  const next = items.filter((item) => item.qty > 0);
  persist(next);
  dispatchChange({ items: next });
}
function remove(id) {
  const next = state.items.filter((item) => item.id !== id);
  persist(next);
  dispatchChange({ items: next });
}
function clear() {
  persist([]);
  dispatchChange({ items: [] });
}
function total() {
  return state.items.reduce((sum, item) => sum + item.price * item.qty, 0);
}
function count() {
  return state.items.reduce((sum, item) => sum + item.qty, 0);
}
hydrateCart();

// webapp/ui/dom.js
function createElement(tag, options = {}) {
  const el = document.createElement(tag);
  if (options.className) {
    el.className = options.className;
  }
  if (options.text !== void 0) {
    el.textContent = options.text;
  }
  if (options.html !== void 0) {
    el.innerHTML = options.html;
  }
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, value]) => {
      if (value !== void 0 && value !== null) {
        el.setAttribute(key, String(value));
      }
    });
  }
  return el;
}
function clearElement(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

// webapp/ui/button.js
var VARIANT_CLASS_MAP = {
  primary: "",
  secondary: "button--secondary",
  ghost: "button--ghost",
  nav: "button--nav",
  chip: "button--chip",
  icon: "button--icon",
  qty: "button--qty"
};
var SIZE_CLASS_MAP = {
  sm: "button--sm",
  md: "button--md",
  lg: "button--lg"
};
function createButton({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  onClick,
  ariaLabel,
  pressed,
  current,
  href,
  type = "button",
  className = ""
} = {}) {
  const variantClass = VARIANT_CLASS_MAP[variant] ?? "";
  const sizeClass = SIZE_CLASS_MAP[size] ?? "";
  const classes = ["button", "ui-interactive", variantClass, sizeClass, className].filter(Boolean).join(" ");
  const isLink = typeof href === "string";
  const button = createElement(isLink ? "a" : "button", {
    className: classes,
    text: label,
    attrs: {
      type: isLink ? void 0 : type,
      href: isLink && !disabled && !loading ? href : void 0
    }
  });
  if (ariaLabel) {
    button.setAttribute("aria-label", ariaLabel);
  }
  if (typeof pressed === "boolean") {
    button.setAttribute("aria-pressed", pressed ? "true" : "false");
  }
  if (typeof current === "boolean") {
    if (current) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  }
  if (isLink) {
    if (disabled || loading) {
      button.setAttribute("aria-disabled", "true");
      button.dataset.disabled = "true";
      button.tabIndex = -1;
    }
  } else {
    button.disabled = disabled || loading;
  }
  if (loading) {
    button.dataset.state = "loading";
    button.dataset.label = label;
    button.textContent = "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026";
    button.setAttribute("aria-busy", "true");
  }
  if (onClick) {
    button.addEventListener("click", (event) => {
      if (button.dataset.disabled === "true" || button.dataset.state === "loading") {
        event.preventDefault();
        return;
      }
      onClick(event);
    });
  }
  return button;
}
function setButtonPressed(button, pressed) {
  if (!button || typeof pressed !== "boolean") return;
  button.setAttribute("aria-pressed", pressed ? "true" : "false");
}
function setButtonCurrent(button, current) {
  if (!button || typeof current !== "boolean") return;
  if (current) {
    button.setAttribute("aria-current", "page");
  } else {
    button.removeAttribute("aria-current");
  }
}
function setButtonLoading(button, loading) {
  if (!button) return;
  if (loading) {
    button.dataset.label = button.textContent;
    button.textContent = "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026";
    button.dataset.state = "loading";
    button.setAttribute("aria-busy", "true");
    if ("disabled" in button) button.disabled = true;
    button.dataset.disabled = "true";
  } else {
    const label = button.dataset.label;
    if (label) button.textContent = label;
    button.classList.remove("loading");
    delete button.dataset.state;
    button.removeAttribute("aria-busy");
    if ("disabled" in button) button.disabled = false;
    delete button.dataset.disabled;
  }
}

// webapp/ui/linkButton.js
var VARIANT_CLASS_MAP2 = {
  primary: "",
  secondary: "button--secondary",
  ghost: "button--ghost",
  nav: "button--nav",
  chip: "button--chip",
  icon: "button--icon",
  qty: "button--qty"
};
var SIZE_CLASS_MAP2 = {
  sm: "button--sm",
  md: "button--md",
  lg: "button--lg"
};
function createLinkButton({
  label,
  href,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  onClick,
  ariaLabel,
  pressed,
  current,
  rel,
  target,
  className = ""
} = {}) {
  const variantClass = VARIANT_CLASS_MAP2[variant] ?? "";
  const sizeClass = SIZE_CLASS_MAP2[size] ?? "";
  const classes = ["button", "ui-interactive", variantClass, sizeClass, className].filter(Boolean).join(" ");
  const link = createElement("a", {
    className: classes,
    text: label,
    attrs: {
      href: !disabled && !loading ? href : void 0,
      rel,
      target
    }
  });
  if (ariaLabel) {
    link.setAttribute("aria-label", ariaLabel);
  }
  if (typeof pressed === "boolean") {
    link.setAttribute("aria-pressed", pressed ? "true" : "false");
  }
  if (typeof current === "boolean") {
    if (current) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }
  if (disabled || loading) {
    link.setAttribute("aria-disabled", "true");
    link.dataset.disabled = "true";
    link.tabIndex = -1;
  }
  if (loading) {
    link.dataset.state = "loading";
    link.dataset.label = label;
    link.textContent = "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026";
    link.setAttribute("aria-busy", "true");
  }
  link.addEventListener("click", (event) => {
    if (link.dataset.disabled === "true" || link.dataset.state === "loading") {
      event.preventDefault();
      return;
    }
    if (onClick) {
      onClick(event);
    }
  });
  return link;
}

// webapp/ui/card.js
function createCard({ className = "", interactive = false, attrs = {} } = {}) {
  const classes = [
    "card",
    interactive ? "card--interactive" : "",
    interactive ? "ui-interactive" : "",
    className
  ].filter(Boolean).join(" ");
  const card = createElement("article", { className: classes, attrs });
  if (interactive && !card.hasAttribute("tabindex")) {
    card.setAttribute("tabindex", "0");
  }
  return card;
}
function createCardFooter({ className = "", attrs = {} } = {}) {
  return createElement("div", { className: ["card-footer", className].filter(Boolean).join(" "), attrs });
}

// webapp/ui/chip.js
function createChip({ label, active = false, onClick, disabled = false, ariaLabel } = {}) {
  const chip = createButton({
    label,
    variant: "chip",
    size: "sm",
    onClick,
    disabled,
    ariaLabel: ariaLabel || label,
    pressed: active
  });
  if (active) {
    chip.classList.add("is-active");
  }
  return chip;
}

// webapp/ui/section.js
function createSection({
  className = "",
  variant = "panel",
  title,
  titleTag = "h3",
  description,
  attrs = {}
} = {}) {
  const classes = ["section", variant === "panel" ? "panel" : "", variant !== "panel" ? variant : "", className].filter(Boolean).join(" ");
  const section = createElement("section", { className: classes, attrs });
  if (title) {
    section.appendChild(createElement(titleTag, { className: "section-title", text: title }));
  }
  if (description) {
    section.appendChild(createElement("p", { className: "helper", text: description }));
  }
  return section;
}

// webapp/ui/emptyState.js
function createEmptyState({ title = "\u041F\u043E\u043A\u0430 \u043F\u0443\u0441\u0442\u043E", description, action } = {}) {
  const section = createSection({ className: "state state--empty" });
  section.appendChild(createElement("h3", { className: "section-title", text: title }));
  if (description) {
    section.appendChild(createElement("p", { className: "helper", text: description }));
  }
  if (action) {
    section.appendChild(action);
  }
  return section;
}

// webapp/ui/errorState.js
function createErrorState({ title = "\u0427\u0442\u043E-\u0442\u043E \u043F\u043E\u0448\u043B\u043E \u043D\u0435 \u0442\u0430\u043A", description, action } = {}) {
  const section = createSection({ className: "state state--error", attrs: { role: "alert" } });
  section.appendChild(createElement("h3", { className: "section-title", text: title }));
  if (description) {
    section.appendChild(createElement("p", { className: "helper", text: description }));
  }
  if (action) {
    section.appendChild(action);
  }
  return section;
}

// webapp/ui/iconButton.js
function createIconButton({
  icon,
  active = false,
  pressed,
  ariaLabel,
  className = "",
  ...buttonProps
} = {}) {
  const isPressed = typeof pressed === "boolean" ? pressed : active;
  const button = createButton({
    ...buttonProps,
    label: icon,
    variant: buttonProps.variant || "icon",
    ariaLabel,
    pressed: isPressed
  });
  button.classList.add("icon-button");
  if (className) {
    className.split(" ").filter(Boolean).forEach((name) => button.classList.add(name));
  }
  if (isPressed) {
    button.classList.add("is-active");
  }
  return button;
}

// webapp/ui/input.js
function createInput({
  type = "text",
  placeholder = "",
  value = "",
  disabled = false,
  ariaLabel,
  onInput,
  onChange,
  className = "",
  attrs = {}
} = {}) {
  const input = createElement("input", {
    className: ["input", "ui-interactive", className].filter(Boolean).join(" "),
    attrs: {
      type,
      placeholder,
      ...attrs
    }
  });
  input.value = value;
  if (ariaLabel) {
    input.setAttribute("aria-label", ariaLabel);
  }
  if (disabled) {
    input.disabled = true;
    input.dataset.disabled = "true";
  }
  if (onInput) input.addEventListener("input", onInput);
  if (onChange) input.addEventListener("change", onChange);
  return input;
}

// webapp/ui/loadingState.js
function createLoadingState({ text = "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026", content: content2 } = {}) {
  const section = createSection({
    className: "state state--loading",
    attrs: { "data-state": "loading", "aria-busy": "true" }
  });
  section.appendChild(createElement("p", { className: "helper", text }));
  if (content2) {
    section.appendChild(content2);
  }
  return section;
}

// webapp/ui/priceTag.js
function createPriceTag({ value, className = "" } = {}) {
  return createElement("div", {
    className: ["price-tag", className].filter(Boolean).join(" "),
    text: value ?? ""
  });
}

// webapp/services/mediaBase.js
var cachedBaseUrl = null;
function normalizeBaseUrl(value) {
  if (!value) return "";
  return String(value).trim().replace(/\/+$/, "");
}
function getPublicMediaBaseUrl() {
  if (cachedBaseUrl !== null) return cachedBaseUrl;
  cachedBaseUrl = normalizeBaseUrl(globalThis.PUBLIC_MEDIA_BASE_URL);
  return cachedBaseUrl;
}
function resolveMediaUrl(url) {
  if (!url) return "";
  const raw = String(url).trim();
  if (!raw) return "";
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("blob:")) {
    return raw;
  }
  const base = getPublicMediaBaseUrl();
  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  return base ? `${base}${normalized}` : normalized;
}

// webapp/ui/image.js
var PLACEHOLDER_IMAGE = resolveMediaUrl("/assets/pizzas/margarita/margarita_01.jpg");
function applyImageFallback(img) {
  img.onerror = () => {
    img.onerror = null;
    img.src = PLACEHOLDER_IMAGE;
  };
}

// webapp/ui/gallery.js
function setupLazyLoad(track) {
  if (!("IntersectionObserver" in window)) {
    track.querySelectorAll("img[data-src]").forEach((img) => {
      img.src = img.dataset.src;
      img.removeAttribute("data-src");
    });
    return;
  }
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute("data-src");
        obs.unobserve(img);
      });
    },
    { root: track, rootMargin: "40px" }
  );
  track.querySelectorAll("img[data-src]").forEach((img) => observer.observe(img));
}
function createGallery(images = [], { large = false } = {}) {
  const container2 = createElement("div", { className: "gallery" });
  const track = createElement("div", { className: "gallery-track", attrs: { role: "list" } });
  const dots = createElement("div", { className: "gallery-dots" });
  if (!Array.isArray(images) || images.length === 0) {
    const fallback = createElement("div", { className: "gallery-slide" });
    const img = createElement("img", {
      className: ["gallery-image", large ? "large" : ""].join(" ").trim(),
      attrs: {
        alt: "\u0424\u043E\u0442\u043E \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E",
        loading: "lazy",
        decoding: "async",
        src: PLACEHOLDER_IMAGE
      }
    });
    applyImageFallback(img);
    fallback.appendChild(img);
    track.appendChild(fallback);
  } else {
    images.forEach((src, index) => {
      const slide = createElement("div", { className: "gallery-slide", attrs: { role: "listitem" } });
      const img = createElement("img", {
        className: ["gallery-image", large ? "large" : ""].join(" ").trim(),
        attrs: {
          alt: `\u0424\u043E\u0442\u043E ${index + 1}`,
          loading: "lazy",
          decoding: "async",
          "data-src": src
        }
      });
      applyImageFallback(img);
      slide.appendChild(img);
      track.appendChild(slide);
      const dot = createElement("span", {
        className: ["gallery-dot", index === 0 ? "active" : ""].join(" ").trim()
      });
      dots.appendChild(dot);
    });
  }
  let rafId = 0;
  const updateDots = () => {
    if (!dots.children.length) return;
    const index = Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
    Array.from(dots.children).forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
    });
  };
  track.addEventListener("scroll", () => {
    if (rafId) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      updateDots();
    });
  });
  track.addEventListener("click", () => {
    if (images.length <= 1) return;
    const index = Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
    const next = (index + 1) % images.length;
    track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
  });
  container2.appendChild(track);
  if (images.length > 1) {
    container2.appendChild(dots);
  }
  setupLazyLoad(track);
  return container2;
}

// webapp/ui/skeleton.js
function createSkeletonGrid(count2 = 4) {
  const wrapper = createElement("div", { className: "menu-grid" });
  for (let i = 0; i < count2; i += 1) {
    const block = createElement("div", { className: "skeleton skeleton-card" });
    wrapper.appendChild(block);
  }
  return wrapper;
}

// webapp/services/format.js
function formatPrice(value) {
  return `${value.toLocaleString("ru-RU")} \u20BD`;
}

// webapp/services/menuService.js
function buildImagesFromCount(baseId, photosCount) {
  const count2 = Number(photosCount);
  if (!baseId || !Number.isFinite(count2) || count2 <= 0) return [];
  return Array.from(
    { length: count2 },
    (_, index) => resolveMediaUrl(`assets/pizzas/${baseId}/${baseId}_${String(index + 1).padStart(2, "0")}.jpg`)
  );
}
function normalizeMenuItem(item) {
  const id = String(item?.id ?? item?.slug ?? "");
  const title = String(item?.title ?? "");
  const description = String(item?.desc ?? item?.description ?? "");
  const price = Number(item?.price ?? 0);
  const images = Array.isArray(item?.images) ? item.images.filter(Boolean).map((image) => typeof image === "string" ? image : image?.url).filter(Boolean).map(String) : [];
  const slugBase = String(item?.slug ?? item?.id ?? "");
  const resolvedImages = (images.length ? images : buildImagesFromCount(slugBase, item?.photosCount)).map(
    resolveMediaUrl
  );
  return {
    id,
    title,
    price,
    description,
    desc: description,
    tags: Array.isArray(item?.tags) ? item.tags.map(String) : [],
    isAvailable: typeof item?.isAvailable === "boolean" ? item.isAvailable : true,
    images: resolvedImages
  };
}
function collectPayloadKeys(value) {
  if (!value || typeof value !== "object") return [];
  return Object.keys(value);
}
function parseMenuPayload(payload) {
  const rawItemsPayload = payload?.items?.items ?? payload?.data?.items?.items ?? payload?.result?.items?.items ?? payload?.items ?? payload?.data?.items ?? payload?.result?.items ?? payload;
  const itemsPayload = Array.isArray(rawItemsPayload) ? rawItemsPayload : Array.isArray(rawItemsPayload?.items) ? rawItemsPayload.items : Array.isArray(rawItemsPayload?.results) ? rawItemsPayload.results : [];
  const isItemsPayloadRecognized = Array.isArray(rawItemsPayload) || Array.isArray(rawItemsPayload?.items) || Array.isArray(rawItemsPayload?.results);
  if (!isItemsPayloadRecognized) {
    const diagnostic = {
      message: "Menu items payload has unexpected shape.",
      payloadKeys: collectPayloadKeys(payload),
      dataKeys: collectPayloadKeys(payload?.data),
      resultKeys: collectPayloadKeys(payload?.result),
      itemsKeys: collectPayloadKeys(payload?.items),
      rawItemsKeys: collectPayloadKeys(rawItemsPayload)
    };
    console.error(diagnostic);
  }
  const rawCategoriesPayload = payload?.categories?.items?.items ?? payload?.data?.categories?.items?.items ?? payload?.result?.categories?.items?.items ?? payload?.categories?.items ?? payload?.data?.categories?.items ?? payload?.result?.categories?.items ?? payload?.categories ?? payload?.data?.categories ?? payload?.result?.categories;
  const categoriesPayload = Array.isArray(rawCategoriesPayload) ? rawCategoriesPayload : Array.isArray(rawCategoriesPayload?.items) ? rawCategoriesPayload.items : Array.isArray(rawCategoriesPayload?.results) ? rawCategoriesPayload.results : [];
  const isCategoriesPayloadRecognized = Array.isArray(rawCategoriesPayload) || Array.isArray(rawCategoriesPayload?.items) || Array.isArray(rawCategoriesPayload?.results);
  if (!isCategoriesPayloadRecognized) {
    const diagnostic = {
      message: "Menu categories payload has unexpected shape.",
      payloadKeys: collectPayloadKeys(payload),
      dataKeys: collectPayloadKeys(payload?.data),
      resultKeys: collectPayloadKeys(payload?.result),
      categoriesKeys: collectPayloadKeys(payload?.categories),
      rawCategoriesKeys: collectPayloadKeys(rawCategoriesPayload)
    };
    console.error(diagnostic);
  }
  const items = itemsPayload.map(normalizeMenuItem).filter((item) => item.id && item.title);
  return { items, categories: categoriesPayload };
}
async function fetchLocalMenu() {
  const response = await fetch("/data/menu.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (text.trim().startsWith("<")) {
    throw new Error("menu.json returned HTML (wrong path)");
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error("menu.json is not valid JSON");
  }
  return parseMenuPayload(payload);
}
function isFallbackEligible(error) {
  return error?.isFallback === true;
}
async function fetchApiJson(url) {
  let response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (error) {
    const networkError = new Error(`Network error while fetching ${url}`);
    networkError.cause = error;
    networkError.isFallback = true;
    throw networkError;
  }
  if (!response.ok) {
    const httpError = new Error(`HTTP ${response.status} for ${url}`);
    httpError.isFallback = response.status >= 500;
    httpError.status = response.status;
    httpError.cause = response;
    throw httpError;
  }
  return response.json();
}
async function fetchMenu() {
  try {
    const [productsResponse, categoriesResponse] = await Promise.all([
      fetchApiJson("/api/public/products"),
      fetchApiJson("/api/public/categories")
    ]);
    return parseMenuPayload({
      items: productsResponse.items ?? productsResponse,
      categories: categoriesResponse.items ?? categoriesResponse
    });
  } catch (error) {
    if (!isFallbackEligible(error)) {
      throw error;
    }
    try {
      return await fetchLocalMenu();
    } catch (fallbackError) {
      const combinedError = new Error("Menu fetch failed (API and local fallback).");
      combinedError.cause = { api: error, fallback: fallbackError };
      combinedError.apiError = error;
      combinedError.fallbackError = fallbackError;
      throw combinedError;
    }
  }
}

// webapp/store/menuStore.js
var state2 = {
  items: [],
  categories: [],
  status: "idle",
  error: null
};
var listeners2 = /* @__PURE__ */ new Set();
function notify() {
  listeners2.forEach((listener) => listener({ ...state2 }));
}
function subscribeMenu(listener) {
  listeners2.add(listener);
  listener({ ...state2 });
  return () => listeners2.delete(listener);
}
async function loadMenu() {
  if (state2.status === "loading" || state2.status === "loaded") {
    return state2.items;
  }
  state2.status = "loading";
  state2.error = null;
  notify();
  try {
    const data = await fetchMenu();
    state2.items = data.items;
    state2.categories = data.categories;
    state2.status = "loaded";
    notify();
    return data.items;
  } catch (error) {
    state2.status = "error";
    state2.error = error instanceof Error ? error.message : "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043C\u0435\u043D\u044E";
    notify();
    throw error;
  }
}
function getMenuItemById(id) {
  return state2.items.find((item) => item.id === id) || null;
}
function getMenuState() {
  return { ...state2 };
}

// webapp/services/configService.js
var cachedConfig = null;
var DEFAULT_CONFIG = {
  minOrder: 700,
  workHours: { open: "10:00", close: "22:00" },
  deliveryFee: 0,
  freeDeliveryFrom: 1500,
  supportPhone: "+7 (900) 000-00-00",
  supportChat: "https://t.me/pizzatagil_support",
  bannerText: "\u0414\u043E\u0441\u0442\u0430\u0432\u043A\u0430 45 \u043C\u0438\u043D\u0443\u0442 / \u0421\u043A\u0438\u0434\u043A\u0430 10% \u043F\u0440\u0438 \u0441\u0430\u043C\u043E\u0432\u044B\u0432\u043E\u0437\u0435",
  adminPinHash: null,
  adminTgId: null,
  promoPickupDiscount: 10,
  deliveryZones: []
};
async function fetchConfig() {
  if (cachedConfig) return cachedConfig;
  try {
    const response = await fetch("/data/config.json", { cache: "no-store" });
    if (response.ok) {
      cachedConfig = { ...DEFAULT_CONFIG, ...await response.json() };
    } else {
      cachedConfig = { ...DEFAULT_CONFIG };
    }
  } catch (error) {
    cachedConfig = { ...DEFAULT_CONFIG };
  }
  const override = storage.read(STORAGE_KEYS.adminConfig, null);
  if (override && typeof override === "object") {
    cachedConfig = { ...cachedConfig, ...override };
  }
  return cachedConfig;
}

// webapp/ui/toast.js
var container = null;
function ensureContainer() {
  if (container) return container;
  container = createElement("div", {
    className: "toast-container",
    attrs: {
      role: "status",
      "aria-live": "polite"
    }
  });
  document.body.appendChild(container);
  return container;
}
function showToast(message, variant = "info") {
  const root = ensureContainer();
  const toast = createElement("div", { className: ["toast", variant].join(" ") });
  if (variant === "error") {
    toast.setAttribute("aria-live", "assertive");
  }
  toast.textContent = message;
  root.appendChild(toast);
  window.setTimeout(() => toast.classList.add("show"), 10);
  window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 200);
  }, 3200);
}

// webapp/pages/menuPage.js
var DEFAULT_FILTERS = [
  { id: "all", label: "\u0412\u0441\u0435" },
  { id: "favorite", label: "\u0418\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0435" }
];
function createMenuCard(item, navigate2, favorites) {
  const card = createCard({ interactive: true });
  const gallery = createGallery(item.images, { large: false });
  const title = createElement("h3", { className: "card-title", text: item.title });
  const description = createElement("p", { className: "card-description", text: item.description });
  const tags = createElement("div", { className: "tag-row" });
  item.tags.forEach((tag) => tags.appendChild(createElement("span", { className: "badge", text: tag })));
  const isFav = favorites.has(item.id);
  const favButton = createIconButton({
    icon: "\u2764",
    ariaLabel: isFav ? "\u0423\u0431\u0440\u0430\u0442\u044C \u0438\u0437 \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E" : "\u0412 \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0435",
    active: isFav,
    className: "favorite-toggle"
  });
  favButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (favorites.has(item.id)) {
      favorites.delete(item.id);
      showToast("\u0423\u0434\u0430\u043B\u0435\u043D\u043E \u0438\u0437 \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E", "info");
      favButton.setAttribute("aria-label", "\u0412 \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0435");
    } else {
      favorites.add(item.id);
      showToast("\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0432 \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0435", "success");
      favButton.setAttribute("aria-label", "\u0423\u0431\u0440\u0430\u0442\u044C \u0438\u0437 \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E");
    }
    favButton.classList.toggle("is-active");
    setButtonPressed(favButton, favorites.has(item.id));
    setFavorites(favorites);
  });
  const footer = createCardFooter();
  const price = createPriceTag({ value: formatPrice(item.price) });
  const addButton = createButton({
    label: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C",
    onClick: (event) => {
      event.stopPropagation();
      add({
        id: item.id,
        title: item.title,
        price: item.price,
        image: item.images?.[0] || ""
      });
      showToast("\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443", "success");
    }
  });
  footer.append(price, addButton);
  card.append(gallery, favButton, title, description);
  if (item.tags.length) {
    card.append(tags);
  }
  card.append(footer);
  card.addEventListener("click", () => navigate2(`/pizza/${item.id}`));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate2(`/pizza/${item.id}`);
    }
  });
  return card;
}
function renderMenuPage({ navigate: navigate2 }) {
  const root = createElement("section", { className: "list" });
  const content2 = createElement("div");
  root.appendChild(content2);
  let currentFilter = "all";
  let searchValue = "";
  let config = null;
  const renderState = (state3) => {
    clearElement(content2);
    if (state3.status === "loading" || state3.status === "idle") {
      content2.appendChild(
        createLoadingState({
          text: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u043C\u0435\u043D\u044E\u2026",
          content: createSkeletonGrid(4)
        })
      );
      return;
    }
    if (state3.status === "error") {
      const retry = createButton({
        label: "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C",
        variant: "secondary",
        onClick: () => loadMenu().catch(() => null)
      });
      content2.appendChild(
        createErrorState({
          title: "\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438",
          description: state3.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u043C\u0435\u043D\u044E. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437.",
          action: retry
        })
      );
      return;
    }
    if (!state3.items.length) {
      content2.appendChild(
        createEmptyState({
          title: "\u041C\u0435\u043D\u044E \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043F\u0443\u0441\u0442\u043E\u0435",
          description: "\u041C\u044B \u0443\u0436\u0435 \u043E\u0431\u043D\u043E\u0432\u043B\u044F\u0435\u043C \u0430\u0441\u0441\u043E\u0440\u0442\u0438\u043C\u0435\u043D\u0442. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0447\u0443\u0442\u044C \u043F\u043E\u0437\u0436\u0435."
        })
      );
      return;
    }
    const favorites = getFavorites();
    const filtersRow = createElement("div", { className: "filter-row" });
    const categoryFilters = state3.categories.map((category) => ({
      id: String(category.id),
      label: category.title
    }));
    const filters = [...DEFAULT_FILTERS, ...categoryFilters];
    filters.forEach((filter) => {
      const button = createChip({
        label: filter.label,
        active: currentFilter === filter.id,
        ariaLabel: `\u0424\u0438\u043B\u044C\u0442\u0440: ${filter.label}`,
        onClick: () => {
          currentFilter = filter.id;
          renderState(state3);
        }
      });
      filtersRow.appendChild(button);
    });
    const searchInput = createInput({
      type: "search",
      placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E",
      ariaLabel: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E",
      value: searchValue,
      onInput: (event) => {
        searchValue = event.target.value.trim().toLowerCase();
        renderState(state3);
      }
    });
    const banner = createSection({ className: "banner" });
    banner.appendChild(createElement("div", { text: config?.bannerText || "\u0414\u043E\u0441\u0442\u0430\u0432\u043A\u0430 45 \u043C\u0438\u043D\u0443\u0442" }));
    banner.appendChild(
      createElement("div", {
        className: "helper",
        text: `\u0422\u0435\u043B\u0435\u0444\u043E\u043D: ${config?.supportPhone || ""}`
      })
    );
    const contacts = createCardFooter();
    const callLink = createLinkButton({
      label: "\u041F\u043E\u0437\u0432\u043E\u043D\u0438\u0442\u044C",
      variant: "secondary",
      href: `tel:${config?.supportPhone || ""}`,
      ariaLabel: "\u041F\u043E\u0437\u0432\u043E\u043D\u0438\u0442\u044C \u0432 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0443"
    });
    const chatLink = createLinkButton({
      label: "\u041D\u0430\u043F\u0438\u0441\u0430\u0442\u044C",
      variant: "secondary",
      href: config?.supportChat || "#",
      ariaLabel: "\u041D\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u0432 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0443",
      target: "_blank",
      rel: "noopener noreferrer"
    });
    contacts.append(callLink, chatLink);
    banner.appendChild(contacts);
    const grid = createElement("div", { className: "menu-grid" });
    const filtered = state3.items.filter((item) => item.isAvailable !== false).filter((item) => {
      if (currentFilter === "favorite") return favorites.has(item.id);
      if (currentFilter === "all") return true;
      return String(item.categoryId || "") === currentFilter;
    }).filter((item) => searchValue ? item.title.toLowerCase().includes(searchValue) : true);
    const orders = getOrders();
    const topMap = /* @__PURE__ */ new Map();
    orders.forEach((order) => {
      order.items?.forEach((item) => {
        topMap.set(item.id, (topMap.get(item.id) || 0) + item.qty);
      });
    });
    const topIds = Array.from(topMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);
    const recommended = state3.items.filter((item) => topIds.includes(item.id));
    content2.append(banner, searchInput, filtersRow);
    if (recommended.length) {
      const recTitle = createElement("h3", { className: "section-title", text: "\u0422\u043E\u043F \u043F\u0440\u043E\u0434\u0430\u0436" });
      const recGrid = createElement("div", { className: "menu-grid" });
      recommended.forEach((item) => recGrid.appendChild(createMenuCard(item, navigate2, favorites)));
      content2.append(recTitle, recGrid);
    }
    if (!filtered.length) {
      content2.appendChild(
        createEmptyState({
          title: "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E",
          description: "\u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0434\u0440\u0443\u0433\u043E\u0439 \u0444\u0438\u043B\u044C\u0442\u0440 \u0438\u043B\u0438 \u043E\u0447\u0438\u0441\u0442\u0438\u0442\u0435 \u043F\u043E\u0438\u0441\u043A."
        })
      );
      return;
    }
    filtered.forEach((item) => grid.appendChild(createMenuCard(item, navigate2, favorites)));
    content2.appendChild(grid);
  };
  const unsubscribe = subscribeMenu(renderState);
  fetchConfig().then((configValue) => {
    config = configValue;
    loadMenu().catch(() => null);
  });
  return { element: root, cleanup: unsubscribe };
}

// webapp/pages/cartPage.js
function createCartItemRow(item) {
  const row = createSection({ className: "cart-item" });
  const header = createElement("div", { className: "cart-row" });
  const product = createElement("div", { className: "cart-cell cart-product" });
  const productLabel = createElement("span", { className: "cart-cell-label", text: "\u0422\u043E\u0432\u0430\u0440" });
  const previewSrc = item.image || PLACEHOLDER_IMAGE;
  const preview = createElement("img", {
    className: "cart-preview",
    attrs: { src: previewSrc, alt: item.title || "\u041F\u0438\u0446\u0446\u0430" }
  });
  applyImageFallback(preview);
  const title = createElement("div", { className: "cart-title", text: item.title });
  product.append(productLabel, preview, title);
  const price = createElement("div", { className: "cart-cell cart-price" });
  price.append(
    createElement("span", { className: "cart-cell-label", text: "\u0426\u0435\u043D\u0430" }),
    createElement("span", { text: formatPrice(item.price) })
  );
  const qtyCell = createElement("div", { className: "cart-cell cart-qty" });
  qtyCell.appendChild(createElement("span", { className: "cart-cell-label", text: "\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E" }));
  const controls = createElement("div", { className: "qty-controls" });
  const dec = createButton({
    label: "\u2212",
    variant: "qty",
    size: "sm",
    ariaLabel: "\u0423\u043C\u0435\u043D\u044C\u0448\u0438\u0442\u044C \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E",
    onClick: () => setQty(item.id, item.qty - 1)
  });
  const qty = createElement("span", { className: "qty-label", text: String(item.qty) });
  const inc = createButton({
    label: "+",
    variant: "qty",
    size: "sm",
    ariaLabel: "\u0423\u0432\u0435\u043B\u0438\u0447\u0438\u0442\u044C \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E",
    onClick: () => setQty(item.id, item.qty + 1)
  });
  controls.append(dec, qty, inc);
  qtyCell.appendChild(controls);
  const lineTotal = item.price * item.qty;
  const sum = createElement("div", { className: "cart-cell cart-sum" });
  sum.append(
    createElement("span", { className: "cart-cell-label", text: "\u0421\u0443\u043C\u043C\u0430" }),
    createElement("span", { text: formatPrice(lineTotal) })
  );
  header.append(product, price, qtyCell, sum);
  const removeButton = createButton({
    label: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
    variant: "ghost",
    className: "cart-remove",
    ariaLabel: `\u0423\u0434\u0430\u043B\u0438\u0442\u044C ${item.title}`,
    onClick: () => {
      remove(item.id);
      showToast("\u041F\u043E\u0437\u0438\u0446\u0438\u044F \u0443\u0434\u0430\u043B\u0435\u043D\u0430", "info");
    }
  });
  row.append(removeButton, header);
  return row;
}
function renderCartPage({ navigate: navigate2 }) {
  const root = createElement("section", { className: "list" });
  const content2 = createElement("div");
  root.appendChild(content2);
  const renderState = (state3) => {
    clearElement(content2);
    if (!state3.items.length) {
      content2.appendChild(
        createEmptyState({
          title: "\u041A\u043E\u0440\u0437\u0438\u043D\u0430 \u043F\u0443\u0441\u0442\u0430",
          description: "\u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u043B\u044E\u0431\u0438\u043C\u0443\u044E \u043F\u0438\u0446\u0446\u0443 \u0438\u0437 \u043C\u0435\u043D\u044E.",
          action: createButton({
            label: "\u041F\u0435\u0440\u0435\u0439\u0442\u0438 \u0432 \u043C\u0435\u043D\u044E",
            variant: "secondary",
            onClick: () => navigate2("/menu")
          })
        })
      );
      return;
    }
    const list = createElement("div", { className: "list cart-list" });
    const listHeader = createElement("div", { className: "cart-header" });
    listHeader.append(
      createElement("span", { text: "\u0422\u043E\u0432\u0430\u0440" }),
      createElement("span", { text: "\u0426\u0435\u043D\u0430" }),
      createElement("span", { text: "\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E" }),
      createElement("span", { text: "\u0421\u0443\u043C\u043C\u0430" })
    );
    content2.appendChild(listHeader);
    state3.items.forEach((item) => list.appendChild(createCartItemRow(item)));
    content2.appendChild(list);
    const summary = createSection({ className: "cart-summary" });
    const totalRow = createElement("div", { className: "total-row" });
    totalRow.append(createElement("span", { text: "\u0418\u0442\u043E\u0433\u043E" }), createElement("span", { text: formatPrice(total()) }));
    summary.appendChild(totalRow);
    summary.appendChild(
      createButton({
        label: "\u041E\u0444\u043E\u0440\u043C\u0438\u0442\u044C \u0437\u0430\u043A\u0430\u0437",
        className: "cart-checkout",
        onClick: () => navigate2("/checkout")
      })
    );
    content2.appendChild(summary);
  };
  const unsubscribe = subscribeCart(renderState);
  renderState(getState());
  return { element: root, cleanup: unsubscribe };
}

// webapp/services/paymentService.js
var PAYMENT_METHODS = {
  card: "card",
  sbp: "sbp",
  cash: "cash"
};
var PAYMENT_STATUSES = {
  pending: "pending",
  ok: "ok",
  failed: "failed"
};
async function preparePayment(order, method) {
  if (!order || !method) {
    return { status: PAYMENT_STATUSES.failed, message: "\u041C\u0435\u0442\u043E\u0434 \u043E\u043F\u043B\u0430\u0442\u044B \u043D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D" };
  }
  return {
    status: PAYMENT_STATUSES.pending,
    method,
    metadata: {
      orderId: order.order_id
    }
  };
}
function getPromoList(storageService) {
  if (!storageService) return [];
  const promos = storageService.read(STORAGE_KEYS.adminPromos, []);
  return Array.isArray(promos) ? promos : [];
}
function applyPromo(total2, promo) {
  if (!promo || !promo.active) return { total: total2, discount: 0 };
  if (promo.expiresAt) {
    const now = Date.now();
    const expires = Date.parse(promo.expiresAt);
    if (!Number.isNaN(expires) && now > expires) {
      return { total: total2, discount: 0 };
    }
  }
  const value = Number(promo.value || 0);
  if (promo.type === "percent") {
    const discount2 = Math.round(total2 * value / 100);
    return { total: Math.max(0, total2 - discount2), discount: discount2 };
  }
  const discount = Math.min(total2, value);
  return { total: Math.max(0, total2 - discount), discount };
}

// webapp/pages/checkoutPage.js
var PAYMENT_OPTIONS = [
  { id: PAYMENT_METHODS.cash, label: "\u041D\u0430\u043B\u0438\u0447\u043D\u044B\u0435", enabled: true },
  { id: PAYMENT_METHODS.sbp, label: "\u0421\u0411\u041F (QR)", enabled: false },
  { id: PAYMENT_METHODS.card, label: "\u041A\u0430\u0440\u0442\u0430", enabled: false }
];
function renderOrderItems(container2, items) {
  const list = createElement("div", { className: "list" });
  items.forEach((item) => {
    const row = createElement("div", { className: "panel" });
    row.appendChild(createElement("div", { text: item.title }));
    row.appendChild(createElement("div", { className: "helper", text: `${item.qty} \xD7 ${formatPrice(item.price)}` }));
    row.appendChild(createElement("div", { className: "helper", text: `\u0421\u0443\u043C\u043C\u0430: ${formatPrice(item.price * item.qty)}` }));
    list.appendChild(row);
  });
  clearElement(container2);
  container2.appendChild(list);
}
function renderCheckoutPage({ navigate: navigate2 }) {
  const root = createElement("section", { className: "list" });
  const content2 = createElement("div");
  root.appendChild(content2);
  let submitting = false;
  let selectedMethod = PAYMENT_METHODS.cash;
  let config = null;
  let promoApplied = null;
  let deliveryType = "delivery";
  const renderState = (state3) => {
    clearElement(content2);
    if (!state3.items.length) {
      const empty = createElement("div", { className: "panel" });
      empty.appendChild(createElement("p", { className: "helper", text: "\u041A\u043E\u0440\u0437\u0438\u043D\u0430 \u043F\u0443\u0441\u0442\u0430. \u041D\u0435\u0447\u0435\u0433\u043E \u043E\u0444\u043E\u0440\u043C\u043B\u044F\u0442\u044C." }));
      empty.appendChild(
        createButton({
          label: "\u0412\u0435\u0440\u043D\u0443\u0442\u044C\u0441\u044F \u0432 \u043C\u0435\u043D\u044E",
          variant: "secondary",
          onClick: () => navigate2("/menu")
        })
      );
      content2.appendChild(empty);
      return;
    }
    const itemsBlock = createElement("div");
    renderOrderItems(itemsBlock, state3.items);
    const summary = createElement("div", { className: "panel" });
    const subtotalValue = total();
    const pickupDiscount = deliveryType === "pickup" ? Math.round(subtotalValue * Number(config?.promoPickupDiscount || 0) / 100) : 0;
    const discountedSubtotal = Math.max(0, subtotalValue - pickupDiscount);
    const deliveryFee = deliveryType === "delivery" ? Number(config?.deliveryFee || 0) : 0;
    const freeFrom = Number(config?.freeDeliveryFrom || 0);
    const finalDeliveryFee = deliveryFee && subtotalValue >= freeFrom ? 0 : deliveryFee;
    const promoResult = promoApplied ? applyPromo(discountedSubtotal, promoApplied) : { total: discountedSubtotal, discount: 0 };
    const totalValue = promoResult.total + finalDeliveryFee;
    const subtotalRow = createElement("div", { className: "total-row" });
    subtotalRow.append(
      createElement("span", { text: "\u041F\u043E\u0434\u044B\u0442\u043E\u0433" }),
      createElement("span", { text: formatPrice(subtotalValue) })
    );
    const deliveryRow = createElement("div", { className: "total-row" });
    deliveryRow.append(
      createElement("span", { text: "\u0414\u043E\u0441\u0442\u0430\u0432\u043A\u0430" }),
      createElement("span", { text: formatPrice(finalDeliveryFee) })
    );
    const totalRow = createElement("div", { className: "total-row" });
    totalRow.append(createElement("span", { text: "\u0418\u0442\u043E\u0433\u043E" }), createElement("span", { text: formatPrice(totalValue) }));
    summary.append(subtotalRow);
    if (pickupDiscount) {
      const pickupRow = createElement("div", { className: "total-row" });
      pickupRow.append(
        createElement("span", { text: `\u0421\u043A\u0438\u0434\u043A\u0430 \u0441\u0430\u043C\u043E\u0432\u044B\u0432\u043E\u0437` }),
        createElement("span", { text: `\u2212${formatPrice(pickupDiscount)}` })
      );
      summary.appendChild(pickupRow);
    }
    summary.append(deliveryRow);
    if (promoResult.discount) {
      const promoRow = createElement("div", { className: "total-row" });
      promoRow.append(
        createElement("span", { text: `\u041F\u0440\u043E\u043C\u043E\u043A\u043E\u0434 ${promoApplied.code}` }),
        createElement("span", { text: `\u2212${formatPrice(promoResult.discount)}` })
      );
      summary.appendChild(promoRow);
    }
    summary.appendChild(totalRow);
    const form = createElement("div", { className: "list" });
    const phoneInput = createElement("input", {
      className: "input",
      attrs: { type: "tel", placeholder: "+7 900 000-00-00", required: true }
    });
    const nameInput = createElement("input", {
      className: "input",
      attrs: { type: "text", placeholder: "\u0418\u043C\u044F (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)" }
    });
    const deliveryToggle = createElement("div", { className: "panel" });
    deliveryToggle.appendChild(createElement("div", { className: "helper", text: "\u0421\u043F\u043E\u0441\u043E\u0431 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u044F" }));
    ["delivery", "pickup"].forEach((type) => {
      const label = createElement("label", { className: "panel radio-row" });
      const input = createElement("input", {
        attrs: { type: "radio", name: "delivery", value: type }
      });
      input.checked = deliveryType === type;
      input.addEventListener("change", () => {
        deliveryType = type;
        renderState(getState());
      });
      label.append(
        input,
        createElement("span", {
          text: type === "delivery" ? "\u0414\u043E\u0441\u0442\u0430\u0432\u043A\u0430" : "\u0421\u0430\u043C\u043E\u0432\u044B\u0432\u043E\u0437"
        })
      );
      deliveryToggle.appendChild(label);
    });
    const addressInput = createElement("input", {
      className: "input",
      attrs: { type: "text", placeholder: "\u0410\u0434\u0440\u0435\u0441 \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438" }
    });
    const commentLabel = createElement("label", { className: "helper", text: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u043A \u0437\u0430\u043A\u0430\u0437\u0443" });
    const commentInput = createElement("textarea", {
      className: "input",
      attrs: { placeholder: "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u0431\u0435\u0437 \u043B\u0443\u043A\u0430, \u043A\u0443\u0440\u044C\u0435\u0440 \u043F\u043E\u0437\u0432\u043E\u043D\u0438\u0442\u044C" }
    });
    const paymentLabel = createElement("div", { className: "helper", text: "\u0421\u043F\u043E\u0441\u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u044B" });
    const paymentOptions = createElement("div", { className: "list" });
    PAYMENT_OPTIONS.forEach((option) => {
      const optionRow = createElement("label", { className: "panel" });
      const input = createElement("input", {
        attrs: {
          type: "radio",
          name: "payment",
          value: option.id,
          disabled: option.enabled ? void 0 : "disabled"
        }
      });
      input.checked = option.id === selectedMethod;
      input.addEventListener("change", () => {
        selectedMethod = option.id;
      });
      optionRow.append(input, createElement("span", { text: option.label }));
      if (!option.enabled) {
        optionRow.appendChild(createElement("span", { className: "helper", text: "\u0421\u043A\u043E\u0440\u043E" }));
      }
      paymentOptions.appendChild(optionRow);
    });
    const promoLabel = createElement("label", { className: "helper", text: "\u041F\u0440\u043E\u043C\u043E\u043A\u043E\u0434" });
    const promoInput = createElement("input", {
      className: "input",
      attrs: { type: "text", placeholder: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043F\u0440\u043E\u043C\u043E\u043A\u043E\u0434" }
    });
    const promoButton = createButton({
      label: "\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C",
      variant: "secondary",
      onClick: () => {
        const code = promoInput.value.trim().toLowerCase();
        if (!code) {
          showToast("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043F\u0440\u043E\u043C\u043E\u043A\u043E\u0434", "info");
          return;
        }
        const promoList = getPromoList(storage);
        const promo = promoList.find((item) => item.code?.toLowerCase() === code && item.active);
        if (!promo) {
          showToast("\u041F\u0440\u043E\u043C\u043E\u043A\u043E\u0434 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D", "error");
          promoApplied = null;
        } else {
          promoApplied = promo;
          showToast("\u041F\u0440\u043E\u043C\u043E\u043A\u043E\u0434 \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D", "success");
        }
        renderState(getState());
      }
    });
    const error = createElement("div", { className: "error" });
    error.hidden = true;
    const submit = createButton({
      label: "\u041E\u0444\u043E\u0440\u043C\u0438\u0442\u044C \u0437\u0430\u043A\u0430\u0437",
      onClick: async () => {
        if (submitting) return;
        error.hidden = true;
        if (!getState().items.length) {
          error.textContent = "\u041A\u043E\u0440\u0437\u0438\u043D\u0430 \u043F\u0443\u0441\u0442\u0430.";
          error.hidden = false;
          return;
        }
        const phone = phoneInput.value.trim();
        if (!/^\+?[0-9\s()-]{10,}$/.test(phone)) {
          error.textContent = "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0442\u0435\u043B\u0435\u0444\u043E\u043D.";
          error.hidden = false;
          return;
        }
        if (deliveryType === "delivery" && !addressInput.value.trim()) {
          error.textContent = "\u0410\u0434\u0440\u0435\u0441 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u0435\u043D \u0434\u043B\u044F \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438.";
          error.hidden = false;
          return;
        }
        if (deliveryType === "delivery" && Array.isArray(config?.deliveryZones) && config.deliveryZones.length) {
          const address = addressInput.value.trim().toLowerCase();
          const match = config.deliveryZones.some((zone) => address.includes(String(zone).toLowerCase()));
          if (!match) {
            showToast("\u0410\u0434\u0440\u0435\u0441 \u0432\u043D\u0435 \u0437\u043E\u043D\u044B \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438. \u0417\u0430\u043A\u0430\u0437 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D.", "info");
          }
        }
        if (subtotalValue < Number(config?.minOrder || 0)) {
          error.textContent = `\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0443\u043C\u043C\u0430 \u0437\u0430\u043A\u0430\u0437\u0430 ${formatPrice(config?.minOrder || 0)}.`;
          error.hidden = false;
          return;
        }
        const now = /* @__PURE__ */ new Date();
        const [openHour, openMin] = String(config?.workHours?.open || "10:00").split(":").map(Number);
        const [closeHour, closeMin] = String(config?.workHours?.close || "22:00").split(":").map(Number);
        const minutes = now.getHours() * 60 + now.getMinutes();
        const openMinutes = openHour * 60 + openMin;
        const closeMinutes = closeHour * 60 + closeMin;
        if (minutes < openMinutes || minutes > closeMinutes) {
          error.textContent = `\u041C\u044B \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u043C \u0441 ${config?.workHours?.open} \u0434\u043E ${config?.workHours?.close}.`;
          error.hidden = false;
          return;
        }
        submitting = true;
        setButtonLoading(submit, true);
        const orderId = window.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const user = getUser();
        const order = {
          type: "pizza_order_v1",
          order_id: orderId,
          request_id: null,
          ts: Math.floor(Date.now() / 1e3),
          source: "webapp",
          user: {
            tg_id: user?.id,
            username: user?.username,
            first_name: user?.first_name
          },
          customer: { phone, name: nameInput.value.trim() || void 0 },
          delivery: {
            type: deliveryType,
            address: deliveryType === "delivery" ? addressInput.value.trim() : void 0
          },
          payment: { method: selectedMethod, status: "pending" },
          items: state3.items.map((item) => ({
            id: item.id,
            title: item.title,
            price: item.price,
            qty: item.qty
          })),
          subtotal: discountedSubtotal,
          delivery_fee: finalDeliveryFee,
          total: totalValue,
          comment: commentInput.value.trim()
        };
        try {
          const payment = await preparePayment(order, selectedMethod);
          order.payment = payment;
          const apiPayload = {
            order_id: order.order_id,
            customerName: order.customer.name || "\u0413\u043E\u0441\u0442\u044C",
            phone: order.customer.phone,
            address: order.delivery.address,
            comment: order.comment,
            items: order.items.map((item) => ({
              ...item,
              id: Number(item.id)
            })),
            total: order.total
          };
          let pendingSync = false;
          try {
            const apiResponse = await fetch("/api/public/orders", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(apiPayload)
            });
            const requestId = apiResponse.headers.get("x-request-id");
            if (requestId) {
              order.request_id = requestId;
            }
            if (!apiResponse.ok) {
              pendingSync = true;
              throw new Error(`API status ${apiResponse.status}`);
            }
          } catch (apiError) {
            pendingSync = true;
            addPendingOrder({
              order_id: order.order_id,
              payload: apiPayload,
              ts: Date.now(),
              request_id: order.request_id || void 0
            });
            console.warn("Failed to persist order in API", apiError);
          }
          setLastOrderStatus({
            status: "order:creating",
            order_id: order.order_id,
            request_id: order.request_id || void 0
          });
          const sent = sendData(order);
          if (!sent && !isTelegram()) {
            const status2 = pendingSync ? "order:pending_sync" : "order:sent";
            addOrder({ ...order, status: status2 });
            setLastOrderStatus({
              status: status2,
              order_id: order.order_id,
              request_id: order.request_id || void 0
            });
            clear();
            showToast("\u0417\u0430\u043A\u0430\u0437 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E", "success");
            navigate2("/order-status");
            return;
          }
          const status = sent ? pendingSync ? "order:pending_sync" : "order:sent" : "order:error";
          setLastOrderStatus({
            status,
            order_id: order.order_id,
            request_id: order.request_id || void 0
          });
          if (!sent) {
            throw new Error("Telegram unavailable");
          }
          addOrder({ ...order, status });
          clear();
          showTelegramAlert("\u0417\u0430\u043A\u0430\u0437 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D \u0432 \u0431\u043E\u0442 \u2705");
          showToast("\u0417\u0430\u043A\u0430\u0437 \u043F\u0440\u0438\u043D\u044F\u0442, \u043C\u044B \u0441\u043A\u043E\u0440\u043E \u0441\u0432\u044F\u0436\u0435\u043C\u0441\u044F!", "success");
          navigate2("/order-status");
        } catch (err) {
          console.error("Checkout failed", err);
          setLastOrderStatus({
            status: "order:error",
            order_id: order.order_id,
            request_id: order.request_id || void 0
          });
          addOrder({ ...order, status: "order:error" });
          error.textContent = "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u043A\u0430\u0437. \u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E.";
          error.hidden = false;
          showToast("\u041E\u0448\u0438\u0431\u043A\u0430 Telegram \u2014 \u0437\u0430\u043A\u0430\u0437 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E", "error");
          navigate2("/order-status");
        } finally {
          submitting = false;
          setButtonLoading(submit, false);
        }
      }
    });
    form.append(
      createElement("label", { className: "helper", text: "\u0422\u0435\u043B\u0435\u0444\u043E\u043D" }),
      phoneInput,
      createElement("label", { className: "helper", text: "\u0418\u043C\u044F" }),
      nameInput,
      deliveryToggle
    );
    if (deliveryType === "delivery") {
      form.append(createElement("label", { className: "helper", text: "\u0410\u0434\u0440\u0435\u0441" }), addressInput);
    }
    summary.append(
      form,
      commentLabel,
      commentInput,
      paymentLabel,
      paymentOptions,
      promoLabel,
      promoInput,
      promoButton,
      error,
      submit
    );
    content2.append(itemsBlock, summary);
  };
  const unsubscribe = subscribeCart(renderState);
  fetchConfig().then((configValue) => {
    config = configValue;
    renderState(getState());
  });
  return { element: root, cleanup: unsubscribe };
}

// webapp/pages/pizzaPage.js
function renderPizzaPage({ navigate: navigate2, params }) {
  const root = createElement("section", { className: "list" });
  const content2 = createElement("div", { className: "fade-in" });
  root.appendChild(content2);
  const renderState = () => {
    clearElement(content2);
    const item = getMenuItemById(params.id);
    if (!item) {
      const panel = createSection();
      panel.appendChild(createElement("p", { className: "helper", text: "\u041F\u0438\u0446\u0446\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430." }));
      panel.appendChild(
        createButton({
          label: "\u041D\u0430\u0437\u0430\u0434 \u0432 \u043C\u0435\u043D\u044E",
          variant: "secondary",
          onClick: () => navigate2("/menu")
        })
      );
      content2.appendChild(panel);
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
      icon: isFav ? "\u2665" : "\u2661",
      ariaLabel: isFav ? "\u0423\u0431\u0440\u0430\u0442\u044C \u0438\u0437 \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E" : "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432 \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0435",
      active: isFav,
      className: "favorite-chip"
    });
    favButton.addEventListener("click", () => {
      if (favorites.has(item.id)) {
        favorites.delete(item.id);
        favButton.textContent = "\u2661";
        favButton.classList.remove("is-active");
        favButton.setAttribute("aria-label", "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432 \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0435");
      } else {
        favorites.add(item.id);
        favButton.textContent = "\u2665";
        favButton.classList.add("is-active");
        favButton.setAttribute("aria-label", "\u0423\u0431\u0440\u0430\u0442\u044C \u0438\u0437 \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E");
      }
      setButtonPressed(favButton, favorites.has(item.id));
      setFavorites(favorites);
    });
    const actions = createCardFooter();
    const back = createButton({
      label: "\u041D\u0430\u0437\u0430\u0434",
      variant: "secondary",
      onClick: () => navigate2("/menu")
    });
    const add2 = createButton({
      label: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443",
      onClick: () => add2({
        id: item.id,
        title: item.title,
        price: item.price,
        image: item.images?.[0] || ""
      })
    });
    add2.addEventListener("click", () => showToast("\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443", "success"));
    actions.append(back, add2);
    card.append(favButton, actions);
    content2.appendChild(card);
  };
  const unsubscribe = subscribeMenu(renderState);
  loadMenu().catch(() => null);
  return { element: root, cleanup: unsubscribe };
}

// webapp/pages/profilePage.js
function computeStats(orders) {
  const totalOrders = orders.length;
  const totalSpent = orders.reduce((sum, order) => sum + (order.total || 0), 0);
  const avgCheck = totalOrders ? Math.round(totalSpent / totalOrders) : 0;
  const favMap = /* @__PURE__ */ new Map();
  orders.forEach((order) => {
    order.items?.forEach((item) => {
      favMap.set(item.title, (favMap.get(item.title) || 0) + item.qty);
    });
  });
  const favorite = Array.from(favMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "\u2014";
  return { totalOrders, totalSpent, avgCheck, favorite };
}
var STATUS_LABELS = {
  "order:sent": "\u041E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D",
  "order:pending_sync": "\u041E\u0436\u0438\u0434\u0430\u0435\u0442 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u0438",
  "order:error": "\u041E\u0448\u0438\u0431\u043A\u0430",
  "order:success": "\u041E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D"
};
function getStatusLabel(status) {
  return STATUS_LABELS[status] || "\u041E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D";
}
function renderProfilePage({ navigate: navigate2 }) {
  const root = createElement("section", { className: "list" });
  const content2 = createElement("div");
  root.appendChild(content2);
  const render = () => {
    clearElement(content2);
    const orders = getOrders();
    const favorites = getFavorites();
    const stats = computeStats(orders);
    const summary = createElement("div", { className: "panel" });
    summary.appendChild(createElement("h2", { className: "title", text: "\u041F\u0440\u043E\u0444\u0438\u043B\u044C" }));
    summary.appendChild(createElement("div", { className: "helper", text: `\u0417\u0430\u043A\u0430\u0437\u043E\u0432: ${stats.totalOrders}` }));
    summary.appendChild(createElement("div", { className: "helper", text: `\u0421\u0440\u0435\u0434\u043D\u0438\u0439 \u0447\u0435\u043A: ${formatPrice(stats.avgCheck)}` }));
    summary.appendChild(createElement("div", { className: "helper", text: `\u041B\u044E\u0431\u0438\u043C\u0430\u044F \u043F\u0438\u0446\u0446\u0430: ${stats.favorite}` }));
    summary.appendChild(createElement("div", { className: "helper", text: `\u041F\u043E\u0442\u0440\u0430\u0447\u0435\u043D\u043E: ${formatPrice(stats.totalSpent)}` }));
    const favPanel = createElement("div", { className: "panel" });
    favPanel.appendChild(createElement("h3", { className: "section-title", text: "\u0418\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0435" }));
    if (!favorites.size) {
      favPanel.appendChild(createElement("p", { className: "helper", text: "\u0418\u0437\u0431\u0440\u0430\u043D\u043D\u044B\u0445 \u043F\u0438\u0446\u0446 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442." }));
    } else {
      favPanel.appendChild(
        createElement("p", { className: "helper", text: `\u0412 \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u043C: ${favorites.size}` })
      );
    }
    const history = createElement("div", { className: "panel" });
    history.appendChild(createElement("h3", { className: "section-title", text: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 \u0437\u0430\u043A\u0430\u0437\u044B" }));
    if (!orders.length) {
      history.appendChild(createElement("p", { className: "helper", text: "\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u043F\u0443\u0441\u0442\u0430." }));
    } else {
      orders.slice(0, 10).forEach((order) => {
        const row = createElement("div", { className: "order-row" });
        row.appendChild(
          createElement("div", {
            text: `#${order.order_id || "\u2014"} \u2022 ${formatPrice(order.total || 0)}`
          })
        );
        const status = createElement("div", {
          className: "helper",
          text: getStatusLabel(order.status)
        });
        const items = createElement("div", {
          className: "helper",
          text: order.items?.map((item) => `${item.title} \xD7 ${item.qty}`).join(", ") || ""
        });
        const repeat = createButton({
          label: "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C \u0437\u0430\u043A\u0430\u0437",
          variant: "secondary",
          onClick: () => {
            setState(order.items || []);
            showToast("\u041F\u043E\u0437\u0438\u0446\u0438\u0438 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u044B \u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443", "success");
            navigate2("/cart");
          }
        });
        row.append(status, items, repeat);
        history.appendChild(row);
      });
    }
    const feedback = createElement("div", { className: "panel" });
    feedback.appendChild(createElement("h3", { className: "section-title", text: "\u041E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u043E\u0442\u0437\u044B\u0432" }));
    const feedbackInput = createElement("textarea", {
      className: "input",
      attrs: { placeholder: "\u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u043E\u0442\u0437\u044B\u0432 \u0438\u043B\u0438 \u043F\u043E\u0436\u0435\u043B\u0430\u043D\u0438\u0435" }
    });
    const feedbackButton = createButton({
      label: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C",
      onClick: () => {
        const message = feedbackInput.value.trim();
        if (!message) {
          showToast("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043E\u0442\u0437\u044B\u0432", "info");
          return;
        }
        const sent = sendData({ type: "feedback_v1", message, ts: Date.now() });
        if (sent) {
          showTelegramAlert("\u0421\u043F\u0430\u0441\u0438\u0431\u043E \u0437\u0430 \u043E\u0442\u0437\u044B\u0432!");
        } else {
          showToast("\u041E\u0442\u0437\u044B\u0432 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E", "info");
        }
        feedbackInput.value = "";
      }
    });
    feedback.append(feedbackInput, feedbackButton);
    content2.append(summary, favPanel, history, feedback);
  };
  render();
  return { element: root };
}

// webapp/pages/adminPage.js
function renderAdminPage() {
  const root = createElement("section", { className: "min-h-screen" });
  const mount = createElement("div");
  const placeholder = createElement("div", {
    className: "admin-placeholder",
    text: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0430\u0434\u043C\u0438\u043D\u043A\u0438\u2026"
  });
  root.appendChild(placeholder);
  root.appendChild(mount);
  let cleanup2 = null;
  import("/admin/AdminApp.bundle.js").then((module) => {
    placeholder.remove();
    cleanup2 = module.mountAdminApp(mount, {
      navigate: window.appNavigate,
      initialPath: window.location.pathname
    });
  }).catch((error) => {
    placeholder.textContent = `\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0430\u0434\u043C\u0438\u043D\u043A\u0438: ${error.message}`;
  });
  return {
    element: root,
    cleanup: () => cleanup2?.()
  };
}

// webapp/pages/orderStatusPage.js
var STATUS_LABELS2 = {
  "order:creating": "\u0421\u043E\u0437\u0434\u0430\u0451\u043C \u0437\u0430\u043A\u0430\u0437",
  "order:sent": "\u0417\u0430\u043A\u0430\u0437 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D",
  "order:success": "\u0417\u0430\u043A\u0430\u0437 \u043F\u0440\u0438\u043D\u044F\u0442",
  "order:pending_sync": "\u041E\u0436\u0438\u0434\u0430\u0435\u0442 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u0438",
  "order:error": "\u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0438"
};
function renderOrderStatusPage({ navigate: navigate2 }) {
  const root = createElement("section", { className: "list" });
  const content2 = createElement("div");
  root.appendChild(content2);
  const render = () => {
    clearElement(content2);
    const status = getLastOrderStatus();
    const orders = getOrders();
    const latest = orders[0];
    const requestId = latest?.request_id || status?.request_id;
    const panel = createElement("div", { className: "panel" });
    panel.appendChild(
      createElement("h2", {
        className: "title",
        text: "\u0421\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u043A\u0430\u0437\u0430"
      })
    );
    panel.appendChild(
      createElement("p", {
        className: "helper",
        text: status ? STATUS_LABELS2[status.status] || status.status : "\u041D\u0435\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u0437\u0430\u043A\u0430\u0437\u0430."
      })
    );
    if (latest) {
      panel.appendChild(
        createElement("div", {
          className: "helper",
          text: `\u0421\u0443\u043C\u043C\u0430: ${formatPrice(latest.total)}`
        })
      );
    }
    if (requestId) {
      panel.appendChild(
        createElement("div", {
          className: "helper",
          text: `Request ID: ${requestId}`
        })
      );
    }
    panel.appendChild(
      createButton({
        label: "\u041F\u0435\u0440\u0435\u0439\u0442\u0438 \u0432 \u043F\u0440\u043E\u0444\u0438\u043B\u044C",
        onClick: () => navigate2("/profile")
      })
    );
    content2.appendChild(panel);
  };
  render();
  return { element: root };
}

// webapp/services/pagesService.js
async function fetchPageBySlug(slug) {
  const response = await fetch(`/api/public/pages/${slug}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// webapp/pages/dynamicPage.js
function renderHero(props) {
  const section = createSection({
    title: props.title || "",
    titleTag: "h2",
    description: props.subtitle
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
  const displayIds = Array.isArray(props.items) ? props.items.filter((item) => item.visible !== false).map((item) => String(item.id)) : Array.isArray(props.productIds) ? props.productIds.map(String) : [];
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
      label: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C",
      onClick: () => {
        add({ id: item.id, title: item.title, price: item.price, image: item.images?.[0] || "" });
        showToast("\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443", "success");
      }
    });
    footer.appendChild(addButton);
    card.appendChild(footer);
    grid.appendChild(card);
  });
  if (!products.length) {
    section.appendChild(createElement("p", { className: "helper", text: "\u041D\u0435\u0442 \u0442\u043E\u0432\u0430\u0440\u043E\u0432 \u0434\u043B\u044F \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F." }));
  } else {
    section.appendChild(grid);
  }
  return section;
}
function renderDynamicPage({ params }) {
  const root = createElement("section", { className: "list" });
  const content2 = createElement("div");
  root.appendChild(content2);
  const renderState = async () => {
    clearElement(content2);
    try {
      await loadMenu();
      const { items } = getMenuState();
      const { page, blocks } = await fetchPageBySlug(params.id);
      content2.appendChild(createElement("h2", { className: "title", text: page.title }));
      blocks.forEach((block) => {
        switch (block.type) {
          case "hero":
            content2.appendChild(renderHero(block.props || {}));
            break;
          case "banner":
            content2.appendChild(renderBanner(block.props || {}));
            break;
          case "text":
            content2.appendChild(renderText(block.props || {}));
            break;
          case "gallery":
            content2.appendChild(renderGallery(block.props || {}));
            break;
          case "products-grid":
            content2.appendChild(renderProductsGrid(block.props || {}, items));
            break;
          default:
            break;
        }
      });
    } catch (error) {
      content2.appendChild(
        createElement("p", { className: "helper", text: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443." })
      );
    }
  };
  renderState();
  return { element: root };
}

// webapp/ui/appShell.js
function createNav({ items, onNavigate, location = "top" }) {
  const nav = createElement("nav", {
    className: "nav",
    attrs: { "aria-label": location === "top" ? "\u041E\u0441\u043D\u043E\u0432\u043D\u0430\u044F \u043D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044F" : "\u041D\u0438\u0436\u043D\u044F\u044F \u043D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044F" }
  });
  const buttons = items.map((item) => {
    const button = createButton({
      label: item.label,
      variant: "nav",
      size: "sm",
      ariaLabel: item.label,
      onClick: () => onNavigate(item.path)
    });
    button.dataset.path = item.path;
    button.dataset.location = location;
    nav.appendChild(button);
    return button;
  });
  return { element: nav, buttons };
}
function createTopBar({ title, subtitle, navItems: navItems2, onNavigate }) {
  const header = createElement("header", { className: "header" });
  header.appendChild(createElement("h1", { className: "title", text: title }));
  header.appendChild(createElement("p", { className: "subtitle", text: subtitle }));
  const nav = createNav({ items: navItems2, onNavigate, location: "top" });
  const element = createElement("div", { className: "top-bar" });
  element.append(header, nav.element);
  return { element, header, nav };
}
function createBottomBar({ navItems: navItems2, onNavigate }) {
  const nav = createNav({ items: navItems2, onNavigate, location: "bottom" });
  const element = createElement("div", { className: "bottom-bar" });
  element.appendChild(nav.element);
  return { element, nav };
}
function createAppShell({ title, subtitle, navItems: navItems2, onNavigate }) {
  const warning2 = createElement("div", { className: "warning", text: "Browser Mode: Telegram WebApp \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D." });
  warning2.hidden = true;
  const debugPanel2 = createElement("div", { className: "panel debug-panel" });
  debugPanel2.hidden = true;
  const topBar2 = createTopBar({ title, subtitle, navItems: navItems2, onNavigate });
  const bottomBar2 = createBottomBar({ navItems: navItems2, onNavigate });
  const content2 = createElement("main", { className: "app-content" });
  return {
    elements: [topBar2.element, warning2, debugPanel2, content2, bottomBar2.element],
    warning: warning2,
    debugPanel: debugPanel2,
    topBar: topBar2,
    bottomBar: bottomBar2,
    content: content2
  };
}

// webapp/services/orderSyncService.js
var syncing = false;
async function sendOrderPayload(payload) {
  const response = await fetch("/api/public/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`Order sync failed: ${response.status}`);
  }
}
async function syncPendingOrders() {
  if (syncing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const queue = getPendingOrders();
  if (!queue.length) return;
  syncing = true;
  try {
    for (const order of queue) {
      try {
        await sendOrderPayload(order.payload);
        removePendingOrder(order.order_id);
        updateOrderStatus(order.order_id, "order:sent");
      } catch (error) {
        console.warn("Pending order sync failed", error);
      }
    }
  } finally {
    syncing = false;
  }
}

// webapp/app.js
var app = document.getElementById("app");
if (typeof window.PUBLIC_MEDIA_BASE_URL === "undefined") {
  window.PUBLIC_MEDIA_BASE_URL = "";
}
var navItems = [
  { label: "\u041C\u0435\u043D\u044E", path: "/menu" },
  { label: "\u041A\u043E\u0440\u0437\u0438\u043D\u0430", path: "/cart" },
  { label: "\u041E\u0444\u043E\u0440\u043C\u0438\u0442\u044C", path: "/checkout" },
  { label: "\u041F\u0440\u043E\u0444\u0438\u043B\u044C", path: "/profile" },
  { label: "\u0410\u0434\u043C\u0438\u043D", path: "/admin" }
];
var appShell = createAppShell({
  title: "Pizza Tagil",
  subtitle: "\u041C\u0438\u043D\u0438 App \u0434\u043B\u044F \u0437\u0430\u043A\u0430\u0437\u0430 \u043F\u0438\u0446\u0446\u044B \u0431\u0435\u0437 \u043B\u0438\u0448\u043D\u0438\u0445 \u0448\u0430\u0433\u043E\u0432.",
  navItems,
  onNavigate: (path) => navigate(path)
});
var { warning, debugPanel, topBar, bottomBar, content } = appShell;
app.append(...appShell.elements);
var routes = [
  { path: /^\/menu\/?$/, render: renderMenuPage },
  { path: /^\/cart\/?$/, render: renderCartPage },
  { path: /^\/checkout\/?$/, render: renderCheckoutPage },
  { path: /^\/profile\/?$/, render: renderProfilePage },
  { path: /^\/admin\/login\/?$/, render: renderAdminPage },
  { path: /^\/admin\/?$/, render: renderAdminPage },
  { path: /^\/order-status\/?$/, render: renderOrderStatusPage },
  { path: /^\/pizza\/([^/]+)\/?$/, render: renderPizzaPage },
  { path: /^\/page\/([^/]+)\/?$/, render: renderDynamicPage }
];
var cleanup = null;
function setActiveNav(pathname) {
  [topBar.nav.buttons, bottomBar.nav.buttons].forEach((buttons) => {
    buttons.forEach((button) => {
      const target = button.dataset.path;
      const isActive = pathname.startsWith(target);
      button.classList.toggle("is-active", isActive);
      setButtonCurrent(button, isActive);
    });
  });
}
function renderRoute(pathname) {
  const path = pathname === "/" ? "/menu" : pathname;
  const match = routes.find((route) => route.path.test(path));
  if (!match) {
    navigate("/menu");
    return;
  }
  const isAdmin = path.startsWith("/admin");
  topBar.element.hidden = isAdmin;
  bottomBar.element.hidden = isAdmin;
  document.body.classList.toggle("admin-mode", isAdmin);
  renderDebug();
  if (cleanup) cleanup();
  clearElement(content);
  const paramsMatch = path.match(match.path);
  const params = paramsMatch && paramsMatch.length > 1 ? { id: paramsMatch[1] } : {};
  const result = match.render({ navigate, params });
  cleanup = result?.cleanup || null;
  content.appendChild(result.element);
  setActiveNav(path);
}
function navigate(path) {
  window.history.pushState({}, "", path);
  renderRoute(path);
}
window.appNavigate = navigate;
window.addEventListener("popstate", () => renderRoute(window.location.pathname));
window.addEventListener("online", () => {
  syncPendingOrders();
});
var telegramState = initTelegram();
warning.textContent = "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0447\u0435\u0440\u0435\u0437 \u043A\u043D\u043E\u043F\u043A\u0443 \xAB\u{1F355} \u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D\xBB \u0432 \u0431\u043E\u0442\u0435, \u0438\u043D\u0430\u0447\u0435 Telegram \u0444\u0443\u043D\u043A\u0446\u0438\u0438 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B.";
warning.hidden = telegramState.available && !telegramState.missingInitData;
subscribeCart(() => {
  const itemsCount = count();
  [topBar.nav.buttons, bottomBar.nav.buttons].forEach((buttons) => {
    const cartButton = buttons[1];
    cartButton.textContent = itemsCount ? `\u041A\u043E\u0440\u0437\u0438\u043D\u0430 (${itemsCount})` : "\u041A\u043E\u0440\u0437\u0438\u043D\u0430";
  });
});
function renderDebug() {
  const isDebug = new URLSearchParams(window.location.search).get("debug") === "1";
  debugPanel.hidden = !isDebug;
  if (!isDebug) return;
  clearElement(debugPanel);
  const lastStatus = getLastOrderStatus();
  debugPanel.appendChild(createElement("h3", { className: "section-title", text: "Debug" }));
  debugPanel.appendChild(createElement("div", { className: "helper", text: `isTelegram: ${isTelegram()}` }));
  const user = getUser();
  debugPanel.appendChild(
    createElement("div", {
      className: "helper",
      text: `user: ${user?.id || "\u2014"} ${user?.username ? `@${user.username}` : ""}`
    })
  );
  debugPanel.appendChild(
    createElement("div", {
      className: "helper",
      text: `lastOrderStatus: ${lastStatus?.status || "\u2014"}`
    })
  );
  debugPanel.appendChild(
    createElement("div", {
      className: "helper",
      text: `cart items: ${count()}`
    })
  );
  debugPanel.appendChild(
    createElement("div", {
      className: "helper",
      text: `storage: cart=${storage.has(STORAGE_KEYS.cart)} orders=${storage.has(
        STORAGE_KEYS.orders
      )} favs=${storage.has(STORAGE_KEYS.favorites)}`
    })
  );
}
renderDebug();
renderRoute(window.location.pathname);
syncPendingOrders();
