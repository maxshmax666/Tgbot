import { fetchMenu, fetchLocalMenu } from "../services/menuService.js";

const state = {
  items: [],
  categories: [],
  source: "api",
  status: "idle",
  error: null,
};

const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener({ ...state }));
}

export function subscribeMenu(listener) {
  listeners.add(listener);
  listener({ ...state });
  return () => listeners.delete(listener);
}

export async function loadMenu() {
  if (state.status === "loading" || state.status === "loaded") {
    return state.items;
  }
  state.status = "loading";
  state.error = null;
  notify();
  try {
    const data = await fetchMenu();
    state.items = data.items;
    state.categories = data.categories;
    state.source = data.source ?? "api";
    state.status = "loaded";
    notify();
    return data.items;
  } catch (error) {
    state.status = "error";
    state.error = error instanceof Error ? error.message : "Не удалось загрузить меню";
    notify();
    throw error;
  }
}

export async function loadLocalMenu() {
  if (state.status === "loading") {
    return state.items;
  }
  state.status = "loading";
  state.error = null;
  notify();
  try {
    const data = await fetchLocalMenu();
    state.items = data.items;
    state.categories = data.categories;
    state.source = "local";
    state.status = "loaded";
    notify();
    return data.items;
  } catch (error) {
    state.status = "error";
    state.error = error instanceof Error ? error.message : "Не удалось загрузить меню";
    notify();
    throw error;
  }
}

export function getMenuItemById(id) {
  return state.items.find((item) => item.id === id) || null;
}

export function getMenuItemBySlug(slug) {
  return state.items.find((item) => item.slug === slug || item.id === slug) || null;
}

export function getMenuState() {
  return { ...state };
}

export function getCategories() {
  return state.categories;
}
