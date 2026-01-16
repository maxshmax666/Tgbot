import { createElement } from "./dom.js";

const INTRO_STORAGE_KEY = "introSeen";

function getShouldShowIntro() {
  const params = new URLSearchParams(window.location.search);
  const force = params.get("intro") === "1";
  if (force) return true;
  try {
    return localStorage.getItem(INTRO_STORAGE_KEY) !== "1";
  } catch (error) {
    return true;
  }
}

function markIntroSeen() {
  try {
    localStorage.setItem(INTRO_STORAGE_KEY, "1");
  } catch (error) {
    console.warn("Intro storage write failed", error);
  }
}

function createParticles(count, width, height) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: 12 + Math.random() * 18,
    speed: 0.6 + Math.random() * 1.9,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.02,
    opacity: 0.45 + Math.random() * 0.5,
  }));
}

function getParticleCount(width, height) {
  const area = width * height;
  const base = Math.min(140, Math.max(28, Math.round(area / 18000)));
  const deviceMemory = navigator.deviceMemory || 4;
  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const multiplier = prefersReduced ? 0.45 : deviceMemory <= 2 ? 0.55 : deviceMemory <= 4 ? 0.8 : 1;
  return Math.max(18, Math.round(base * multiplier));
}

export function IntroMatrixPizzaOverlay() {
  if (!getShouldShowIntro()) return null;

  const overlay = createElement("div", { className: "intro-overlay", attrs: { role: "dialog", "aria-modal": "true" } });
  const canvas = createElement("canvas", { className: "intro-canvas", attrs: { "aria-hidden": "true" } });
  const content = createElement("div", { className: "intro-content" });
  const title = createElement("div", { className: "intro-title", text: "Тапни по центру, чтобы войти" });
  const subtitle = createElement("div", { className: "intro-subtitle", text: "ENTER" });
  const action = createElement("button", {
    className: "intro-enter",
    text: "Войти",
    attrs: { type: "button", "aria-label": "Войти в приложение" },
  });

  content.append(title, subtitle, action);
  overlay.append(canvas, content);
  document.body.appendChild(overlay);
  document.body.classList.add("intro-active");

  const ctx = canvas.getContext("2d");
  let rafId = 0;
  let width = 0;
  let height = 0;
  let particles = [];
  let running = true;

  const resize = () => {
    const ratio = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
    particles = createParticles(getParticleCount(width, height), width, height);
  };

  const draw = () => {
    if (!running) return;
    rafId = window.requestAnimationFrame(draw);
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(7, 9, 14, 0.25)";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(255, 153, 51, 0.4)";
    ctx.shadowBlur = 12;
    particles.forEach((particle) => {
      particle.y += particle.speed;
      particle.rotation += particle.rotationSpeed;
      if (particle.y - particle.size > height) {
        particle.y = -particle.size * 2;
        particle.x = Math.random() * width;
        particle.speed = 0.6 + Math.random() * 1.9;
        particle.size = 12 + Math.random() * 18;
        particle.opacity = 0.45 + Math.random() * 0.5;
      }
      ctx.save();
      ctx.globalAlpha = particle.opacity;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.font = `${particle.size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.fillText("🍕", 0, 0);
      ctx.restore();
    });
    ctx.restore();
  };

  const cleanup = () => {
    running = false;
    if (rafId) window.cancelAnimationFrame(rafId);
    window.removeEventListener("resize", resize);
    document.removeEventListener("keydown", onKeydown);
    overlay.remove();
    document.body.classList.remove("intro-active");
  };

  const dismiss = () => {
    if (!overlay.classList.contains("is-exiting")) {
      overlay.classList.add("is-exiting");
      markIntroSeen();
      window.setTimeout(cleanup, 450);
    }
  };

  const onKeydown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      dismiss();
    }
  };

  action.addEventListener("click", dismiss);
  content.addEventListener("click", dismiss);
  document.addEventListener("keydown", onKeydown);

  resize();
  draw();

  return { cleanup };
}
