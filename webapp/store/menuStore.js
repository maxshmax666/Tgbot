import { fetchMenu } from "../services/menuService.js";

const state = {
  items: [],
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
    const items = await fetchMenu();
    state.items = items;
    state.status = "loaded";
    notify();
    return items;
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

export function getMenuState() {
  return { ...state };
}
