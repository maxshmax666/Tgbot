// webapp/services/telegramService.js
function getWebApp() {
  return window.Telegram?.WebApp || null;
}
function getAvailabilityState() {
  const wa = getWebApp();
  const initData = wa?.initData;
  const user = wa?.initDataUnsafe?.user;
  const hasInitData = typeof initData === "string" && initData.trim().length > 0;
  const userValid = !user || typeof user === "object" && !Array.isArray(user);
  const available = Boolean(wa && userValid);
  return { available, missingInitData: available && !hasInitData };
}
function isTelegram() {
  const { available, missingInitData } = getAvailabilityState();
  return available && !missingInitData;
}
function initTelegram() {
  const wa = getWebApp();
  const state4 = getAvailabilityState();
  if (!wa) return state4;
  try {
    wa.ready?.();
  } catch {
  }
  try {
    wa.expand?.();
  } catch {
  }
  try {
    wa.setHeaderColor?.("#0b0b0b");
  } catch {
  }
  try {
    wa.setBackgroundColor?.("#0b0b0b");
  } catch {
  }
  return state4;
}
function getUser() {
  const wa = getWebApp();
  const u = wa?.initDataUnsafe?.user || null;
  return u && typeof u === "object" ? u : null;
}
function sendData(payload) {
  const wa = getWebApp();
  if (!wa?.sendData) return false;
  try {
    const data = typeof payload === "string" ? payload : JSON.stringify(payload);
    wa.sendData(data);
    return true;
  } catch {
    return false;
  }
}
function showTelegramAlert(message, title = "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435") {
  const wa = getWebApp();
  if (wa?.showPopup) {
    return new Promise((resolve) => {
      try {
        wa.showPopup(
          { title, message: String(message ?? ""), buttons: [{ id: "ok", type: "ok", text: "OK" }] },
          () => resolve()
        );
      } catch {
        try {
          alert(String(message ?? ""));
        } catch {
        }
        resolve();
      }
    });
  }
  return new Promise((resolve) => {
    try {
      alert(String(message ?? ""));
    } catch {
    }
    resolve();
  });
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
  lastOrderStatus: "pt_last_order_status_v1",
  userAuth: "pt_user_auth_v1",
  promoSelected: "pt_selected_promo_v1",
  menuState: "pt_menu_state_v1"
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
function updateOrderStatus(orderId, status, updatedAt) {
  if (!orderId) return;
  const items = getOrders();
  const index = items.findIndex((item) => item.order_id === orderId);
  if (index === -1) return;
  items[index] = {
    ...items[index],
    status,
    ...updatedAt ? { updated_at: updatedAt } : {}
  };
  storage.write(STORAGE_KEYS.orders, items);
}
function updateOrderStatusFromApi(orderId, status, updatedAt) {
  if (!orderId || !status) return;
  updateOrderStatus(orderId, status, updatedAt);
  setLastOrderStatus({
    status,
    order_id: orderId,
    updated_at: updatedAt || void 0
  });
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
function getSelectedPromo() {
  return storage.read(STORAGE_KEYS.promoSelected, null);
}
function setSelectedPromo(promo) {
  if (!promo) {
    storage.remove(STORAGE_KEYS.promoSelected);
    return;
  }
  storage.write(STORAGE_KEYS.promoSelected, promo);
}

// webapp/store/cartStore.js
var state = {
  items: [],
  updatedAt: Date.now()
};
var listeners = /* @__PURE__ */ new Set();
var DEFAULT_DOUGH = "poolish";
function resolveDoughType(item) {
  return String(item?.doughType || DEFAULT_DOUGH);
}
function buildLineId(item) {
  return `${String(item?.id || "")}::${resolveDoughType(item)}`;
}
function normalizeItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    id: String(item.id || ""),
    title: String(item.title || ""),
    price: Number(item.price || 0),
    image: item.image || "",
    qty: Number(item.qty || 0),
    doughType: resolveDoughType(item),
    lineId: item.lineId || buildLineId(item)
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
  const lineId = item?.lineId || buildLineId(item);
  const existing = items.find((cartItem) => cartItem.lineId === lineId);
  if (existing) {
    existing.qty += 1;
  } else {
    items.push({
      id: String(item.id || ""),
      title: String(item.title || ""),
      price: Number(item.price || 0),
      image: item.image || "",
      doughType: resolveDoughType(item),
      lineId,
      qty: 1
    });
  }
  persist(items);
  dispatchChange({ items });
}
function setQty(lineId, qty) {
  const items = [...state.items];
  const target = items.find((item) => item.lineId === lineId);
  if (!target) return;
  target.qty = Math.max(0, qty);
  const next = items.filter((item) => item.qty > 0);
  persist(next);
  dispatchChange({ items: next });
}
function remove(lineId) {
  const next = state.items.filter((item) => item.lineId !== lineId);
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
function createCardFooter2({ className = "", attrs = {} } = {}) {
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
function createLightbox(src, alt) {
  const overlay = createElement("div", { className: "gallery-lightbox", attrs: { role: "dialog", "aria-modal": "true" } });
  const image = createElement("img", { className: "gallery-lightbox-image", attrs: { src, alt } });
  const close = createElement("button", {
    className: "gallery-lightbox-close",
    text: "\xD7",
    attrs: { type: "button", "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C" }
  });
  overlay.append(image, close);
  const closeLightbox = () => {
    document.removeEventListener("keydown", onKeydown);
    overlay.remove();
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") {
      closeLightbox();
    }
  };
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeLightbox();
  });
  close.addEventListener("click", closeLightbox);
  document.addEventListener("keydown", onKeydown);
  return overlay;
}
function createGallery(images = [], { large = false, enableZoom = false } = {}) {
  const container2 = createElement("div", { className: "gallery" });
  const track = createElement("div", { className: "gallery-track", attrs: { role: "list" } });
  const dots = createElement("div", { className: "gallery-dots" });
  if (!Array.isArray(images) || images.length === 0) {
    const fallback = createElement("div", { className: "gallery-slide" });
    const img = createElement("img", {
      className: ["gallery-image", large ? "large" : "", enableZoom ? "zoomable" : ""].join(" ").trim(),
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
        className: ["gallery-image", large ? "large" : "", enableZoom ? "zoomable" : ""].join(" ").trim(),
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
  track.addEventListener("click", (event) => {
    if (enableZoom && event.target?.tagName === "IMG") {
      const index2 = Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
      const src = images[index2] || event.target?.currentSrc || event.target?.src;
      if (src) {
        document.body.appendChild(createLightbox(src, event.target?.alt || "\u0424\u043E\u0442\u043E"));
      }
      return;
    }
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
  const photosPoolishRaw = Array.isArray(item?.photosPoolish) ? item.photosPoolish : Array.isArray(item?.photos_poolish) ? item.photos_poolish : [];
  const photosBigaRaw = Array.isArray(item?.photosBiga) ? item.photosBiga : Array.isArray(item?.photos_biga) ? item.photos_biga : [];
  const photosPoolish = photosPoolishRaw.filter(Boolean).map((image) => typeof image === "string" ? image : image?.url).filter(Boolean).map(String).map(resolveMediaUrl);
  const photosBiga = photosBigaRaw.filter(Boolean).map((image) => typeof image === "string" ? image : image?.url).filter(Boolean).map(String).map(resolveMediaUrl);
  const categoryId = item?.categoryId ?? item?.category_id ?? item?.category?.id ?? item?.category?.slug ?? null;
  return {
    id,
    title,
    price,
    description,
    desc: description,
    tags: Array.isArray(item?.tags) ? item.tags.map(String) : [],
    isAvailable: typeof item?.isAvailable === "boolean" ? item.isAvailable : true,
    images: resolvedImages,
    photosPoolish,
    photosBiga,
    categoryId: categoryId === null ? null : String(categoryId)
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
async function hasLocalMenu() {
  try {
    const response = await fetch("/data/menu.json", { method: "HEAD", cache: "no-store" });
    if (response.ok) return true;
  } catch (error) {
    return false;
  }
  try {
    const response = await fetch("/data/menu.json", { cache: "no-store" });
    if (!response.ok) return false;
    const text = await response.text();
    return Boolean(text && !text.trim().startsWith("<"));
  } catch (error) {
    return false;
  }
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
    httpError.isFallback = response.status >= 500 || response.status === 404;
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
    const apiMenu = parseMenuPayload({
      items: productsResponse.items ?? productsResponse,
      categories: categoriesResponse.items ?? categoriesResponse
    });
    if (!apiMenu.items.length) {
      try {
        const localMenu = await fetchLocalMenu();
        if (localMenu.items.length) {
          return { ...localMenu, source: "local" };
        }
      } catch (localError) {
        console.warn("Local menu fallback failed after empty API payload.", localError);
      }
    }
    return { ...apiMenu, source: "api" };
  } catch (error) {
    if (!isFallbackEligible(error)) {
      throw error;
    }
    try {
      const localMenu = await fetchLocalMenu();
      return { ...localMenu, source: "local" };
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
  source: "api",
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
    state2.source = data.source ?? "api";
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
async function loadLocalMenu() {
  if (state2.status === "loading") {
    return state2.items;
  }
  state2.status = "loading";
  state2.error = null;
  notify();
  try {
    const data = await fetchLocalMenu();
    state2.items = data.items;
    state2.categories = data.categories;
    state2.source = "local";
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
function getMenuItemBySlug(slug) {
  return state2.items.find((item) => item.slug === slug || item.id === slug) || null;
}
function getMenuState() {
  return { ...state2 };
}

// webapp/services/configService.js
var cachedConfig = null;
var DEFAULT_CONFIG = {
  minOrder: 700,
  workHours: { open: "10:00", close: "22:00" },
  workSchedule: [
    {
      days: [1, 2, 3, 4, 5, 6, 0],
      intervals: [{ start: "10:00", end: "22:00" }]
    }
  ],
  deliveryFee: 0,
  freeDeliveryFrom: 1500,
  supportPhone: "+7 (900) 000-00-00",
  supportChat: "https://t.me/pizzatagil_support",
  bannerText: "\u0413\u043E\u0440\u044F\u0447\u0430\u044F \u043F\u0438\u0446\u0446\u0430 \u0438 \u043B\u044E\u0431\u0438\u043C\u044B\u0435 \u0445\u0438\u0442\u044B \u043A\u0430\u0436\u0434\u044B\u0439 \u0434\u0435\u043D\u044C",
  adminPinHash: null,
  adminTgId: null,
  promoPickupDiscount: 10,
  deliveryZones: [],
  deliveryGeoEnabled: false,
  deliveryPostalEnabled: false,
  defaultDeliveryZoneId: null
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

// webapp/ui/breadcrumbs.js
function createBreadcrumbs(items = []) {
  const nav = createElement("nav", { className: "breadcrumbs", attrs: { "aria-label": "\u0425\u043B\u0435\u0431\u043D\u044B\u0435 \u043A\u0440\u043E\u0448\u043A\u0438" } });
  const list = createElement("ol", { className: "breadcrumbs-list" });
  items.forEach((item, index) => {
    const li = createElement("li", { className: "breadcrumbs-item" });
    if (item?.onClick) {
      const button = createElement("button", {
        className: "breadcrumbs-link",
        text: item.label,
        attrs: { type: "button" }
      });
      button.addEventListener("click", item.onClick);
      li.appendChild(button);
    } else {
      li.appendChild(createElement("span", { className: "breadcrumbs-current", text: item?.label || "" }));
    }
    if (index < items.length - 1) {
      li.appendChild(createElement("span", { className: "breadcrumbs-separator", text: "\u2192" }));
    }
    list.appendChild(li);
  });
  nav.appendChild(list);
  return nav;
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
  const options = typeof variant === "string" ? { variant } : {
    variant: variant?.variant || "info",
    durationMs: variant?.durationMs,
    actionLabel: variant?.actionLabel,
    onAction: variant?.onAction
  };
  const root = ensureContainer();
  const toast = createElement("div", { className: ["toast", options.variant].join(" ") });
  if (options.variant === "error") {
    toast.setAttribute("aria-live", "assertive");
  }
  const text = createElement("span", { className: "toast-text", text: message });
  toast.appendChild(text);
  if (options.actionLabel && typeof options.onAction === "function") {
    const action = createElement("button", {
      className: "toast-action",
      text: options.actionLabel,
      attrs: { type: "button" }
    });
    action.addEventListener("click", () => options.onAction());
    toast.appendChild(action);
  }
  root.appendChild(toast);
  window.setTimeout(() => toast.classList.add("show"), 10);
  const duration = Number.isFinite(options.durationMs) ? options.durationMs : 2200;
  window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 200);
  }, duration);
}

// webapp/services/menuFilterService.js
var QUICK_FILTERS = [
  { id: "spicy", label: "\u041E\u0441\u0442\u0440\u044B\u0435" },
  { id: "meatless", label: "\u0411\u0435\u0437 \u043C\u044F\u0441\u0430" },
  { id: "kids", label: "\u0414\u0435\u0442\u0441\u043A\u0438\u0435" },
  { id: "popular", label: "\u041F\u043E\u043F\u0443\u043B\u044F\u0440\u043D\u044B\u0435" }
];
function getPopularIds(orders = [], limit = 3) {
  const counts = /* @__PURE__ */ new Map();
  orders.forEach((order) => {
    order.items?.forEach((item) => {
      counts.set(item.id, (counts.get(item.id) || 0) + (item.qty || 0));
    });
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => String(id));
}
function filterMenuItems(items, { filterId, favorites, popularIds, categoryIds }) {
  const normalizedFilter = String(filterId || "all");
  const activeFavorites = favorites instanceof Set ? favorites : /* @__PURE__ */ new Set();
  const popularSet = new Set(popularIds || []);
  return (Array.isArray(items) ? items : []).filter((item) => item.isAvailable !== false).filter((item) => {
    const tags = Array.isArray(item.tags) ? item.tags : [];
    if (normalizedFilter === "favorite") return activeFavorites.has(item.id);
    if (normalizedFilter === "popular") return popularSet.has(item.id);
    if (normalizedFilter === "spicy") return tags.includes("spicy");
    if (normalizedFilter === "kids") return tags.includes("kids");
    if (normalizedFilter === "meatless") return !tags.includes("meat");
    if (categoryIds?.has(normalizedFilter)) return String(item.categoryId || "") === normalizedFilter;
    return true;
  });
}

// webapp/pages/menuPage.js
var DEFAULT_FILTERS = [
  { id: "all", label: "\u0412\u0441\u0435" },
  { id: "favorite", label: "\u0418\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0435" }
];
var MENU_SCROLL_THROTTLE_MS = 160;
var MENU_STATE_DEFAULT = {
  currentFilter: "all",
  scrollByFilter: {}
};
function getScrollKey(filterId) {
  return `menuScroll:${filterId || "all"}`;
}
function readMenuState() {
  const raw = storage.read(STORAGE_KEYS.menuState, MENU_STATE_DEFAULT);
  const scrollByFilter = raw && typeof raw.scrollByFilter === "object" && raw.scrollByFilter !== null ? raw.scrollByFilter : {};
  return {
    currentFilter: typeof raw?.currentFilter === "string" ? raw.currentFilter : "all",
    scrollByFilter
  };
}
function writeMenuState(next) {
  storage.write(STORAGE_KEYS.menuState, next);
}
function createMenuCard(item, navigate2, favorites, { filterId } = {}) {
  const itemSlug = item.slug || item.id;
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
        image: item.images?.[0] || "",
        doughType: "poolish"
      });
      showToast("\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443", {
        variant: "success",
        durationMs: 2e3,
        actionLabel: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u043E\u0440\u0437\u0438\u043D\u0443",
        onAction: () => navigate2("/cart")
      });
      console.info("cart:add", { source: "menu", itemId: item.id, doughType: "poolish", toast: "\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443" });
    }
  });
  footer.append(price, addButton);
  card.append(gallery, favButton, title, description);
  if (item.tags.length) {
    card.append(tags);
  }
  card.append(footer);
  const query = filterId && filterId !== "all" ? `?from=${encodeURIComponent(filterId)}` : "";
  card.addEventListener("click", () => navigate2(`/pizza/${itemSlug}${query}`));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate2(`/pizza/${itemSlug}${query}`);
    }
  });
  return card;
}
function renderMenuPage({ navigate: navigate2 }) {
  const root = createElement("section", { className: "list" });
  const content2 = createElement("div");
  root.appendChild(content2);
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
      ...next
    };
    writeMenuState(updated);
    return updated;
  };
  const saveScrollPosition = () => {
    if (!scrollContainer) return;
    const scrollTop = Math.max(0, Math.round(scrollContainer.scrollTop));
    const state4 = persistMenuState();
    const key = getScrollKey(currentFilter);
    state4.scrollByFilter[key] = scrollTop;
    state4.currentFilter = currentFilter;
    writeMenuState(state4);
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
    const state4 = readMenuState();
    const key = getScrollKey(currentFilter);
    const target = Math.max(0, Number(state4.scrollByFilter?.[key] ?? 0));
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
  const renderState = (state4) => {
    clearElement(content2);
    if (state4.status === "loading" || state4.status === "idle") {
      content2.appendChild(
        createLoadingState({
          text: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u043C\u0435\u043D\u044E\u2026",
          content: createSkeletonGrid(4)
        })
      );
      return;
    }
    if (state4.status === "error") {
      const retry = createButton({
        label: "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C",
        variant: "secondary",
        onClick: () => loadMenu().catch(() => null)
      });
      content2.appendChild(
        createErrorState({
          title: "\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438",
          description: state4.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u043C\u0435\u043D\u044E. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437.",
          action: retry
        })
      );
      return;
    }
    if (!state4.items.length) {
      content2.appendChild(
        createEmptyState({
          title: "\u041C\u0435\u043D\u044E \u043F\u0443\u0441\u0442\u043E\u0435",
          description: "\u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0442\u043E\u0432\u0430\u0440\u044B \u0432 \u0430\u0434\u043C\u0438\u043D\u043A\u0435."
        })
      );
      return;
    }
    const favorites = getFavorites();
    const filtersRow = createElement("div", { className: "filter-row" });
    const quickFiltersRow = createElement("div", { className: "filter-row quick-filters" });
    const crumbs = createBreadcrumbs([
      { label: "\u041C\u0435\u043D\u044E", onClick: () => navigate2("/menu") },
      { label: "\u041F\u0438\u0446\u0446\u044B" }
    ]);
    const categoryFilters = state4.categories.map((category) => ({
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
          persistMenuState({ currentFilter });
          shouldRestoreScroll = true;
          renderState(state4);
        }
      });
      filtersRow.appendChild(button);
    });
    QUICK_FILTERS.forEach((filter) => {
      const button = createChip({
        label: filter.label,
        active: currentFilter === filter.id,
        ariaLabel: `\u0411\u044B\u0441\u0442\u0440\u044B\u0439 \u0444\u0438\u043B\u044C\u0442\u0440: ${filter.label}`,
        onClick: () => {
          currentFilter = filter.id;
          persistMenuState({ currentFilter });
          shouldRestoreScroll = true;
          renderState(state4);
        }
      });
      quickFiltersRow.appendChild(button);
    });
    const searchInput = createInput({
      type: "search",
      placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E",
      ariaLabel: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E",
      value: searchValue,
      onInput: (event) => {
        searchValue = event.target.value.trim().toLowerCase();
        renderState(state4);
      }
    });
    const banner = createSection({ className: "banner" });
    banner.appendChild(createElement("div", { text: config?.bannerText || "\u0413\u043E\u0440\u044F\u0447\u0430\u044F \u043F\u0438\u0446\u0446\u0430 \u0438 \u043B\u044E\u0431\u0438\u043C\u044B\u0435 \u0445\u0438\u0442\u044B \u043A\u0430\u0436\u0434\u044B\u0439 \u0434\u0435\u043D\u044C" }));
    const phoneValue = config?.supportPhone || "";
    if (phoneValue) {
      banner.appendChild(
        createElement("div", {
          className: "helper",
          text: `\u0422\u0435\u043B\u0435\u0444\u043E\u043D: ${phoneValue}`
        })
      );
    }
    const orders = getOrders();
    const topIds = getPopularIds(orders, 3);
    const recommended = state4.items.filter((item) => topIds.includes(item.id));
    const recommendedIds = new Set(recommended.map((item) => item.id));
    const showRecommended = recommended.length > 0;
    const grid = createElement("div", { className: "menu-grid" });
    const categoryIds = new Set(state4.categories.map((category) => String(category.id)));
    const filtered = filterMenuItems(state4.items, {
      filterId: currentFilter,
      favorites,
      popularIds: topIds,
      categoryIds
    }).filter((item) => searchValue ? item.title.toLowerCase().includes(searchValue) : true).filter((item) => !showRecommended || !recommendedIds.has(item.id));
    content2.append(crumbs, banner, searchInput, filtersRow, quickFiltersRow);
    if (showRecommended) {
      const recTitle = createElement("h3", { className: "section-title", text: "\u0422\u043E\u043F \u043F\u0440\u043E\u0434\u0430\u0436" });
      const recGrid = createElement("div", { className: "menu-grid" });
      recommended.forEach(
        (item) => recGrid.appendChild(createMenuCard(item, navigate2, favorites, { filterId: currentFilter }))
      );
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
    filtered.forEach(
      (item) => grid.appendChild(createMenuCard(item, navigate2, favorites, { filterId: currentFilter }))
    );
    content2.appendChild(grid);
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
    }
  };
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
  const dough = item.doughType ? createElement("div", {
    className: "helper",
    text: `\u0422\u0435\u0441\u0442\u043E: ${item.doughType === "biga" ? "\u0411\u0438\u0433\u0430" : "\u041F\u0443\u043B\u0438\u0448"}`
  }) : null;
  product.append(productLabel, preview, title);
  if (dough) product.appendChild(dough);
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
    onClick: () => setQty(item.lineId || item.id, item.qty - 1)
  });
  const qty = createElement("span", { className: "qty-label", text: String(item.qty) });
  const inc = createButton({
    label: "+",
    variant: "qty",
    size: "sm",
    ariaLabel: "\u0423\u0432\u0435\u043B\u0438\u0447\u0438\u0442\u044C \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E",
    onClick: () => setQty(item.lineId || item.id, item.qty + 1)
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
      remove(item.lineId || item.id);
      showToast("\u041F\u043E\u0437\u0438\u0446\u0438\u044F \u0443\u0434\u0430\u043B\u0435\u043D\u0430", "info");
    }
  });
  const addons = createElement("div", { className: "cart-addons" });
  addons.appendChild(createElement("div", { className: "helper", text: "\u041F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0438 \u0434\u043E\u043F\u043E\u0432:" }));
  const addonsList = createElement("div", { className: "cart-addons-list" });
  ["\u0421\u043E\u0443\u0441", "\u0414\u043E\u043F. \u0441\u044B\u0440", "\u041D\u0430\u043F\u0438\u0442\u043E\u043A"].forEach(
    (addon) => addonsList.appendChild(createElement("span", { className: "badge", text: addon }))
  );
  addons.appendChild(addonsList);
  row.append(removeButton, header, addons);
  return row;
}
function renderCartPage({ navigate: navigate2 }) {
  const root = createElement("section", { className: "list" });
  const content2 = createElement("div");
  root.appendChild(content2);
  const renderState = (state4) => {
    clearElement(content2);
    if (!state4.items.length) {
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
    state4.items.forEach((item) => list.appendChild(createCartItemRow(item)));
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
  if (method === PAYMENT_METHODS.cash) {
    return {
      status: PAYMENT_STATUSES.pending,
      method,
      payment_id: null,
      metadata: {
        orderId: order.order_id
      }
    };
  }
  try {
    const response = await fetch("/api/public/payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        order_id: order.order_id,
        method,
        total: Number(order.total),
        items: order.items.map((item) => ({
          id: Number(item.id),
          qty: Number(item.qty)
        })),
        customer: {
          name: order.customer?.name,
          phone: order.customer?.phone
        }
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error?.message || "\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u043F\u043B\u0430\u0442\u0435\u0436\u0430";
      throw new Error(message);
    }
    return {
      status: payload.status || PAYMENT_STATUSES.pending,
      method,
      payment_id: payload.payment_id,
      payment_url: payload.payment_url,
      confirmation: payload.confirmation,
      metadata: {
        orderId: order.order_id
      }
    };
  } catch (error) {
    console.error("Payment create failed", error);
    return {
      status: PAYMENT_STATUSES.failed,
      method,
      message: error?.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u043F\u043B\u0430\u0442\u0435\u0436",
      metadata: {
        orderId: order.order_id
      }
    };
  }
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

// webapp/services/scheduleService.js
var DEFAULT_SCHEDULE = [
  {
    days: [1, 2, 3, 4, 5, 6, 0],
    intervals: [{ start: "10:00", end: "22:00" }]
  }
];
function parseTimeToMinutes(value) {
  const [hour, minute] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}
function normalizeSchedule(rawSchedule, fallbackHours) {
  if (Array.isArray(rawSchedule) && rawSchedule.length) return rawSchedule;
  if (fallbackHours?.open || fallbackHours?.close) {
    const open = fallbackHours?.open || "10:00";
    const close = fallbackHours?.close || "22:00";
    return [
      {
        days: [1, 2, 3, 4, 5, 6, 0],
        intervals: [{ start: open, end: close }]
      }
    ];
  }
  return DEFAULT_SCHEDULE;
}
function getIntervalsForDay(schedule, day) {
  return schedule.filter((entry) => Array.isArray(entry?.days) && entry.days.includes(day)).flatMap((entry) => entry.intervals || []).map((interval) => {
    const start = parseTimeToMinutes(interval?.start);
    const end = parseTimeToMinutes(interval?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    return { start, end };
  }).filter(Boolean).sort((a, b) => a.start - b.start);
}
function getScheduleStatus(rawSchedule, fallbackHours, now = /* @__PURE__ */ new Date()) {
  const schedule = normalizeSchedule(rawSchedule, fallbackHours);
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const intervals = getIntervalsForDay(schedule, day);
  const activeInterval = intervals.find((interval) => minutes >= interval.start && minutes <= interval.end);
  const isOpen = Boolean(activeInterval);
  let nextOpen = null;
  if (isOpen) {
    nextOpen = new Date(now);
  } else {
    for (let offset = 0; offset < 7 && !nextOpen; offset += 1) {
      const candidateDate = new Date(now);
      candidateDate.setDate(now.getDate() + offset);
      const candidateDay = candidateDate.getDay();
      const candidateIntervals = getIntervalsForDay(schedule, candidateDay);
      const candidateMinutes = offset === 0 ? minutes : 0;
      const candidate = candidateIntervals.find((interval) => interval.start >= candidateMinutes);
      if (candidate) {
        const hours = Math.floor(candidate.start / 60);
        const mins = candidate.start % 60;
        candidateDate.setHours(hours, mins, 0, 0);
        nextOpen = candidateDate;
      }
    }
  }
  return { isOpen, nextOpen, intervals, schedule };
}
function getUpcomingSlots(rawSchedule, fallbackHours, now = /* @__PURE__ */ new Date(), daysAhead = 5) {
  const schedule = normalizeSchedule(rawSchedule, fallbackHours);
  const slots = [];
  for (let offset = 0; offset <= daysAhead; offset += 1) {
    const dayDate = new Date(now);
    dayDate.setDate(now.getDate() + offset);
    const day = dayDate.getDay();
    const intervals = getIntervalsForDay(schedule, day);
    intervals.forEach((interval) => {
      const minutesNow = offset === 0 ? now.getHours() * 60 + now.getMinutes() : 0;
      if (interval.end <= minutesNow) return;
      const slotDate = new Date(dayDate);
      slotDate.setHours(Math.floor(interval.start / 60), interval.start % 60, 0, 0);
      slots.push(slotDate);
    });
  }
  if (!slots.length) {
    const fallback = new Date(now);
    fallback.setHours(10, 0, 0, 0);
    slots.push(fallback);
  }
  return slots;
}

// webapp/pages/checkoutPage.js
var PAYMENT_OPTIONS = [
  { id: PAYMENT_METHODS.cash, label: "\u041D\u0430\u043B\u0438\u0447\u043D\u044B\u0435", enabled: true },
  { id: PAYMENT_METHODS.sbp, label: "\u0421\u0411\u041F (QR)", enabled: true },
  { id: PAYMENT_METHODS.card, label: "\u041A\u0430\u0440\u0442\u0430", enabled: true }
];
function renderOrderItems(container2, items) {
  const list = createElement("div", { className: "list" });
  items.forEach((item) => {
    const row = createElement("div", { className: "panel" });
    row.appendChild(createElement("div", { text: item.title }));
    if (item.doughType) {
      row.appendChild(
        createElement("div", {
          className: "helper",
          text: `\u0422\u0435\u0441\u0442\u043E: ${item.doughType === "biga" ? "\u0411\u0438\u0433\u0430" : "\u041F\u0443\u043B\u0438\u0448"}`
        })
      );
    }
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
  let autoPromoApplied = false;
  let deliveryType = "delivery";
  let geoData = null;
  let geoConsent = false;
  let geoStatus = "idle";
  let geoError = "";
  let scheduledAt = null;
  const renderState = (state4) => {
    clearElement(content2);
    if (!autoPromoApplied) {
      const storedPromo = getSelectedPromo();
      if (storedPromo?.active !== false) {
        promoApplied = storedPromo;
      }
      autoPromoApplied = true;
    }
    if (!state4.items.length) {
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
    renderOrderItems(itemsBlock, state4.items);
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
    const postalEnabled = Boolean(config?.deliveryPostalEnabled);
    const geoEnabled = Boolean(config?.deliveryGeoEnabled);
    const deliveryZoneId = Number.isFinite(Number(config?.defaultDeliveryZoneId)) ? Number(config?.defaultDeliveryZoneId) : null;
    const postalInput = createElement("input", {
      className: "input",
      attrs: { type: "text", placeholder: "\u0418\u043D\u0434\u0435\u043A\u0441" }
    });
    const postalHint = createElement("div", {
      className: "helper",
      text: "\u0418\u043D\u0434\u0435\u043A\u0441 \u043D\u0443\u0436\u0435\u043D \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0437\u043E\u043D\u044B \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438."
    });
    const geoConsentToggle = createElement("label", { className: "panel radio-row" });
    const geoConsentInput = createElement("input", {
      attrs: { type: "checkbox" }
    });
    geoConsentInput.checked = geoConsent;
    geoConsentInput.addEventListener("change", () => {
      geoConsent = geoConsentInput.checked;
    });
    geoConsentToggle.append(
      geoConsentInput,
      createElement("span", { text: "\u0420\u0430\u0437\u0440\u0435\u0448\u0430\u044E \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u043C\u0435\u0441\u0442\u043E\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435" })
    );
    const geoStatusText = createElement("div", {
      className: "helper",
      text: geoStatus === "ready" && geoData ? `\u041C\u0435\u0441\u0442\u043E\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E: ${geoData.lat.toFixed(5)}, ${geoData.lng.toFixed(5)}` : geoStatus === "loading" ? "\u041E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u0435\u043C \u043C\u0435\u0441\u0442\u043E\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435..." : geoStatus === "error" ? geoError || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u043C\u0435\u0441\u0442\u043E\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435." : "\u0413\u0435\u043E\u043B\u043E\u043A\u0430\u0446\u0438\u044F \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0437\u043E\u043D\u044B \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438."
    });
    const geoButton = createButton({
      label: "\u041E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u043C\u0435\u0441\u0442\u043E\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435",
      variant: "secondary",
      onClick: () => {
        if (!geoConsent) {
          geoError = "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u0441\u043E\u0433\u043B\u0430\u0441\u0438\u0435 \u043D\u0430 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435 \u0433\u0435\u043E\u043B\u043E\u043A\u0430\u0446\u0438\u0438.";
          geoStatus = "error";
          geoStatusText.textContent = geoError;
          showToast(geoError, "info");
          return;
        }
        if (!navigator?.geolocation) {
          geoError = "\u0413\u0435\u043E\u043B\u043E\u043A\u0430\u0446\u0438\u044F \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0432 \u044D\u0442\u043E\u043C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435.";
          geoStatus = "error";
          geoStatusText.textContent = geoError;
          showToast(geoError, "error");
          return;
        }
        setButtonLoading(geoButton, true);
        geoStatus = "loading";
        geoStatusText.textContent = "\u041E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u0435\u043C \u043C\u0435\u0441\u0442\u043E\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435...";
        navigator.geolocation.getCurrentPosition(
          (position) => {
            geoData = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            geoError = "";
            geoStatus = "ready";
            geoStatusText.textContent = `\u041C\u0435\u0441\u0442\u043E\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E: ${geoData.lat.toFixed(5)}, ${geoData.lng.toFixed(5)}`;
            setButtonLoading(geoButton, false);
            showToast("\u041C\u0435\u0441\u0442\u043E\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E", "success");
          },
          (geoErr) => {
            geoData = null;
            geoStatus = "error";
            geoError = geoErr?.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u043C\u0435\u0441\u0442\u043E\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435.";
            geoStatusText.textContent = geoError;
            setButtonLoading(geoButton, false);
            showToast(geoError, "error");
          },
          { enableHighAccuracy: true, timeout: 1e4, maximumAge: 0 }
        );
      }
    });
    const commentLabel = createElement("label", { className: "helper", text: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u043A \u0437\u0430\u043A\u0430\u0437\u0443" });
    const commentInput = createElement("textarea", {
      className: "input",
      attrs: { placeholder: "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u0431\u0435\u0437 \u043B\u0443\u043A\u0430, \u043A\u0443\u0440\u044C\u0435\u0440 \u043F\u043E\u0437\u0432\u043E\u043D\u0438\u0442\u044C" }
    });
    const scheduleStatus = getScheduleStatus(config?.workSchedule, config?.workHours);
    const preorderMode = !scheduleStatus.isOpen;
    if (!preorderMode) {
      scheduledAt = null;
    }
    if (preorderMode && selectedMethod === PAYMENT_METHODS.cash) {
      selectedMethod = PAYMENT_OPTIONS.find((option) => option.id !== PAYMENT_METHODS.cash)?.id || PAYMENT_METHODS.card;
    }
    const paymentLabel = createElement("div", { className: "helper", text: "\u0421\u043F\u043E\u0441\u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u044B" });
    const paymentOptions = createElement("div", { className: "list" });
    const filteredPaymentOptions = preorderMode ? PAYMENT_OPTIONS.filter((option) => option.id !== PAYMENT_METHODS.cash) : PAYMENT_OPTIONS;
    const paymentList = filteredPaymentOptions.length ? filteredPaymentOptions : [{ id: "cashless_stub", label: "\u0411\u0435\u0437\u043D\u0430\u043B\u0438\u0447\u043D\u0430\u044F \u043E\u043F\u043B\u0430\u0442\u0430 (\u0437\u0430\u0433\u043B\u0443\u0448\u043A\u0430)", enabled: true }];
    if (!paymentList.some((option) => option.id === selectedMethod)) {
      selectedMethod = paymentList[0]?.id || PAYMENT_METHODS.card;
    }
    paymentList.forEach((option) => {
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
      if (preorderMode && option.id === PAYMENT_METHODS.cash) {
        optionRow.appendChild(createElement("span", { className: "helper", text: "\u041D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u0434\u043B\u044F \u043F\u0440\u0435\u0434\u0437\u0430\u043A\u0430\u0437\u0430" }));
      }
      paymentOptions.appendChild(optionRow);
    });
    const promoLabel = createElement("label", { className: "helper", text: "\u041F\u0440\u043E\u043C\u043E\u043A\u043E\u0434" });
    const promoInput = createElement("input", {
      className: "input",
      attrs: { type: "text", placeholder: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043F\u0440\u043E\u043C\u043E\u043A\u043E\u0434" }
    });
    if (promoApplied?.code) {
      promoInput.value = promoApplied.code;
    }
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
        const postalCode = postalInput.value.trim();
        const hasGeo = geoData && Number.isFinite(geoData.lat) && Number.isFinite(geoData.lng);
        if (deliveryType === "delivery" && postalEnabled && !postalCode) {
          error.textContent = "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0438\u043D\u0434\u0435\u043A\u0441, \u0447\u0442\u043E\u0431\u044B \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0437\u043E\u043D\u0443 \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438.";
          error.hidden = false;
          return;
        }
        if (deliveryType === "delivery" && geoEnabled && !hasGeo) {
          error.textContent = "\u041D\u0443\u0436\u043D\u043E \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u043C\u0435\u0441\u0442\u043E\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0437\u043E\u043D\u044B \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438.";
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
        if (preorderMode && selectedMethod === PAYMENT_METHODS.cash) {
          error.textContent = "\u041D\u0430\u043B\u0438\u0447\u043D\u044B\u0435 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u0434\u043B\u044F \u043F\u0440\u0435\u0434\u0437\u0430\u043A\u0430\u0437\u0430.";
          error.hidden = false;
          return;
        }
        if (preorderMode && !scheduledAt) {
          error.textContent = "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u0440\u0435\u043C\u044F \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438 \u0434\u043B\u044F \u043F\u0440\u0435\u0434\u0437\u0430\u043A\u0430\u0437\u0430.";
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
          isPreorder: preorderMode,
          scheduledAt: preorderMode ? scheduledAt : null,
          user: {
            tg_id: user?.id,
            username: user?.username,
            first_name: user?.first_name
          },
          customer: { phone, name: nameInput.value.trim() || void 0 },
          delivery: {
            type: deliveryType,
            address: deliveryType === "delivery" ? addressInput.value.trim() : void 0,
            postalCode: deliveryType === "delivery" ? postalCode || void 0 : void 0,
            geo: deliveryType === "delivery" && hasGeo ? { ...geoData } : void 0,
            zoneId: deliveryType === "delivery" ? deliveryZoneId || void 0 : void 0
          },
          payment: { method: selectedMethod, status: "pending" },
          items: state4.items.map((item) => ({
            id: item.id,
            title: item.title,
            price: item.price,
            qty: item.qty,
            doughType: item.doughType,
            lineId: item.lineId
          })),
          subtotal: discountedSubtotal,
          delivery_fee: finalDeliveryFee,
          total: totalValue,
          comment: commentInput.value.trim()
        };
        try {
          const payment = await preparePayment(order, selectedMethod);
          order.payment = payment;
          if (payment.status === "failed") {
            const status2 = "order:pending_sync";
            addOrder({ ...order, status: status2 });
            setLastOrderStatus({
              status: status2,
              order_id: order.order_id,
              request_id: order.request_id || void 0
            });
            error.textContent = payment.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u043F\u043B\u0430\u0442\u0435\u0436. \u0417\u0430\u043A\u0430\u0437 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E.";
            error.hidden = false;
            showToast(error.textContent, "error");
            navigate2("/order-status");
            return;
          }
          const apiPayload = {
            order_id: order.order_id,
            customerName: order.customer.name || "\u0413\u043E\u0441\u0442\u044C",
            phone: order.customer.phone,
            address: order.delivery.address,
            comment: order.comment,
            payment_id: order.payment.payment_id,
            payment_status: order.payment.status,
            payment_method: order.payment.method,
            deliveryZoneId: deliveryType === "delivery" ? deliveryZoneId || null : null,
            postalCode: deliveryType === "delivery" ? postalCode || null : null,
            geo: deliveryType === "delivery" && hasGeo ? { ...geoData } : null,
            items: order.items.map((item) => ({
              ...item,
              id: Number(item.id)
            })),
            total: order.total,
            isPreorder: order.isPreorder,
            scheduledAt: order.scheduledAt
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
            let apiErrorPayload = null;
            if (!apiResponse.ok) {
              try {
                apiErrorPayload = await apiResponse.json();
              } catch (parseError) {
                apiErrorPayload = null;
              }
              const apiReason = apiErrorPayload?.error?.details?.reason;
              const apiMessage = apiErrorPayload?.error?.message;
              if (apiReason === "delivery_zone_mismatch") {
                const message = apiMessage || "\u0410\u0434\u0440\u0435\u0441 \u0432\u043D\u0435 \u0437\u043E\u043D\u044B \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438.";
                error.textContent = message;
                error.hidden = false;
                showToast(message, "error");
                return;
              }
              pendingSync = true;
              throw new Error(apiMessage || `API status ${apiResponse.status}`);
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
          if (order.payment?.confirmation?.type === "redirect" && order.payment?.payment_url) {
            window.location.assign(order.payment.payment_url);
            return;
          }
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
      if (postalEnabled) {
        form.append(
          createElement("label", { className: "helper", text: "\u0418\u043D\u0434\u0435\u043A\u0441" }),
          postalInput,
          postalHint
        );
      }
      if (geoEnabled) {
        form.append(
          createElement("label", { className: "helper", text: "\u041C\u0435\u0441\u0442\u043E\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435" }),
          geoConsentToggle,
          geoButton,
          geoStatusText
        );
      }
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
    if (preorderMode) {
      const preorderPanel = createElement("div", { className: "panel" });
      preorderPanel.appendChild(
        createElement("div", {
          className: "helper",
          text: "\u0421\u0435\u0439\u0447\u0430\u0441 \u0437\u0430\u043A\u0440\u044B\u0442\u043E. \u0425\u043E\u0442\u0438\u0442\u0435 \u043E\u0444\u043E\u0440\u043C\u0438\u0442\u044C \u043F\u0440\u0435\u0434\u0437\u0430\u043A\u0430\u0437?"
        })
      );
      const slots = getUpcomingSlots(config?.workSchedule, config?.workHours);
      const select = createElement("select", { className: "input" });
      select.appendChild(createElement("option", { text: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u0440\u0435\u043C\u044F \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438", attrs: { value: "" } }));
      const formatter = new Intl.DateTimeFormat("ru-RU", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
      slots.forEach((slot) => {
        const value = slot.toISOString();
        const option = createElement("option", {
          text: formatter.format(slot),
          attrs: { value }
        });
        select.appendChild(option);
      });
      const nextOpenValue = scheduleStatus.nextOpen?.toISOString();
      if (nextOpenValue) {
        select.value = nextOpenValue;
        scheduledAt = nextOpenValue;
      } else if (slots.length) {
        select.value = slots[0].toISOString();
        scheduledAt = select.value;
      }
      select.addEventListener("change", () => {
        scheduledAt = select.value || null;
      });
      preorderPanel.appendChild(select);
      preorderPanel.appendChild(
        createElement("div", { className: "helper", text: "\u041E\u043F\u043B\u0430\u0442\u0430 \u0442\u043E\u043B\u044C\u043A\u043E \u0431\u0435\u0437\u043D\u0430\u043B\u043E\u043C." })
      );
      summary.prepend(preorderPanel);
    }
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
var DOUGH_OPTIONS = [
  { id: "poolish", label: "\u041F\u0443\u043B\u0438\u0448", priceModifier: 0 },
  { id: "biga", label: "\u0411\u0438\u0433\u0430", priceModifier: 0 }
];
function createPizzaSkeleton() {
  const wrapper = createElement("div", { className: "pizza-skeleton" });
  const image = createElement("div", { className: "skeleton pizza-skeleton__image" });
  const title = createElement("div", { className: "skeleton pizza-skeleton__title" });
  const description = createElement("div", { className: "skeleton pizza-skeleton__text" });
  const actions = createElement("div", { className: "skeleton pizza-skeleton__actions" });
  wrapper.append(image, title, description, actions);
  return wrapper;
}
function getItemKey(item) {
  return item?.slug || item?.id || "";
}
function getDoughImages(item, doughType) {
  const poolish = Array.isArray(item?.photosPoolish) ? item.photosPoolish : [];
  const biga = Array.isArray(item?.photosBiga) ? item.photosBiga : [];
  const fallback = Array.isArray(item?.images) ? item.images : [];
  if (doughType === "biga" && biga.length) return biga;
  if (doughType === "poolish" && poolish.length) return poolish;
  if (poolish.length) return poolish;
  if (biga.length) return biga;
  return fallback;
}
function renderPizzaPage({ navigate: navigate2, params }) {
  const root = createElement("section", { className: "list" });
  const content2 = createElement("div", { className: "fade-in" });
  root.appendChild(content2);
  let touchStartX = 0;
  let touchEndX = 0;
  let selectedDough = "poolish";
  const param = params.id;
  const getNavigableItems = (menuState) => {
    const categoryIds = new Set(menuState.categories.map((category) => String(category.id)));
    const filterId = new URLSearchParams(window.location.search).get("from") || "all";
    const popularIds = getPopularIds(getOrders(), 3);
    const filteredItems = filterMenuItems(menuState.items, {
      filterId,
      favorites: getFavorites(),
      popularIds,
      categoryIds
    });
    const currentIndex = filteredItems.findIndex((menuItem) => getItemKey(menuItem) === param);
    if (currentIndex === -1 || filteredItems.length === 0) {
      return { items: menuState.items, filterId: "all" };
    }
    return { items: filteredItems, filterId };
  };
  const renderState = () => {
    clearElement(content2);
    const menuState = getMenuState();
    const loading = menuState.status === "loading" || menuState.status === "idle";
    const item = getMenuItemBySlug(param);
    console.log("[pizza-detail] param=", param, "loading=", loading, "items=", menuState.items.length, "found=", !!item);
    if (loading) {
      content2.appendChild(
        createLoadingState({
          text: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443 \u043F\u0438\u0446\u0446\u044B\u2026",
          content: createPizzaSkeleton()
        })
      );
      return;
    }
    if (menuState.status === "error") {
      const retry = createButton({
        label: "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C",
        variant: "secondary",
        onClick: () => loadMenu().catch(() => null)
      });
      content2.appendChild(
        createErrorState({
          title: "\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043C\u0435\u043D\u044E",
          description: menuState.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043C\u0435\u043D\u044E. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437.",
          action: retry
        })
      );
      return;
    }
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
    const { items: navigableItems, filterId } = getNavigableItems(menuState);
    const currentIndex = navigableItems.findIndex((menuItem) => getItemKey(menuItem) === getItemKey(item));
    const prevItem = currentIndex > 0 ? navigableItems[currentIndex - 1] : null;
    const nextItem = currentIndex >= 0 && currentIndex < navigableItems.length - 1 ? navigableItems[currentIndex + 1] : null;
    console.log("[pizza-nav]", {
      listSize: navigableItems.length,
      currentIndex,
      prev: prevItem ? getItemKey(prevItem) : null,
      next: nextItem ? getItemKey(nextItem) : null
    });
    const crumbs = createBreadcrumbs([
      { label: "\u041C\u0435\u043D\u044E", onClick: () => navigate2("/menu") },
      { label: "\u041F\u0438\u0446\u0446\u044B", onClick: () => navigate2("/menu") },
      { label: item.title }
    ]);
    const card = createCard({ className: "pizza-card" });
    const doughImages = getDoughImages(item, selectedDough);
    card.appendChild(createGallery(doughImages, { large: true, enableZoom: true }));
    card.appendChild(createElement("h2", { className: "title", text: item.title }));
    card.appendChild(createElement("p", { className: "helper", text: item.description }));
    const doughPanel = createElement("div", { className: "panel dough-panel" });
    doughPanel.appendChild(createElement("div", { className: "helper", text: "\u0422\u0435\u0441\u0442\u043E" }));
    const doughRow = createElement("div", { className: "dough-options" });
    DOUGH_OPTIONS.forEach((option) => {
      const button = createButton({
        label: option.label,
        variant: "chip",
        pressed: option.id === selectedDough,
        onClick: () => {
          selectedDough = option.id;
          renderState();
        }
      });
      button.classList.toggle("is-active", option.id === selectedDough);
      doughRow.appendChild(button);
    });
    doughPanel.appendChild(doughRow);
    const selectedOption = DOUGH_OPTIONS.find((option) => option.id === selectedDough) || DOUGH_OPTIONS[0];
    const priceValue = item.price + (selectedOption?.priceModifier || 0);
    card.appendChild(doughPanel);
    card.appendChild(createPriceTag({ value: formatPrice(priceValue) }));
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
    const navRow = createElement("div", { className: "pizza-nav" });
    const navLoading = menuState.status !== "loaded" || navigableItems.length === 0;
    const prevButton = createButton({
      label: navLoading ? "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026" : "\u2190 \u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u043F\u0438\u0446\u0446\u0430",
      variant: "secondary",
      ariaLabel: "\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u043F\u0438\u0446\u0446\u0430",
      onClick: () => {
        if (prevItem) navigate2(`/pizza/${getItemKey(prevItem)}?from=${encodeURIComponent(filterId)}`);
      }
    });
    const nextButton = createButton({
      label: navLoading ? "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026" : "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0430\u044F \u043F\u0438\u0446\u0446\u0430 \u2192",
      variant: "secondary",
      ariaLabel: "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0430\u044F \u043F\u0438\u0446\u0446\u0430",
      onClick: () => {
        if (nextItem) navigate2(`/pizza/${getItemKey(nextItem)}?from=${encodeURIComponent(filterId)}`);
      }
    });
    prevButton.disabled = !prevItem || navLoading;
    nextButton.disabled = !nextItem || navLoading;
    navRow.append(prevButton, nextButton);
    const navHelper = navLoading ? createElement("div", { className: "helper", text: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0441\u043F\u0438\u0441\u043E\u043A \u043F\u0438\u0446\u0446\u2026" }) : null;
    const actions = createCardFooter2({ className: "pizza-actions" });
    const back = createButton({
      label: "\u041D\u0430\u0437\u0430\u0434 \u0432 \u043C\u0435\u043D\u044E",
      variant: "secondary",
      onClick: () => navigate2("/menu")
    });
    const addButton = createButton({
      label: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443",
      onClick: () => add({
        id: item.id,
        title: item.title,
        price: priceValue,
        image: doughImages?.[0] || item.images?.[0] || "",
        doughType: selectedDough
      })
    });
    addButton.addEventListener("click", () => {
      showToast("\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443", {
        variant: "success",
        durationMs: 2e3,
        actionLabel: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u043E\u0440\u0437\u0438\u043D\u0443",
        onAction: () => navigate2("/cart")
      });
      console.info("cart:add", {
        source: "pizza",
        itemId: item.id,
        doughType: selectedDough,
        toast: "\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443"
      });
    });
    actions.append(back, addButton);
    card.append(favButton, navRow);
    if (navHelper) {
      card.appendChild(navHelper);
    }
    card.appendChild(actions);
    content2.append(crumbs, card);
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
    const menuState = getMenuState();
    const { items: navigableItems, filterId } = getNavigableItems(menuState);
    const currentIndex = navigableItems.findIndex((menuItem) => getItemKey(menuItem) === param);
    if (currentIndex < 0) return;
    if (delta < 0 && currentIndex < navigableItems.length - 1) {
      navigate2(`/pizza/${getItemKey(navigableItems[currentIndex + 1])}?from=${encodeURIComponent(filterId)}`);
    }
    if (delta > 0 && currentIndex > 0) {
      navigate2(`/pizza/${getItemKey(navigableItems[currentIndex - 1])}?from=${encodeURIComponent(filterId)}`);
    }
  };
  content2.addEventListener("touchstart", handleTouchStart, { passive: true });
  content2.addEventListener("touchend", handleTouchEnd, { passive: true });
  return {
    element: root,
    cleanup: () => {
      unsubscribe();
      content2.removeEventListener("touchstart", handleTouchStart);
      content2.removeEventListener("touchend", handleTouchEnd);
    }
  };
}

// webapp/services/authService.js
var DEFAULT_CONFIG2 = {
  telegramBotUsername: "",
  googleClientId: "",
  emailEnabled: true,
  debug: false
};
var getConfig = () => {
  if (typeof window === "undefined") return { ...DEFAULT_CONFIG2 };
  return { ...DEFAULT_CONFIG2, ...window.PUBLIC_AUTH_CONFIG || {} };
};
var parseResponse = async (response) => {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || "Auth failed";
    const details = payload?.error?.details;
    throw new Error(details ? `${message}: ${JSON.stringify(details)}` : message);
  }
  return payload;
};
var getGlobal = (path) => {
  return path.split(".").reduce((acc, key) => acc?.[key], window);
};
var waitForGlobal = (path, timeout = 4e3, interval = 50) => {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (getGlobal(path)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (getGlobal(path)) return resolve(true);
      if (Date.now() - start >= timeout) return resolve(false);
      setTimeout(tick, interval);
    };
    tick();
  });
};
function getAuthConfig() {
  return getConfig();
}
function getAuthState() {
  return storage.read(STORAGE_KEYS.userAuth, null);
}
function setAuthState(payload) {
  storage.write(STORAGE_KEYS.userAuth, payload);
}
function clearAuthState() {
  storage.remove(STORAGE_KEYS.userAuth);
}
async function registerWithEmail({ email, password }) {
  const response = await fetch("/api/public/auth/email-register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return parseResponse(response);
}
async function loginWithEmail({ email, password }) {
  const response = await fetch("/api/public/auth/email-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const payload = await parseResponse(response);
  setAuthState({ provider: "email", ...payload });
  return payload;
}
async function requestPasswordReset(email) {
  const response = await fetch("/api/public/auth/password-reset/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email })
  });
  return parseResponse(response);
}
async function confirmPasswordReset({ token, password }) {
  const response = await fetch("/api/public/auth/password-reset/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, password })
  });
  return parseResponse(response);
}
function renderTelegramLogin(container2, { botUsername, onSuccess, onError } = {}) {
  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.textContent = isTelegram() ? "\u0412\u043E\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 Telegram" : "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0432 Telegram";
  const helper = document.createElement("div");
  helper.className = "helper";
  helper.style.marginTop = "8px";
  helper.textContent = isTelegram() ? "\u0412\u044B \u0432\u043E\u0439\u0434\u0451\u0442\u0435 \u0447\u0435\u0440\u0435\u0437 \u0434\u0430\u043D\u043D\u044B\u0435 Telegram Mini App." : "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043C\u0438\u043D\u0438-\u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0432\u043D\u0443\u0442\u0440\u0438 Telegram.";
  const updateHelper = (text) => {
    if (typeof text === "string" && text.trim().length > 0) helper.textContent = text;
  };
  const getInitDataWithRetry = async (tg) => {
    const readInitData = () => typeof tg?.initData === "string" ? tg.initData : "";
    let initData = readInitData();
    if (initData) return initData;
    updateHelper("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435 Telegram. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435, \u0447\u0442\u043E \u043E\u0442\u043A\u0440\u044B\u043B\u0438 \u043C\u0438\u043D\u0438\u2011\u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0432\u043D\u0443\u0442\u0440\u0438 Telegram.");
    try {
      tg?.ready?.();
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    initData = readInitData();
    return initData;
  };
  btn.onclick = async () => {
    try {
      const cfg = getAuthConfig();
      const username = botUsername || cfg.telegramBotUsername;
      if (!username) throw new Error("\u041B\u043E\u0433\u0438\u043D \u0447\u0435\u0440\u0435\u0437 Telegram \u0441\u0435\u0439\u0447\u0430\u0441 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435.");
      if (!isTelegram()) {
        window.open(`https://t.me/${username}`, "_blank");
        return;
      }
      const tg = window.Telegram?.WebApp;
      if (!tg) throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C\u0441\u044F \u043A Telegram. \u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043C\u0438\u043D\u0438\u2011\u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0432\u043D\u0443\u0442\u0440\u0438 Telegram.");
      try {
        tg.ready?.();
      } catch {
      }
      const initData = await getInitDataWithRetry(tg);
      if (!initData) {
        updateHelper("\u0414\u0430\u043D\u043D\u044B\u0435 Telegram \u043D\u0435 \u043F\u0440\u0438\u0448\u043B\u0438. \u0417\u0430\u043A\u0440\u043E\u0439\u0442\u0435 \u0438 \u0441\u043D\u043E\u0432\u0430 \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043C\u0438\u043D\u0438\u2011\u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435.");
        return;
      }
      const res = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u043E\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 Telegram. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435.");
      }
      setAuthState({ provider: "telegram", ...data });
      if (!localStorage.getItem("auth:token") && data.token) localStorage.setItem("auth:token", data.token);
      if (!localStorage.getItem("auth:user") && data.user) localStorage.setItem("auth:user", JSON.stringify(data.user));
      if (!localStorage.getItem("auth:provider") && data.provider) localStorage.setItem("auth:provider", data.provider);
      onSuccess?.(data);
    } catch (e) {
      onError?.(e);
    }
  };
  container2.appendChild(btn);
  container2.appendChild(helper);
  return () => {
    try {
      btn.remove();
    } catch {
    }
    try {
      helper.remove();
    } catch {
    }
  };
}
async function renderGoogleLogin(container2, { clientId, onSuccess, onError } = {}) {
  await waitForGlobal("google.accounts.id", 4e3);
  const wrap = document.createElement("div");
  wrap.className = "google-login-wrap";
  wrap.style.display = "flex";
  wrap.style.justifyContent = "center";
  wrap.style.maxWidth = "360px";
  container2.appendChild(wrap);
  const cfg = getAuthConfig();
  const cid = clientId || cfg.googleClientId;
  if (!cid) {
    const hint = document.createElement("div");
    hint.className = "helper";
    hint.textContent = "googleClientId \u043D\u0435 \u0437\u0430\u0434\u0430\u043D \u0432 auth-config.js";
    wrap.appendChild(hint);
    return () => {
      try {
        wrap.remove();
      } catch {
      }
    };
  }
  if (!window.google?.accounts?.id) {
    const hint = document.createElement("div");
    hint.className = "helper";
    hint.textContent = "Google Identity Services \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043B\u0441\u044F (\u043F\u0440\u043E\u0432\u0435\u0440\u044C index.html).";
    wrap.appendChild(hint);
    return () => {
      try {
        wrap.remove();
      } catch {
      }
    };
  }
  try {
    window.google.accounts.id.initialize({
      client_id: cid,
      callback: async (resp) => {
        try {
          const credential = resp?.credential;
          if (!credential) throw new Error("Google credential \u043F\u0443\u0441\u0442\u043E\u0439");
          const res = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ credential })
          });
          const data = await res.json();
          if (!res.ok || !data?.ok) throw new Error(data?.error || "Google login failed");
          setAuthState({ provider: "google", ...data });
          if (!localStorage.getItem("auth:token") && data.token) localStorage.setItem("auth:token", data.token);
          if (!localStorage.getItem("auth:user") && data.user) localStorage.setItem("auth:user", JSON.stringify(data.user));
          if (!localStorage.getItem("auth:provider") && data.provider) localStorage.setItem("auth:provider", data.provider);
          onSuccess?.(data);
        } catch (e) {
          onError?.(e);
        }
      }
    });
    window.google.accounts.id.renderButton(wrap, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "signin_with",
      width: "100%"
    });
  } catch (e) {
    onError?.(e);
  }
  return () => {
    try {
      wrap.remove();
    } catch {
    }
  };
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
  const authConfig = getAuthConfig();
  let cleanupAuth = null;
  let isSubmitting = false;
  let statusMessage = "";
  const render = () => {
    if (cleanupAuth) {
      cleanupAuth();
      cleanupAuth = null;
    }
    clearElement(content2);
    const orders = getOrders();
    const favorites = getFavorites();
    const stats = computeStats(orders);
    const telegramUser = getUser();
    const storedAuth = getAuthState();
    const isMiniApp = isTelegram();
    const user = isMiniApp ? telegramUser : storedAuth?.user;
    const provider = isMiniApp ? "telegram-webapp" : storedAuth?.provider;
    const isEmailEnabled = authConfig.emailEnabled !== false;
    const isDebugEnabled = Boolean(authConfig?.debug) && new URLSearchParams(window.location.search).get("debug") === "1";
    if (isDebugEnabled) {
      try {
        const dbg = createElement("pre", {
          className: "panel",
          text: "DEBUG AUTH\nisMiniApp: " + String(isMiniApp) + "\ntelegramUser: " + JSON.stringify(telegramUser || null) + "\nstoredAuth: " + JSON.stringify(storedAuth || null) + "\ncomputed user: " + JSON.stringify(user || null) + "\nprovider: " + String(provider || "") + "\n"
        });
        content2.appendChild(dbg);
      } catch (e) {
      }
    }
    if (!user) {
      const authLayout = createElement("div", { className: "auth-layout" });
      const authHero = createElement("div", { className: "auth-hero" });
      authHero.append(
        createElement("div", { className: "brand-badge", text: "\u041F\u0438\u0446\u0446\u0435\u0440\u0438\u044F \u0422\u0430\u0433\u0438\u043B" }),
        createElement("h2", { className: "auth-title", text: "\u0412\u0445\u043E\u0434 \u0432 \u0430\u043A\u043A\u0430\u0443\u043D\u0442" }),
        createElement("p", {
          className: "helper",
          text: "\u0412\u043E\u0439\u0434\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u0438 \u043F\u043E\u043B\u0443\u0447\u0430\u0442\u044C \u0431\u043E\u043D\u0443\u0441\u044B."
        })
      );
      const authPanel = createElement("div", { className: "panel auth-panel" });
      const authStatus = createElement("div", { className: "auth-status" });
      authStatus.textContent = statusMessage;
      authStatus.hidden = !statusMessage;
      authPanel.append(authStatus);
      const telegramWrap = createElement("div", { className: "auth-actions" });
      const googleWrap = createElement("div", { className: "auth-actions" });
      const emailWrap = createElement("div", { className: "auth-actions auth-email" });
      const cleanupFns = [];
      if (authConfig.telegramBotUsername) {
        authPanel.appendChild(createElement("div", { className: "section-title", text: "Telegram" }));
        authPanel.appendChild(telegramWrap);
        const telegramCleanup = renderTelegramLogin(telegramWrap, {
          botUsername: authConfig.telegramBotUsername,
          onSuccess: () => {
            showToast("\u0412\u0445\u043E\u0434 \u0447\u0435\u0440\u0435\u0437 Telegram \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D", "success");
            render();
          },
          onError: (error) => {
            showToast(error?.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u043E\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 Telegram", "error");
          }
        });
        cleanupFns.push(telegramCleanup);
      } else {
        authPanel.appendChild(
          createElement("p", {
            className: "helper",
            text: "\u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 PUBLIC_AUTH_CONFIG.telegramBotUsername \u0432 auth-config.js."
          })
        );
      }
      if (authConfig.googleClientId) {
        authPanel.appendChild(createElement("div", { className: "section-title", text: "Google" }));
        authPanel.appendChild(googleWrap);
        renderGoogleLogin(googleWrap, {
          clientId: authConfig.googleClientId,
          onSuccess: () => {
            showToast("\u0412\u0445\u043E\u0434 \u0447\u0435\u0440\u0435\u0437 Google \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D", "success");
            render();
          },
          onError: (error) => {
            showToast(error?.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u043E\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 Google", "error");
          }
        }).then((googleCleanup) => cleanupFns.push(googleCleanup)).catch((error) => {
          showToast(error?.message || "Google login \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D", "error");
        });
      } else {
        authPanel.appendChild(
          createElement("p", {
            className: "helper",
            text: "\u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 PUBLIC_AUTH_CONFIG.googleClientId \u0432 auth-config.js."
          })
        );
      }
      if (isEmailEnabled) {
        authPanel.appendChild(createElement("div", { className: "section-title", text: "Email" }));
        const emailInput = createElement("input", {
          className: "input",
          attrs: { type: "email", placeholder: "Email", autocomplete: "email" }
        });
        const passwordWrap = createElement("div", { className: "input-row" });
        const passwordInput = createElement("input", {
          className: "input",
          attrs: { type: "password", placeholder: "\u041F\u0430\u0440\u043E\u043B\u044C (\u043C\u0438\u043D. 8 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432)", autocomplete: "current-password" }
        });
        const toggleButton = createButton({
          label: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C",
          variant: "ghost",
          size: "sm",
          onClick: () => {
            const nextType = passwordInput.getAttribute("type") === "password" ? "text" : "password";
            passwordInput.setAttribute("type", nextType);
            toggleButton.textContent = nextType === "password" ? "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C" : "\u0421\u043A\u0440\u044B\u0442\u044C";
          }
        });
        toggleButton.classList.add("input-toggle");
        passwordWrap.append(passwordInput, toggleButton);
        const emailActions = createElement("div", { className: "auth-actions" });
        const setSubmitting = (next, message = "") => {
          isSubmitting = next;
          statusMessage = message;
          authStatus.textContent = statusMessage;
          authStatus.hidden = !statusMessage;
          [loginButton, registerButton, resetButton, clearSessionButton].forEach((button) => {
            button.disabled = isSubmitting;
          });
          emailInput.disabled = isSubmitting;
          passwordInput.disabled = isSubmitting;
        };
        const loginButton = createButton({
          label: "\u0412\u043E\u0439\u0442\u0438",
          onClick: async () => {
            try {
              const email = emailInput.value.trim();
              const password = passwordInput.value;
              if (!email || !password) {
                showToast("\u0423\u043A\u0430\u0436\u0438\u0442\u0435 email \u0438 \u043F\u0430\u0440\u043E\u043B\u044C", "info");
                return;
              }
              setSubmitting(true, "\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C \u0434\u0430\u043D\u043D\u044B\u0435\u2026");
              await loginWithEmail({ email, password });
              showToast("\u0412\u0445\u043E\u0434 \u043F\u043E email \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D", "success");
              setSubmitting(false, "");
              render();
            } catch (error) {
              setSubmitting(false, error?.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u043E\u0439\u0442\u0438. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0434\u0430\u043D\u043D\u044B\u0435.");
              showToast(error?.message || "\u041E\u0448\u0438\u0431\u043A\u0430", "error");
            }
          }
        });
        const registerButton = createButton({
          label: "\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C\u0441\u044F",
          variant: "secondary",
          onClick: async () => {
            try {
              const email = emailInput.value.trim();
              const password = passwordInput.value;
              if (!email || !password) {
                showToast("\u0423\u043A\u0430\u0436\u0438\u0442\u0435 email \u0438 \u043F\u0430\u0440\u043E\u043B\u044C", "info");
                return;
              }
              setSubmitting(true, "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u0443\u0435\u043C \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u2026");
              await registerWithEmail({ email, password });
              setSubmitting(false, "\u041F\u0438\u0441\u044C\u043C\u043E \u0441 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435\u043C \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E.");
              showToast("\u041F\u0438\u0441\u044C\u043C\u043E \u0441 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435\u043C \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E", "success");
            } catch (error) {
              setSubmitting(false, error?.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C\u0441\u044F.");
              showToast(error?.message || "\u041E\u0448\u0438\u0431\u043A\u0430", "error");
            }
          }
        });
        const resetButton = createButton({
          label: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u043F\u0430\u0440\u043E\u043B\u044C",
          variant: "ghost",
          onClick: async () => {
            try {
              const email = emailInput.value.trim();
              if (!email) {
                showToast("\u0423\u043A\u0430\u0436\u0438\u0442\u0435 email \u0434\u043B\u044F \u0441\u0431\u0440\u043E\u0441\u0430", "info");
                return;
              }
              setSubmitting(true, "\u041E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u043C \u0441\u0441\u044B\u043B\u043A\u0443 \u0434\u043B\u044F \u0441\u0431\u0440\u043E\u0441\u0430\u2026");
              await requestPasswordReset(email);
              setSubmitting(false, "\u0421\u0441\u044B\u043B\u043A\u0430 \u0434\u043B\u044F \u0441\u0431\u0440\u043E\u0441\u0430 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0430 \u043D\u0430 \u043F\u043E\u0447\u0442\u0443.");
              showToast("\u0421\u0441\u044B\u043B\u043A\u0430 \u0434\u043B\u044F \u0441\u0431\u0440\u043E\u0441\u0430 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0430 \u043D\u0430 \u043F\u043E\u0447\u0442\u0443", "success");
            } catch (error) {
              setSubmitting(false, error?.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443.");
              showToast(error?.message || "\u041E\u0448\u0438\u0431\u043A\u0430", "error");
            }
          }
        });
        const clearSessionButton = createButton({
          label: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u044E",
          variant: "ghost",
          onClick: () => {
            try {
              clearAuthState();
            } catch {
            }
            try {
              localStorage.removeItem("auth:token");
              localStorage.removeItem("auth:user");
              localStorage.removeItem("auth:provider");
            } catch {
            }
            showToast("\u0421\u0435\u0441\u0441\u0438\u044F \u043E\u0447\u0438\u0449\u0435\u043D\u0430", "success");
            render();
          }
        });
        if (isSubmitting) {
          [loginButton, registerButton, resetButton, clearSessionButton].forEach((button) => {
            button.disabled = true;
          });
        }
        emailActions.append(loginButton, registerButton, resetButton, clearSessionButton);
        emailWrap.append(emailInput, passwordWrap, emailActions);
        authPanel.appendChild(emailWrap);
      }
      cleanupAuth = () => cleanupFns.forEach((fn) => fn?.());
      authLayout.append(authHero, authPanel);
      content2.appendChild(authLayout);
    }
    if (user) {
      const userPanel = createElement("div", { className: "panel" });
      userPanel.appendChild(createElement("h2", { className: "title", text: "\u041F\u0440\u043E\u0444\u0438\u043B\u044C" }));
      const displayName = user.first_name || user.name || user.username || user.email || `User ${user.id || ""}`;
      userPanel.appendChild(
        createElement("div", {
          className: "helper",
          text: `\u041F\u0440\u043E\u0432\u0430\u0439\u0434\u0435\u0440: ${provider || "\u2014"}`
        })
      );
      userPanel.appendChild(
        createElement("div", {
          className: "helper",
          text: `\u0418\u043C\u044F: ${displayName}`
        })
      );
      if (!isMiniApp) {
        const logout = createButton({
          label: "\u0412\u044B\u0439\u0442\u0438",
          variant: "secondary",
          onClick: () => {
            clearAuthState();
            render();
          }
        });
        userPanel.appendChild(logout);
      }
      content2.appendChild(userPanel);
    }
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

// webapp/pages/homePage.js
var HOME_MENU_PREVIEW_LIMIT = 4;
var homeFirstRenderLogged = false;
function createMenuPreviewCard(item, navigate2) {
  const itemSlug = item.slug || item.id;
  const card = createCard({ interactive: true });
  const gallery = createGallery(item.images, { large: false });
  const title = createElement("h3", { className: "card-title", text: item.title });
  const description = createElement("p", { className: "card-description", text: item.description });
  const footer = createCardFooter2();
  const price = createPriceTag({ value: formatPrice(item.price) });
  const openButton = createButton({
    label: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C",
    onClick: (event) => {
      event.stopPropagation();
      navigate2(`/pizza/${itemSlug}`);
    }
  });
  footer.append(price, openButton);
  card.append(gallery, title, description, footer);
  card.addEventListener("click", () => navigate2(`/pizza/${itemSlug}`));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate2(`/pizza/${itemSlug}`);
    }
  });
  return card;
}
function renderHomePage({ navigate: navigate2 }) {
  const initialMenuState = getMenuState();
  if (!homeFirstRenderLogged) {
    console.info("[home] first-render", {
      status: initialMenuState.status,
      items: initialMenuState.items.length
    });
    homeFirstRenderLogged = true;
  }
  const root = createElement("section", { className: "list" });
  const hero = createSection({ className: "home-hero" });
  hero.appendChild(createElement("h2", { className: "title", text: "\u0414\u043E\u0431\u0440\u043E \u043F\u043E\u0436\u0430\u043B\u043E\u0432\u0430\u0442\u044C \u0432 \u041F\u0438\u0446\u0446\u0435\u0440\u0438\u044E \u0422\u0430\u0433\u0438\u043B" }));
  hero.appendChild(
    createElement("p", {
      className: "helper",
      text: "\u0411\u044B\u0441\u0442\u0440\u043E\u0435 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0435 \u0437\u0430\u043A\u0430\u0437\u0430, \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u0430\u043A\u0446\u0438\u0438 \u0438 \u0433\u043E\u0440\u044F\u0447\u0438\u0435 \u043F\u0438\u0446\u0446\u044B \u043F\u0440\u044F\u043C\u043E \u0438\u0437 \u043F\u0435\u0447\u0438."
    })
  );
  const heroActions = createCardFooter2({ className: "home-actions" });
  heroActions.append(
    createButton({ label: "\u041F\u0435\u0440\u0435\u0439\u0442\u0438 \u0432 \u043C\u0435\u043D\u044E", onClick: () => navigate2("/menu") }),
    createButton({ label: "\u0421\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u0430\u043A\u0446\u0438\u0438", variant: "secondary", onClick: () => navigate2("/promos") })
  );
  hero.appendChild(heroActions);
  const cards = createElement("div", { className: "menu-grid" });
  const promoCard = createCard({ className: "home-card" });
  promoCard.appendChild(createElement("h3", { className: "card-title", text: "\u0410\u043A\u0446\u0438\u0438 \u0434\u043D\u044F" }));
  promoCard.appendChild(
    createElement("p", { className: "card-description", text: "\u0421\u043A\u0438\u0434\u043A\u0438, \u043A\u043E\u043C\u0431\u043E \u0438 \u043F\u0440\u043E\u043C\u043E\u043A\u043E\u0434\u044B \u043D\u0430 \u043A\u0430\u0436\u0434\u044B\u0439 \u0434\u0435\u043D\u044C." })
  );
  const promoFooter = createCardFooter2();
  promoFooter.appendChild(createButton({ label: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0430\u043A\u0446\u0438\u0438", onClick: () => navigate2("/promos") }));
  promoCard.appendChild(promoFooter);
  const menuCard = createCard({ className: "home-card" });
  menuCard.appendChild(createElement("h3", { className: "card-title", text: "\u041A\u0430\u0442\u0430\u043B\u043E\u0433 \u043F\u0438\u0446\u0446" }));
  menuCard.appendChild(
    createElement("p", { className: "card-description", text: "\u0411\u044B\u0441\u0442\u0440\u044B\u0439 \u0432\u044B\u0431\u043E\u0440 \u043F\u043E \u0444\u0438\u043B\u044C\u0442\u0440\u0430\u043C \u0438 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F\u043C." })
  );
  const menuFooter = createCardFooter2();
  menuFooter.appendChild(createButton({ label: "\u041F\u0435\u0440\u0435\u0439\u0442\u0438 \u0432 \u043C\u0435\u043D\u044E", onClick: () => navigate2("/menu") }));
  menuCard.appendChild(menuFooter);
  cards.append(promoCard, menuCard);
  const menuSection = createSection({ className: "home-menu" });
  menuSection.appendChild(createElement("h3", { className: "section-title", text: "\u041C\u0435\u043D\u044E \u0438 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438" }));
  const menuContent = createElement("div");
  menuSection.appendChild(menuContent);
  root.append(hero, cards, menuSection);
  const renderMenuState = (state4) => {
    clearElement(menuContent);
    if (state4.status === "loading" || state4.status === "idle") {
      menuContent.appendChild(
        createLoadingState({
          text: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u043C\u0435\u043D\u044E\u2026",
          content: createSkeletonGrid(HOME_MENU_PREVIEW_LIMIT)
        })
      );
      return;
    }
    if (state4.status === "error") {
      const retry = createButton({
        label: "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C",
        variant: "secondary",
        onClick: () => loadMenu().catch(() => null)
      });
      menuContent.appendChild(
        createErrorState({
          title: "\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043C\u0435\u043D\u044E",
          description: state4.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u043C\u0435\u043D\u044E. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437.",
          action: retry
        })
      );
      return;
    }
    if (!state4.items.length) {
      menuContent.appendChild(
        createEmptyState({
          title: "\u041C\u0435\u043D\u044E \u043F\u043E\u043A\u0430 \u043F\u0443\u0441\u0442\u043E\u0435",
          description: "\u0421\u043A\u043E\u0440\u043E \u0434\u043E\u0431\u0430\u0432\u0438\u043C \u043D\u043E\u0432\u044B\u0435 \u043F\u043E\u0437\u0438\u0446\u0438\u0438. \u0417\u0430\u0433\u043B\u044F\u043D\u0438\u0442\u0435 \u0447\u0443\u0442\u044C \u043F\u043E\u0437\u0436\u0435."
        })
      );
      return;
    }
    if (state4.categories.length) {
      const categoriesRow = createElement("div", { className: "filter-row" });
      state4.categories.forEach((category) => {
        const chip = createChip({
          label: category.title,
          ariaLabel: `\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F: ${category.title}`,
          onClick: () => navigate2("/menu")
        });
        categoriesRow.appendChild(chip);
      });
      menuContent.appendChild(categoriesRow);
    }
    const previewGrid = createElement("div", { className: "menu-grid" });
    const previewItems = state4.items.slice(0, HOME_MENU_PREVIEW_LIMIT);
    previewItems.forEach((item) => previewGrid.appendChild(createMenuPreviewCard(item, navigate2)));
    menuContent.appendChild(previewGrid);
    const menuAction = createCardFooter2();
    menuAction.appendChild(createButton({ label: "\u0421\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u0432\u0441\u0435 \u043C\u0435\u043D\u044E", onClick: () => navigate2("/menu") }));
    menuContent.appendChild(menuAction);
  };
  const unsubscribe = subscribeMenu(renderMenuState);
  loadMenu().catch(() => null);
  return { element: root, cleanup: () => unsubscribe() };
}

// webapp/services/promoService.js
async function fetchPromos() {
  const response = await fetch("/data/promos.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (text.trim().startsWith("<")) {
    throw new Error("promos.json returned HTML (wrong path)");
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error("promos.json is not valid JSON");
  }
  if (!Array.isArray(payload)) {
    throw new Error("promos.json has unexpected shape");
  }
  return payload.map((promo) => ({
    id: String(promo?.id ?? promo?.code ?? ""),
    title: String(promo?.title ?? ""),
    description: String(promo?.description ?? ""),
    type: String(promo?.type ?? "fixed"),
    value: Number(promo?.value ?? 0),
    code: promo?.code ? String(promo.code) : "",
    expiresAt: promo?.expiresAt ? String(promo.expiresAt) : "",
    active: promo?.active !== false
  }));
}

// webapp/store/promoStore.js
var state3 = {
  items: [],
  status: "idle",
  error: null
};
var listeners3 = /* @__PURE__ */ new Set();
function notify2() {
  listeners3.forEach((listener) => listener({ ...state3 }));
}
function subscribePromos(listener) {
  listeners3.add(listener);
  listener({ ...state3 });
  return () => listeners3.delete(listener);
}
async function loadPromos() {
  if (state3.status === "loading" || state3.status === "loaded") {
    return state3.items;
  }
  state3.status = "loading";
  state3.error = null;
  notify2();
  try {
    const items = await fetchPromos();
    state3.items = items;
    state3.status = "loaded";
    notify2();
    return items;
  } catch (error) {
    state3.status = "error";
    state3.error = error instanceof Error ? error.message : "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0430\u043A\u0446\u0438\u0438";
    notify2();
    throw error;
  }
}

// webapp/pages/promosPage.js
function formatCountdown(expiresAt) {
  if (!expiresAt) return "\u0411\u0435\u0437 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u044F \u043F\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438";
  const expires = Date.parse(expiresAt);
  if (Number.isNaN(expires)) return "\u0411\u0435\u0437 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u044F \u043F\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438";
  const diff = expires - Date.now();
  if (diff <= 0) return "\u0410\u043A\u0446\u0438\u044F \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430";
  const hours = Math.floor(diff / 36e5);
  const minutes = Math.floor(diff % 36e5 / 6e4);
  const seconds = Math.floor(diff % 6e4 / 1e3);
  const pad = (value) => String(value).padStart(2, "0");
  return `\u0414\u043E \u043A\u043E\u043D\u0446\u0430 \u0430\u043A\u0446\u0438\u0438: ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
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
    card.appendChild(createElement("div", { className: "promo-code", text: `\u041F\u0440\u043E\u043C\u043E\u043A\u043E\u0434: ${promo.code}` }));
  }
  const timer = createElement("div", { className: "promo-timer", text: formatCountdown(promo.expiresAt) });
  let intervalId = window.setInterval(() => {
    timer.textContent = formatCountdown(promo.expiresAt);
  }, 1e3);
  const footer = createCardFooter2({ className: "promo-actions" });
  const isInactive = promo.active === false || isPromoExpired(promo.expiresAt);
  const applyButton = createButton({
    label: "\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C \u043A \u043A\u043E\u0440\u0437\u0438\u043D\u0435",
    onClick: () => {
      setSelectedPromo(promo);
      showToast("\u0410\u043A\u0446\u0438\u044F \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u0430 \u043A \u043A\u043E\u0440\u0437\u0438\u043D\u0435", "success");
    }
  });
  applyButton.disabled = isInactive;
  footer.append(applyButton);
  card.append(timer, footer);
  return { card, cleanup: () => window.clearInterval(intervalId) };
}
function renderPromosPage({ navigate: navigate2 }) {
  const root = createElement("section", { className: "list" });
  const content2 = createElement("div");
  root.appendChild(content2);
  const cleanupTimers = /* @__PURE__ */ new Set();
  const renderState = (state4) => {
    clearElement(content2);
    cleanupTimers.forEach((fn) => fn());
    cleanupTimers.clear();
    const crumbs = createBreadcrumbs([
      { label: "\u0413\u043B\u0430\u0432\u043D\u0430\u044F", onClick: () => navigate2("/") },
      { label: "\u0410\u043A\u0446\u0438\u0438" }
    ]);
    if (state4.status === "loading" || state4.status === "idle") {
      content2.append(
        crumbs,
        createLoadingState({
          text: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0430\u043A\u0446\u0438\u0438\u2026"
        })
      );
      return;
    }
    if (state4.status === "error") {
      const retry = createButton({
        label: "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C",
        variant: "secondary",
        onClick: () => loadPromos().catch(() => null)
      });
      content2.append(
        crumbs,
        createErrorState({
          title: "\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438",
          description: state4.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0430\u043A\u0446\u0438\u0438.",
          action: retry
        })
      );
      return;
    }
    if (!state4.items.length) {
      content2.append(
        crumbs,
        createEmptyState({
          title: "\u0421\u0435\u0439\u0447\u0430\u0441 \u043D\u0435\u0442 \u0430\u043A\u0446\u0438\u0439",
          description: "\u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0437\u0430\u0433\u043B\u044F\u043D\u0443\u0442\u044C \u043F\u043E\u0437\u0436\u0435."
        })
      );
      return;
    }
    content2.appendChild(crumbs);
    state4.items.forEach((promo) => {
      const { card, cleanup: cleanup2 } = createPromoCard(promo);
      cleanupTimers.add(cleanup2);
      content2.appendChild(card);
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
    }
  };
}

// webapp/services/adminApi.js
async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("content-type") && !(options.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  let response;
  try {
    response = await fetch(path, { ...options, headers, credentials: "include" });
  } catch (error) {
    const networkError = new Error("\u0421\u0435\u0440\u0432\u0435\u0440 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435, \u0447\u0442\u043E /api \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D.");
    networkError.status = 0;
    networkError.details = error instanceof Error ? error.message : String(error);
    throw networkError;
  }
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    const error = new Error("Admin API \u043D\u0435 \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442 JSON (\u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E, \u043D\u0435 \u0437\u0430\u0434\u0435\u043F\u043B\u043E\u0435\u043D\u044B Functions /api)");
    error.status = response.status;
    throw error;
  }
  const payload = await response.json().catch(() => null);
  if (payload == null) {
    const error = new Error("Admin API \u0432\u0435\u0440\u043D\u0443\u043B \u043F\u0443\u0441\u0442\u043E\u0439 \u043E\u0442\u0432\u0435\u0442");
    error.status = response.status;
    throw error;
  }
  if (!response.ok) {
    const message = payload?.error?.message || "Request failed";
    const details = payload?.error?.details;
    const error = new Error(message);
    error.details = details;
    error.status = response.status;
    throw error;
  }
  return payload;
}
var adminApi = {
  async login(email, password) {
    const data = await request("/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    return data.user;
  },
  logout() {
    return request("/api/admin/auth/logout", { method: "POST" });
  },
  me() {
    return request("/api/admin/me").then((data) => data?.user ?? null);
  },
  listCategories() {
    return request("/api/admin/categories").then((data) => data.items || []);
  },
  createCategory(payload) {
    return request("/api/admin/categories", { method: "POST", body: JSON.stringify(payload) });
  },
  updateCategory(id, payload) {
    return request(`/api/admin/categories/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  deleteCategory(id) {
    return request(`/api/admin/categories/${id}`, { method: "DELETE" });
  },
  listIngredients() {
    return request("/api/admin/ingredients").then((data) => data.items || []);
  },
  createIngredient(payload) {
    return request("/api/admin/ingredients", { method: "POST", body: JSON.stringify(payload) });
  },
  updateIngredient(id, payload) {
    return request(`/api/admin/ingredients/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  deleteIngredient(id) {
    return request(`/api/admin/ingredients/${id}`, { method: "DELETE" });
  },
  listInventory() {
    return request("/api/admin/inventory").then((data) => data.items || []);
  },
  updateInventory(id, payload) {
    return request(`/api/admin/inventory/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  listProducts() {
    return request("/api/admin/products").then((data) => data.items || []);
  },
  createProduct(payload) {
    return request("/api/admin/products", { method: "POST", body: JSON.stringify(payload) });
  },
  updateProduct(id, payload) {
    return request(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  deleteProduct(id) {
    return request(`/api/admin/products/${id}`, { method: "DELETE" });
  },
  suggestProductName(payload) {
    return request("/api/admin/products/suggest-name", {
      method: "POST",
      body: JSON.stringify(payload)
    }).then((data) => data.items || []);
  },
  listOrders() {
    return request("/api/admin/orders").then((data) => data.items || []);
  },
  getOrder(id) {
    return request(`/api/admin/orders/${id}`).then((data) => data.item);
  },
  updateOrderStatus(id, status) {
    return request(`/api/admin/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
  },
  listPages() {
    return request("/api/admin/pages").then((data) => data.items || []);
  },
  createPage(payload) {
    return request("/api/admin/pages", { method: "POST", body: JSON.stringify(payload) });
  },
  updatePage(id, payload) {
    return request(`/api/admin/pages/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  deletePage(id) {
    return request(`/api/admin/pages/${id}`, { method: "DELETE" });
  },
  listPageBlocks(pageId) {
    return request(`/api/admin/page-blocks?page_id=${pageId}`).then((data) => data.items || []);
  },
  createPageBlock(payload) {
    return request("/api/admin/page-blocks", { method: "POST", body: JSON.stringify(payload) });
  },
  updatePageBlock(id, payload) {
    return request(`/api/admin/page-blocks/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  deletePageBlock(id) {
    return request(`/api/admin/page-blocks/${id}`, { method: "DELETE" });
  },
  reorderPageBlocks(pageId, orderedIds) {
    return request("/api/admin/page-blocks/reorder", {
      method: "POST",
      body: JSON.stringify({ pageId, orderedIds })
    });
  },
  uploadMedia(file) {
    const form = new FormData();
    form.append("file", file);
    return request("/api/admin/upload", { method: "POST", body: form });
  },
  listMedia() {
    return request("/api/admin/media").then((data) => data.items || []);
  },
  deleteMedia(key) {
    return request(`/api/admin/media/${encodeURIComponent(key)}`, { method: "DELETE" });
  }
};

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
  const path = window.location.pathname;
  const isLoginRoute = path.startsWith("/admin/login");
  const boot = async () => {
    if (!isLoginRoute) {
      try {
        await adminApi.me();
      } catch (err) {
        placeholder.textContent = "\u041D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u043A \u0430\u0434\u043C\u0438\u043D\u043A\u0435. \u041F\u0435\u0440\u0435\u043D\u0430\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u043C \u043D\u0430 \u0432\u0445\u043E\u0434\u2026";
        window.appNavigate?.("/admin/login");
        return;
      }
    }
    import("/admin/AdminApp.bundle.js").then((module) => {
      placeholder.remove();
      cleanup2 = module.mountAdminApp(mount, {
        navigate: window.appNavigate,
        initialPath: window.location.pathname
      });
    }).catch((error) => {
      placeholder.textContent = `\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0430\u0434\u043C\u0438\u043D\u043A\u0438: ${error.message}`;
    });
  };
  boot();
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
var formatUpdatedAt = (updatedAt) => {
  if (!updatedAt) return null;
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diffMs / 6e4);
  if (minutes <= 0) return "\u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E \u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0442\u043E";
  if (minutes < 60) return `\u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E ${minutes} \u043C\u0438\u043D \u043D\u0430\u0437\u0430\u0434`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `\u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E ${hours} \u0447 \u043D\u0430\u0437\u0430\u0434`;
  const days = Math.floor(hours / 24);
  return `\u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E ${days} \u0434\u043D \u043D\u0430\u0437\u0430\u0434`;
};
function renderOrderStatusPage({ navigate: navigate2 }) {
  const root = createElement("section", { className: "list" });
  const content2 = createElement("div");
  root.appendChild(content2);
  const baseDelay = 2e3;
  let retryDelay = baseDelay;
  let retryTimer = null;
  let transientError = null;
  const resolveQrSrc = (confirmation) => {
    const raw = confirmation?.confirmation_data || confirmation?.confirmation_url;
    if (!raw) return null;
    if (raw.startsWith("data:")) return raw;
    if (/^[A-Za-z0-9+/=]+$/.test(raw)) {
      return `data:image/png;base64,${raw}`;
    }
    if (/^https?:\/\//.test(raw)) return raw;
    return null;
  };
  const render = () => {
    clearElement(content2);
    const status = getLastOrderStatus();
    const orders = getOrders();
    const latest = orders[0];
    const requestId = latest?.request_id || status?.request_id;
    const payment = latest?.payment;
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
    const updatedAtLabel = formatUpdatedAt(status?.updated_at || latest?.updated_at);
    if (updatedAtLabel) {
      panel.appendChild(
        createElement("div", {
          className: "helper",
          text: updatedAtLabel
        })
      );
    }
    if (transientError) {
      panel.appendChild(
        createElement("div", {
          className: "helper",
          text: transientError
        })
      );
    }
    if (latest) {
      panel.appendChild(
        createElement("div", {
          className: "helper",
          text: `\u0421\u0443\u043C\u043C\u0430: ${formatPrice(latest.total)}`
        })
      );
    }
    if (payment?.payment_id) {
      panel.appendChild(
        createElement("div", {
          className: "helper",
          text: `\u041F\u043B\u0430\u0442\u0451\u0436: ${payment.payment_id} (${payment.status || "pending"})`
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
    if (payment?.confirmation?.type === "qr") {
      const qrSrc = resolveQrSrc(payment.confirmation);
      panel.appendChild(
        createElement("div", {
          className: "helper",
          text: "\u0421\u0411\u041F: \u043E\u0442\u0441\u043A\u0430\u043D\u0438\u0440\u0443\u0439\u0442\u0435 QR-\u043A\u043E\u0434 \u0434\u043B\u044F \u043E\u043F\u043B\u0430\u0442\u044B."
        })
      );
      if (qrSrc) {
        panel.appendChild(
          createElement("img", {
            attrs: { src: qrSrc, alt: "QR \u0434\u043B\u044F \u043E\u043F\u043B\u0430\u0442\u044B", style: "max-width: 220px; width: 100%;" }
          })
        );
      } else if (payment.payment_url) {
        panel.appendChild(
          createElement("a", {
            className: "helper",
            text: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443 \u0434\u043B\u044F \u043E\u043F\u043B\u0430\u0442\u044B",
            attrs: { href: payment.payment_url, target: "_blank", rel: "noopener noreferrer" }
          })
        );
      }
    } else if (payment?.payment_url) {
      panel.appendChild(
        createElement("a", {
          className: "helper",
          text: "\u041F\u0435\u0440\u0435\u0439\u0442\u0438 \u043A \u043E\u043F\u043B\u0430\u0442\u0435",
          attrs: { href: payment.payment_url, target: "_blank", rel: "noopener noreferrer" }
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
  const poll = async () => {
    const orders = getOrders();
    const latest = orders[0];
    const orderId = latest?.order_id;
    if (!orderId) return;
    try {
      const res = await fetch(`/api/public/orders/${encodeURIComponent(orderId)}`);
      if (res.status === 404) {
        transientError = "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C, \u043F\u043E\u0432\u0442\u043E\u0440\u0438\u043C \u043F\u043E\u0437\u0436\u0435";
      } else if (!res.ok) {
        throw new Error(`Status ${res.status}`);
      } else {
        const data = await res.json();
        updateOrderStatusFromApi(data.order_id, data.status, data.updated_at);
        transientError = null;
      }
    } catch (error) {
      console.warn("Order status poll failed", error);
      transientError = "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C, \u043F\u043E\u0432\u0442\u043E\u0440\u0438\u043C \u043F\u043E\u0437\u0436\u0435";
    } finally {
      render();
      retryDelay = Math.min(Math.round(retryDelay * 1.6), 3e4);
      retryTimer = setTimeout(poll, retryDelay);
    }
  };
  render();
  retryTimer = setTimeout(poll, retryDelay);
  return {
    element: root,
    cleanup: () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    }
  };
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
    const footer = createCardFooter2();
    footer.appendChild(createPriceTag({ value: formatPrice(item.price) }));
    const addButton = createButton({
      label: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C",
      onClick: () => {
        add({ id: item.id, title: item.title, price: item.price, image: item.images?.[0] || "", doughType: "poolish" });
        showToast("\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443", {
          variant: "success",
          durationMs: 2e3,
          actionLabel: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u043E\u0440\u0437\u0438\u043D\u0443",
          onAction: () => window.appNavigate?.("/cart")
        });
        console.info("cart:add", { source: "dynamic", itemId: item.id, doughType: "poolish", toast: "\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443" });
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

// webapp/pages/resetPasswordPage.js
function renderResetPasswordPage() {
  const root = createElement("section", { className: "list" });
  const panel = createElement("div", { className: "panel" });
  panel.appendChild(createElement("h2", { className: "title", text: "\u0421\u0431\u0440\u043E\u0441 \u043F\u0430\u0440\u043E\u043B\u044F" }));
  const token = new URLSearchParams(window.location.search).get("token") || "";
  if (!token) {
    panel.appendChild(createElement("p", { className: "helper", text: "\u0422\u043E\u043A\u0435\u043D \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D." }));
    root.appendChild(panel);
    return { element: root };
  }
  const passwordInput = createElement("input", {
    className: "input",
    attrs: { type: "password", placeholder: "\u041D\u043E\u0432\u044B\u0439 \u043F\u0430\u0440\u043E\u043B\u044C (\u043C\u0438\u043D. 8 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432)" }
  });
  const button = createButton({
    label: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C",
    onClick: async () => {
      const password = passwordInput.value;
      if (!password || password.length < 8) {
        showToast("\u041F\u0430\u0440\u043E\u043B\u044C \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043D\u0435 \u043A\u043E\u0440\u043E\u0447\u0435 8 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432", "info");
        return;
      }
      try {
        await confirmPasswordReset({ token, password });
        showToast("\u041F\u0430\u0440\u043E\u043B\u044C \u043E\u0431\u043D\u043E\u0432\u043B\u0451\u043D", "success");
      } catch (error) {
        showToast(error?.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u043F\u0430\u0440\u043E\u043B\u044C", "error");
      }
    }
  });
  panel.append(passwordInput, button);
  root.appendChild(panel);
  return { element: root };
}

// webapp/pages/verifyEmailPage.js
function renderVerifyEmailPage() {
  const root = createElement("section", { className: "list" });
  const panel = createElement("div", { className: "panel" });
  panel.appendChild(createElement("h2", { className: "title", text: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435 email" }));
  const status = createElement("p", { className: "helper", text: "\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C \u0441\u0441\u044B\u043B\u043A\u0443\u2026" });
  panel.appendChild(status);
  root.appendChild(panel);
  const token = new URLSearchParams(window.location.search).get("token") || "";
  if (!token) {
    status.textContent = "\u0422\u043E\u043A\u0435\u043D \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D.";
    return { element: root };
  }
  fetch("/api/public/auth/email-verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token })
  }).then(async (response) => {
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error?.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C email";
      throw new Error(message);
    }
    status.textContent = "Email \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u041C\u043E\u0436\u043D\u043E \u0432\u0445\u043E\u0434\u0438\u0442\u044C.";
    showToast("Email \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D", "success");
  }).catch((error) => {
    status.textContent = error?.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C email";
    showToast(status.textContent, "error");
  });
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
  const heading = createElement("h1", { className: "title", text: title });
  const badge = createElement("div", { className: "brand-badge", text: "\u0421\u0432\u0435\u0436\u0430\u044F \u043F\u0438\u0446\u0446\u0430 \u043A\u0430\u0436\u0434\u044B\u0439 \u0434\u0435\u043D\u044C" });
  const subtitleText = createElement("p", { className: "subtitle", text: subtitle });
  header.append(heading, badge, subtitleText);
  const nav = createNav({ items: navItems2, onNavigate, location: "top" });
  const element = createElement("div", { className: "top-bar" });
  element.append(header, nav.element);
  return { element, header, nav };
}
function createBottomBar({ navItems: navItems2, onNavigate }) {
  const nav = createNav({ items: navItems2, onNavigate, location: "bottom" });
  const element = createElement("div", { className: "bottom-bar" });
  const contacts = createElement("div", { className: "bottom-bar-contacts" });
  element.append(nav.element, contacts);
  return { element, nav, contacts };
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

// webapp/ui/introMatrixPizzaOverlay.js
var INTRO_STORAGE_KEY = "introSeen";
function getIntroState() {
  const params = new URLSearchParams(window.location.search);
  const forceIntro = params.get("intro") === "1";
  let seen = false;
  try {
    seen = localStorage.getItem(INTRO_STORAGE_KEY) === "1";
  } catch (error) {
    seen = false;
  }
  return { forceIntro, seen };
}
function shouldShowIntro() {
  const { forceIntro, seen } = getIntroState();
  return forceIntro || !seen;
}
function markIntroSeen() {
  try {
    localStorage.setItem(INTRO_STORAGE_KEY, "1");
  } catch (error) {
    console.warn("Intro storage write failed", error);
  }
}
function createParticles(count2, width, height) {
  return Array.from({ length: count2 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: 12 + Math.random() * 18,
    speed: 0.6 + Math.random() * 1.9,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.02,
    opacity: 0.45 + Math.random() * 0.5
  }));
}
function getParticleCount(width, height) {
  const area = width * height;
  const base = Math.min(140, Math.max(28, Math.round(area / 18e3)));
  const deviceMemory = navigator.deviceMemory || 4;
  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const multiplier = prefersReduced ? 0.45 : deviceMemory <= 2 ? 0.55 : deviceMemory <= 4 ? 0.8 : 1;
  return Math.max(18, Math.round(base * multiplier));
}
function IntroOverlay({ mode = "intro", allowOffline = false, onDismiss, onRetry, onOpenOffline } = {}) {
  const overlay = createElement("div", { className: "intro-overlay", attrs: { role: "dialog", "aria-modal": "true" } });
  const canvas = createElement("canvas", { className: "intro-canvas", attrs: { "aria-hidden": "true" } });
  const content2 = createElement("div", { className: "intro-content" });
  const title = createElement("div", {
    className: "intro-title",
    text: mode === "maintenance" ? "\u0422\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0440\u0430\u0431\u043E\u0442\u044B. \u041C\u044B \u0443\u0436\u0435 \u0447\u0438\u043D\u0438\u043C \u{1F6A7}" : "\u0422\u0430\u043F\u043D\u0438 \u043F\u043E \u0446\u0435\u043D\u0442\u0440\u0443, \u0447\u0442\u043E\u0431\u044B \u0432\u043E\u0439\u0442\u0438"
  });
  const subtitle = createElement("div", {
    className: "intro-subtitle",
    text: mode === "maintenance" ? "MAINTENANCE" : "ENTER"
  });
  const actionRow = createElement("div", { className: "intro-actions" });
  const action = createElement("button", {
    className: "intro-enter",
    text: mode === "maintenance" ? "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C" : "\u0412\u043E\u0439\u0442\u0438",
    attrs: { type: "button", "aria-label": mode === "maintenance" ? "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443" : "\u0412\u043E\u0439\u0442\u0438 \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435" }
  });
  actionRow.appendChild(action);
  if (mode === "maintenance" && allowOffline) {
    const offline = createElement("button", {
      className: "intro-enter intro-enter--ghost",
      text: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043C\u0435\u043D\u044E \u043E\u0444\u043B\u0430\u0439\u043D",
      attrs: { type: "button", "aria-label": "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043C\u0435\u043D\u044E \u043E\u0444\u043B\u0430\u0439\u043D" }
    });
    actionRow.appendChild(offline);
    offline.addEventListener("click", () => onOpenOffline?.());
  }
  content2.append(title, subtitle, actionRow);
  overlay.append(canvas, content2);
  document.body.appendChild(overlay);
  document.body.classList.add("intro-active");
  const ctx = canvas.getContext("2d");
  let rafId = 0;
  let width = 0;
  let height = 0;
  let particles = [];
  let running = true;
  const resize = () => {
    const ratio = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
    particles = createParticles(getParticleCount(width, height), width, height);
  };
  const draw = () => {
    if (!running) return;
    rafId = window.requestAnimationFrame(draw);
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(7, 9, 14, 0.25)";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(255, 153, 51, 0.4)";
    ctx.shadowBlur = 12;
    particles.forEach((particle) => {
      particle.y += particle.speed;
      particle.rotation += particle.rotationSpeed;
      if (particle.y - particle.size > height) {
        particle.y = -particle.size * 2;
        particle.x = Math.random() * width;
        particle.speed = 0.6 + Math.random() * 1.9;
        particle.size = 12 + Math.random() * 18;
        particle.opacity = 0.45 + Math.random() * 0.5;
      }
      ctx.save();
      ctx.globalAlpha = particle.opacity;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.font = `${particle.size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.fillText("\u{1F355}", 0, 0);
      ctx.restore();
    });
    ctx.restore();
  };
  const cleanup2 = () => {
    running = false;
    if (rafId) window.cancelAnimationFrame(rafId);
    window.removeEventListener("resize", resize);
    document.removeEventListener("keydown", onKeydown);
    overlay.remove();
    document.body.classList.remove("intro-active");
  };
  const dismiss = () => {
    if (mode === "maintenance") {
      onRetry?.();
      return;
    }
    if (!overlay.classList.contains("is-exiting")) {
      overlay.classList.add("is-exiting");
      markIntroSeen();
      window.setTimeout(() => {
        cleanup2();
        onDismiss?.();
      }, 450);
    }
  };
  const onKeydown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      dismiss();
    }
  };
  action.addEventListener("click", dismiss);
  if (mode !== "maintenance") {
    content2.addEventListener("click", dismiss);
  }
  document.addEventListener("keydown", onKeydown);
  resize();
  draw();
  return { cleanup: cleanup2 };
}

// webapp/services/healthService.js
async function checkHealth({ timeoutMs = 2500 } = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const result = {
    ok: false,
    status: null,
    error: null,
    timedOut: false
  };
  try {
    const response = await fetch("/api/health", { cache: "no-store", signal: controller.signal });
    result.status = response.status;
    result.ok = response.ok;
    if (!response.ok) {
      result.error = new Error(`Health check status ${response.status}`);
    }
  } catch (error) {
    result.error = error;
    result.timedOut = error?.name === "AbortError";
  } finally {
    window.clearTimeout(timeoutId);
  }
  return result;
}

// webapp/app.js
var app = document.getElementById("app");
if (typeof window.PUBLIC_MEDIA_BASE_URL === "undefined") {
  window.PUBLIC_MEDIA_BASE_URL = "";
}
var navItems = [
  { label: "\u0413\u043B\u0430\u0432\u043D\u0430\u044F", path: "/" },
  { label: "\u041C\u0435\u043D\u044E", path: "/menu" },
  { label: "\u041A\u043E\u0440\u0437\u0438\u043D\u0430", path: "/cart" },
  { label: "\u0410\u043A\u0446\u0438\u0438", path: "/promos" },
  { label: "\u041F\u0440\u043E\u0444\u0438\u043B\u044C", path: "/profile" }
];
var appShell = createAppShell({
  title: "\u041F\u0438\u0446\u0446\u0435\u0440\u0438\u044F \u0422\u0430\u0433\u0438\u043B",
  subtitle: "\u041C\u0438\u043D\u0438\u2011\u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0434\u043B\u044F \u0437\u0430\u043A\u0430\u0437\u0430 \u043F\u0438\u0446\u0446\u044B \u0431\u0435\u0437 \u043B\u0438\u0448\u043D\u0438\u0445 \u0448\u0430\u0433\u043E\u0432.",
  navItems,
  onNavigate: (path) => navigate(path)
});
var { warning, debugPanel, topBar, bottomBar, content } = appShell;
app.append(...appShell.elements);
var routes = [
  { path: /^\/$/, render: renderHomePage },
  { path: /^\/home\/?$/, render: renderHomePage },
  { path: /^\/menu\/?$/, render: renderMenuPage },
  { path: /^\/cart\/?$/, render: renderCartPage },
  { path: /^\/checkout\/?$/, render: renderCheckoutPage },
  { path: /^\/promos\/?$/, render: renderPromosPage },
  { path: /^\/profile\/?$/, render: renderProfilePage },
  { path: /^\/reset-password\/?$/, render: renderResetPasswordPage },
  { path: /^\/verify-email\/?$/, render: renderVerifyEmailPage },
  { path: /^\/admin\/login\/?$/, render: renderAdminPage },
  { path: /^\/admin\/?$/, render: renderAdminPage },
  { path: /^\/order-status\/?$/, render: renderOrderStatusPage },
  { path: /^\/pizza\/([^/]+)\/?$/, render: renderPizzaPage },
  { path: /^\/page\/([^/]+)\/?$/, render: renderDynamicPage }
];
var cleanup = null;
var bootState = {
  ready: false,
  status: "idle"
};
var lastTab = null;
function setAppHeightVar() {
  const height = window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${height}px`);
}
function getActiveTab(pathname) {
  if (pathname === "/" || pathname.startsWith("/home")) return "/";
  return navItems.find((item) => item.path !== "/" && pathname.startsWith(item.path))?.path || null;
}
function logBoot() {
  const activeTab = getActiveTab(window.location.pathname);
  console.log("[boot] path=", window.location.pathname, "tab=", activeTab, "ready=", bootState.ready);
}
function logTabSwitch(pathname) {
  const activeTab = getActiveTab(pathname);
  if (!activeTab || activeTab === lastTab) return;
  lastTab = activeTab;
  console.info(`[tab] switch to ${activeTab === "/" ? "home" : activeTab.replace("/", "")}`);
}
function logSafeArea() {
  const styles = getComputedStyle(document.documentElement);
  const topInset = parseFloat(styles.getPropertyValue("--safe-area-top")) || 0;
  const bottomInset = parseFloat(styles.getPropertyValue("--safe-area-bottom")) || 0;
  console.info(`[layout] safeArea top=${topInset} bottom=${bottomInset} applied`);
}
function setActiveNav(pathname) {
  const activeTab = getActiveTab(pathname);
  [topBar.nav.buttons, bottomBar.nav.buttons].forEach((buttons) => {
    buttons.forEach((button) => {
      const target = button.dataset.path;
      const isActive = target === activeTab;
      button.classList.toggle("is-active", isActive);
      setButtonCurrent(button, isActive);
    });
  });
}
function renderRoute(pathname) {
  const path = pathname;
  const match = routes.find((route) => route.path.test(path));
  if (!match) {
    navigate("/menu");
    return;
  }
  logBoot();
  logTabSwitch(path);
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
  if (typeof result?.restoreScroll === "function") {
    result.restoreScroll();
  }
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
window.addEventListener("resize", setAppHeightVar);
window.addEventListener("orientationchange", setAppHeightVar);
setAppHeightVar();
var telegramState = initTelegram() ?? { available: false, missingInitData: false };
warning.textContent = "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0447\u0435\u0440\u0435\u0437 \u043A\u043D\u043E\u043F\u043A\u0443 \xAB\u{1F355} \u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D\xBB \u0432 \u0431\u043E\u0442\u0435, \u0438\u043D\u0430\u0447\u0435 Telegram \u0444\u0443\u043D\u043A\u0446\u0438\u0438 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B.";
warning.hidden = telegramState.available && !telegramState.missingInitData;
subscribeCart(() => {
  const itemsCount = count();
  [topBar.nav.buttons, bottomBar.nav.buttons].forEach((buttons) => {
    const cartButton = buttons.find((button) => button.dataset.path === "/cart");
    if (!cartButton) return;
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
function renderInitialRoute() {
  renderRoute(window.location.pathname);
}
async function initApp() {
  bootState.status = "init";
  logBoot();
  const results = await Promise.allSettled([fetchConfig(), loadMenu()]);
  const hasErrors = results.some((result) => result.status === "rejected");
  bootState.status = hasErrors ? "degraded" : "ready";
  bootState.ready = true;
  logBoot();
  logSafeArea();
  setAppHeightVar();
  const configResult = results[0];
  if (configResult.status === "fulfilled") {
    renderBottomContacts(configResult.value);
  } else {
    renderBottomContacts(null);
  }
}
renderInitialRoute();
syncPendingOrders();
void initApp();
var overlayController = null;
function cleanupOverlay() {
  if (overlayController?.cleanup) {
    overlayController.cleanup();
    overlayController = null;
  }
}
async function runHealthCheck() {
  console.info("health-check:start");
  const result = await checkHealth({ timeoutMs: 2500 });
  console.info("health-check:result", {
    ok: result.ok,
    status: result.status,
    timedOut: result.timedOut,
    error: result.error?.message || null
  });
  return result;
}
function createContactLink({ label, href, variant = "secondary", icon }) {
  const classes = ["button", "ui-interactive", "button--sm", variant ? `button--${variant}` : "", "bottom-bar-contact"].filter(Boolean).join(" ");
  const attrs = {
    href,
    role: "button",
    "aria-label": label,
    target: href?.startsWith("http") ? "_blank" : void 0,
    rel: href?.startsWith("http") ? "noopener noreferrer" : void 0
  };
  const link = createElement("a", { className: classes, attrs });
  if (icon) {
    link.appendChild(createElement("span", { className: "contact-icon", text: icon }));
  }
  link.appendChild(createElement("span", { text: label }));
  return link;
}
function normalizeTelegramChatLink(raw) {
  if (!raw) return "";
  if (!isTelegram()) return raw;
  const match = raw.match(/t\.me\/(.+)$/i);
  if (!match) return raw;
  const username = match[1].split("?")[0].replace("@", "");
  return username ? `https://t.me/${username}` : raw;
}
function renderBottomContacts(config) {
  if (!bottomBar?.contacts) return;
  clearElement(bottomBar.contacts);
  const supportPhone = config?.supportPhone || "";
  const supportChat = normalizeTelegramChatLink(config?.supportChat || "");
  const elements = [];
  if (supportPhone) {
    elements.push(
      createContactLink({
        label: "\u041F\u043E\u0437\u0432\u043E\u043D\u0438\u0442\u044C",
        href: `tel:${supportPhone.replace(/[^+\d]/g, "")}`,
        icon: "\u{1F4DE}"
      })
    );
  }
  if (supportChat) {
    elements.push(
      createContactLink({
        label: "\u041D\u0430\u043F\u0438\u0441\u0430\u0442\u044C",
        href: supportChat,
        icon: "\u{1F4AC}"
      })
    );
  }
  if (!elements.length) {
    bottomBar.contacts.hidden = true;
    return;
  }
  bottomBar.contacts.hidden = false;
  bottomBar.contacts.classList.toggle("is-single", elements.length === 1);
  elements.forEach((el) => bottomBar.contacts.appendChild(el));
}
async function resolveOverlayMode() {
  const { forceIntro, seen } = getIntroState();
  const healthResult = await runHealthCheck();
  const maintenance = !healthResult.ok;
  const showIntro = shouldShowIntro();
  const showMode = maintenance ? "maintenance" : showIntro ? "intro" : "none";
  console.info("intro:decision", { forceIntro, seen, maintenance, showMode });
  return { maintenance, showMode };
}
async function showOverlayFlow() {
  const { maintenance, showMode } = await resolveOverlayMode();
  cleanupOverlay();
  if (showMode === "none") return;
  if (showMode === "maintenance") {
    const allowOffline = await hasLocalMenu();
    overlayController = IntroOverlay({
      mode: "maintenance",
      allowOffline,
      onRetry: () => {
        showOverlayFlow();
      },
      onOpenOffline: async () => {
        try {
          await loadLocalMenu();
          cleanupOverlay();
          navigate("/menu");
        } catch (error) {
          console.warn("Offline menu load failed", error);
        }
      }
    });
    return;
  }
  overlayController = IntroOverlay({
    mode: "intro",
    onDismiss: () => {
      cleanupOverlay();
    }
  });
}
showOverlayFlow();
