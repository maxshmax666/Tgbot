import { createElement, clearElement } from "../ui/dom.js";
import { isTelegram } from "../services/telegramService.js";

function getLocalStorageInfo() {
  const entries = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = localStorage.getItem(key) || "";
      entries.push({ key, size: value.length });
    }
  } catch (error) {
    return [{ key: "localStorage_error", size: String(error?.message || error) }];
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

async function loadHealth(target) {
  try {
    const response = await fetch("/api/health", { cache: "no-store", headers: { accept: "application/json" } });
    if (!response.ok) {
      target.textContent = `health: error (${response.status})`;
      return;
    }
    const payload = await response.json();
    const readiness = payload?.readiness || {};
    const missing = Array.isArray(payload?.missing) ? payload.missing.join(", ") : "—";
    target.textContent = `health: ok (db=${Boolean(readiness.db)}, jwt=${Boolean(
      readiness.jwtSecret
    )}, adminBootstrap=${Boolean(readiness.adminBootstrap)}), missing: ${missing}`;
  } catch (error) {
    target.textContent = `health: error (${error?.message || "unknown"})`;
  }
}

export function renderDebugPage() {
  const root = createElement("section", { className: "list" });
  const header = createElement("div", { className: "section-title", text: "Debug" });
  const buildId = createElement("div", {
    className: "helper",
    text: `build: ${window.BUILD_ID || "unknown"}`,
  });
  const telegramState = createElement("div", { className: "helper", text: `isTelegram: ${isTelegram()}` });
  const health = createElement("div", { className: "helper", text: "health: loading..." });

  const storageTitle = createElement("h3", { className: "section-title", text: "Local storage" });
  const storageList = createElement("ul", { className: "helper" });

  const storageEntries = getLocalStorageInfo();
  clearElement(storageList);
  if (!storageEntries.length) {
    storageList.appendChild(createElement("li", { text: "no entries" }));
  } else {
    storageEntries.forEach((entry) => {
      const label = typeof entry.size === "number" ? `${entry.key}: ${entry.size}b` : `${entry.key}: ${entry.size}`;
      storageList.appendChild(createElement("li", { text: label }));
    });
  }

  root.append(header, buildId, telegramState, health, storageTitle, storageList);

  loadHealth(health);

  return { element: root };
}
