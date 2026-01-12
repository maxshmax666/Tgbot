export const PLACEHOLDER_IMAGE = "assets/placeholder.jpg";

export function applyImageFallback(img) {
  img.onerror = () => {
    img.onerror = null;
    img.src = PLACEHOLDER_IMAGE;
  };
}
