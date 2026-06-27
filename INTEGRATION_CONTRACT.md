# 🔌 Integration Contract — Mock Storefront ⇄ Virtual Staging Widget

> File này là **hợp đồng giao tiếp** giữa 2 session:
> - **Session A (SITE)**: dựng các mock e-commerce storefront để demo.
> - **Session B (WIDGET)**: dựng sản phẩm — widget giả lập ảnh + API gọi OpenAI `gpt-image-1`.
>
> Mục tiêu: Session A dựng site theo đúng chuẩn dưới đây → widget của Session B **cắm vào là chạy**, không cần sửa qua lại.
>
> **Cập nhật file này mỗi khi 2 bên thống nhất thay đổi gì.** Phần cuối có changelog.

---

## 0. TL;DR cho Session A (làm site)

Bạn cần giao 3 thứ:
1. **1 storefront Next.js đẹp** (3–6 sản phẩm nội thất/trang trí/thủ công) + **1 trang HTML tĩnh** (chứng minh widget nhúng đâu cũng chạy).
2. Mỗi trang sản phẩm **nhúng widget bằng 1 dòng script** (xem §3) và **expose catalog qua data-attributes** (xem §2).
3. **Ảnh sản phẩm nền sạch (PNG, tách nền)** — đây là yêu cầu QUAN TRỌNG NHẤT để gpt-image-1 chèn đẹp (xem §4).

Bạn KHÔNG cần code AI, không cần backend. Widget + API do Session B lo.

---

## 1. Kiến trúc & phân chia trách nhiệm

```
┌─ Storefront Next.js (Session A) ─┐
├─ Trang HTML tĩnh     (Session A) ─┤── nhúng ──> <script src=".../virtualstage.js">  (Session B)
└──────────────────────────────────┘                          │
                                                               ▼
                                   Widget UI (nút + modal upload)   (Session B)
                                                               │  gửi: ảnh phòng + danh sách product
                                                               ▼
                                   POST /api/stage  ──> OpenAI gpt-image-1  (Session B)
                                                               │  trả: ảnh composite + hotspots
                                                               ▼
                                   Hiển thị ảnh + sản phẩm click-to-buy   (Session B)
```

| Việc | Ai làm |
|---|---|
| Storefront UI, trang sản phẩm, giỏ hàng giả | **Session A** |
| Data sản phẩm + ảnh nền sạch | **Session A** |
| Nhúng script widget | **Session A** (copy snippet §3) |
| Widget UI, modal, upload ảnh | **Session B** |
| API `/api/stage`, gọi gpt-image-1 | **Session B** |
| Hotspot + nút "Thêm vào giỏ" trên ảnh kết quả | **Session B** (gọi hàm `window.VStage` của site — xem §5) |

---

## 2. Data Contract — Catalog sản phẩm

Widget cần biết shop đang bán gì. Site expose catalog theo **2 cách (làm cả 2 càng tốt)**:

### Cách 1 (BẮT BUỘC): Global JS object
Mỗi trang đặt object này trong `<head>` hoặc đầu `<body>`:

```html
<script>
  window.VSTAGE_CATALOG = {
    shopId: "mock-shop-a",
    shopName: "Nhà Gỗ Việt",
    currency: "VND",
    products: [
      {
        id: "p001",
        name: "Ghế gỗ óc chó Minimal",
        price: 2500000,
        category: "chair",            // chair | table | lamp | rug | art | decor | plant | shelf
        // ẢNH NỀN SẠCH, tách nền, PNG — dùng để AI chèn vào ảnh phòng:
        cutoutImage: "https://.../p001-cutout.png",
        // ảnh thường để hiển thị trong UI:
        thumbnail: "https://.../p001-thumb.jpg",
        productUrl: "/products/p001",
        // gợi ý cho AI đặt đồ đúng chỗ (tùy chọn nhưng nên có):
        placementHint: "đặt trên sàn, cạnh bàn làm việc",
        realWidthCm: 55             // để AI scale đúng tỉ lệ (tùy chọn)
      }
    ]
  };
</script>
```

### Cách 2 (NÊN CÓ): Data-attributes trên DOM
Để widget có thể tự đọc sản phẩm đang xem ngay cả khi không có global object:

```html
<div class="product-card"
     data-vstage-id="p001"
     data-vstage-name="Ghế gỗ óc chó Minimal"
     data-vstage-price="2500000"
     data-vstage-cutout="https://.../p001-cutout.png"
     data-vstage-category="chair">
  ...
</div>
```

> Trang chi tiết sản phẩm: thêm `data-vstage-current="p001"` trên `<body>` để widget biết SP đang xem (mặc định chèn món này).

---

## 3. Embed Snippet — cách nhúng widget

