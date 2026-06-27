# Virtual Staging Demo

Demo widget nhúng cho 3 cửa hàng: cây cảnh, decor mạ vàng và tranh canvas. Khách upload ảnh không gian,
widget chọn sản phẩm theo prompt riêng của từng store, gen ảnh staging và cho tick sản phẩm để thêm vào giỏ.

## Chạy local
```bash
npm install
cp .env.example .env.local   # điền OPENAI_API_KEY (bỏ trống = chế độ MOCK, trả ảnh gốc để test UI)
npm run dev                  # tự chọn cổng trống nếu 3000 bận
```

Mở:
- `/` — demo hub
- `/cay-canh` — storefront cây cảnh
- `/decor-vang` — storefront decor mạ vàng
- `/in-tranh` — storefront tranh canvas

Chạy demo production trên 3 local host:
```bash
npm run demo:3
```

Mặc định mở:
- `http://127.0.0.1:3000/` — cửa hàng cây cảnh
- `http://127.0.0.1:3001/` — cửa hàng decor mạ vàng
- `http://127.0.0.1:3002/` — cửa hàng tranh canvas

Admin dùng chung data cho cả 3 cửa hàng:
- `http://127.0.0.1:3000/admin`

## Thành phần
| File | Vai trò |
|---|---|
| `public/virtualstage.js` | Widget nhúng (vanilla JS + Shadow DOM, chạy mọi site) |
| `app/api/stage/route.js` | API gọi `gpt-image-1` (có CORS + MOCK mode) |
| `app/[shop]` | 3 storefront demo đọc từ `data/shops.json` |
| `INTEGRATION_CONTRACT.md` | Hợp đồng giao tiếp với Session A (site) |

## Nhúng (cho Session A)
```html
<script src="https://<domain>/virtualstage.js"
        data-shop-id="my-shop" data-position="bottom-right" defer></script>
```
Site cần expose `window.VSTAGE_CATALOG` + `window.VStage.addToCart` — xem `INTEGRATION_CONTRACT.md`.
