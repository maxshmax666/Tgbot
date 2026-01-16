import { fetchPromos } from "../services/promoService.js";

const state = {
  items: [],
  status: "idle",
  error: null,
};

const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener({ ...state }));
}

export function subscribePromos(listener) {
  listeners.add(listener);
  listener({ ...state });
  return () => listeners.delete(listener);
}

export async function loadPromos() {
  if (state.status === "loading" || state.status === "loaded") {
    return state.items;
  }
  state.status = "loading";
  state.error = null;
  notify();
  try {
    const items = await fetchPromos();
    state.items = items;
    state.status = "loaded";
    notify();
    return items;
  } catch (error) {
    state.status = "error";
    state.error = error instanceof Error ? error.message : "Не удалось загрузить акции";
    notify();
    throw error;
  }
}