Session A dán đoạn này vào **cuối `<body>`** mỗi trang muốn có tính năng (thường là trang sản phẩm):

```html
<!-- Virtual Staging Widget (Session B cung cấp) -->
<script
  src="https://<widget-domain>/virtualstage.js"
  data-shop-id="mock-shop-a"
  data-position="bottom-right"      <!-- vị trí nút nổi -->
  data-button-text="🛋️ Thử trong không gian của bạn"
  defer>
</script>
```

- Script tự render 1 **nút nổi (floating button)**. Không đụng layout site.
- Khi click → mở modal: upload ảnh phòng → chọn sản phẩm (mặc định lấy từ §2) → "Tạo ảnh".
- **Session B chịu trách nhiệm**: nếu `<widget-domain>` chưa có, tạm thời site có thể import từ `/virtualstage.js` cùng repo (xem §6 — quyết định deploy).

---

## 4. ⚠️ Yêu cầu ẢNH SẢN PHẨM (quyết định chất lượng demo)

gpt-image-1 chèn sản phẩm dựa trên **ảnh reference**. Ảnh xấu → kết quả xấu. Session A đảm bảo:

- ✅ **Tách nền** (nền trắng hoặc transparent PNG), 1 sản phẩm/ảnh.
- ✅ Chụp/crop **chính diện hoặc góc 3/4**, sản phẩm chiếm phần lớn khung.
- ✅ Độ phân giải tối thiểu **800×800px**, vuông càng tốt.
- ✅ Tên file rõ ràng: `p001-cutout.png`.
- ✅ Ưu tiên loại đồ **dễ chèn & ăn ảnh**: ghế, đèn sàn/bàn, tranh treo tường, thảm, cây cảnh, kệ, đồ thủ công để bàn.
- ❌ Tránh: đồ trong suốt phức tạp, gương lớn, đồ có bóng đổ cháy sáng.

> Gợi ý: 5–6 sản phẩm chất lượng cao > 20 sản phẩm ảnh xấu. Chọn đồ demo "chắc thắng".

---

## 5. Callback để Widget → Giỏ hàng của Site

Sau khi tạo ảnh, widget cho phép click sản phẩm trong ảnh → "Thêm vào giỏ". Để hành động này tác động lên storefront thật, **Session A expose 1 hàm global**:

```js
// Session A định nghĩa (storefront thật cài hàm này):
window.VStage = {
  addToCart: function (productId, qty = 1) {
    // logic giỏ hàng của site (có thể chỉ là alert/console cho demo)
    console.log("Added", productId, qty);
  },
  goToProduct: function (productId) {
    window.location.href = "/products/" + productId;
  }
};
```

- Nếu `window.VStage` không tồn tại → widget tự fallback (mở `productUrl`). Nên site cứ làm đơn giản, không bắt buộc đầy đủ.

---

## 6. Quyết định cần 2 session thống nhất (điền vào đây)

| Vấn đề | Lựa chọn | Chốt |
|---|---|---|
| Stack storefront chính | Next.js (App Router) + **Tailwind** (không dùng shadcn, dùng component tự viết cho nhẹ) | ✅ A |
| Storefront thứ 2 | Trang HTML/CSS tĩnh thuần → `public/static-cay.html` (Session A) + `public/static-shop.html` legacy (Session B) | ✅ A |
| Deploy chung 1 repo hay tách? | 1 monorepo trên Vercel (site + widget + api chung) | ✅ A |
| `<widget-domain>` | Tạm dùng cùng origin: site nhúng `/virtualstage.js`. Khi Session B deploy domain riêng thì đổi 1 chỗ trong `components/VStageIntegration.js` | ✅ A |
| Số sản phẩm demo | 3 cửa hàng chính: cây cảnh / decor mạ vàng / tranh canvas | ✅ A |
| Tiền tệ & ngôn ngữ | VND, tiếng Việt | ✅ A |

---

## 7. Demo Script (kịch bản trình diễn — để cả 2 build hướng tới)

1. Mở **storefront Next.js** → trang sản phẩm ghế → nút "🛋️ Thử trong không gian của bạn" nổi góc phải.
2. Click → upload ảnh **văn phòng thật** (chuẩn bị sẵn 3–4 ảnh ăn ảnh + cho phép chụp tại chỗ).
3. ~10–20s → ảnh phòng có **ghế của shop** đặt vào tự nhiên.
4. Trên ảnh: click ghế → popup tên + giá → **"Thêm vào giỏ"** → giỏ hàng storefront +1.
5. Mở **trang HTML tĩnh** → CÙNG nút đó xuất hiện → chứng minh *"1 dòng script, chạy mọi nền tảng"*.

