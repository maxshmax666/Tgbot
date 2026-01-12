import { createElement } from "./dom.js";
import { createSection } from "./section.js";

export function createLoadingState({ text = "Загрузка…", content } = {}) {
  const section = createSection({
    className: "state state--loading",
    attrs: { "data-state": "loading", "aria-busy": "true" },
  });
  section.appendChild(createElement("p", { className: "helper", text }));
  if (content) {
    section.appendChild(content);
  }
  return section;
}
