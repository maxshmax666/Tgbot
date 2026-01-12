import React, { useEffect, useMemo, useState } from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "https://esm.sh/@dnd-kit/core@6.1.0";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "https://esm.sh/@dnd-kit/sortable@8.0.0";
import { CSS } from "https://esm.sh/@dnd-kit/utilities@3.2.2";
import { adminApi } from "../services/adminApi.js";

const BLOCK_TYPES = [
  { type: "hero", label: "Hero", defaultProps: { title: "", subtitle: "", buttonLabel: "", buttonLink: "" } },
  { type: "banner", label: "Banner", defaultProps: { text: "" } },
  { type: "text", label: "Text", defaultProps: { text: "" } },
  { type: "gallery", label: "Gallery", defaultProps: { title: "", images: [] } },
  { type: "products-grid", label: "Products Grid", defaultProps: { title: "", items: [] } },
];

const navItems = [
  { id: "dashboard", label: "Overview" },
  { id: "products", label: "Products" },
  { id: "categories", label: "Categories" },
  { id: "orders", label: "Orders" },
  { id: "media", label: "Media" },
  { id: "pages", label: "Pages" },
];

function Button({ children, variant = "primary", ...props }) {
  const base = "px-4 py-2 rounded-md text-sm font-medium transition";
  const styles = {
    primary: "bg-indigo-500 hover:bg-indigo-600 text-white",
    secondary: "bg-slate-700 hover:bg-slate-600 text-white",
    ghost: "bg-transparent hover:bg-slate-800 text-slate-200",
    danger: "bg-rose-500 hover:bg-rose-600 text-white",
  };
  return (
    <button className={`${base} ${styles[variant]}`} {...props} />
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-2 text-sm text-slate-200">
      <span className="text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function Input(props) {
  return (
    <input
      className="rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      {...props}
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      className="rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      {...props}
    />
  );
}

function Select(props) {
  return (
    <select
      className="rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      {...props}
    />
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminApi.login(email, password);
      const user = await adminApi.me();
      onLogin(user);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
      <form onSubmit={handleSubmit} className="bg-slate-900 p-8 rounded-xl shadow-xl w-full max-w-md flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Admin Login</h1>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error && <p className="text-rose-400 text-sm">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </div>
  );
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
      isActive: item.is_active === 1,
    });
    await load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить категорию?")) return;
    await adminApi.deleteCategory(id);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">New category</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Sort">
            <Input type="number" value={sort} onChange={(e) => setSort(e.target.value)} />
          </Field>
          <Field label="Active">
            <Select value={isActive ? "yes" : "no"} onChange={(e) => setIsActive(e.target.value === "yes")}>
              <option value="yes">Active</option>
              <option value="no">Inactive</option>
            </Select>
          </Field>
        </div>
        <Button onClick={handleCreate} disabled={!title.trim()}>Create</Button>
      </div>
      <div className="bg-slate-900 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Categories</h2>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="grid md:grid-cols-4 gap-3 items-center border border-slate-800 rounded-lg p-3">
              <Input
                value={item.title}
                onChange={(e) => setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, title: e.target.value } : row)))}
              />
              <Input
                type="number"
                value={item.sort}
                onChange={(e) => setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, sort: e.target.value } : row)))}
              />
              <Select
                value={item.is_active ? "yes" : "no"}
                onChange={(e) => setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, is_active: e.target.value === "yes" ? 1 : 0 } : row)))}
              >
                <option value="yes">Active</option>
                <option value="no">Inactive</option>
              </Select>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => handleUpdate(item)}>Save</Button>
                <Button variant="danger" onClick={() => handleDelete(item.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
    if (!window.confirm("Удалить файл?")) return;
    await adminApi.deleteMedia(key);
    await load();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-xl p-6 w-full max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Media library</h3>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
        <div className="flex gap-3 items-center">
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <Button onClick={handleUpload} disabled={!file}>Upload</Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[400px] overflow-auto">
          {items.map((item) => (
            <div key={item.key} className="border border-slate-800 rounded-lg p-2 space-y-2">
              <img src={item.url} alt={item.meta?.name || item.key} className="w-full h-28 object-cover rounded-md" />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => onSelect(item.url)}>Use</Button>
                <Button variant="danger" onClick={() => handleDelete(item.key)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
    images: [],
  });
  const [mediaOpen, setMediaOpen] = useState(false);

  const load = async () => {
    const [productsData, categoriesData] = await Promise.all([
      adminApi.listProducts(),
      adminApi.listCategories(),
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
      images: form.images.map((url, index) => ({ url, sort: index })),
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
      images: product.images?.map((img) => img.url) || [],
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить товар?")) return;
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

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">Product editor</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Title">
            <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
          </Field>
          <Field label="Price">
            <Input type="number" value={form.price} onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))} />
          </Field>
          <Field label="Category">
            <Select value={form.categoryId} onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))}>
              <option value="">Без категории</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.title}</option>
              ))}
            </Select>
          </Field>
          <Field label="Sort">
            <Input type="number" value={form.sort} onChange={(e) => setForm((prev) => ({ ...prev, sort: e.target.value }))} />
          </Field>
          <Field label="Active">
            <Select value={form.isActive ? "yes" : "no"} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.value === "yes" }))}>
              <option value="yes">Active</option>
              <option value="no">Inactive</option>
            </Select>
          </Field>
          <Field label="Featured">
            <Select value={form.isFeatured ? "yes" : "no"} onChange={(e) => setForm((prev) => ({ ...prev, isFeatured: e.target.value === "yes" }))}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </Field>
        </div>
        <Field label="Description">
          <Textarea rows={4} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
        </Field>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Images</span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setMediaOpen(true)}>Media library</Button>
              <Button variant="secondary" onClick={() => addImage(window.prompt("Image URL") || "")}>Add URL</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {form.images.map((url, index) => (
              <div key={`${url}-${index}`} className="border border-slate-800 rounded-lg p-2 space-y-2">
                <img src={url} alt="" className="w-full h-24 object-cover rounded-md" />
                <Button variant="danger" onClick={() => removeImage(index)}>Remove</Button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={!form.title.trim()}>Save</Button>
          <Button variant="ghost" onClick={resetForm}>Reset</Button>
        </div>
      </div>
      <div className="bg-slate-900 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Products</h2>
        <div className="space-y-3">
          {products.map((product) => (
            <div key={product.id} className="border border-slate-800 rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="font-medium">{product.title}</div>
                <div className="text-sm text-slate-400">{product.price} ₽</div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => handleEdit(product)}>Edit</Button>
                <Button variant="danger" onClick={() => handleDelete(product.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {mediaOpen && (
        <MediaLibrary
          onSelect={(url) => {
            addImage(url);
            setMediaOpen(false);
          }}
          onClose={() => setMediaOpen(false)}
        />
      )}
    </div>
  );
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

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="bg-slate-900 rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-semibold">Orders</h2>
        {orders.map((order) => (
          <button
            key={order.id}
            className={`w-full text-left border border-slate-800 rounded-lg p-3 ${selected?.id === order.id ? "bg-slate-800" : ""}`}
            onClick={() => handleSelect(order)}
          >
            <div className="font-medium">#{order.id} • {order.customer_name}</div>
            <div className="text-sm text-slate-400">{order.status} • {order.total} ₽</div>
          </button>
        ))}
      </div>
      <div className="bg-slate-900 rounded-xl p-6 lg:col-span-2">
        {!selected ? (
          <p className="text-slate-400">Select an order to view details.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Order #{selected.id}</h3>
              <p className="text-sm text-slate-400">{selected.customer_name} • {selected.phone}</p>
              <p className="text-sm text-slate-400">{selected.address}</p>
            </div>
            <div className="space-y-2">
              {selected.items?.map((item, index) => (
                <div key={`${item.id}-${index}`} className="flex justify-between text-sm">
                  <span>{item.title} × {item.qty}</span>
                  <span>{item.price} ₽</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              {["new", "preparing", "delivering", "done"].map((status) => (
                <Button key={status} variant={selected.status === status ? "secondary" : "ghost"} onClick={() => updateStatus(status)}>
                  {status}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function ProductsGridEditor({ block, products, onChange }) {
  const items = Array.isArray(block.props.items)
    ? block.props.items
    : products.map((product) => ({ id: product.id, visible: true }));

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
    const updated = items.map((item) => (item.id === id ? { ...item, visible: !item.visible } : item));
    onChange({ ...block.props, items: updated });
  };

  const productMap = new Map(products.map((product) => [product.id, product]));

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((item) => {
              const product = productMap.get(item.id);
              if (!product) return null;
              return (
                <SortableItem key={item.id} id={item.id}>
                  <div className="flex items-center justify-between border border-slate-800 rounded-lg p-2">
                    <span className="text-sm">{product.title}</span>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={item.visible !== false}
                        onChange={() => toggleVisibility(item.id)}
                      />
                      Visible
                    </label>
                  </div>
                </SortableItem>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
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
      props: definition.defaultProps,
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
    setSelected((prev) => (prev ? { ...prev, props } : prev));
    setBlocks((prev) => prev.map((item) => (item.id === selected.id ? { ...item, props } : item)));
  };

  const saveSelected = async () => {
    if (!selected) return;
    await adminApi.updatePageBlock(selected.id, {
      sort: selected.sort,
      type: selected.type,
      props: selected.props || {},
    });
    await onRefresh();
  };

  const deleteSelected = async () => {
    if (!selected) return;
    if (!window.confirm("Удалить блок?")) return;
    await adminApi.deletePageBlock(selected.id);
    const updated = blocks.filter((block) => block.id !== selected.id);
    setBlocks(updated);
    setSelected(updated[0] || null);
    await onRefresh();
  };

  return (
    <div className="grid lg:grid-cols-[240px_1fr_320px] gap-6">
      <div className="bg-slate-900 rounded-xl p-4 space-y-3">
        <h3 className="text-sm text-slate-400">Blocks</h3>
        {BLOCK_TYPES.map((block) => (
          <Button key={block.type} variant="secondary" onClick={() => handleAddBlock(block.type)}>
            + {block.label}
          </Button>
        ))}
      </div>
      <div className="bg-slate-900 rounded-xl p-4">
        <h3 className="text-sm text-slate-400 mb-3">Canvas</h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {blocks.map((block) => (
                <SortableItem key={block.id} id={block.id}>
                  <button
                    className={`w-full text-left border border-slate-800 rounded-lg p-3 ${selected?.id === block.id ? "bg-slate-800" : ""}`}
                    onClick={() => setSelected(block)}
                  >
                    <div className="text-sm font-medium">{block.type}</div>
                    <div className="text-xs text-slate-400">Sort: {block.sort}</div>
                  </button>
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
      <div className="bg-slate-900 rounded-xl p-4 space-y-4">
        <h3 className="text-sm text-slate-400">Properties</h3>
        {!selected ? (
          <p className="text-slate-500 text-sm">Select a block to edit.</p>
        ) : (
          <div className="space-y-3">
            <div className="text-sm font-medium">{selected.type}</div>
            {selected.type === "hero" && (
              <>
                <Field label="Title">
                  <Input value={selected.props.title || ""} onChange={(e) => updateSelectedProps({ ...selected.props, title: e.target.value })} />
                </Field>
                <Field label="Subtitle">
                  <Textarea value={selected.props.subtitle || ""} onChange={(e) => updateSelectedProps({ ...selected.props, subtitle: e.target.value })} />
                </Field>
                <Field label="Button label">
                  <Input value={selected.props.buttonLabel || ""} onChange={(e) => updateSelectedProps({ ...selected.props, buttonLabel: e.target.value })} />
                </Field>
                <Field label="Button link">
                  <Input value={selected.props.buttonLink || ""} onChange={(e) => updateSelectedProps({ ...selected.props, buttonLink: e.target.value })} />
                </Field>
              </>
            )}
            {selected.type === "banner" && (
              <Field label="Text">
                <Textarea value={selected.props.text || ""} onChange={(e) => updateSelectedProps({ ...selected.props, text: e.target.value })} />
              </Field>
            )}
            {selected.type === "text" && (
              <Field label="Content">
                <Textarea value={selected.props.text || ""} onChange={(e) => updateSelectedProps({ ...selected.props, text: e.target.value })} />
              </Field>
            )}
            {selected.type === "gallery" && (
              <>
                <Field label="Title">
                  <Input value={selected.props.title || ""} onChange={(e) => updateSelectedProps({ ...selected.props, title: e.target.value })} />
                </Field>
                <Field label="Images (comma separated URLs)">
                  <Textarea
                    value={(selected.props.images || []).join(", ")}
                    onChange={(e) => updateSelectedProps({ ...selected.props, images: e.target.value.split(",").map((url) => url.trim()).filter(Boolean) })}
                  />
                </Field>
              </>
            )}
            {selected.type === "products-grid" && (
              <>
                <Field label="Title">
                  <Input value={selected.props.title || ""} onChange={(e) => updateSelectedProps({ ...selected.props, title: e.target.value })} />
                </Field>
                <ProductsGridEditor
                  block={selected}
                  products={products}
                  onChange={(props) => updateSelectedProps(props)}
                />
              </>
            )}
            <div className="flex gap-2">
              <Button onClick={saveSelected}>Save</Button>
              <Button variant="danger" onClick={deleteSelected}>Delete</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
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
    if (!window.confirm("Удалить страницу?")) return;
    await adminApi.deletePage(page.id);
    setSelectedPage(null);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">New page</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Slug">
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </Field>
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
        </div>
        <Button onClick={handleCreate} disabled={!slug || !title}>Create</Button>
      </div>
      <div className="bg-slate-900 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">Pages</h2>
        <div className="grid md:grid-cols-3 gap-3">
          {pages.map((page) => (
            <div key={page.id} className={`border border-slate-800 rounded-lg p-3 space-y-2 ${selectedPage?.id === page.id ? "bg-slate-800" : ""}`}>
              <div className="font-medium">{page.title}</div>
              <div className="text-xs text-slate-400">/{page.slug}</div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => handleSelect(page)}>Edit</Button>
                <Button variant="danger" onClick={() => handleDelete(page)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {selectedPage && (
        <div className="bg-slate-900 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Page builder</h3>
              <p className="text-sm text-slate-400">/{selectedPage.slug}</p>
            </div>
            <a
              href={`/page/${selectedPage.slug}`}
              className="text-sm text-indigo-300 underline"
              target="_blank"
              rel="noreferrer"
            >
              View public page
            </a>
          </div>
          <PageBuilder page={selectedPage} onRefresh={load} />
        </div>
      )}
    </div>
  );
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

  return (
    <div className="bg-slate-900 rounded-xl p-6 space-y-4">
      <h2 className="text-lg font-semibold">Media library</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.key} className="border border-slate-800 rounded-lg p-2">
            <img src={item.url} alt={item.meta?.name || item.key} className="w-full h-24 object-cover rounded-md" />
            <p className="text-xs text-slate-400 mt-2 truncate">{item.meta?.name || item.key}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard() {
  return (
    <div className="bg-slate-900 rounded-xl p-6">
      <h2 className="text-lg font-semibold">Welcome</h2>
      <p className="text-slate-400">Use the sidebar to manage catalog, orders, media and pages.</p>
    </div>
  );
}

function AdminLayout({ user, onLogout }) {
  const [view, setView] = useState("dashboard");

  const content = useMemo(() => {
    switch (view) {
      case "products":
        return <ProductsView />;
      case "categories":
        return <CategoriesView />;
      case "orders":
        return <OrdersView />;
      case "media":
        return <MediaView />;
      case "pages":
        return <PagesView />;
      default:
        return <Dashboard />;
    }
  }, [view]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <aside className="w-64 bg-slate-900 p-6 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold">Admin Panel</h1>
          <p className="text-xs text-slate-400">{user.email}</p>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`w-full text-left px-3 py-2 rounded-lg ${view === item.id ? "bg-indigo-500" : "hover:bg-slate-800"}`}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <Button variant="ghost" onClick={onLogout}>Logout</Button>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        {content}
      </main>
    </div>
  );
}

function AdminApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .me()
      .then((data) => {
        setUser(data);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await adminApi.logout();
    setUser(null);
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return <AdminLayout user={user} onLogout={handleLogout} />;
}

export function mountAdminApp(container) {
  const root = createRoot(container);
  root.render(<AdminApp />);
  return () => root.unmount();
}
