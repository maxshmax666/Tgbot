// webapp/admin/AdminApp.js
import React2, { useCallback, useEffect as useEffect2, useMemo, useState as useState2 } from "https://esm.sh/react@18.2.0";
import { createRoot as createRoot2 } from "https://esm.sh/react-dom@18.2.0/client";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from "https://esm.sh/@dnd-kit/core@6.1.0";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from "https://esm.sh/@dnd-kit/sortable@8.0.0";
import { CSS } from "https://esm.sh/@dnd-kit/utilities@3.2.2";

// webapp/services/adminApi.js
async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("content-type") && !(options.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  let response;
  try {
    response = await fetch(path, { ...options, headers, credentials: "include" });
  } catch (error) {
    const networkError = new Error("\u0421\u0435\u0440\u0432\u0435\u0440 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435, \u0447\u0442\u043E /api \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D.");
    networkError.status = 0;
    networkError.details = error instanceof Error ? error.message : String(error);
    throw networkError;
  }
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    const error = new Error("Admin API \u043D\u0435 \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442 JSON (\u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E, \u043D\u0435 \u0437\u0430\u0434\u0435\u043F\u043B\u043E\u0435\u043D\u044B Functions /api)");
    error.status = response.status;
    throw error;
  }
  const payload = await response.json().catch(() => null);
  if (payload == null) {
    const error = new Error("Admin API \u0432\u0435\u0440\u043D\u0443\u043B \u043F\u0443\u0441\u0442\u043E\u0439 \u043E\u0442\u0432\u0435\u0442");
    error.status = response.status;
    throw error;
  }
  if (!response.ok) {
    const message = payload?.error?.message || "Request failed";
    const details = payload?.error?.details;
    const error = new Error(message);
    error.details = details;
    error.status = response.status;
    throw error;
  }
  return payload;
}
var adminApi = {
  async login(password) {
    const data = await request("/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ password })
    });
    return data.user;
  },
  logout() {
    return request("/api/admin/auth/logout", { method: "POST" });
  },
  me() {
    return request("/api/admin/me").then((data) => data?.user ?? null);
  },
  listCategories() {
    return request("/api/admin/categories").then((data) => data.items || []);
  },
  createCategory(payload) {
    return request("/api/admin/categories", { method: "POST", body: JSON.stringify(payload) });
  },
  updateCategory(id, payload) {
    return request(`/api/admin/categories/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  deleteCategory(id) {
    return request(`/api/admin/categories/${id}`, { method: "DELETE" });
  },
  listProducts() {
    return request("/api/admin/products").then((data) => data.items || []);
  },
  createProduct(payload) {
    return request("/api/admin/products", { method: "POST", body: JSON.stringify(payload) });
  },
  updateProduct(id, payload) {
    return request(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  deleteProduct(id) {
    return request(`/api/admin/products/${id}`, { method: "DELETE" });
  },
  listOrders() {
    return request("/api/admin/orders").then((data) => data.items || []);
  },
  getOrder(id) {
    return request(`/api/admin/orders/${id}`).then((data) => data.item);
  },
  updateOrderStatus(id, status) {
    return request(`/api/admin/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
  },
  listPages() {
    return request("/api/admin/pages").then((data) => data.items || []);
  },
  createPage(payload) {
    return request("/api/admin/pages", { method: "POST", body: JSON.stringify(payload) });
  },
  updatePage(id, payload) {
    return request(`/api/admin/pages/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  deletePage(id) {
    return request(`/api/admin/pages/${id}`, { method: "DELETE" });
  },
  listPageBlocks(pageId) {
    return request(`/api/admin/page-blocks?page_id=${pageId}`).then((data) => data.items || []);
  },
  createPageBlock(payload) {
    return request("/api/admin/page-blocks", { method: "POST", body: JSON.stringify(payload) });
  },
  updatePageBlock(id, payload) {
    return request(`/api/admin/page-blocks/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  deletePageBlock(id) {
    return request(`/api/admin/page-blocks/${id}`, { method: "DELETE" });
  },
  reorderPageBlocks(pageId, orderedIds) {
    return request("/api/admin/page-blocks/reorder", {
      method: "POST",
      body: JSON.stringify({ pageId, orderedIds })
    });
  },
  uploadMedia(file) {
    const form = new FormData();
    form.append("file", file);
    return request("/api/admin/upload", { method: "POST", body: form });
  },
  listMedia() {
    return request("/api/admin/media").then((data) => data.items || []);
  },
  deleteMedia(key) {
    return request(`/api/admin/media/${encodeURIComponent(key)}`, { method: "DELETE" });
  }
};

// webapp/services/mediaBase.js
var cachedBaseUrl = null;
function normalizeBaseUrl(value) {
  if (!value) return "";
  return String(value).trim().replace(/\/+$/, "");
}
function getPublicMediaBaseUrl() {
  if (cachedBaseUrl !== null) return cachedBaseUrl;
  cachedBaseUrl = normalizeBaseUrl(globalThis.PUBLIC_MEDIA_BASE_URL);
  return cachedBaseUrl;
}
function resolveMediaUrl(url) {
  if (!url) return "";
  const raw = String(url).trim();
  if (!raw) return "";
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("blob:")) {
    return raw;
  }
  const base = getPublicMediaBaseUrl();
  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  return base ? `${base}${normalized}` : normalized;
}

// webapp/services/telegramService.js
import React, { useEffect, useState } from "https://esm.sh/react@18.2.0";
import { createPortal } from "https://esm.sh/react-dom@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
var confirmRoot = null;
var confirmContainer = null;
var confirmResolve = null;
var ensureConfirmRoot = () => {
  if (!confirmContainer) {
    confirmContainer = document.createElement("div");
    confirmContainer.id = "admin-confirm-popup-root";
    document.body.appendChild(confirmContainer);
  }
  if (!confirmRoot) {
    confirmRoot = createRoot(confirmContainer);
  }
};
var cleanupConfirmRoot = () => {
  if (confirmRoot) {
    confirmRoot.unmount();
    confirmRoot = null;
  }
  if (confirmContainer) {
    confirmContainer.remove();
    confirmContainer = null;
  }
  confirmResolve = null;
};
function ConfirmModal({
  message,
  title,
  okText,
  cancelText,
  onConfirm,
  onCancel
}) {
  const [isOpen, setIsOpen] = useState(true);
  const handleClose = (confirmed) => {
    setIsOpen(false);
    if (confirmed) {
      onConfirm();
    } else {
      onCancel();
    }
  };
  useEffect(() => {
    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        handleClose(false);
      }
      if (event.key === "Enter") {
        handleClose(true);
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, []);
  if (!isOpen) return null;
  return createPortal(
    /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" }, /* @__PURE__ */ React.createElement("div", { className: "w-full max-w-md rounded-xl bg-slate-900 p-6 text-slate-100 shadow-xl space-y-4" }, /* @__PURE__ */ React.createElement("div", { className: "space-y-2" }, /* @__PURE__ */ React.createElement("h3", { className: "text-lg font-semibold" }, title), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-300 whitespace-pre-line" }, message)), /* @__PURE__ */ React.createElement("div", { className: "flex justify-end gap-3" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "px-4 py-2 rounded-md text-sm font-medium transition bg-slate-700 hover:bg-slate-600 text-white",
        onClick: () => handleClose(false)
      },
      cancelText
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "px-4 py-2 rounded-md text-sm font-medium transition bg-rose-500 hover:bg-rose-600 text-white",
        onClick: () => handleClose(true)
      },
      okText
    )))),
    document.body
  );
}
var getWebApp = () => window.Telegram?.WebApp || null;
function confirmPopup({
  message,
  title = "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435",
  okText = "OK",
  cancelText = "Cancel"
} = {}) {
  const webApp = getWebApp();
  if (webApp?.showPopup) {
    return new Promise((resolve) => {
      webApp.showPopup(
        {
          title,
          message: message || "",
          buttons: [
            { id: "cancel", type: "cancel", text: cancelText },
            { id: "ok", type: "ok", text: okText }
          ]
        },
        (buttonId) => resolve(buttonId === "ok")
      );
    });
  }
  return new Promise((resolve) => {
    if (!document?.body) {
      resolve(false);
      return;
    }
    if (confirmResolve) {
      confirmResolve(false);
      cleanupConfirmRoot();
    }
    ensureConfirmRoot();
    confirmResolve = resolve;
    const handleResolve = (confirmed) => {
      resolve(confirmed);
      cleanupConfirmRoot();
    };
    confirmRoot.render(
      /* @__PURE__ */ React.createElement(
        ConfirmModal,
        {
          title,
          message: message || "",
          okText,
          cancelText,
          onConfirm: () => handleResolve(true),
          onCancel: () => handleResolve(false)
        }
      )
    );
  });
}

