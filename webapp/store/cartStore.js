const STORAGE_KEY = "pizza_cart_v1";

const state = {
  items: [],
  updatedAt: Date.now(),
};

const listeners = new Set();

function notify() {
  state.updatedAt = Date.now();
  listeners.forEach((listener) => listener({ ...state }));
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  } catch (error) {
    console.error("Failed to save cart", error);
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      state.items = parsed
        .map((item) => ({
          id: String(item.id || ""),
          title: String(item.title || ""),
          price: Number(item.price || 0),
          image: item.image || "",
          qty: Number(item.qty || 0),
        }))
        .filter((item) => item.id && item.qty > 0);
    }
  } catch (error) {
    console.warn("Failed to load cart", error);
  }
}

load();

export function subscribeCart(listener) {
  listeners.add(listener);
  listener({ ...state });
  return () => listeners.delete(listener);
}

export function getCartItems() {
  return [...state.items];
}

export function getCartTotal() {
  return state.items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

export function getCartCount() {
  return state.items.reduce((sum, item) => sum + item.qty, 0);
}

export function addToCart(item) {
  const existing = state.items.find((cartItem) => cartItem.id === item.id);
  if (existing) {
    existing.qty += 1;
  } else {
    state.items.push({
      id: item.id,
      title: item.title,
      price: item.price,
      image: item.image,
      qty: 1,
    });
  }
  persist();
  notify();
}

export function updateQty(id, qty) {
  const target = state.items.find((item) => item.id === id);
  if (!target) return;
  target.qty = Math.max(0, qty);
  if (target.qty === 0) {
    state.items = state.items.filter((item) => item.id !== id);
  }
  persist();
  notify();
}

export function removeFromCart(id) {
  state.items = state.items.filter((item) => item.id !== id);
  persist();
  notify();
}

export function clearCart() {
  state.items = [];
  persist();
  notify();
}
