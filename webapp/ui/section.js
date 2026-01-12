import { createElement } from "./dom.js";

export function createSection({
  className = "",
  variant = "panel",
  title,
  titleTag = "h3",
  description,
  attrs = {},
} = {}) {
  const classes = ["section", variant === "panel" ? "panel" : "", variant !== "panel" ? variant : "", className]
    .filter(Boolean)
    .join(" ");
  const section = createElement("section", { className: classes, attrs });
  if (title) {
    section.appendChild(createElement(titleTag, { className: "section-title", text: title }));
  }
  if (description) {
    section.appendChild(createElement("p", { className: "helper", text: description }));
  }
  return section;
}