// webapp/admin/AdminApp.js
var RU = {
  nav: {
    dashboard: "\u041E\u0431\u0437\u043E\u0440",
    products: "\u0422\u043E\u0432\u0430\u0440\u044B",
    categories: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438",
    orders: "\u0417\u0430\u043A\u0430\u0437\u044B",
    media: "\u041C\u0435\u0434\u0438\u0430",
    pages: "\u0421\u0442\u0440\u0430\u043D\u0438\u0446\u044B"
  },
  blocks: {
    hero: "\u041F\u0435\u0440\u0432\u044B\u0439 \u044D\u043A\u0440\u0430\u043D",
    banner: "\u0411\u0430\u043D\u043D\u0435\u0440",
    text: "\u0422\u0435\u043A\u0441\u0442",
    gallery: "\u0413\u0430\u043B\u0435\u0440\u0435\u044F",
    productsGrid: "\u0421\u0435\u0442\u043A\u0430 \u0442\u043E\u0432\u0430\u0440\u043E\u0432"
  },
  buttons: {
    retry: "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C",
    signIn: "\u0412\u043E\u0439\u0442\u0438",
    signingIn: "\u0412\u0445\u043E\u0434\u0438\u043C\u2026",
    create: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C",
    save: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C",
    delete: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
    edit: "\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
    upload: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C",
    use: "\u0412\u044B\u0431\u0440\u0430\u0442\u044C",
    close: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C",
    addUrl: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C URL",
    remove: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
    reset: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C",
    logout: "\u0412\u044B\u0439\u0442\u0438",
    viewPublicPage: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u0443\u0431\u043B\u0438\u0447\u043D\u0443\u044E \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443"
  },
  labels: {
    password: "\u041F\u0430\u0440\u043E\u043B\u044C",
    title: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435",
    sort: "\u0421\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u043A\u0430",
    active: "\u0410\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u044C",
    statusActive: "\u0410\u043A\u0442\u0438\u0432\u0435\u043D",
    statusInactive: "\u041D\u0435\u0430\u043A\u0442\u0438\u0432\u0435\u043D",
    yes: "\u0414\u0430",
    no: "\u041D\u0435\u0442",
    description: "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435",
    price: "\u0426\u0435\u043D\u0430",
    category: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F",
    featured: "\u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u043C\u044B\u0439",
    images: "\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F",
    imagesComma: "\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F (URL \u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043F\u044F\u0442\u0443\u044E)",
    content: "\u041A\u043E\u043D\u0442\u0435\u043D\u0442",
    buttonLabel: "\u0422\u0435\u043A\u0441\u0442 \u043A\u043D\u043E\u043F\u043A\u0438",
    buttonLink: "\u0421\u0441\u044B\u043B\u043A\u0430 \u043A\u043D\u043E\u043F\u043A\u0438",
    subtitle: "\u041F\u043E\u0434\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A",
    text: "\u0422\u0435\u043A\u0441\u0442",
    slug: "Slug"
  },
  headings: {
    adminLogin: "\u0412\u0445\u043E\u0434 \u0432 \u0430\u0434\u043C\u0438\u043D\u043A\u0443",
    newCategory: "\u041D\u043E\u0432\u0430\u044F \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F",
    categories: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438",
    mediaLibrary: "\u041C\u0435\u0434\u0438\u0430\u0442\u0435\u043A\u0430",
    productEditor: "\u0420\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u0442\u043E\u0432\u0430\u0440\u0430",
    products: "\u0422\u043E\u0432\u0430\u0440\u044B",
    orders: "\u0417\u0430\u043A\u0430\u0437\u044B",
    orderDetails: "\u0417\u0430\u043A\u0430\u0437",
    newPage: "\u041D\u043E\u0432\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430",
    pages: "\u0421\u0442\u0440\u0430\u043D\u0438\u0446\u044B",
    pageBuilder: "\u041A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B",
    dashboard: "\u0414\u043E\u0431\u0440\u043E \u043F\u043E\u0436\u0430\u043B\u043E\u0432\u0430\u0442\u044C",
    adminPanel: "\u0410\u0434\u043C\u0438\u043D-\u043F\u0430\u043D\u0435\u043B\u044C",
    blocks: "\u0411\u043B\u043E\u043A\u0438",
    canvas: "\u041F\u043E\u043B\u043E\u0442\u043D\u043E",
    properties: "\u0421\u0432\u043E\u0439\u0441\u0442\u0432\u0430"
  },
  messages: {
    adminLoginHint: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043F\u0430\u0440\u043E\u043B\u044C \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430.",
    adminPasswordInfoPrefix: "\u041F\u0430\u0440\u043E\u043B\u044C \u0437\u0430\u0434\u0430\u0451\u0442\u0441\u044F \u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u043C\u0438 \u043E\u043A\u0440\u0443\u0436\u0435\u043D\u0438\u044F",
    adminPasswordInfoSuffix: "(\u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E). \u041C\u0438\u043D\u0438\u043C\u0443\u043C 6 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.",
    envCheckFailed: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0435 \u043E\u043A\u0440\u0443\u0436\u0435\u043D\u0438\u044F.",
    missingEnv: "\u041D\u0435 \u0437\u0430\u0434\u0430\u043D\u044B \u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0435 \u043E\u043A\u0440\u0443\u0436\u0435\u043D\u0438\u044F:",
    envNotConfiguredPrefix: "ENV \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u044B",
    loginFailed: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u043E\u0439\u0442\u0438.",
    loginErrorFallback: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u043E\u0432\u0430\u0442\u044C\u0441\u044F. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043F\u0430\u0440\u043E\u043B\u044C \u0438 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 API.",
    healthCheckFailed: (status) => `\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043A\u043E\u043D\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u0438 \u043D\u0435 \u0443\u0434\u0430\u043B\u0430\u0441\u044C (${status}).`,
    loading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026",
    loadingAdminConfig: "\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C \u043A\u043E\u043D\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u044E \u0430\u0434\u043C\u0438\u043D\u043A\u0438\u2026",
    loadingAdminAccess: "\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C \u0434\u043E\u0441\u0442\u0443\u043F \u043A \u0430\u0434\u043C\u0438\u043D\u043A\u0435\u2026",
    errorLoadingAdmin: "\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0430\u0434\u043C\u0438\u043D\u043A\u0438",
    errorLoadingUi: "\u041F\u0440\u043E\u0438\u0437\u043E\u0448\u043B\u0430 \u043E\u0448\u0438\u0431\u043A\u0430 \u0432 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0435 \u0430\u0434\u043C\u0438\u043D\u043A\u0438. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043A\u043E\u043D\u0441\u043E\u043B\u044C \u0438 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043E\u043A\u0440\u0443\u0436\u0435\u043D\u0438\u044F.",
    unknownError: "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430",
    adminApiUnavailable: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C\u0441\u044F \u043A \u0430\u0434\u043C\u0438\u043D API. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0435 \u043E\u043A\u0440\u0443\u0436\u0435\u043D\u0438\u044F \u0438 \u043B\u043E\u0433\u0438 \u0431\u0438\u043B\u0434\u0430.",
    selectOrder: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0437\u0430\u043A\u0430\u0437, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u0434\u0435\u0442\u0430\u043B\u0438.",
    selectBlock: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0431\u043B\u043E\u043A \u0434\u043B\u044F \u0440\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F.",
    useSidebar: "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u043C\u0435\u043D\u044E \u0441\u043B\u0435\u0432\u0430, \u0447\u0442\u043E\u0431\u044B \u0443\u043F\u0440\u0430\u0432\u043B\u044F\u0442\u044C \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u043E\u043C, \u0437\u0430\u043A\u0430\u0437\u0430\u043C\u0438, \u043C\u0435\u0434\u0438\u0430 \u0438 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430\u043C\u0438.",
    noCategory: "\u0411\u0435\u0437 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438",
    imageUrlPrompt: "URL \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F",
    visible: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C"
  },
  confirm: {
    deleteCategory: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044E?",
    deleteProduct: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0442\u043E\u0432\u0430\u0440?",
    deleteFile: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0444\u0430\u0439\u043B?",
    deleteBlock: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0431\u043B\u043E\u043A?",
    deletePage: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443?"
  },
  validation: {
    passwordMin: (min) => `\u041F\u0430\u0440\u043E\u043B\u044C \u043C\u0438\u043D\u0438\u043C\u0443\u043C ${min} \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432`,
    passwordRequired: "\u041F\u0430\u0440\u043E\u043B\u044C \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u0435\u043D",
    invalidValue: "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435"
  },
  orderStatus: {
    new: "\u041D\u043E\u0432\u044B\u0439",
    preparing: "\u0413\u043E\u0442\u043E\u0432\u0438\u0442\u0441\u044F",
    delivering: "\u0414\u043E\u0441\u0442\u0430\u0432\u043A\u0430",
    done: "\u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D"
  }
};
var BLOCK_TYPES = [
  { type: "hero", label: RU.blocks.hero, defaultProps: { title: "", subtitle: "", buttonLabel: "", buttonLink: "" } },
  { type: "banner", label: RU.blocks.banner, defaultProps: { text: "" } },
  { type: "text", label: RU.blocks.text, defaultProps: { text: "" } },
  { type: "gallery", label: RU.blocks.gallery, defaultProps: { title: "", images: [] } },
  { type: "products-grid", label: RU.blocks.productsGrid, defaultProps: { title: "", items: [] } }
];
var navItems = [
  { id: "dashboard", label: RU.nav.dashboard },
  { id: "products", label: RU.nav.products },
  { id: "categories", label: RU.nav.categories },
  { id: "orders", label: RU.nav.orders },
  { id: "media", label: RU.nav.media },
  { id: "pages", label: RU.nav.pages }
];
function Button({ children, variant = "primary", ...props }) {
  const base = "px-4 py-2 rounded-md text-sm font-medium transition";
  const styles = {
    primary: "bg-indigo-500 hover:bg-indigo-600 text-white",
    secondary: "bg-slate-700 hover:bg-slate-600 text-white",
    ghost: "bg-transparent hover:bg-slate-800 text-slate-200",
    danger: "bg-rose-500 hover:bg-rose-600 text-white"
  };
  return /* @__PURE__ */ React2.createElement("button", { className: `${base} ${styles[variant]}`, ...props });
}
function Field({ label, children }) {
  return /* @__PURE__ */ React2.createElement("label", { className: "flex flex-col gap-2 text-sm text-slate-200" }, /* @__PURE__ */ React2.createElement("span", { className: "text-slate-400" }, label), children);
}
function Input(props) {
  return /* @__PURE__ */ React2.createElement(
    "input",
    {
      className: "rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500",
      ...props
    }
  );
}
function Textarea(props) {
  return /* @__PURE__ */ React2.createElement(
    "textarea",
    {
      className: "rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500",
      ...props
    }
  );
}
function Select(props) {
  return /* @__PURE__ */ React2.createElement(
    "select",
    {
      className: "rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500",
      ...props
    }
  );
}
var ErrorBoundary = class extends React2.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return /* @__PURE__ */ React2.createElement("div", { className: "min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6" }, /* @__PURE__ */ React2.createElement("div", { className: "bg-slate-900 rounded-xl p-6 max-w-lg w-full space-y-3" }, /* @__PURE__ */ React2.createElement("h2", { className: "text-lg font-semibold" }, RU.messages.errorLoadingAdmin), /* @__PURE__ */ React2.createElement("p", { className: "text-sm text-slate-400" }, RU.messages.errorLoadingUi), /* @__PURE__ */ React2.createElement("pre", { className: "text-xs text-rose-300 whitespace-pre-wrap break-words" }, this.state.error?.message || RU.messages.unknownError)));
    }
    return this.props.children;
  }
};
function LoadingScreen({ label = RU.messages.loading }) {
  return /* @__PURE__ */ React2.createElement("div", { className: "min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6" }, /* @__PURE__ */ React2.createElement("div", { className: "bg-slate-900 rounded-xl p-6 w-full max-w-md text-center space-y-3" }, /* @__PURE__ */ React2.createElement("div", { className: "h-10 w-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" }), /* @__PURE__ */ React2.createElement("p", { className: "text-sm text-slate-400" }, label)));
}
function ErrorState({ title, message, details, onRetry }) {
  return /* @__PURE__ */ React2.createElement("div", { className: "min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6" }, /* @__PURE__ */ React2.createElement("div", { className: "bg-slate-900 rounded-xl p-6 w-full max-w-lg space-y-3" }, /* @__PURE__ */ React2.createElement("h2", { className: "text-lg font-semibold" }, title), /* @__PURE__ */ React2.createElement("p", { className: "text-sm text-slate-400" }, message), details && /* @__PURE__ */ React2.createElement("pre", { className: "text-xs text-rose-300 whitespace-pre-wrap break-words" }, details), onRetry && /* @__PURE__ */ React2.createElement(Button, { onClick: onRetry }, RU.buttons.retry)));
}
function formatZodIssues(details) {
  if (!Array.isArray(details)) return null;
  const lines = details.map((issue) => {
    if (!issue || typeof issue !== "object") return null;
    const path = Array.isArray(issue.path) ? issue.path.join(".") : "";
    if (path === "password" && issue.code === "too_small" && typeof issue.minimum === "number") {
      return RU.validation.passwordMin(issue.minimum);
    }
    if (path === "password" && issue.code === "invalid_type") {
      return RU.validation.passwordRequired;
    }
    if (issue.message) return path ? `${path}: ${issue.message}` : issue.message;
    return path ? `${path}: ${RU.validation.invalidValue}` : RU.validation.invalidValue;
  }).filter(Boolean);
  return lines.length ? lines.join("\n") : null;
}
function Login({ onLogin, onNavigate }) {
  const [password, setPassword] = useState2("");
  const [error, setError] = useState2("");
  const [loading, setLoading] = useState2(false);
  const [healthStatus, setHealthStatus] = useState2("loading");
  const [missingEnv, setMissingEnv] = useState2([]);
  const [healthError, setHealthError] = useState2("");
  useEffect2(() => {
    let isActive = true;
    const controller = new AbortController();
    const loadHealth = async () => {
      try {
        const response = await fetch("/api/health", {
          signal: controller.signal,
          headers: { accept: "application/json" }
        });
        if (!response.ok) {
          throw new Error(RU.messages.healthCheckFailed(response.status));
        }
        const payload = await response.json();
        const missing = Array.isArray(payload?.missing) ? payload.missing.filter((item) => typeof item === "string") : [];
        if (isActive) {
          setMissingEnv(missing);
          setHealthStatus("ready");
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        if (isActive) {
          setHealthError(err?.message || RU.messages.envCheckFailed);
          setHealthStatus("error");
        }
      }
    };
    loadHealth();
    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await onLogin(password);
      if (onNavigate) {
        onNavigate("/admin");
      }
      return user;
    } catch (err) {
      const zodMessage = formatZodIssues(err?.details);
      const envMessage = err?.status === 500 && typeof err?.message === "string" && err.message.startsWith(RU.messages.envNotConfiguredPrefix);
      const fallbackMessage = err?.message || RU.messages.loginFailed;
      setError(envMessage ? err.message : zodMessage || fallbackMessage);
    } finally {
      setLoading(false);
    }
  };
  if (healthStatus === "loading") {
    return /* @__PURE__ */ React2.createElement(LoadingScreen, { label: RU.messages.loadingAdminConfig });
  }
  return /* @__PURE__ */ React2.createElement("div", { className: "min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6" }, /* @__PURE__ */ React2.createElement("form", { onSubmit: handleSubmit, className: "bg-slate-900 p-8 rounded-xl shadow-xl w-full max-w-md flex flex-col gap-4" }, /* @__PURE__ */ React2.createElement("h1", { className: "text-xl font-semibold" }, RU.headings.adminLogin), /* @__PURE__ */ React2.createElement("p", { className: "text-sm text-slate-400" }, RU.messages.adminLoginHint), /* @__PURE__ */ React2.createElement("p", { className: "text-xs text-slate-500" }, RU.messages.adminPasswordInfoPrefix, " ", /* @__PURE__ */ React2.createElement("code", { className: "text-slate-300" }, "ADMIN_PASSWORD_HASH"), " \u0438\u043B\u0438", " ", /* @__PURE__ */ React2.createElement("code", { className: "text-slate-300" }, "ADMIN_PASSWORD"), " ", RU.messages.adminPasswordInfoSuffix), healthStatus === "error" && /* @__PURE__ */ React2.createElement("p", { className: "text-amber-400 text-xs whitespace-pre-line" }, RU.messages.envCheckFailed, " ", healthError), missingEnv.length > 0 && /* @__PURE__ */ React2.createElement("div", { className: "rounded-md border border-amber-700 bg-amber-950/60 p-3 text-sm text-amber-200" }, /* @__PURE__ */ React2.createElement("p", { className: "font-medium" }, RU.messages.missingEnv), /* @__PURE__ */ React2.createElement("ul", { className: "list-disc list-inside text-xs text-amber-100 mt-2" }, missingEnv.map((name) => /* @__PURE__ */ React2.createElement("li", { key: name }, /* @__PURE__ */ React2.createElement("code", null, name))))), /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.password }, /* @__PURE__ */ React2.createElement(Input, { type: "password", value: password, onChange: (e) => setPassword(e.target.value), required: true })), error && /* @__PURE__ */ React2.createElement("p", { className: "text-rose-400 text-sm whitespace-pre-line" }, error), /* @__PURE__ */ React2.createElement(Button, { type: "submit", disabled: loading }, loading ? RU.buttons.signingIn : RU.buttons.signIn)));
}
function CategoriesView() {
  const [items, setItems] = useState2([]);
  const [title, setTitle] = useState2("");
  const [sort, setSort] = useState2(0);
  const [isActive, setIsActive] = useState2(true);
  const load = async () => {
    const data = await adminApi.listCategories();
    setItems(data);
  };
  useEffect2(() => {
    load();
  }, []);
  const handleCreate = async () => {
    await adminApi.createCategory({ title, sort: Number(sort), isActive });
    setTitle("");
    setSort(0);
    setIsActive(true);
    await load();
  };
  const handleUpdate = async (item) => {
    await adminApi.updateCategory(item.id, {
      title: item.title,
      sort: Number(item.sort),
      isActive: item.is_active === 1
    });
    await load();
  };
  const handleDelete = async (id) => {
    const confirmed = await confirmPopup({ message: RU.confirm.deleteCategory });
    if (!confirmed) return;
    await adminApi.deleteCategory(id);
    await load();
  };
  return /* @__PURE__ */ React2.createElement("div", { className: "space-y-6" }, /* @__PURE__ */ React2.createElement("div", { className: "bg-slate-900 rounded-xl p-6 space-y-4" }, /* @__PURE__ */ React2.createElement("h2", { className: "text-lg font-semibold" }, RU.headings.newCategory), /* @__PURE__ */ React2.createElement("div", { className: "grid md:grid-cols-3 gap-4" }, /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.title }, /* @__PURE__ */ React2.createElement(Input, { value: title, onChange: (e) => setTitle(e.target.value) })), /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.sort }, /* @__PURE__ */ React2.createElement(Input, { type: "number", value: sort, onChange: (e) => setSort(e.target.value) })), /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.active }, /* @__PURE__ */ React2.createElement(Select, { value: isActive ? "yes" : "no", onChange: (e) => setIsActive(e.target.value === "yes") }, /* @__PURE__ */ React2.createElement("option", { value: "yes" }, RU.labels.statusActive), /* @__PURE__ */ React2.createElement("option", { value: "no" }, RU.labels.statusInactive)))), /* @__PURE__ */ React2.createElement(Button, { onClick: handleCreate, disabled: !title.trim() }, RU.buttons.create)), /* @__PURE__ */ React2.createElement("div", { className: "bg-slate-900 rounded-xl p-6" }, /* @__PURE__ */ React2.createElement("h2", { className: "text-lg font-semibold mb-4" }, RU.headings.categories), /* @__PURE__ */ React2.createElement("div", { className: "space-y-3" }, items.map((item) => /* @__PURE__ */ React2.createElement("div", { key: item.id, className: "grid md:grid-cols-4 gap-3 items-center border border-slate-800 rounded-lg p-3" }, /* @__PURE__ */ React2.createElement(
    Input,
    {
      value: item.title,
      onChange: (e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, title: e.target.value } : row))
    }
  ), /* @__PURE__ */ React2.createElement(
    Input,
    {
      type: "number",
      value: item.sort,
      onChange: (e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, sort: e.target.value } : row))
    }
  ), /* @__PURE__ */ React2.createElement(
    Select,
    {
      value: item.is_active ? "yes" : "no",
      onChange: (e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, is_active: e.target.value === "yes" ? 1 : 0 } : row))
    },
    /* @__PURE__ */ React2.createElement("option", { value: "yes" }, RU.labels.statusActive),
    /* @__PURE__ */ React2.createElement("option", { value: "no" }, RU.labels.statusInactive)
  ), /* @__PURE__ */ React2.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React2.createElement(Button, { variant: "secondary", onClick: () => handleUpdate(item) }, RU.buttons.save), /* @__PURE__ */ React2.createElement(Button, { variant: "danger", onClick: () => handleDelete(item.id) }, RU.buttons.delete)))))));
}
function MediaLibrary({ onSelect, onClose }) {
  const [items, setItems] = useState2([]);
  const [file, setFile] = useState2(null);
  const load = async () => {
    const data = await adminApi.listMedia();
    setItems(data);
  };
  useEffect2(() => {
    load();
  }, []);
  const handleUpload = async () => {
    if (!file) return;
    await adminApi.uploadMedia(file);
    setFile(null);
    await load();
  };
  const handleDelete = async (key) => {
    const confirmed = await confirmPopup({ message: RU.confirm.deleteFile });
    if (!confirmed) return;
    await adminApi.deleteMedia(key);
    await load();
  };
  return /* @__PURE__ */ React2.createElement("div", { className: "fixed inset-0 bg-black/70 flex items-center justify-center z-50" }, /* @__PURE__ */ React2.createElement("div", { className: "bg-slate-900 rounded-xl p-6 w-full max-w-4xl space-y-4" }, /* @__PURE__ */ React2.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React2.createElement("h3", { className: "text-lg font-semibold" }, RU.headings.mediaLibrary), /* @__PURE__ */ React2.createElement(Button, { variant: "ghost", onClick: onClose }, RU.buttons.close)), /* @__PURE__ */ React2.createElement("div", { className: "flex gap-3 items-center" }, /* @__PURE__ */ React2.createElement("input", { type: "file", onChange: (e) => setFile(e.target.files?.[0] || null) }), /* @__PURE__ */ React2.createElement(Button, { onClick: handleUpload, disabled: !file }, RU.buttons.upload)), /* @__PURE__ */ React2.createElement("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[400px] overflow-auto" }, items.map((item) => /* @__PURE__ */ React2.createElement("div", { key: item.key, className: "border border-slate-800 rounded-lg p-2 space-y-2" }, /* @__PURE__ */ React2.createElement(
    "img",
    {
      src: resolveMediaUrl(item.url),
      alt: item.meta?.name || item.key,
      className: "w-full h-28 object-cover rounded-md"
    }
  ), /* @__PURE__ */ React2.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React2.createElement(Button, { variant: "secondary", onClick: () => onSelect(item.url) }, RU.buttons.use), /* @__PURE__ */ React2.createElement(Button, { variant: "danger", onClick: () => handleDelete(item.key) }, RU.buttons.delete)))))));
}
function ProductsView() {
  const [products, setProducts] = useState2([]);
  const [categories, setCategories] = useState2([]);
  const [form, setForm] = useState2({
    id: null,
    title: "",
    description: "",
    price: 0,
    categoryId: "",
    isActive: true,
    isFeatured: false,
    sort: 0,
    images: []
  });
  const [mediaOpen, setMediaOpen] = useState2(false);
  const load = async () => {
    const [productsData, categoriesData] = await Promise.all([
      adminApi.listProducts(),
      adminApi.listCategories()
    ]);
    setProducts(productsData);
    setCategories(categoriesData);
  };
  useEffect2(() => {
    load();
  }, []);
  const resetForm = () => {
    setForm({ id: null, title: "", description: "", price: 0, categoryId: "", isActive: true, isFeatured: false, sort: 0, images: [] });
  };
  const handleSubmit = async () => {
    const payload = {
      title: form.title,
      description: form.description,
      price: Number(form.price),
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      sort: Number(form.sort),
      images: form.images.map((url, index) => ({ url, sort: index }))
    };
    if (form.id) {
      await adminApi.updateProduct(form.id, payload);
    } else {
      await adminApi.createProduct(payload);
    }
    resetForm();
    await load();
  };
  const handleEdit = (product) => {
    setForm({
      id: product.id,
      title: product.title,
      description: product.description || "",
      price: product.price,
      categoryId: product.category_id || "",
      isActive: product.is_active === 1,
      isFeatured: product.is_featured === 1,
      sort: product.sort,
      images: product.images?.map((img) => img.url) || []
    });
  };
  const handleDelete = async (id) => {
    const confirmed = await confirmPopup({ message: RU.confirm.deleteProduct });
    if (!confirmed) return;
    await adminApi.deleteProduct(id);
    await load();
  };
  const addImage = (url) => {
    if (!url) return;
    setForm((prev) => ({ ...prev, images: [...prev.images, url] }));
  };
  const removeImage = (index) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };
  return /* @__PURE__ */ React2.createElement("div", { className: "space-y-6" }, /* @__PURE__ */ React2.createElement("div", { className: "bg-slate-900 rounded-xl p-6 space-y-4" }, /* @__PURE__ */ React2.createElement("h2", { className: "text-lg font-semibold" }, RU.headings.productEditor), /* @__PURE__ */ React2.createElement("div", { className: "grid md:grid-cols-2 gap-4" }, /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.title }, /* @__PURE__ */ React2.createElement(Input, { value: form.title, onChange: (e) => setForm((prev) => ({ ...prev, title: e.target.value })) })), /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.price }, /* @__PURE__ */ React2.createElement(Input, { type: "number", value: form.price, onChange: (e) => setForm((prev) => ({ ...prev, price: e.target.value })) })), /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.category }, /* @__PURE__ */ React2.createElement(Select, { value: form.categoryId, onChange: (e) => setForm((prev) => ({ ...prev, categoryId: e.target.value })) }, /* @__PURE__ */ React2.createElement("option", { value: "" }, RU.messages.noCategory), categories.map((cat) => /* @__PURE__ */ React2.createElement("option", { key: cat.id, value: cat.id }, cat.title)))), /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.sort }, /* @__PURE__ */ React2.createElement(Input, { type: "number", value: form.sort, onChange: (e) => setForm((prev) => ({ ...prev, sort: e.target.value })) })), /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.active }, /* @__PURE__ */ React2.createElement(Select, { value: form.isActive ? "yes" : "no", onChange: (e) => setForm((prev) => ({ ...prev, isActive: e.target.value === "yes" })) }, /* @__PURE__ */ React2.createElement("option", { value: "yes" }, RU.labels.statusActive), /* @__PURE__ */ React2.createElement("option", { value: "no" }, RU.labels.statusInactive))), /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.featured }, /* @__PURE__ */ React2.createElement(Select, { value: form.isFeatured ? "yes" : "no", onChange: (e) => setForm((prev) => ({ ...prev, isFeatured: e.target.value === "yes" })) }, /* @__PURE__ */ React2.createElement("option", { value: "yes" }, RU.labels.yes), /* @__PURE__ */ React2.createElement("option", { value: "no" }, RU.labels.no)))), /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.description }, /* @__PURE__ */ React2.createElement(Textarea, { rows: 4, value: form.description, onChange: (e) => setForm((prev) => ({ ...prev, description: e.target.value })) })), /* @__PURE__ */ React2.createElement("div", { className: "space-y-2" }, /* @__PURE__ */ React2.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React2.createElement("span", { className: "text-slate-400 text-sm" }, RU.labels.images), /* @__PURE__ */ React2.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React2.createElement(Button, { variant: "secondary", onClick: () => setMediaOpen(true) }, RU.headings.mediaLibrary), /* @__PURE__ */ React2.createElement(Button, { variant: "secondary", onClick: () => addImage(window.prompt(RU.messages.imageUrlPrompt) || "") }, RU.buttons.addUrl))), /* @__PURE__ */ React2.createElement("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-3" }, form.images.map((url, index) => /* @__PURE__ */ React2.createElement("div", { key: `${url}-${index}`, className: "border border-slate-800 rounded-lg p-2 space-y-2" }, /* @__PURE__ */ React2.createElement("img", { src: resolveMediaUrl(url), alt: "", className: "w-full h-24 object-cover rounded-md" }), /* @__PURE__ */ React2.createElement(Button, { variant: "danger", onClick: () => removeImage(index) }, RU.buttons.remove))))), /* @__PURE__ */ React2.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React2.createElement(Button, { onClick: handleSubmit, disabled: !form.title.trim() }, RU.buttons.save), /* @__PURE__ */ React2.createElement(Button, { variant: "ghost", onClick: resetForm }, RU.buttons.reset))), /* @__PURE__ */ React2.createElement("div", { className: "bg-slate-900 rounded-xl p-6" }, /* @__PURE__ */ React2.createElement("h2", { className: "text-lg font-semibold mb-4" }, RU.headings.products), /* @__PURE__ */ React2.createElement("div", { className: "space-y-3" }, products.map((product) => /* @__PURE__ */ React2.createElement("div", { key: product.id, className: "border border-slate-800 rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3" }, /* @__PURE__ */ React2.createElement("div", null, /* @__PURE__ */ React2.createElement("div", { className: "font-medium" }, product.title), /* @__PURE__ */ React2.createElement("div", { className: "text-sm text-slate-400" }, product.price, " \u20BD")), /* @__PURE__ */ React2.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React2.createElement(Button, { variant: "secondary", onClick: () => handleEdit(product) }, RU.buttons.edit), /* @__PURE__ */ React2.createElement(Button, { variant: "danger", onClick: () => handleDelete(product.id) }, RU.buttons.delete)))))), mediaOpen && /* @__PURE__ */ React2.createElement(
    MediaLibrary,
    {
      onSelect: (url) => {
        addImage(url);
        setMediaOpen(false);
      },
      onClose: () => setMediaOpen(false)
    }
  ));
}
function OrdersView() {
  const [orders, setOrders] = useState2([]);
  const [selected, setSelected] = useState2(null);
  const getStatusLabel = (status) => RU.orderStatus[status] || status;
  const load = async () => {
    const data = await adminApi.listOrders();
    setOrders(data);
  };
  useEffect2(() => {
    load();
  }, []);
  const handleSelect = async (order) => {
    const data = await adminApi.getOrder(order.id);
    setSelected(data);
  };
  const updateStatus = async (status) => {
    if (!selected) return;
    await adminApi.updateOrderStatus(selected.id, status);
    await load();
    const refreshed = await adminApi.getOrder(selected.id);
    setSelected(refreshed);
  };
  return /* @__PURE__ */ React2.createElement("div", { className: "grid lg:grid-cols-3 gap-6" }, /* @__PURE__ */ React2.createElement("div", { className: "bg-slate-900 rounded-xl p-6 space-y-3" }, /* @__PURE__ */ React2.createElement("h2", { className: "text-lg font-semibold" }, RU.headings.orders), orders.map((order) => /* @__PURE__ */ React2.createElement(
    "button",
    {
      key: order.id,
      className: `w-full text-left border border-slate-800 rounded-lg p-3 ${selected?.id === order.id ? "bg-slate-800" : ""}`,
      onClick: () => handleSelect(order)
    },
    /* @__PURE__ */ React2.createElement("div", { className: "font-medium" }, "#", order.id, " \u2022 ", order.customer_name),
    /* @__PURE__ */ React2.createElement("div", { className: "text-sm text-slate-400" }, getStatusLabel(order.status), " \u2022 ", order.total, " \u20BD")
  ))), /* @__PURE__ */ React2.createElement("div", { className: "bg-slate-900 rounded-xl p-6 lg:col-span-2" }, !selected ? /* @__PURE__ */ React2.createElement("p", { className: "text-slate-400" }, RU.messages.selectOrder) : /* @__PURE__ */ React2.createElement("div", { className: "space-y-4" }, /* @__PURE__ */ React2.createElement("div", null, /* @__PURE__ */ React2.createElement("h3", { className: "text-lg font-semibold" }, RU.headings.orderDetails, " #", selected.id), /* @__PURE__ */ React2.createElement("p", { className: "text-sm text-slate-400" }, selected.customer_name, " \u2022 ", selected.phone), /* @__PURE__ */ React2.createElement("p", { className: "text-sm text-slate-400" }, selected.address)), /* @__PURE__ */ React2.createElement("div", { className: "space-y-2" }, selected.items?.map((item, index) => /* @__PURE__ */ React2.createElement("div", { key: `${item.id}-${index}`, className: "flex justify-between text-sm" }, /* @__PURE__ */ React2.createElement("span", null, item.title, " \xD7 ", item.qty), /* @__PURE__ */ React2.createElement("span", null, item.price, " \u20BD")))), /* @__PURE__ */ React2.createElement("div", { className: "flex gap-2 flex-wrap" }, ["new", "preparing", "delivering", "done"].map((status) => /* @__PURE__ */ React2.createElement(Button, { key: status, variant: selected.status === status ? "secondary" : "ghost", onClick: () => updateStatus(status) }, getStatusLabel(status)))))));
}
function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  return /* @__PURE__ */ React2.createElement("div", { ref: setNodeRef, style, ...attributes, ...listeners }, children);
}
function ProductsGridEditor({ block, products, onChange }) {
  const items = Array.isArray(block.props.items) ? block.props.items : products.map((product) => ({ id: product.id, visible: true }));
  const sensors = useSensors(useSensor(PointerSensor));
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    onChange({ ...block.props, items: reordered });
  };
  const toggleVisibility = (id) => {
    const updated = items.map((item) => item.id === id ? { ...item, visible: !item.visible } : item);
    onChange({ ...block.props, items: updated });
  };
  const productMap = new Map(products.map((product) => [product.id, product]));
  return /* @__PURE__ */ React2.createElement("div", { className: "space-y-3" }, /* @__PURE__ */ React2.createElement(DndContext, { sensors, collisionDetection: closestCenter, onDragEnd: handleDragEnd }, /* @__PURE__ */ React2.createElement(SortableContext, { items: items.map((item) => item.id), strategy: verticalListSortingStrategy }, /* @__PURE__ */ React2.createElement("div", { className: "space-y-2" }, items.map((item) => {
    const product = productMap.get(item.id);
    if (!product) return null;
    return /* @__PURE__ */ React2.createElement(SortableItem, { key: item.id, id: item.id }, /* @__PURE__ */ React2.createElement("div", { className: "flex items-center justify-between border border-slate-800 rounded-lg p-2" }, /* @__PURE__ */ React2.createElement("span", { className: "text-sm" }, product.title), /* @__PURE__ */ React2.createElement("label", { className: "flex items-center gap-2 text-sm" }, /* @__PURE__ */ React2.createElement(
      "input",
      {
        type: "checkbox",
        checked: item.visible !== false,
        onChange: () => toggleVisibility(item.id)
      }
    ), RU.messages.visible)));
  })))));
}
function PageBuilder({ page, onRefresh }) {
  const [blocks, setBlocks] = useState2([]);
  const [selected, setSelected] = useState2(null);
  const [products, setProducts] = useState2([]);
  const getBlockLabel = (type) => BLOCK_TYPES.find((item) => item.type === type)?.label || type;
  const sensors = useSensors(useSensor(PointerSensor));
  useEffect2(() => {
    adminApi.listPageBlocks(page.id).then((items) => {
      setBlocks(items);
      setSelected(items[0] || null);
    });
    adminApi.listProducts().then(setProducts);
  }, [page.id]);
  const handleAddBlock = async (blockType) => {
    const definition = BLOCK_TYPES.find((item) => item.type === blockType);
    const payload = {
      pageId: page.id,
      sort: blocks.length,
      type: definition.type,
      props: definition.defaultProps
    };
    const result = await adminApi.createPageBlock(payload);
    const newBlock = { id: result.id, page_id: page.id, sort: payload.sort, type: payload.type, props: payload.props };
    const updated = [...blocks, newBlock];
    setBlocks(updated);
    setSelected(newBlock);
    await onRefresh();
  };
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((item) => item.id === active.id);
    const newIndex = blocks.findIndex((item) => item.id === over.id);
    const reordered = arrayMove(blocks, oldIndex, newIndex).map((item, index) => ({ ...item, sort: index }));
    setBlocks(reordered);
    await adminApi.reorderPageBlocks(page.id, reordered.map((item) => item.id));
  };
  const updateSelectedProps = (props) => {
    setSelected((prev) => prev ? { ...prev, props } : prev);
    setBlocks((prev) => prev.map((item) => item.id === selected.id ? { ...item, props } : item));
  };
  const saveSelected = async () => {
    if (!selected) return;
    await adminApi.updatePageBlock(selected.id, {
      sort: selected.sort,
      type: selected.type,
      props: selected.props || {}
    });
    await onRefresh();
  };
  const deleteSelected = async () => {
    if (!selected) return;
    const confirmed = await confirmPopup({ message: RU.confirm.deleteBlock });
    if (!confirmed) return;
    await adminApi.deletePageBlock(selected.id);
    const updated = blocks.filter((block) => block.id !== selected.id);
    setBlocks(updated);
    setSelected(updated[0] || null);
    await onRefresh();
  };
  return /* @__PURE__ */ React2.createElement("div", { className: "grid lg:grid-cols-[240px_1fr_320px] gap-6" }, /* @__PURE__ */ React2.createElement("div", { className: "bg-slate-900 rounded-xl p-4 space-y-3" }, /* @__PURE__ */ React2.createElement("h3", { className: "text-sm text-slate-400" }, RU.headings.blocks), BLOCK_TYPES.map((block) => /* @__PURE__ */ React2.createElement(Button, { key: block.type, variant: "secondary", onClick: () => handleAddBlock(block.type) }, "+ ", block.label))), /* @__PURE__ */ React2.createElement("div", { className: "bg-slate-900 rounded-xl p-4" }, /* @__PURE__ */ React2.createElement("h3", { className: "text-sm text-slate-400 mb-3" }, RU.headings.canvas), /* @__PURE__ */ React2.createElement(DndContext, { sensors, collisionDetection: closestCenter, onDragEnd: handleDragEnd }, /* @__PURE__ */ React2.createElement(SortableContext, { items: blocks.map((block) => block.id), strategy: verticalListSortingStrategy }, /* @__PURE__ */ React2.createElement("div", { className: "space-y-3" }, blocks.map((block) => /* @__PURE__ */ React2.createElement(SortableItem, { key: block.id, id: block.id }, /* @__PURE__ */ React2.createElement(
    "button",
    {
      className: `w-full text-left border border-slate-800 rounded-lg p-3 ${selected?.id === block.id ? "bg-slate-800" : ""}`,
      onClick: () => setSelected(block)
    },
    /* @__PURE__ */ React2.createElement("div", { className: "text-sm font-medium" }, getBlockLabel(block.type)),
    /* @__PURE__ */ React2.createElement("div", { className: "text-xs text-slate-400" }, RU.labels.sort, ": ", block.sort)
  ))))))), /* @__PURE__ */ React2.createElement("div", { className: "bg-slate-900 rounded-xl p-4 space-y-4" }, /* @__PURE__ */ React2.createElement("h3", { className: "text-sm text-slate-400" }, RU.headings.properties), !selected ? /* @__PURE__ */ React2.createElement("p", { className: "text-slate-500 text-sm" }, RU.messages.selectBlock) : /* @__PURE__ */ React2.createElement("div", { className: "space-y-3" }, /* @__PURE__ */ React2.createElement("div", { className: "text-sm font-medium" }, getBlockLabel(selected.type)), selected.type === "hero" && /* @__PURE__ */ React2.createElement(React2.Fragment, null, /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.title }, /* @__PURE__ */ React2.createElement(Input, { value: selected.props.title || "", onChange: (e) => updateSelectedProps({ ...selected.props, title: e.target.value }) })), /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.subtitle }, /* @__PURE__ */ React2.createElement(Textarea, { value: selected.props.subtitle || "", onChange: (e) => updateSelectedProps({ ...selected.props, subtitle: e.target.value }) })), /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.buttonLabel }, /* @__PURE__ */ React2.createElement(Input, { value: selected.props.buttonLabel || "", onChange: (e) => updateSelectedProps({ ...selected.props, buttonLabel: e.target.value }) })), /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.buttonLink }, /* @__PURE__ */ React2.createElement(Input, { value: selected.props.buttonLink || "", onChange: (e) => updateSelectedProps({ ...selected.props, buttonLink: e.target.value }) }))), selected.type === "banner" && /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.text }, /* @__PURE__ */ React2.createElement(Textarea, { value: selected.props.text || "", onChange: (e) => updateSelectedProps({ ...selected.props, text: e.target.value }) })), selected.type === "text" && /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.content }, /* @__PURE__ */ React2.createElement(Textarea, { value: selected.props.text || "", onChange: (e) => updateSelectedProps({ ...selected.props, text: e.target.value }) })), selected.type === "gallery" && /* @__PURE__ */ React2.createElement(React2.Fragment, null, /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.title }, /* @__PURE__ */ React2.createElement(Input, { value: selected.props.title || "", onChange: (e) => updateSelectedProps({ ...selected.props, title: e.target.value }) })), /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.imagesComma }, /* @__PURE__ */ React2.createElement(
    Textarea,
    {
      value: (selected.props.images || []).join(", "),
      onChange: (e) => updateSelectedProps({ ...selected.props, images: e.target.value.split(",").map((url) => url.trim()).filter(Boolean) })
    }
  ))), selected.type === "products-grid" && /* @__PURE__ */ React2.createElement(React2.Fragment, null, /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.title }, /* @__PURE__ */ React2.createElement(Input, { value: selected.props.title || "", onChange: (e) => updateSelectedProps({ ...selected.props, title: e.target.value }) })), /* @__PURE__ */ React2.createElement(
    ProductsGridEditor,
    {
      block: selected,
      products,
      onChange: (props) => updateSelectedProps(props)
    }
  )), /* @__PURE__ */ React2.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React2.createElement(Button, { onClick: saveSelected }, RU.buttons.save), /* @__PURE__ */ React2.createElement(Button, { variant: "danger", onClick: deleteSelected }, RU.buttons.delete)))));
}
function PagesView() {
  const [pages, setPages] = useState2([]);
  const [slug, setSlug] = useState2("");
  const [title, setTitle] = useState2("");
  const [selectedPage, setSelectedPage] = useState2(null);
  const load = async () => {
    const data = await adminApi.listPages();
    setPages(data);
  };
  useEffect2(() => {
    load();
  }, []);
  const handleCreate = async () => {
    await adminApi.createPage({ slug, title });
    setSlug("");
    setTitle("");
    await load();
  };
  const handleSelect = (page) => {
    setSelectedPage(page);
  };
  const handleDelete = async (page) => {
    const confirmed = await confirmPopup({ message: RU.confirm.deletePage });
    if (!confirmed) return;
    await adminApi.deletePage(page.id);
    setSelectedPage(null);
    await load();
  };
  return /* @__PURE__ */ React2.createElement("div", { className: "space-y-6" }, /* @__PURE__ */ React2.createElement("div", { className: "bg-slate-900 rounded-xl p-6 space-y-4" }, /* @__PURE__ */ React2.createElement("h2", { className: "text-lg font-semibold" }, RU.headings.newPage), /* @__PURE__ */ React2.createElement("div", { className: "grid md:grid-cols-2 gap-4" }, /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.slug }, /* @__PURE__ */ React2.createElement(Input, { value: slug, onChange: (e) => setSlug(e.target.value) })), /* @__PURE__ */ React2.createElement(Field, { label: RU.labels.title }, /* @__PURE__ */ React2.createElement(Input, { value: title, onChange: (e) => setTitle(e.target.value) }))), /* @__PURE__ */ React2.createElement(Button, { onClick: handleCreate, disabled: !slug || !title }, RU.buttons.create)), /* @__PURE__ */ React2.createElement("div", { className: "bg-slate-900 rounded-xl p-6 space-y-4" }, /* @__PURE__ */ React2.createElement("h2", { className: "text-lg font-semibold" }, RU.headings.pages), /* @__PURE__ */ React2.createElement("div", { className: "grid md:grid-cols-3 gap-3" }, pages.map((page) => /* @__PURE__ */ React2.createElement("div", { key: page.id, className: `border border-slate-800 rounded-lg p-3 space-y-2 ${selectedPage?.id === page.id ? "bg-slate-800" : ""}` }, /* @__PURE__ */ React2.createElement("div", { className: "font-medium" }, page.title), /* @__PURE__ */ React2.createElement("div", { className: "text-xs text-slate-400" }, "/", page.slug), /* @__PURE__ */ React2.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React2.createElement(Button, { variant: "secondary", onClick: () => handleSelect(page) }, RU.buttons.edit), /* @__PURE__ */ React2.createElement(Button, { variant: "danger", onClick: () => handleDelete(page) }, RU.buttons.delete)))))), selectedPage && /* @__PURE__ */ React2.createElement("div", { className: "bg-slate-900 rounded-xl p-6 space-y-4" }, /* @__PURE__ */ React2.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React2.createElement("div", null, /* @__PURE__ */ React2.createElement("h3", { className: "text-lg font-semibold" }, RU.headings.pageBuilder), /* @__PURE__ */ React2.createElement("p", { className: "text-sm text-slate-400" }, "/", selectedPage.slug)), /* @__PURE__ */ React2.createElement(
    "a",
    {
      href: `/page/${selectedPage.slug}`,
      className: "text-sm text-indigo-300 underline",
      target: "_blank",
      rel: "noreferrer"
    },
    RU.buttons.viewPublicPage
  )), /* @__PURE__ */ React2.createElement(PageBuilder, { page: selectedPage, onRefresh: load })));
}
function MediaView() {
  const [items, setItems] = useState2([]);
  const load = async () => {
    const data = await adminApi.listMedia();
    setItems(data);
  };
  useEffect2(() => {
    load();
  }, []);
  return /* @__PURE__ */ React2.createElement("div", { className: "bg-slate-900 rounded-xl p-6 space-y-4" }, /* @__PURE__ */ React2.createElement("h2", { className: "text-lg font-semibold" }, RU.headings.mediaLibrary), /* @__PURE__ */ React2.createElement("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4" }, items.map((item) => /* @__PURE__ */ React2.createElement("div", { key: item.key, className: "border border-slate-800 rounded-lg p-2" }, /* @__PURE__ */ React2.createElement(
    "img",
    {
      src: resolveMediaUrl(item.url),
      alt: item.meta?.name || item.key,
      className: "w-full h-24 object-cover rounded-md"
    }
  ), /* @__PURE__ */ React2.createElement("p", { className: "text-xs text-slate-400 mt-2 truncate" }, item.meta?.name || item.key)))));
}
function Dashboard() {
  return /* @__PURE__ */ React2.createElement("div", { className: "bg-slate-900 rounded-xl p-6" }, /* @__PURE__ */ React2.createElement("h2", { className: "text-lg font-semibold" }, RU.headings.dashboard), /* @__PURE__ */ React2.createElement("p", { className: "text-slate-400" }, RU.messages.useSidebar));
}
function AdminLayout({ user, onLogout }) {
  const [view, setView] = useState2("dashboard");
  const content = useMemo(() => {
    switch (view) {
      case "products":
        return /* @__PURE__ */ React2.createElement(ProductsView, null);
      case "categories":
        return /* @__PURE__ */ React2.createElement(CategoriesView, null);
      case "orders":
        return /* @__PURE__ */ React2.createElement(OrdersView, null);
      case "media":
        return /* @__PURE__ */ React2.createElement(MediaView, null);
      case "pages":
        return /* @__PURE__ */ React2.createElement(PagesView, null);
      default:
        return /* @__PURE__ */ React2.createElement(Dashboard, null);
    }
  }, [view]);
  return /* @__PURE__ */ React2.createElement("div", { className: "min-h-screen bg-slate-950 text-slate-100 flex" }, /* @__PURE__ */ React2.createElement("aside", { className: "w-64 bg-slate-900 p-6 flex flex-col gap-6" }, /* @__PURE__ */ React2.createElement("div", null, /* @__PURE__ */ React2.createElement("h1", { className: "text-xl font-semibold" }, RU.headings.adminPanel), /* @__PURE__ */ React2.createElement("p", { className: "text-xs text-slate-400" }, user.email)), /* @__PURE__ */ React2.createElement("nav", { className: "space-y-2" }, navItems.map((item) => /* @__PURE__ */ React2.createElement(
    "button",
    {
      key: item.id,
      className: `w-full text-left px-3 py-2 rounded-lg ${view === item.id ? "bg-indigo-500" : "hover:bg-slate-800"}`,
      onClick: () => setView(item.id)
    },
    item.label
  ))), /* @__PURE__ */ React2.createElement(Button, { variant: "ghost", onClick: onLogout }, RU.buttons.logout)), /* @__PURE__ */ React2.createElement("main", { className: "flex-1 p-8 overflow-auto" }, content));
}
function AdminApp({ navigate, initialPath }) {
  const [user, setUser] = useState2(null);
  const [status, setStatus] = useState2("loading");
  const [error, setError] = useState2(null);
  const goTo = (path) => {
    if (navigate) {
      navigate(path);
    } else {
      window.history.pushState({}, "", path);
    }
  };
  const fetchSession = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const data = await adminApi.me();
      if (data) {
        setUser(data);
        setStatus("authenticated");
      } else {
        setUser(null);
        setStatus("unauthenticated");
      }
    } catch (err) {
      setUser(null);
      if (err.status === 401 || err.status === 403) {
        setStatus("unauthenticated");
      } else {
        setStatus("error");
        setError(err);
      }
    }
  }, []);
  useEffect2(() => {
    fetchSession();
  }, [fetchSession]);
  const handleLogin = async (password) => {
    const data = await adminApi.login(password);
    if (!data) {
      const error2 = new Error(RU.messages.loginErrorFallback);
      error2.status = 401;
      throw error2;
    }
    setUser(data);
    setStatus("authenticated");
    setError(null);
    return data;
  };
  const handleLogout = async () => {
    await adminApi.logout();
    setUser(null);
    setStatus("unauthenticated");
    goTo("/admin/login");
  };
  const isLoginRoute = (initialPath || window.location.pathname).startsWith("/admin/login");
  if (status === "loading") {
    return /* @__PURE__ */ React2.createElement(LoadingScreen, { label: RU.messages.loadingAdminAccess });
  }
  if (status === "error") {
    const errorMessage = error?.message || RU.messages.adminApiUnavailable;
    return /* @__PURE__ */ React2.createElement(
      ErrorState,
      {
        title: RU.messages.errorLoadingAdmin,
        message: errorMessage,
        details: error?.details ? JSON.stringify(error.details, null, 2) : error?.message,
        onRetry: fetchSession
      }
    );
  }
  if (status === "unauthenticated" || !user) {
    if (!isLoginRoute) {
      goTo("/admin/login");
    }
    return /* @__PURE__ */ React2.createElement(Login, { onLogin: handleLogin, onNavigate: isLoginRoute ? goTo : null });
  }
  if (isLoginRoute) {
    goTo("/admin");
  }
  return /* @__PURE__ */ React2.createElement(AdminLayout, { user, onLogout: handleLogout });
}
function mountAdminApp(container, options = {}) {
  const root = createRoot2(container);
  root.render(
    /* @__PURE__ */ React2.createElement(ErrorBoundary, null, /* @__PURE__ */ React2.createElement(AdminApp, { navigate: options.navigate, initialPath: options.initialPath }))
  );
  return () => root.unmount();
}
export {
  mountAdminApp
};
