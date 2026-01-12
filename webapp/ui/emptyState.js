import { createElement } from "./dom.js";
import { createSection } from "./section.js";

export function createEmptyState({ title = "Пока пусто", description, action } = {}) {
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
