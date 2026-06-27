// Inject window.VStage + giỏ hàng giả (localStorage) trên MỌI trang.
// Tuân thủ INTEGRATION_CONTRACT.md §5: widget gọi window.VStage.addToCart(id, qty).
// addToCart tự resolve thông tin sản phẩm từ window.VSTAGE_CATALOG.
export default function CartCore() {
  const js = `
(function () {
  var KEY = "vstage_cart";
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function write(c) { localStorage.setItem(KEY, JSON.stringify(c)); window.dispatchEvent(new CustomEvent("vstage:cart")); }

  function findProduct(id) {
    var cat = window.VSTAGE_CATALOG;
    if (!cat || !cat.products) return null;
    for (var i = 0; i < cat.products.length; i++) if (cat.products[i].id === id) return cat.products[i];
    return null;
  }

  function toast(msg) {
    var t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = "position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(20px);background:#111;color:#fff;padding:12px 20px;border-radius:999px;font:500 14px/1.2 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.25);z-index:99999;opacity:0;transition:.28s ease;max-width:90vw;text-align:center";
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = "1"; t.style.transform = "translateX(-50%) translateY(0)"; });
    setTimeout(function () { t.style.opacity = "0"; t.style.transform = "translateX(-50%) translateY(20px)"; setTimeout(function () { t.remove(); }, 320); }, 2200);
  }

  // ==== Contract §5 — hàm global cho widget gọi ====
  window.VStage = {
    addToCart: function (productId, qty) {
      qty = qty || 1;
      var c = read();
      var p = findProduct(productId);
      var entry = c[productId] || { id: productId, qty: 0 };
      entry.qty += qty;
      if (p) { entry.name = p.name; entry.price = p.price; entry.image = p.thumbnail; entry.url = p.productUrl; }
      c[productId] = entry;
      write(c);
      toast("✓ Đã thêm " + (p ? p.name : productId) + " vào giỏ");
    },
    goToProduct: function (productId) {
      var p = findProduct(productId);
      window.location.href = p && p.url ? p.url : "/";
    },
    getCart: read,
    clearCart: function () { write({}); }
  };
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
