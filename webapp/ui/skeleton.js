import { createElement } from "./dom.js";

export function createSkeletonGrid(count = 4) {
  const wrapper = createElement("div", { className: "menu-grid" });
  for (let i = 0; i < count; i += 1) {
    const block = createElement("div", { className: "skeleton skeleton-card" });
    wrapper.appendChild(block);
  }
  return wrapper;
}
