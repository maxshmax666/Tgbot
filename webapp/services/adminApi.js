async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("content-type") && !(options.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  let response;
  try {
    response = await fetch(path, { ...options, headers, credentials: "include" });
  } catch (error) {
    const networkError = new Error("Сервер недоступен. Проверьте, что /api доступен.");
    networkError.status = 0;
    networkError.details = error instanceof Error ? error.message : String(error);
    throw networkError;
  }
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    const error = new Error("Admin API не отвечает JSON (возможно, не задеплоены Functions /api)");
    error.status = response.status;
    throw error;
  }
  const payload = await response.json().catch(() => null);
  if (payload == null) {
    const error = new Error("Admin API вернул пустой ответ");
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

export const adminApi = {
  async login(email, password) {
    const data = await request("/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
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
  listIngredients() {
    return request("/api/admin/ingredients").then((data) => data.items || []);
  },
  createIngredient(payload) {
    return request("/api/admin/ingredients", { method: "POST", body: JSON.stringify(payload) });
  },
  updateIngredient(id, payload) {
    return request(`/api/admin/ingredients/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  deleteIngredient(id) {
    return request(`/api/admin/ingredients/${id}`, { method: "DELETE" });
  },
  listInventory() {
    return request("/api/admin/inventory").then((data) => data.items || []);
  },
  updateInventory(id, payload) {
    return request(`/api/admin/inventory/${id}`, { method: "PUT", body: JSON.stringify(payload) });
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
  suggestProductName(payload) {
    return request("/api/admin/products/suggest-name", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then((data) => data.items || []);
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
      body: JSON.stringify({ pageId, orderedIds }),
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
  },
};
