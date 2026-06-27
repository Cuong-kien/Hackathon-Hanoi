// =============================================================================
//  Catalog đã chuyển sang BACKEND JSON (data/shops.json) — admin làm chủ data.
//  File này giữ lại API đọc cũ cho storefront, uỷ quyền toàn bộ cho lib/store.js.
//  (Trước đây là data tĩnh; nay đọc tươi mỗi request để admin sửa là thấy ngay.)
// =============================================================================
export { getShop, getProduct, getShopList, formatVND, buildCatalog } from "./store.js";
