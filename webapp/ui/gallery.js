import { createElement } from "./dom.js";
import { applyImageFallback, PLACEHOLDER_IMAGE } from "./image.js";

function setupLazyLoad(track) {
  if (!("IntersectionObserver" in window)) {
    track.querySelectorAll("img[data-src]").forEach((img) => {
      img.src = img.dataset.src;
      img.removeAttribute("data-src");
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute("data-src");
        obs.unobserve(img);
      });
    },
    { root: track, rootMargin: "40px" }
  );

  track.querySelectorAll("img[data-src]").forEach((img) => observer.observe(img));
}

export function createGallery(images = [], { large = false } = {}) {
  const container = createElement("div", { className: "gallery" });
  const track = createElement("div", { className: "gallery-track", attrs: { role: "list" } });
  const dots = createElement("div", { className: "gallery-dots" });

  if (!Array.isArray(images) || images.length === 0) {
    const fallback = createElement("div", { className: "gallery-slide" });
    const img = createElement("img", {
      className: ["gallery-image", large ? "large" : ""].join(" ").trim(),
      attrs: {
        alt: "Фото недоступно",
        loading: "lazy",
        decoding: "async",
        src: PLACEHOLDER_IMAGE,
      },
    });
    applyImageFallback(img);
    fallback.appendChild(img);
    track.appendChild(fallback);
  } else {
    images.forEach((src, index) => {
      const slide = createElement("div", { className: "gallery-slide", attrs: { role: "listitem" } });
      const img = createElement("img", {
        className: ["gallery-image", large ? "large" : ""].join(" ").trim(),
        attrs: {
          alt: `Фото ${index + 1}`,
          loading: "lazy",
          decoding: "async",
          "data-src": src,
        },
      });
      applyImageFallback(img);
      slide.appendChild(img);
      track.appendChild(slide);

      const dot = createElement("span", {
        className: ["gallery-dot", index === 0 ? "active" : ""].join(" ").trim(),
      });
      dots.appendChild(dot);
    });
  }

  let rafId = 0;
  const updateDots = () => {
    if (!dots.children.length) return;
    const index = Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
    Array.from(dots.children).forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
    });
  };

  track.addEventListener("scroll", () => {
    if (rafId) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      updateDots();
    });
  });

  track.addEventListener("click", () => {
    if (images.length <= 1) return;
    const index = Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
    const next = (index + 1) % images.length;
    track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
  });

  container.appendChild(track);
  if (images.length > 1) {
    container.appendChild(dots);
  }

  setupLazyLoad(track);
  return container;
}
