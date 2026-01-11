export function createElement(tag, options = {}) {
  const el = document.createElement(tag);
  if (options.className) {
    el.className = options.className;
  }
  if (options.text !== undefined) {
    el.textContent = options.text;
  }
  if (options.html !== undefined) {
    el.innerHTML = options.html;
  }
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        el.setAttribute(key, String(value));
      }
    });
  }
  return el;
}

export function clearElement(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}
