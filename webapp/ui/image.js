import { resolveMediaUrl } from "../services/mediaBase.js";

export const PLACEHOLDER_IMAGE = resolveMediaUrl("/assets/pizzas/margarita/margarita_01.jpg");

export function applyImageFallback(img) {
  img.onerror = () => {
    img.onerror = null;
    img.src = PLACEHOLDER_IMAGE;
  };
}
