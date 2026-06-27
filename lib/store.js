// =============================================================================
//  STORE — tầng dữ liệu backend (JSON file). Admin làm chủ data.
//  Nguồn sự thật: data/shops.json (catalog) + data/orders.json (đơn hàng).
//  Đọc TƯƠI mỗi request → admin sửa là storefront thấy ngay.
//  Tags kichThuoc/tamGia/tagList được suy lại mỗi lần đọc cho nhất quán.
// =============================================================================
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const SHOPS_PATH = path.join(DATA_DIR, "shops.json");
const ORDERS_PATH = path.join(DATA_DIR, "orders.json");

function readJSON(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}
function writeJSON(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

// ---- Tag suy diễn ----
function sizeClass(cm) {
  if (cm == null) return null;
  if (cm < 15) return "mini";
  if (cm < 30) return "nhỏ";
  if (cm < 60) return "vừa";
  return "lớn";
}
function priceTier(v) {
  if (v < 300000) return "rẻ";
  if (v < 1000000) return "trung";
  if (v < 3000000) return "cao";
  return "premium";
}
function withDerived(p) {
  const base = { ...(p.tags || {}) };
  delete base.kichThuoc;
  delete base.tamGia;
  const tags = { ...base, kichThuoc: sizeClass(p.realWidthCm), tamGia: priceTier(p.price) };
  const tagList = Object.values(tags).flat().filter(Boolean);
  return { ...p, tags, tagList };
}

export function slugify(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ---- Đọc catalog ----
function readShopsRaw() {
  return readJSON(SHOPS_PATH, { shops: {} }).shops || {};
}
function saveShops(shops) {
  writeJSON(SHOPS_PATH, { shops });
}

export function getShopList() {
  const shops = readShopsRaw();
  return Object.values(shops).map((s) => ({ ...s, products: (s.products || []).map(withDerived) }));
}
export function getShop(slug) {
  const s = readShopsRaw()[slug];
  if (!s) return null;
  return { ...s, products: (s.products || []).map(withDerived) };
}
export function getProduct(slug, productId) {
  const s = getShop(slug);
  if (!s) return null;
  return s.products.find((p) => p.id === productId) || null;
}

export function formatVND(n) {
  return new Intl.NumberFormat("vi-VN").format(n || 0) + "₫";
}

// Build object đúng chuẩn window.VSTAGE_CATALOG (contract §2 cách 1)
export function buildCatalog(shop, currentId) {
  return {
    shopId: shop.id,
    shopName: shop.name,
    currency: shop.currency,
    currentProductId: currentId || null,
    stagingProfile: shop.stagingProfile || null,
    products: shop.products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      category: p.category,
      cutoutImage: p.cutoutImage,
      thumbnail: p.thumbnail,
      productUrl: p.productUrl,
      placementHint: p.placementHint,
      realWidthCm: p.realWidthCm,
      tags: p.tags,
      tagList: p.tagList,
    })),
  };
}

// ---- CRUD sản phẩm (admin) ----
const CATEGORIES = ["chair", "table", "lamp", "rug", "art", "decor", "plant", "shelf"];
export { CATEGORIES };

export function addProduct(slug, input) {
  const shops = readShopsRaw();
  const shop = shops[slug];
  if (!shop) throw new Error("Không tìm thấy cửa hàng: " + slug);
  let id = input.id || slugify(input.name);
  if (!id) throw new Error("Sản phẩm cần tên");
  // tránh trùng id
  let base = id, n = 2;
  while (shop.products.some((p) => p.id === id)) id = `${base}-${n++}`;

  const img = input.thumbnail || input.cutoutImage || "https://loremflickr.com/900/900/product";
  const product = {
    id,
    name: input.name,
    price: Number(input.price) || 0,
    category: CATEGORIES.includes(input.category) ? input.category : "decor",
    thumbnail: img,
    cutoutImage: input.cutoutImage || img,
    productUrl: `/${slug}/products/${id}`,
    placementHint: input.placementHint || "",
    realWidthCm: Number(input.realWidthCm) || null,
    desc: input.desc || "",
    material: input.material || "",
    dims: input.dims || "",
    tags: input.tags || {},
  };
  shop.products.push(product);
  saveShops(shops);
  return withDerived(product);
}

export function updateProduct(slug, productId, patch) {
  const shops = readShopsRaw();
  const shop = shops[slug];
  if (!shop) throw new Error("Không tìm thấy cửa hàng: " + slug);
  const p = shop.products.find((x) => x.id === productId);
  if (!p) throw new Error("Không tìm thấy sản phẩm: " + productId);
  const allowed = ["name", "price", "category", "thumbnail", "cutoutImage", "placementHint", "realWidthCm", "desc", "material", "dims", "tags"];
  for (const k of allowed) {
    if (patch[k] === undefined) continue;
    if (k === "price" || k === "realWidthCm") p[k] = Number(patch[k]) || (k === "price" ? 0 : null);
    else p[k] = patch[k];
  }
  if (!p.cutoutImage) p.cutoutImage = p.thumbnail;
  saveShops(shops);
  return withDerived(p);
}

export function deleteProduct(slug, productId) {
  const shops = readShopsRaw();
  const shop = shops[slug];
  if (!shop) throw new Error("Không tìm thấy cửa hàng: " + slug);
  const before = shop.products.length;
  shop.products = shop.products.filter((p) => p.id !== productId);
  if (shop.products.length === before) throw new Error("Không tìm thấy sản phẩm: " + productId);
  saveShops(shops);
  return { ok: true };
}

// ---- Đơn hàng ----
export function listOrders() {
  return (readJSON(ORDERS_PATH, { orders: [] }).orders || []).slice().reverse(); // mới nhất trước
}
export function createOrder(input) {
  const data = readJSON(ORDERS_PATH, { orders: [] });
  const items = (input.items || []).map((it) => ({
    id: it.id,
    name: it.name || it.id,
    price: Number(it.price) || 0,
    qty: Number(it.qty) || 1,
  }));
  const total = items.reduce((s, it) => s + it.price * it.qty, 0);
  const order = {
    id: "ORD-" + Date.now().toString(36).toUpperCase(),
    createdAt: new Date().toISOString(),
    customer: input.customer || { name: "Khách demo", phone: "", address: "" },
    items,
    total,
    status: "new",
  };
  data.orders.push(order);
  writeJSON(ORDERS_PATH, data);
  return order;
}
export function updateOrderStatus(id, status) {
  const data = readJSON(ORDERS_PATH, { orders: [] });
  const o = data.orders.find((x) => x.id === id);
  if (!o) throw new Error("Không tìm thấy đơn: " + id);
  o.status = status;
  writeJSON(ORDERS_PATH, data);
  return o;
}