**Checklist chống cháy demo:**
- [ ] Có sẵn 3–4 ảnh phòng đẹp + kết quả cache phòng mạng lag / API chậm.
- [ ] Loading state đẹp (skeleton/animation) khi chờ gpt-image-1.
- [ ] Mỗi sản phẩm có `cutoutImage` nền sạch đạt chuẩn §4.

---

## 8. Checklist bàn giao

**Session A (SITE) xong khi:**
- [ ] Storefront Next.js chạy, 5–6 sản phẩm, mỗi SP có `cutoutImage` đạt chuẩn §4.
- [ ] `window.VSTAGE_CATALOG` có trên mọi trang sản phẩm (§2 cách 1).
- [ ] Data-attributes trên product card (§2 cách 2).
- [ ] Embed snippet §3 đã dán cuối `<body>`.
- [ ] `window.VStage.addToCart` đã định nghĩa (§5).
- [ ] Trang HTML tĩnh + cùng snippet.

**Session B (WIDGET) xong khi:**
- [ ] `virtualstage.js` render nút nổi, đọc catalog từ §2.
- [ ] Modal: upload ảnh + chọn sản phẩm + nút tạo.
- [ ] `POST /api/stage` gọi gpt-image-1, trả ảnh composite.
- [ ] Hotspot click-to-buy gọi `window.VStage` (§5).

---

## Changelog
- 2026-06-27 — Khởi tạo contract (Session B). Chờ Session A xác nhận §6.
- 2026-06-27 — **Session A bàn giao storefront.** Đã chốt §6. Đã build 3 cửa hàng thật:
  - `/` — trang chủ chợ (3 cửa hàng).
  - `/gom-su`, `/decor-vang`, `/in-tranh` — 3 storefront riêng (gốm Bát Tràng / decor mạ vàng để bàn / in tranh canvas), mỗi shop 5 SP, theme màu riêng.
  - `/[shop]/products/[id]` — 15 trang chi tiết SP, có `window.VSTAGE_CATALOG`, `data-vstage-*`, `data-vstage-current`, nút "Thêm vào giỏ".
  - `/cart` — giỏ hàng thật (localStorage). `window.VStage.addToCart/goToProduct` định nghĩa global ở `components/CartCore.js` (mọi trang).
  - `public/static-gom.html` — storefront HTML tĩnh có catalog thật + nhúng widget.
  - Snippet nhúng widget đã có ở mọi trang SP qua `components/VStageIntegration.js` (trỏ `/virtualstage.js`).
  - **Còn lại cho Session B:** `<widget-domain>` thật (nếu tách deploy) → sửa src trong `VStageIntegration.js`.
  - **Ảnh (§4):** ĐÃ thay ảnh minh hoạ bằng **15 ảnh thật tải về `public/images/<shop>/<id>.jpg`** (nguồn: Wikimedia Commons + Unsplash). `thumbnail` & `cutoutImage` trỏ local, ổn định & tải nhanh. `lib/shops.js` tự chuẩn hoá đường dẫn local ở cuối file.
  - **⚠️ Còn lại về cutout:** ảnh là ảnh thật nhưng **chưa tách nền** (vẫn có background). Để gpt-image-1 chèn mịn nhất nên chạy remove-bg cho ~5–6 món "chắc thắng" → ghi đè file `public/images/<shop>/<id>.jpg`. Không cần đổi code.
- 2026-06-27 — **Session A: clone 3 cửa hàng thật của Việt Nam** (tên/giá/ảnh sản phẩm thật, tải về local):
  - `/cay-canh` → **Là Nhà Tree House** (16 cây cảnh) · `/decor-vang` → **Ngọc Tâm An** (15 đồ mạ vàng/dát vàng 24K) · `/in-tranh` → **Printek** (15 tranh canvas).
  - shopId GIỮ NGUYÊN (`mock-shop-cay`/`mock-shop-vang`/`mock-shop-tranh`) → Session B không phải đổi gì. Lớp tag `PRODUCT_TAGS` đã cập nhật theo id mới.
- 2026-06-27 — **Session A: đổi cửa hàng "gốm" → "cây cảnh".** 3 storefront giờ là: `/cay-canh` (cây cảnh để bàn, shopId `mock-shop-cay`), `/decor-vang`, `/in-tranh`. Đã xoá `/gom-su` & `static-gom.html`; thêm `public/static-cay.html` (shopId `mock-shop-cay`). Cây cảnh dùng `category: "plant"` — rất hợp staging. Toàn bộ ảnh đã refetch theo phong cách "sản phẩm trang trí để bàn/phòng/tường" cho dễ present.
- 2026-06-27 — **Demo hiện tại chốt 3 store để test gen ảnh:** `/cay-canh` (cây cảnh), `/decor-vang` (decor mạ vàng, shopId `mock-shop-vang`), `/in-tranh` (tranh canvas). `/noi-that` không còn nằm trong `data/shops.json` demo chính.
