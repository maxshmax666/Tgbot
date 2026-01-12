async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("content-type") && !(options.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(path, { ...options, headers, credentials: "include" });
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    const error = new Error("Admin API не отвечает JSON (возможно, не задеплоены Functions /api)");
    error.status = response.status;
    throw error;
  }
  const payload = await response.json().catch(() => null);
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
  async login(password) {
    const data = await request("/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    return data.user;
  },
  logout() {
    return request("/api/admin/auth/logout", { method: "POST" });
  },
  me() {
    return request("/api/admin/me").then((data) => data.user);
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
