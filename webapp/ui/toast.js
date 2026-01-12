import { createElement } from "./dom.js";

let container = null;

function ensureContainer() {
  if (container) return container;
  container = createElement("div", { className: "toast-container" });
  document.body.appendChild(container);
  return container;
}

export function showToast(message, variant = "info") {
  const root = ensureContainer();
  const toast = createElement("div", { className: ["toast", variant].join(" ") });
  toast.textContent = message;
  root.appendChild(toast);
  window.setTimeout(() => toast.classList.add("show"), 10);
  window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 200);
  }, 3200);
}
