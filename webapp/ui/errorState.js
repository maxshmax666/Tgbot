import { createElement } from "./dom.js";
import { createSection } from "./section.js";

export function createErrorState({ title = "Что-то пошло не так", description, action } = {}) {
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
