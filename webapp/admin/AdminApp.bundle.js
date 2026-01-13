// webapp/admin/AdminApp.js
import React, { useCallback, useEffect, useMemo, useState } from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
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

// webapp/admin/AdminApp.js
var BLOCK_TYPES = [
  { type: "hero", label: "Hero", defaultProps: { title: "", subtitle: "", buttonLabel: "", buttonLink: "" } },
  { type: "banner", label: "Banner", defaultProps: { text: "" } },
  { type: "text", label: "Text", defaultProps: { text: "" } },
  { type: "gallery", label: "Gallery", defaultProps: { title: "", images: [] } },
  { type: "products-grid", label: "Products Grid", defaultProps: { title: "", items: [] } }
];
var navItems = [
  { id: "dashboard", label: "Overview" },
  { id: "products", label: "Products" },
  { id: "categories", label: "Categories" },
  { id: "orders", label: "Orders" },
  { id: "media", label: "Media" },
  { id: "pages", label: "Pages" }
];
function Button({ children, variant = "primary", ...props }) {
  const base = "px-4 py-2 rounded-md text-sm font-medium transition";
  const styles = {
    primary: "bg-indigo-500 hover:bg-indigo-600 text-white",
    secondary: "bg-slate-700 hover:bg-slate-600 text-white",
    ghost: "bg-transparent hover:bg-slate-800 text-slate-200",
    danger: "bg-rose-500 hover:bg-rose-600 text-white"
  };
  return /* @__PURE__ */ React.createElement("button", { className: `${base} ${styles[variant]}`, ...props });
}
function Field({ label, children }) {
  return /* @__PURE__ */ React.createElement("label", { className: "flex flex-col gap-2 text-sm text-slate-200" }, /* @__PURE__ */ React.createElement("span", { className: "text-slate-400" }, label), children);
}
function Input(props) {
  return /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500",
      ...props
    }
  );
}
function Textarea(props) {
  return /* @__PURE__ */ React.createElement(
    "textarea",
    {
      className: "rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500",
      ...props
    }
  );
}
function Select(props) {
  return /* @__PURE__ */ React.createElement(
    "select",
    {
      className: "rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500",
      ...props
    }
  );
}
var ErrorBoundary = class extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6" }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-900 rounded-xl p-6 max-w-lg w-full space-y-3" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-semibold" }, "\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438"), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-400" }, "\u041F\u0440\u043E\u0438\u0437\u043E\u0448\u043B\u0430 \u043E\u0448\u0438\u0431\u043A\u0430 \u0432 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0435 \u0430\u0434\u043C\u0438\u043D\u043A\u0438. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043A\u043E\u043D\u0441\u043E\u043B\u044C \u0438 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043E\u043A\u0440\u0443\u0436\u0435\u043D\u0438\u044F."), /* @__PURE__ */ React.createElement("pre", { className: "text-xs text-rose-300 whitespace-pre-wrap break-words" }, this.state.error?.message || "Unknown error")));
    }
    return this.props.children;
  }
};
function LoadingScreen({ label = "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026" }) {
  return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6" }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-900 rounded-xl p-6 w-full max-w-md text-center space-y-3" }, /* @__PURE__ */ React.createElement("div", { className: "h-10 w-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" }), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-400" }, label)));
}
function ErrorState({ title, message, details, onRetry }) {
  return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6" }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-900 rounded-xl p-6 w-full max-w-lg space-y-3" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-semibold" }, title), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-400" }, message), details && /* @__PURE__ */ React.createElement("pre", { className: "text-xs text-rose-300 whitespace-pre-wrap break-words" }, details), onRetry && /* @__PURE__ */ React.createElement(Button, { onClick: onRetry }, "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C")));
}
function formatZodIssues(details) {
  if (!Array.isArray(details)) return null;
  const lines = details.map((issue) => {
    if (!issue || typeof issue !== "object") return null;
    const path = Array.isArray(issue.path) ? issue.path.join(".") : "";
    if (path === "password" && issue.code === "too_small" && typeof issue.minimum === "number") {
      return `\u041F\u0430\u0440\u043E\u043B\u044C \u043C\u0438\u043D\u0438\u043C\u0443\u043C ${issue.minimum} \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432`;
    }
    if (path === "password" && issue.code === "invalid_type") {
      return "\u041F\u0430\u0440\u043E\u043B\u044C \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u0435\u043D";
    }
    if (issue.message) return path ? `${path}: ${issue.message}` : issue.message;
    return path ? `${path}: \u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435` : "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435";
  }).filter(Boolean);
  return lines.length ? lines.join("\n") : null;
}
function Login({ onLogin, onNavigate }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
      const envMessage = err?.status === 500 && typeof err?.message === "string" && err.message.startsWith("ENV \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u044B");
      const fallbackMessage = err?.message || "Login failed";
      setError(envMessage ? err.message : zodMessage || fallbackMessage);
    } finally {
      setLoading(false);
    }
  };
  return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6" }, /* @__PURE__ */ React.createElement("form", { onSubmit: handleSubmit, className: "bg-slate-900 p-8 rounded-xl shadow-xl w-full max-w-md flex flex-col gap-4" }, /* @__PURE__ */ React.createElement("h1", { className: "text-xl font-semibold" }, "Admin Login"), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-400" }, "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043F\u0430\u0440\u043E\u043B\u044C \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430."), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500" }, "\u041F\u0430\u0440\u043E\u043B\u044C \u0437\u0430\u0434\u0430\u0451\u0442\u0441\u044F \u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u043C\u0438 \u043E\u043A\u0440\u0443\u0436\u0435\u043D\u0438\u044F ", /* @__PURE__ */ React.createElement("code", { className: "text-slate-300" }, "ADMIN_PASSWORD_HASH"), " \u0438\u043B\u0438 ", /* @__PURE__ */ React.createElement("code", { className: "text-slate-300" }, "ADMIN_PASSWORD"), " (\u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E). \u041C\u0438\u043D\u0438\u043C\u0443\u043C 6 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432."), /* @__PURE__ */ React.createElement(Field, { label: "Password" }, /* @__PURE__ */ React.createElement(Input, { type: "password", value: password, onChange: (e) => setPassword(e.target.value), required: true })), error && /* @__PURE__ */ React.createElement("p", { className: "text-rose-400 text-sm whitespace-pre-line" }, error), /* @__PURE__ */ React.createElement(Button, { type: "submit", disabled: loading }, loading ? "Signing in..." : "Sign in")));
}
function CategoriesView() {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState("");
  const [sort, setSort] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const load = async () => {
    const data = await adminApi.listCategories();
    setItems(data);
  };
  useEffect(() => {
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
    if (!window.confirm("\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044E?")) return;
    await adminApi.deleteCategory(id);
    await load();
  };
  return /* @__PURE__ */ React.createElement("div", { className: "space-y-6" }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-900 rounded-xl p-6 space-y-4" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-semibold" }, "New category"), /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-3 gap-4" }, /* @__PURE__ */ React.createElement(Field, { label: "Title" }, /* @__PURE__ */ React.createElement(Input, { value: title, onChange: (e) => setTitle(e.target.value) })), /* @__PURE__ */ React.createElement(Field, { label: "Sort" }, /* @__PURE__ */ React.createElement(Input, { type: "number", value: sort, onChange: (e) => setSort(e.target.value) })), /* @__PURE__ */ React.createElement(Field, { label: "Active" }, /* @__PURE__ */ React.createElement(Select, { value: isActive ? "yes" : "no", onChange: (e) => setIsActive(e.target.value === "yes") }, /* @__PURE__ */ React.createElement("option", { value: "yes" }, "Active"), /* @__PURE__ */ React.createElement("option", { value: "no" }, "Inactive")))), /* @__PURE__ */ React.createElement(Button, { onClick: handleCreate, disabled: !title.trim() }, "Create")), /* @__PURE__ */ React.createElement("div", { className: "bg-slate-900 rounded-xl p-6" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-semibold mb-4" }, "Categories"), /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, items.map((item) => /* @__PURE__ */ React.createElement("div", { key: item.id, className: "grid md:grid-cols-4 gap-3 items-center border border-slate-800 rounded-lg p-3" }, /* @__PURE__ */ React.createElement(
    Input,
    {
      value: item.title,
      onChange: (e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, title: e.target.value } : row))
    }
  ), /* @__PURE__ */ React.createElement(
    Input,
    {
      type: "number",
      value: item.sort,
      onChange: (e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, sort: e.target.value } : row))
    }
  ), /* @__PURE__ */ React.createElement(
    Select,
    {
      value: item.is_active ? "yes" : "no",
      onChange: (e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, is_active: e.target.value === "yes" ? 1 : 0 } : row))
    },
    /* @__PURE__ */ React.createElement("option", { value: "yes" }, "Active"),
    /* @__PURE__ */ React.createElement("option", { value: "no" }, "Inactive")
  ), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Button, { variant: "secondary", onClick: () => handleUpdate(item) }, "Save"), /* @__PURE__ */ React.createElement(Button, { variant: "danger", onClick: () => handleDelete(item.id) }, "Delete")))))));
}
function MediaLibrary({ onSelect, onClose }) {
  const [items, setItems] = useState([]);
  const [file, setFile] = useState(null);
  const load = async () => {
    const data = await adminApi.listMedia();
    setItems(data);
  };
  useEffect(() => {
    load();
  }, []);
  const handleUpload = async () => {
    if (!file) return;
    await adminApi.uploadMedia(file);
    setFile(null);
    await load();
  };
  const handleDelete = async (key) => {
    if (!window.confirm("\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0444\u0430\u0439\u043B?")) return;
    await adminApi.deleteMedia(key);
    await load();
  };
  return /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 bg-black/70 flex items-center justify-center z-50" }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-900 rounded-xl p-6 w-full max-w-4xl space-y-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("h3", { className: "text-lg font-semibold" }, "Media library"), /* @__PURE__ */ React.createElement(Button, { variant: "ghost", onClick: onClose }, "Close")), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3 items-center" }, /* @__PURE__ */ React.createElement("input", { type: "file", onChange: (e) => setFile(e.target.files?.[0] || null) }), /* @__PURE__ */ React.createElement(Button, { onClick: handleUpload, disabled: !file }, "Upload")), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[400px] overflow-auto" }, items.map((item) => /* @__PURE__ */ React.createElement("div", { key: item.key, className: "border border-slate-800 rounded-lg p-2 space-y-2" }, /* @__PURE__ */ React.createElement(
    "img",
    {
      src: resolveMediaUrl(item.url),
      alt: item.meta?.name || item.key,
      className: "w-full h-28 object-cover rounded-md"
    }
  ), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Button, { variant: "secondary", onClick: () => onSelect(item.url) }, "Use"), /* @__PURE__ */ React.createElement(Button, { variant: "danger", onClick: () => handleDelete(item.key) }, "Delete")))))));
}
function ProductsView() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
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
  const [mediaOpen, setMediaOpen] = useState(false);
  const load = async () => {
    const [productsData, categoriesData] = await Promise.all([
      adminApi.listProducts(),
      adminApi.listCategories()
    ]);
    setProducts(productsData);
    setCategories(categoriesData);
  };
  useEffect(() => {
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
    if (!window.confirm("\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0442\u043E\u0432\u0430\u0440?")) return;
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
  return /* @__PURE__ */ React.createElement("div", { className: "space-y-6" }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-900 rounded-xl p-6 space-y-4" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-semibold" }, "Product editor"), /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-2 gap-4" }, /* @__PURE__ */ React.createElement(Field, { label: "Title" }, /* @__PURE__ */ React.createElement(Input, { value: form.title, onChange: (e) => setForm((prev) => ({ ...prev, title: e.target.value })) })), /* @__PURE__ */ React.createElement(Field, { label: "Price" }, /* @__PURE__ */ React.createElement(Input, { type: "number", value: form.price, onChange: (e) => setForm((prev) => ({ ...prev, price: e.target.value })) })), /* @__PURE__ */ React.createElement(Field, { label: "Category" }, /* @__PURE__ */ React.createElement(Select, { value: form.categoryId, onChange: (e) => setForm((prev) => ({ ...prev, categoryId: e.target.value })) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "\u0411\u0435\u0437 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438"), categories.map((cat) => /* @__PURE__ */ React.createElement("option", { key: cat.id, value: cat.id }, cat.title)))), /* @__PURE__ */ React.createElement(Field, { label: "Sort" }, /* @__PURE__ */ React.createElement(Input, { type: "number", value: form.sort, onChange: (e) => setForm((prev) => ({ ...prev, sort: e.target.value })) })), /* @__PURE__ */ React.createElement(Field, { label: "Active" }, /* @__PURE__ */ React.createElement(Select, { value: form.isActive ? "yes" : "no", onChange: (e) => setForm((prev) => ({ ...prev, isActive: e.target.value === "yes" })) }, /* @__PURE__ */ React.createElement("option", { value: "yes" }, "Active"), /* @__PURE__ */ React.createElement("option", { value: "no" }, "Inactive"))), /* @__PURE__ */ React.createElement(Field, { label: "Featured" }, /* @__PURE__ */ React.createElement(Select, { value: form.isFeatured ? "yes" : "no", onChange: (e) => setForm((prev) => ({ ...prev, isFeatured: e.target.value === "yes" })) }, /* @__PURE__ */ React.createElement("option", { value: "yes" }, "Yes"), /* @__PURE__ */ React.createElement("option", { value: "no" }, "No")))), /* @__PURE__ */ React.createElement(Field, { label: "Description" }, /* @__PURE__ */ React.createElement(Textarea, { rows: 4, value: form.description, onChange: (e) => setForm((prev) => ({ ...prev, description: e.target.value })) })), /* @__PURE__ */ React.createElement("div", { className: "space-y-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("span", { className: "text-slate-400 text-sm" }, "Images"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Button, { variant: "secondary", onClick: () => setMediaOpen(true) }, "Media library"), /* @__PURE__ */ React.createElement(Button, { variant: "secondary", onClick: () => addImage(window.prompt("Image URL") || "") }, "Add URL"))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-3" }, form.images.map((url, index) => /* @__PURE__ */ React.createElement("div", { key: `${url}-${index}`, className: "border border-slate-800 rounded-lg p-2 space-y-2" }, /* @__PURE__ */ React.createElement("img", { src: resolveMediaUrl(url), alt: "", className: "w-full h-24 object-cover rounded-md" }), /* @__PURE__ */ React.createElement(Button, { variant: "danger", onClick: () => removeImage(index) }, "Remove"))))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Button, { onClick: handleSubmit, disabled: !form.title.trim() }, "Save"), /* @__PURE__ */ React.createElement(Button, { variant: "ghost", onClick: resetForm }, "Reset"))), /* @__PURE__ */ React.createElement("div", { className: "bg-slate-900 rounded-xl p-6" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-semibold mb-4" }, "Products"), /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, products.map((product) => /* @__PURE__ */ React.createElement("div", { key: product.id, className: "border border-slate-800 rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-medium" }, product.title), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-slate-400" }, product.price, " \u20BD")), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Button, { variant: "secondary", onClick: () => handleEdit(product) }, "Edit"), /* @__PURE__ */ React.createElement(Button, { variant: "danger", onClick: () => handleDelete(product.id) }, "Delete")))))), mediaOpen && /* @__PURE__ */ React.createElement(
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
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const load = async () => {
    const data = await adminApi.listOrders();
    setOrders(data);
  };
  useEffect(() => {
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
  return /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-3 gap-6" }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-900 rounded-xl p-6 space-y-3" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-semibold" }, "Orders"), orders.map((order) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: order.id,
      className: `w-full text-left border border-slate-800 rounded-lg p-3 ${selected?.id === order.id ? "bg-slate-800" : ""}`,
      onClick: () => handleSelect(order)
    },
    /* @__PURE__ */ React.createElement("div", { className: "font-medium" }, "#", order.id, " \u2022 ", order.customer_name),
    /* @__PURE__ */ React.createElement("div", { className: "text-sm text-slate-400" }, order.status, " \u2022 ", order.total, " \u20BD")
  ))), /* @__PURE__ */ React.createElement("div", { className: "bg-slate-900 rounded-xl p-6 lg:col-span-2" }, !selected ? /* @__PURE__ */ React.createElement("p", { className: "text-slate-400" }, "Select an order to view details.") : /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { className: "text-lg font-semibold" }, "Order #", selected.id), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-400" }, selected.customer_name, " \u2022 ", selected.phone), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-400" }, selected.address)), /* @__PURE__ */ React.createElement("div", { className: "space-y-2" }, selected.items?.map((item, index) => /* @__PURE__ */ React.createElement("div", { key: `${item.id}-${index}`, className: "flex justify-between text-sm" }, /* @__PURE__ */ React.createElement("span", null, item.title, " \xD7 ", item.qty), /* @__PURE__ */ React.createElement("span", null, item.price, " \u20BD")))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 flex-wrap" }, ["new", "preparing", "delivering", "done"].map((status) => /* @__PURE__ */ React.createElement(Button, { key: status, variant: selected.status === status ? "secondary" : "ghost", onClick: () => updateStatus(status) }, status))))));
}
function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  return /* @__PURE__ */ React.createElement("div", { ref: setNodeRef, style, ...attributes, ...listeners }, children);
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
  return /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, /* @__PURE__ */ React.createElement(DndContext, { sensors, collisionDetection: closestCenter, onDragEnd: handleDragEnd }, /* @__PURE__ */ React.createElement(SortableContext, { items: items.map((item) => item.id), strategy: verticalListSortingStrategy }, /* @__PURE__ */ React.createElement("div", { className: "space-y-2" }, items.map((item) => {
    const product = productMap.get(item.id);
    if (!product) return null;
    return /* @__PURE__ */ React.createElement(SortableItem, { key: item.id, id: item.id }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between border border-slate-800 rounded-lg p-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm" }, product.title), /* @__PURE__ */ React.createElement("label", { className: "flex items-center gap-2 text-sm" }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        checked: item.visible !== false,
        onChange: () => toggleVisibility(item.id)
      }
    ), "Visible")));
  })))));
}
function PageBuilder({ page, onRefresh }) {
  const [blocks, setBlocks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [products, setProducts] = useState([]);
  const sensors = useSensors(useSensor(PointerSensor));
  useEffect(() => {
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
    if (!window.confirm("\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0431\u043B\u043E\u043A?")) return;
    await adminApi.deletePageBlock(selected.id);
    const updated = blocks.filter((block) => block.id !== selected.id);
    setBlocks(updated);
    setSelected(updated[0] || null);
    await onRefresh();
  };
  return /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-[240px_1fr_320px] gap-6" }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-900 rounded-xl p-4 space-y-3" }, /* @__PURE__ */ React.createElement("h3", { className: "text-sm text-slate-400" }, "Blocks"), BLOCK_TYPES.map((block) => /* @__PURE__ */ React.createElement(Button, { key: block.type, variant: "secondary", onClick: () => handleAddBlock(block.type) }, "+ ", block.label))), /* @__PURE__ */ React.createElement("div", { className: "bg-slate-900 rounded-xl p-4" }, /* @__PURE__ */ React.createElement("h3", { className: "text-sm text-slate-400 mb-3" }, "Canvas"), /* @__PURE__ */ React.createElement(DndContext, { sensors, collisionDetection: closestCenter, onDragEnd: handleDragEnd }, /* @__PURE__ */ React.createElement(SortableContext, { items: blocks.map((block) => block.id), strategy: verticalListSortingStrategy }, /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, blocks.map((block) => /* @__PURE__ */ React.createElement(SortableItem, { key: block.id, id: block.id }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `w-full text-left border border-slate-800 rounded-lg p-3 ${selected?.id === block.id ? "bg-slate-800" : ""}`,
      onClick: () => setSelected(block)
    },
    /* @__PURE__ */ React.createElement("div", { className: "text-sm font-medium" }, block.type),
    /* @__PURE__ */ React.createElement("div", { className: "text-xs text-slate-400" }, "Sort: ", block.sort)
  ))))))), /* @__PURE__ */ React.createElement("div", { className: "bg-slate-900 rounded-xl p-4 space-y-4" }, /* @__PURE__ */ React.createElement("h3", { className: "text-sm text-slate-400" }, "Properties"), !selected ? /* @__PURE__ */ React.createElement("p", { className: "text-slate-500 text-sm" }, "Select a block to edit.") : /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-medium" }, selected.type), selected.type === "hero" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Field, { label: "Title" }, /* @__PURE__ */ React.createElement(Input, { value: selected.props.title || "", onChange: (e) => updateSelectedProps({ ...selected.props, title: e.target.value }) })), /* @__PURE__ */ React.createElement(Field, { label: "Subtitle" }, /* @__PURE__ */ React.createElement(Textarea, { value: selected.props.subtitle || "", onChange: (e) => updateSelectedProps({ ...selected.props, subtitle: e.target.value }) })), /* @__PURE__ */ React.createElement(Field, { label: "Button label" }, /* @__PURE__ */ React.createElement(Input, { value: selected.props.buttonLabel || "", onChange: (e) => updateSelectedProps({ ...selected.props, buttonLabel: e.target.value }) })), /* @__PURE__ */ React.createElement(Field, { label: "Button link" }, /* @__PURE__ */ React.createElement(Input, { value: selected.props.buttonLink || "", onChange: (e) => updateSelectedProps({ ...selected.props, buttonLink: e.target.value }) }))), selected.type === "banner" && /* @__PURE__ */ React.createElement(Field, { label: "Text" }, /* @__PURE__ */ React.createElement(Textarea, { value: selected.props.text || "", onChange: (e) => updateSelectedProps({ ...selected.props, text: e.target.value }) })), selected.type === "text" && /* @__PURE__ */ React.createElement(Field, { label: "Content" }, /* @__PURE__ */ React.createElement(Textarea, { value: selected.props.text || "", onChange: (e) => updateSelectedProps({ ...selected.props, text: e.target.value }) })), selected.type === "gallery" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Field, { label: "Title" }, /* @__PURE__ */ React.createElement(Input, { value: selected.props.title || "", onChange: (e) => updateSelectedProps({ ...selected.props, title: e.target.value }) })), /* @__PURE__ */ React.createElement(Field, { label: "Images (comma separated URLs)" }, /* @__PURE__ */ React.createElement(
    Textarea,
    {
      value: (selected.props.images || []).join(", "),
      onChange: (e) => updateSelectedProps({ ...selected.props, images: e.target.value.split(",").map((url) => url.trim()).filter(Boolean) })
    }
  ))), selected.type === "products-grid" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Field, { label: "Title" }, /* @__PURE__ */ React.createElement(Input, { value: selected.props.title || "", onChange: (e) => updateSelectedProps({ ...selected.props, title: e.target.value }) })), /* @__PURE__ */ React.createElement(
    ProductsGridEditor,
    {
      block: selected,
      products,
      onChange: (props) => updateSelectedProps(props)
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Button, { onClick: saveSelected }, "Save"), /* @__PURE__ */ React.createElement(Button, { variant: "danger", onClick: deleteSelected }, "Delete")))));
}
function PagesView() {
  const [pages, setPages] = useState([]);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [selectedPage, setSelectedPage] = useState(null);
  const load = async () => {
    const data = await adminApi.listPages();
    setPages(data);
  };
  useEffect(() => {
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
    if (!window.confirm("\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443?")) return;
    await adminApi.deletePage(page.id);
    setSelectedPage(null);
    await load();
  };
  return /* @__PURE__ */ React.createElement("div", { className: "space-y-6" }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-900 rounded-xl p-6 space-y-4" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-semibold" }, "New page"), /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-2 gap-4" }, /* @__PURE__ */ React.createElement(Field, { label: "Slug" }, /* @__PURE__ */ React.createElement(Input, { value: slug, onChange: (e) => setSlug(e.target.value) })), /* @__PURE__ */ React.createElement(Field, { label: "Title" }, /* @__PURE__ */ React.createElement(Input, { value: title, onChange: (e) => setTitle(e.target.value) }))), /* @__PURE__ */ React.createElement(Button, { onClick: handleCreate, disabled: !slug || !title }, "Create")), /* @__PURE__ */ React.createElement("div", { className: "bg-slate-900 rounded-xl p-6 space-y-4" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-semibold" }, "Pages"), /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-3 gap-3" }, pages.map((page) => /* @__PURE__ */ React.createElement("div", { key: page.id, className: `border border-slate-800 rounded-lg p-3 space-y-2 ${selectedPage?.id === page.id ? "bg-slate-800" : ""}` }, /* @__PURE__ */ React.createElement("div", { className: "font-medium" }, page.title), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-slate-400" }, "/", page.slug), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Button, { variant: "secondary", onClick: () => handleSelect(page) }, "Edit"), /* @__PURE__ */ React.createElement(Button, { variant: "danger", onClick: () => handleDelete(page) }, "Delete")))))), selectedPage && /* @__PURE__ */ React.createElement("div", { className: "bg-slate-900 rounded-xl p-6 space-y-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { className: "text-lg font-semibold" }, "Page builder"), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-400" }, "/", selectedPage.slug)), /* @__PURE__ */ React.createElement(
    "a",
    {
      href: `/page/${selectedPage.slug}`,
      className: "text-sm text-indigo-300 underline",
      target: "_blank",
      rel: "noreferrer"
    },
    "View public page"
  )), /* @__PURE__ */ React.createElement(PageBuilder, { page: selectedPage, onRefresh: load })));
}
function MediaView() {
  const [items, setItems] = useState([]);
  const load = async () => {
    const data = await adminApi.listMedia();
    setItems(data);
  };
  useEffect(() => {
    load();
  }, []);
  return /* @__PURE__ */ React.createElement("div", { className: "bg-slate-900 rounded-xl p-6 space-y-4" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-semibold" }, "Media library"), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4" }, items.map((item) => /* @__PURE__ */ React.createElement("div", { key: item.key, className: "border border-slate-800 rounded-lg p-2" }, /* @__PURE__ */ React.createElement(
    "img",
    {
      src: resolveMediaUrl(item.url),
      alt: item.meta?.name || item.key,
      className: "w-full h-24 object-cover rounded-md"
    }
  ), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-400 mt-2 truncate" }, item.meta?.name || item.key)))));
}
function Dashboard() {
  return /* @__PURE__ */ React.createElement("div", { className: "bg-slate-900 rounded-xl p-6" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-semibold" }, "Welcome"), /* @__PURE__ */ React.createElement("p", { className: "text-slate-400" }, "Use the sidebar to manage catalog, orders, media and pages."));
}
function AdminLayout({ user, onLogout }) {
  const [view, setView] = useState("dashboard");
  const content = useMemo(() => {
    switch (view) {
      case "products":
        return /* @__PURE__ */ React.createElement(ProductsView, null);
      case "categories":
        return /* @__PURE__ */ React.createElement(CategoriesView, null);
      case "orders":
        return /* @__PURE__ */ React.createElement(OrdersView, null);
      case "media":
        return /* @__PURE__ */ React.createElement(MediaView, null);
      case "pages":
        return /* @__PURE__ */ React.createElement(PagesView, null);
      default:
        return /* @__PURE__ */ React.createElement(Dashboard, null);
    }
  }, [view]);
  return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-slate-950 text-slate-100 flex" }, /* @__PURE__ */ React.createElement("aside", { className: "w-64 bg-slate-900 p-6 flex flex-col gap-6" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h1", { className: "text-xl font-semibold" }, "Admin Panel"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-400" }, user.email)), /* @__PURE__ */ React.createElement("nav", { className: "space-y-2" }, navItems.map((item) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: item.id,
      className: `w-full text-left px-3 py-2 rounded-lg ${view === item.id ? "bg-indigo-500" : "hover:bg-slate-800"}`,
      onClick: () => setView(item.id)
    },
    item.label
  ))), /* @__PURE__ */ React.createElement(Button, { variant: "ghost", onClick: onLogout }, "Logout")), /* @__PURE__ */ React.createElement("main", { className: "flex-1 p-8 overflow-auto" }, content));
}
function AdminApp({ navigate, initialPath }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
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
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);
  const handleLogin = async (password) => {
    const data = await adminApi.login(password);
    if (!data) {
      const error2 = new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u043E\u0432\u0430\u0442\u044C\u0441\u044F. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043F\u0430\u0440\u043E\u043B\u044C \u0438 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 API.");
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
    return /* @__PURE__ */ React.createElement(LoadingScreen, { label: "\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C \u0434\u043E\u0441\u0442\u0443\u043F \u043A \u0430\u0434\u043C\u0438\u043D\u043A\u0435\u2026" });
  }
  if (status === "error") {
    const errorMessage = error?.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C\u0441\u044F \u043A \u0430\u0434\u043C\u0438\u043D API. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0435 \u043E\u043A\u0440\u0443\u0436\u0435\u043D\u0438\u044F \u0438 \u043B\u043E\u0433\u0438 \u0431\u0438\u043B\u0434\u0430.";
    return /* @__PURE__ */ React.createElement(
      ErrorState,
      {
        title: "\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0430\u0434\u043C\u0438\u043D\u043A\u0438",
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
    return /* @__PURE__ */ React.createElement(Login, { onLogin: handleLogin, onNavigate: isLoginRoute ? goTo : null });
  }
  if (isLoginRoute) {
    goTo("/admin");
  }
  return /* @__PURE__ */ React.createElement(AdminLayout, { user, onLogout: handleLogout });
}
function mountAdminApp(container, options = {}) {
  const root = createRoot(container);
  root.render(
    /* @__PURE__ */ React.createElement(ErrorBoundary, null, /* @__PURE__ */ React.createElement(AdminApp, { navigate: options.navigate, initialPath: options.initialPath }))
  );
  return () => root.unmount();
}
export {
  mountAdminApp
};
