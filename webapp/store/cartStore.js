import { STORAGE_KEYS, storage } from "../services/storageService.js";

const state = {
  items: [],
  updatedAt: Date.now(),
};

const listeners = new Set();

function normalizeItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      id: String(item.id || ""),
      title: String(item.title || ""),
      price: Number(item.price || 0),
      image: item.image || "",
      qty: Number(item.qty || 0),
    }))
    .filter((item) => item.id && item.qty > 0);
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

export function hydrateCart() {
  const items = normalizeItems(storage.read(STORAGE_KEYS.cart, []));
  dispatchChange({ items });
}

export function subscribeCart(listener) {
  listeners.add(listener);
  listener(getState());
  return () => listeners.delete(listener);
}

export function getState() {
  return { items: [...state.items], updatedAt: state.updatedAt };
}

export function setState(items) {
  const normalized = normalizeItems(items);
  persist(normalized);
  dispatchChange({ items: normalized });
}

export function add(item) {
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
      qty: 1,
    });
  }
  persist(items);
  dispatchChange({ items });
}

export function setQty(id, qty) {
  const items = [...state.items];
  const target = items.find((item) => item.id === id);
  if (!target) return;
  target.qty = Math.max(0, qty);
  const next = items.filter((item) => item.qty > 0);
  persist(next);
  dispatchChange({ items: next });
}

export function remove(id) {
  const next = state.items.filter((item) => item.id !== id);
  persist(next);
  dispatchChange({ items: next });
}

export function clear() {
  persist([]);
  dispatchChange({ items: [] });
}

export function total() {
  return state.items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

export function count() {
  return state.items.reduce((sum, item) => sum + item.qty, 0);
}

hydrateCart();
