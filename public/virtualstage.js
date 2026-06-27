/*
 * Virtual Staging Widget — virtualstage.js  (v0.5.0 — Store prompts + click-only flow)
 * Nhúng: <script src=".../virtualstage.js" data-shop-id="..." data-position="bottom-right" defer></script>
 *
 * v0.2.0:
 *  - R-001: UI hội thoại theo click. Message types: text / chips / image loading / product_cards.
 *  - R-002: card sản phẩm có checkbox chọn món + nút thêm các món đã chọn vào giỏ.
 *  - R-003: API gen theo hướng beautify (xử lý ở /api/stage).
 *  - R-004: chips hỏi style/ngân sách + speculative generation (gen ngầm 1 mẫu phổ biến lúc upload).
 * v0.3.0:
 *  - R-006: 1 vision pass /api/analyze ngay sau upload → rẽ nhánh: ảnh tốt = gen, ảnh xấu = gợi ý SP (không gen).
 *  - R-005: hotspot trên ảnh gen ↔ highlight card. v0.4.0 ưu tiên bbox post-gen từ /api/stage, không đoán theo ảnh gốc.
 *
 * Data contract & callback giữ nguyên theo INTEGRATION_CONTRACT.md (§2, §5).
 */
(function () {
  "use strict";

  var script = document.currentScript;
  var cfg = {
    apiBase: script ? new URL(script.src).origin : "",
    shopId: (script && script.dataset.shopId) || "",
    position: (script && script.dataset.position) || "bottom-right",
    buttonText: (script && script.dataset.buttonText) || "Xem thử trong phòng bạn",
    speculative: !(script && script.dataset.speculative === "false"),
  };

  var SPEC_STYLE = "hien-dai"; // style mặc định cho mẫu speculative (R-004)
  var STYLE_CHIPS = [
    { label: "Bắc Âu", value: "bac-au" },
    { label: "Hiện đại", value: "hien-dai" },
    { label: "Cổ điển", value: "co-dien" },
  ];
  var BUDGET_CHIPS = [
    { label: "< 10 triệu", value: "lt10" },
    { label: "10–30 triệu", value: "10-30" },
    { label: "> 30 triệu", value: "gt30" },
  ];
  var BUDGET_RANGE = { lt10: [0, 10000000], "10-30": [10000000, 30000000], gt30: [30000000, Infinity] };
  var FALLBACK_QUESTIONS = [
    { id: "style", text: "Bạn thích phong cách nào?", chips: STYLE_CHIPS },
    { id: "budget", text: "Ngân sách khoảng bao nhiêu để mình chọn đồ phù hợp?", chips: BUDGET_CHIPS },
  ];

  // ---------- Catalog ----------
  function getCatalog() {
    if (window.VSTAGE_CATALOG && Array.isArray(window.VSTAGE_CATALOG.products)) return window.VSTAGE_CATALOG;
    var nodes = document.querySelectorAll("[data-vstage-id]");
    var products = [];
    nodes.forEach(function (n) {
      products.push({
        id: n.dataset.vstageId,
        name: n.dataset.vstageName || "Sản phẩm",
        price: Number(n.dataset.vstagePrice || 0),
        cutoutImage: n.dataset.vstageCutout || n.dataset.vstageThumb,
        thumbnail: n.dataset.vstageThumb || n.dataset.vstageCutout,
        category: n.dataset.vstageCategory || "decor",
        productUrl: n.dataset.vstageUrl || "#",
        placementHint: n.dataset.vstageHint || "",
      });
    });
    return { shopName: "Cửa hàng", currency: "VND", products: products };
  }
  function currentProductId(catalog) {
    return (document.body && document.body.dataset.vstageCurrent) || (catalog && catalog.currentProductId) || "";
  }
  function currentProduct(catalog) {
    var cur = currentProductId(catalog);
    if (!cur || !catalog || !Array.isArray(catalog.products)) return null;
    return catalog.products.find(function (p) { return p.id === cur; }) || null;
  }
  function withCurrentProduct(products, catalog) {
    var current = currentProduct(catalog);
    if (!current) return products;
    return [current].concat(products.filter(function (p) { return p.id !== current.id; }));
  }

  function fmtPrice(v, cur) {
    if (!v) return "";
    try { return new Intl.NumberFormat("vi-VN").format(v) + (cur === "VND" ? "₫" : " " + (cur || "")); }
    catch (e) { return v + ""; }
  }
  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function textOf(v) {
    if (Array.isArray(v)) return v.join(" ");
    if (v && typeof v === "object") return Object.values(v).map(textOf).join(" ");
    return String(v || "");
  }
  function norm(s) { return textOf(s).toLowerCase(); }
  function includesAny(haystack, words) {
    haystack = norm(haystack);
    return words.some(function (w) { return haystack.indexOf(w) !== -1; });
  }
  function productSearchText(p) {
    return [p.name, p.category, p.placementHint, p.tagList, p.tags].map(textOf).join(" ");
  }
  function analysisText() {
    var a = S && S.analysis;
    return a ? textOf(a.detectedItems || []) + " " + textOf((a.hotspots || []).map(function (h) { return h.area; })) : "";
  }
  function valuesOf(v) {
    if (Array.isArray(v)) return v.map(function (x) { return String(x).toLowerCase(); });
    if (v == null) return [];
    return String(v).split(",").map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
  }
  function productTagValues(p, key) {
    return valuesOf(p && p.tags ? p.tags[key] : null);
  }
  function tagMatches(p, key, wanted) {
    var have = productTagValues(p, key);
    var want = valuesOf(wanted);
    if (!have.length || !want.length) return false;
    return want.some(function (w) {
      return have.some(function (h) { return h === w || h.indexOf(w) !== -1 || w.indexOf(h) !== -1; });
    });
  }
  function answerScore(p, answers) {
    if (!Array.isArray(answers) || !answers.length) return 0;
    var score = 0;
    answers.forEach(function (ans) {
      var tags = ans && ans.tags;
      if (!tags) return;
      Object.keys(tags).forEach(function (key) {
        if (tagMatches(p, key, tags[key])) score += 1400;
      });
      if (Array.isArray(ans.categories) && ans.categories.indexOf(p.category) !== -1) score += 900;
    });
    return score;
  }
  function answersPrompt(answers) {
    return (answers || []).map(function (a) { return a.prompt || a.label || ""; }).filter(Boolean).join(" ");
  }

  function scoreProduct(p, idx, answers) {
    var score = 1000 - idx; // giữ thứ tự catalog làm tie-breaker ổn định
    var pt = productSearchText(p);
    var at = norm(analysisText());
    var cur = currentProductId(S && S.catalog);
    if (cur && p.id === cur) score += 10000;

    // Ảnh có bàn/laptop/văn phòng → ưu tiên đồ để bàn, đèn, cây mini.
    if (includesAny(at, ["bàn", "laptop", "máy tính", "văn phòng", "desk", "office"])) {
      if (includesAny(pt, ["để bàn", "bàn làm việc", "table", "lamp", "plant", "mini", "nhỏ"])) score += 650;
    }
    // Có tường trống → ưu tiên tranh/decor treo tường.
    if (includesAny(at, ["tường", "wall", "trống", "phía sau"])) {
      if (includesAny(pt, ["tranh", "art", "treo", "tường", "canvas"])) score += 650;
    }
    // Có sàn/góc phòng → ưu tiên cây/đèn/kệ/thảm/đồ size vừa-lớn.
    if (includesAny(at, ["sàn", "góc", "corner", "floor", "lối vào"])) {
      if (includesAny(pt, ["để sàn", "sàn", "lớn", "vừa", "rug", "shelf", "kệ", "plant"])) score += 650;
    }
    // Ảnh tối/ít sáng → ưu tiên sản phẩm chịu bóng / ánh sáng linh hoạt.
    if (S && S.analysis && S.analysis.quality === "poor") {
      if (includesAny(pt, ["chịu bóng", "linh hoạt", "dễ", "rất dễ"])) score += 300;
    }
    score += answerScore(p, answers);
    return score;
  }

  function productLimit(catalog, override) {
    if (override) return Math.min(Number(override) || 1, 4);
    var n = catalog && catalog.stagingProfile && Number(catalog.stagingProfile.maxProducts);
    return n > 0 ? Math.min(n, 4) : 4;
  }

  // Chọn SP theo profile từng store, ưu tiên SP đang xem, lọc ngân sách, rồi xếp hạng theo phân tích ảnh
  function chooseProducts(catalog, opts) {
    opts = opts || {};
    var list = catalog.products.slice();
    var budget = opts.budget;
    if (budget && BUDGET_RANGE[budget]) {
      var r = BUDGET_RANGE[budget];
      var f = list.filter(function (p) { return p.price >= r[0] && p.price < r[1]; });
      if (f.length) list = f;
    }
    var pinned = currentProduct(catalog);
    if (pinned && !list.some(function (p) { return p.id === pinned.id; })) list.unshift(pinned);
    return list
      .map(function (p, i) { return { p: p, s: scoreProduct(p, i, opts.answers || []) }; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, productLimit(catalog, opts.limit))
      .map(function (x) { return x.p; });
  }
  function sameProductIds(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i].id !== b[i].id) return false;
    return true;
  }

  // ---------- Buy hooks (R-002) ----------
  function addToCart(p) {
    if (window.VStage && typeof window.VStage.addToCart === "function") window.VStage.addToCart(p.id, 1);
    else if (p.productUrl && p.productUrl !== "#") { window.location.href = p.productUrl; return; }
    botToast("Đã thêm " + p.name + " vào giỏ.");
  }
  function addBundle(products) {
    products.forEach(function (p) {
      if (window.VStage && typeof window.VStage.addToCart === "function") window.VStage.addToCart(p.id, 1);
    });
    botToast("Đã thêm cả bộ vào giỏ.");
  }

  // ---------- Shadow DOM shell ----------
  var host = document.createElement("div");
  host.id = "vstage-host";
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });
  var style = document.createElement("style");
  style.textContent = [
    ":host{all:initial}",
    "*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}",
    ".fab{position:fixed;z-index:2147483000;bottom:24px;right:24px;background:#111;color:#fff;border:none;border-radius:999px;padding:14px 20px;font-size:15px;font-weight:500;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.28);transition:transform .15s;display:inline-flex;align-items:center;justify-content:center;gap:8px}",
    ".fab:hover{transform:translateY(-2px)}.fab.bottom-left{right:auto;left:24px}.fab.hidden{display:none}",
    ".panel{position:fixed;z-index:2147483001;bottom:24px;right:24px;width:min(400px,94vw);height:min(640px,86vh);background:#fff;border-radius:20px;box-shadow:0 24px 80px rgba(0,0,0,.38);display:flex;flex-direction:column;overflow:hidden}",
    ".panel.bottom-left{right:auto;left:24px}",
    ".phead{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid #eee;flex:0 0 auto}",
    ".phead h3{margin:0;font-size:15px;font-weight:500}.phead p{margin:1px 0 0;font-size:11px;color:#8a8a8a}",
    ".phead .title{min-width:0;flex:1}",
    ".phead button{border:none;background:#f2f2f4;border-radius:9px;width:34px;height:34px;padding:0;font-size:12px;cursor:pointer;color:#111;display:flex;align-items:center;justify-content:center}",
    ".msgs{flex:1 1 auto;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background:#fafafa}",
    ".row{display:flex;gap:8px;max-width:100%}",
    ".row.user{justify-content:flex-end}",
    ".bubble{padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.45;max-width:82%;word-wrap:break-word}",
    ".bubble.bot{background:#fff;border:1px solid #ececec;border-bottom-left-radius:4px}",
    ".bubble.user{background:#111;color:#fff;border-bottom-right-radius:4px}",
    ".uimg{max-width:74%;border-radius:14px;border-bottom-right-radius:4px;display:block}",
    ".chips{display:flex;flex-wrap:wrap;gap:8px}",
    ".chip{border:1px solid #d4d4d8;background:#fff;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:500;cursor:pointer;transition:.12s}",
    ".chip:hover{border-color:#111}.chips.done .chip{opacity:.45;pointer-events:none}",
    ".genwrap{width:100%}",
    ".skel{width:100%;aspect-ratio:3/2;border-radius:14px;background:linear-gradient(100deg,#eee 30%,#f6f6f6 50%,#eee 70%);background-size:200% 100%;animation:sh 1.3s linear infinite}",
    "@keyframes sh{to{background-position:-200% 0}}",
    ".loadbox{width:100%;border:1px solid #ececec;border-radius:14px;background:#fff;padding:12px}",
    ".loadtop{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;font-size:12px;color:#555}",
    ".spinner{width:18px;height:18px;border:2px solid #e5e5e5;border-top-color:#111;border-radius:999px;animation:spin .8s linear infinite;flex:0 0 auto}",
    "@keyframes spin{to{transform:rotate(360deg)}}",
    ".bar{height:6px;border-radius:999px;background:#eee;overflow:hidden;margin-top:10px}",
    ".bar span{display:block;width:45%;height:100%;border-radius:999px;background:#111;animation:bar 1.4s ease-in-out infinite}",
    "@keyframes bar{0%{transform:translateX(-110%)}100%{transform:translateX(240%)}}",
    ".loadsteps{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}",
    ".loadsteps span{font-size:11px;color:#777;border:1px solid #eee;border-radius:999px;padding:4px 8px;background:#fafafa}",
    ".loadsteps span.on{color:#111;border-color:#111}",
    ".genimg{width:100%;border-radius:14px;display:block}",
    ".option{border:1px solid #ececec;border-radius:14px;background:#fff;padding:10px;margin-top:10px}",
    ".option:first-child{margin-top:0}",
    ".ophead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 8px;font-size:12px;font-weight:500;color:#111}",
    ".ophead span:last-child{font-weight:500;color:#777}",
    ".imgwrap{position:relative;line-height:0}",
    ".hotspot{position:absolute;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:999px;border:2px solid #fff;background:#111;color:#fff;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:0;animation:pulse 2s infinite}",
    "@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(255,255,255,.6)}70%{box-shadow:0 0 0 8px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}",
    ".hotspot.on{background:#fff;color:#111;transform:translate(-50%,-50%) scale(1.18)}",
    ".card.hl,.card.sel{border-color:#111;box-shadow:0 0 0 3px rgba(17,17,17,.12)}",
    ".card.preview-card{border-color:#111;box-shadow:0 0 0 2px rgba(17,17,17,.1)}",
    ".spotpop{position:absolute;transform:translate(-50%,calc(-100% - 16px));background:#fff;border:1px solid #e3e3e6;border-radius:10px;padding:8px 10px;box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:5;min-width:140px;line-height:1.3}",
    ".spotpop .sp-n{font-size:12px;font-weight:600}.spotpop .sp-p{font-size:12px;color:#111;margin:2px 0 6px}",
    ".spotpop button{width:100%;border:none;background:#111;color:#fff;border-radius:7px;padding:6px;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px}",
    ".cap{font-size:11px;color:#999;margin-top:6px}",
    ".cards{display:flex;gap:10px;overflow-x:auto;padding:4px 0 2px;scrollbar-width:thin}",
    ".card{position:relative;flex:0 0 150px;border:1px solid #ececec;border-radius:12px;overflow:hidden;background:#fff}",
    ".card img{width:100%;height:96px;object-fit:contain;background:#f6f6f7;display:block}",
    ".card .ci{padding:8px}",
    ".card .cn{font-size:12px;font-weight:500;line-height:1.25;height:30px;overflow:hidden}",
    ".card .cp{font-size:12px;color:#111;margin:3px 0 7px}",
    ".previewtag{display:inline-block;margin:0 0 6px;border-radius:999px;background:#111;color:#fff;padding:3px 8px;font-size:10px;line-height:1.2}",
    ".pick{position:absolute;left:8px;top:8px;z-index:2;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;background:rgba(255,255,255,.92);box-shadow:0 2px 10px rgba(0,0,0,.18);cursor:pointer}",
    ".pick input{width:17px;height:17px;margin:0;accent-color:#111;cursor:pointer}",
    ".card.preview-card .pick{width:24px;height:24px;left:9px;top:9px}",
    ".card.preview-card .pick input{width:15px;height:15px}",
    ".pick input:disabled{cursor:not-allowed}",
    ".swatches{display:flex;gap:5px;margin:0 0 7px;flex-wrap:wrap}",
    ".swatch{width:18px;height:18px;border-radius:999px;border:2px solid #fff;box-shadow:0 0 0 1px #ddd;cursor:pointer;padding:0;position:relative}",
    ".swatch.sel{box-shadow:0 0 0 2px #111}",
    ".swatch.oos{opacity:.4;cursor:not-allowed}",
    ".swatch.oos::after{content:'';position:absolute;left:1px;right:1px;top:7px;border-top:2px solid #c0392b;transform:rotate(-18deg)}",
    ".selectbar{display:flex;align-items:center;gap:10px;margin-top:10px;padding:11px 13px;border:1px dashed #111;border-radius:12px;background:#fff}",
    ".selectbar .bt{font-size:12px;color:#555}.selectbar .bp{font-size:15px;font-weight:500}",
    ".selectbar button{margin-left:auto;border:none;background:#111;color:#fff;border-radius:9px;padding:9px 14px;font-size:13px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px}",
    ".selectbar button:disabled{opacity:.4;cursor:not-allowed}",
    ".previewbox{margin-top:12px}",
    ".artcardselect .previewbox{margin:0 0 12px}",
    ".artselect{border:1px solid #ececec;border-radius:14px;background:#fff;overflow:hidden}",
    ".artselect .as-head{padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;color:#111}",
    ".artgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:10px}",
    ".artopt{border:1px solid #e5e5e5;background:#fff;border-radius:10px;padding:6px;cursor:pointer;text-align:left}",
    ".artopt.current{border-color:#111;background:#fafafa;box-shadow:0 0 0 2px rgba(17,17,17,.08)}",
    ".artopt.on{border-color:#111;box-shadow:0 0 0 2px rgba(17,17,17,.1)}",
    ".artopt img{width:100%;aspect-ratio:1/1;object-fit:contain;background:#f6f6f7;border-radius:8px;display:block}",
    ".artopt .artname{display:block;margin-top:6px;font-size:11px;line-height:1.25;color:#333;height:28px;overflow:hidden}",
    ".artopt .artbadge{display:inline-block;margin-top:6px;border-radius:999px;background:#111;color:#fff;padding:2px 7px;font-size:10px;line-height:1.2}",
    ".actions{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:10px 12px;border-top:1px solid #eee;background:#fff}",
    ".actions button{flex:1;border:1px solid #ddd;background:#fff;color:#111;border-radius:10px;padding:10px 12px;font-size:13px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px}",
    ".ico{width:16px;height:16px;display:inline-block;flex:0 0 auto;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;fill:none}",
    ".btnlabel{display:inline-block;white-space:nowrap}",
    ".sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}",
    ".actions .uploadbtn{background:#111;color:#fff;border-color:#111}",
    ".actions.initial{padding:14px 12px}",
    ".actions.initial .uploadbtn{width:100%;padding:15px 16px;border-radius:12px;font-size:15px}",
    ".actions .capturebtn{display:none}",
    ".actions.initial .chatbar{display:none}",
    ".actions.ready .uploadbtn,.actions.busy .uploadbtn{flex:0 0 auto;min-width:84px}",
    ".actions.busy .uploadbtn{background:#fff;color:#c0392b;border-color:#f2b8b5}",
    ".chatbar{flex:1;display:flex;align-items:center;gap:6px;min-width:0;border:1px solid #ddd;border-radius:10px;background:#fff;padding:2px 2px 2px 10px}",
    ".chatinput{flex:1;min-width:0;border:none;outline:none;background:transparent;color:#111;font-size:13px;line-height:1.2;padding:9px 0}",
    ".chatinput::placeholder{color:#9a9a9a}",
    ".chatinput:disabled{cursor:not-allowed;color:#999}",
    ".sendbtn{flex:0 0 auto!important;border:none!important;background:#111!important;color:#fff!important;border-radius:8px!important;width:34px!important;height:34px!important;padding:0!important;font-size:12px!important}",
    "@media (hover:none) and (pointer:coarse){.actions.initial{align-items:stretch}.actions.initial .capturebtn{display:block;padding:15px 16px;border-radius:12px;font-size:15px;background:#fff;color:#111;border-color:#d4d4d8}}",
    ".actions button:disabled{opacity:.38;cursor:not-allowed}",
    ".err{background:#fff3f2;border:1px solid #ffd5d0;color:#c0392b;padding:9px 12px;border-radius:10px;font-size:13px}",
    ".badge{display:inline-block;background:#fef3c7;color:#92400e;font-size:10px;padding:2px 7px;border-radius:5px;margin-left:6px}",
    ".toast{position:fixed;bottom:96px;right:24px;z-index:2147483002;background:#111;color:#fff;padding:11px 15px;border-radius:10px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.3);opacity:0;transform:translateY(8px);transition:.2s}",
    ".toast.show{opacity:1;transform:none}",
  ].join("\n");
  root.appendChild(style);

  function icon(name) {
    var paths = {
      upload: '<path d="M12 3v12"></path><path d="m7 8 5-5 5 5"></path><path d="M5 21h14"></path>',
      camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle>',
      send: '<path d="m22 2-7 20-4-9-9-4 20-7z"></path><path d="M22 2 11 13"></path>',
      close: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
      pause: '<path d="M10 4H6v16h4V4z"></path><path d="M18 4h-4v16h4V4z"></path>',
      cancel: '<circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path>',
      cart: '<circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.6 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6l1.6-8.4H5.12"></path>',
      sparkles: '<path d="m12 3-1.9 5.1L5 10l5.1 1.9L12 17l1.9-5.1L19 10l-5.1-1.9L12 3z"></path><path d="M5 3v4"></path><path d="M3 5h4"></path><path d="M19 17v4"></path><path d="M17 19h4"></path>',
    };
    return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || "") + "</svg>";
  }
  function labelIcon(name, text) {
    return icon(name) + '<span class="btnlabel">' + escapeHtml(text) + "</span>";
  }
  function setFabLabel(text) {
    if (!fab) return;
    fab.innerHTML = labelIcon("sparkles", text);
  }

  var fab = document.createElement("button");
  fab.className = "fab" + (cfg.position === "bottom-left" ? " bottom-left" : "");
  root.appendChild(fab);
  setFabLabel(cfg.buttonText);

  var toastEl = document.createElement("div");
  toastEl.className = "toast";
  root.appendChild(toastEl);
  var toastTimer;
  function botToast(m) {
    toastEl.textContent = m; toastEl.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  }

  // ---------- State ----------
  var S = null;
  function freshState() {
    return { step: "await_room", roomFile: null, style: null, budget: null,
             products: [], lastImage: null, spec: null, specFired: false,
             analysis: null, override: false, catalog: getCatalog(), answers: [], qIndex: 0,
             selectedPreviewProduct: null, runToken: null, previewToken: null, autoContextNoted: false,
             specNoted: false };
  }

  var panel, msgsEl, fileInput, captureInput, chatInput;
  function buildPanel() {
    panel = document.createElement("div");
    panel.className = "panel" + (cfg.position === "bottom-left" ? " bottom-left" : "");
    panel.innerHTML =
      '<div class="phead">' +
      '<div class="title"><h3>Xem thử trong phòng bạn</h3><p>' + escapeHtml(S.catalog.shopName || "") + "</p></div>" +
      '<button class="pause" type="button" aria-label="Tạm dừng" title="Tạm dừng">' + icon("pause") + "</button>" +
      '<button class="x" type="button" aria-label="Đóng" title="Đóng">' + icon("close") + "</button></div>" +
      '<div class="msgs"></div>' +
      '<div class="actions initial">' +
      '<button class="uploadbtn" type="button">' + labelIcon("upload", "Tải ảnh lên") + "</button>" +
      '<button class="capturebtn" type="button">' + labelIcon("camera", "Chụp ảnh") + "</button>" +
      '<form class="chatbar">' +
      '<input class="chatinput" type="text" autocomplete="off" placeholder="Nhập yêu cầu chỉnh ảnh..."/>' +
      '<button class="sendbtn" type="submit" aria-label="Gửi" title="Gửi">' + icon("send") + '<span class="sr">Gửi</span></button></form></div>' +
      '<input class="file-upload" type="file" accept="image/*" hidden/>' +
      '<input class="file-capture" type="file" accept="image/*" capture="environment" hidden/>';
    root.appendChild(panel);
    msgsEl = panel.querySelector(".msgs");
    fileInput = panel.querySelector(".file-upload");
    captureInput = panel.querySelector(".file-capture");
    chatInput = panel.querySelector(".chatinput");

    panel.querySelector(".x").onclick = closePanel;
    panel.querySelector(".pause").onclick = pausePanel;
    panel.querySelector(".uploadbtn").onclick = function () {
      if (isBusy()) { cancelFlow(); return; }
      fileInput.click();
    };
    panel.querySelector(".capturebtn").onclick = function () {
      if (!isBusy()) captureInput.click();
    };
    panel.querySelector(".chatbar").onsubmit = submitChat;
    fileInput.onchange = function () { if (fileInput.files[0]) onRoom(fileInput.files[0]); fileInput.value = ""; };
    captureInput.onchange = function () { if (captureInput.files[0]) onRoom(captureInput.files[0]); captureInput.value = ""; };

    // drag-drop ảnh vào panel
    panel.addEventListener("dragover", function (e) { e.preventDefault(); });
    panel.addEventListener("drop", function (e) {
      e.preventDefault(); if (e.dataTransfer.files[0]) onRoom(e.dataTransfer.files[0]);
    });
    updateActions();
  }

  function openPanel() {
    if (panel && S) {
      panel.style.display = "flex";
      fab.classList.add("hidden");
      setFabLabel(cfg.buttonText);
      return;
    }
    S = freshState();
    fab.classList.add("hidden");
    buildPanel();
    botText("Chọn ảnh phòng của bạn để xem thử.");
    updateActions();
  }
  function pausePanel() {
    if (!panel) return;
    panel.style.display = "none";
    setFabLabel("Tiếp tục thử");
    fab.classList.remove("hidden");
  }
  function closePanel() {
    if (panel) panel.remove();
    panel = null; S = null;
    setFabLabel(cfg.buttonText);
    fab.classList.remove("hidden");
  }
  function contactStaff() {
    if (window.VStage && typeof window.VStage.contactStaff === "function") {
      window.VStage.contactStaff({ shopId: cfg.shopId });
      return;
    }
    window.dispatchEvent(new CustomEvent("vstage:contact", { detail: { shopId: cfg.shopId } }));
    botToast("Đã gửi yêu cầu liên hệ.");
  }

  function submitChat(e) {
    e.preventDefault();
    if (!S || !chatInput) return;
    var text = chatInput.value.trim();
    if (!text) return;
    if (isBusy()) {
      botToast("Đang tạo ảnh, hãy đợi xong hoặc bấm Hủy.");
      return;
    }
    if (!S.roomFile) {
      fileInput.click();
      return;
    }
    chatInput.value = "";
    userText(text);
    S.answers.push({ questionId: "chat", label: text, value: text, prompt: text });
    if (S.lastImage || S.step === "result") {
      botText("Mình sẽ chỉnh theo yêu cầu này.");
      generate({ refine: text });
    } else {
      botText("Mình đã ghi chú yêu cầu. Bạn chọn tiếp để mình tạo ảnh.");
    }
    updateActions();
  }

  function newRunToken(label) {
    var token = Date.now() + ":" + (label || "run") + ":" + Math.random().toString(36).slice(2);
    S.runToken = token;
    return token;
  }
  function isBusy() {
    return S && (S.step === "analyzing" || S.step === "generating");
  }
  function updateActions() {
    if (!panel || !S) return;
    var actions = panel.querySelector(".actions");
    var upload = panel.querySelector(".uploadbtn");
    var capture = panel.querySelector(".capturebtn");
    var busy = isBusy();
    var hasRoom = !!S.roomFile;
    if (actions) actions.className = "actions " + (!hasRoom && !busy ? "initial" : (busy ? "busy" : "ready"));
    if (upload) {
      upload.disabled = false;
      upload.innerHTML = busy ? labelIcon("cancel", "Hủy") : labelIcon("upload", hasRoom ? "Tải ảnh" : "Tải ảnh lên");
      upload.setAttribute("aria-label", busy ? "Hủy tạo ảnh" : "Tải ảnh lên");
    }
    if (capture) capture.disabled = busy;
    if (chatInput) {
      chatInput.disabled = !hasRoom || busy;
      chatInput.placeholder = busy ? "Đang tạo ảnh..." : (hasRoom ? "Nhập yêu cầu chỉnh ảnh..." : "Nhập sau khi tải ảnh");
    }
  }
  function cancelFlow() {
    if (!S || !isBusy()) return;
    newRunToken("cancel");
    S.previewToken = null;
    S.spec = null; S.specFired = false;
    S.step = "await_room";
    msgsEl.querySelectorAll(".loadbox").forEach(function (box) {
      box.innerHTML = '<div class="cap">Đã hủy.</div>';
    });
    botText("Đã hủy. Chọn Tải ảnh để tiếp tục.");
    updateActions();
  }
  function retryFlow() {
    if (!S || !S.roomFile) return;
    var room = S.roomFile;
    var analysis = S.analysis;
    S.style = null; S.budget = null; S.spec = null; S.specFired = false;
    S.products = []; S.lastImage = null; S.answers = []; S.qIndex = 0;
    S.selectedPreviewProduct = null; S.previewToken = null; S.override = false;
    S.roomFile = room; S.analysis = analysis;
    newRunToken("retry");
    botText("Mình thử lại ảnh này.");
    updateActions();
    if (analysis) routeByAnalysis(analysis);
    else onRoom(room);
  }

  // ---------- Message renderers ----------
  function scroll() { msgsEl.scrollTop = msgsEl.scrollHeight; }
  function plainText(s) { return escapeHtml(String(s || "").replace(/\*\*/g, "").replace(/\*/g, "")); }

  function botText(t) {
    var r = document.createElement("div"); r.className = "row bot";
    r.innerHTML = '<div class="bubble bot">' + plainText(t) + "</div>";
    msgsEl.appendChild(r); scroll();
    return r;
  }
  function userText(t) {
    var r = document.createElement("div"); r.className = "row user";
    r.innerHTML = '<div class="bubble user">' + escapeHtml(t) + "</div>";
    msgsEl.appendChild(r); scroll();
  }
  function userImage(src) {
    var r = document.createElement("div"); r.className = "row user";
    r.innerHTML = '<img class="uimg" src="' + src + '"/>';
    msgsEl.appendChild(r); scroll();
  }
  function botChips(items, onPick) {
    var r = document.createElement("div"); r.className = "row bot";
    var wrap = document.createElement("div"); wrap.className = "chips";
    items.forEach(function (it) {
      var b = document.createElement("button"); b.className = "chip"; b.textContent = it.label;
      b.onclick = function () { wrap.classList.add("done"); userText(it.label); onPick(it); };
      wrap.appendChild(b);
    });
    r.appendChild(wrap); msgsEl.appendChild(r); scroll();
  }
  function botImageLoading() {
    var r = document.createElement("div"); r.className = "row bot";
    var wrap = document.createElement("div"); wrap.className = "bubble bot genwrap";
    wrap.innerHTML = loadingHtml("Đang tạo ảnh", 0);
    r.appendChild(wrap); msgsEl.appendChild(r); scroll();
    return wrap;
  }
  function loadingHtml(title, activeStep) {
    var steps = ["Phân tích ảnh", "Chọn sản phẩm", "Dàn cảnh"];
    return '<div class="loadbox"><div class="loadtop"><span>' + escapeHtml(title || "Đang xử lý") +
      '</span><span class="spinner"></span></div><div class="skel"></div><div class="bar"><span></span></div>' +
      '<div class="loadsteps">' + steps.map(function (s, i) {
        return '<span' + (i === activeStep ? ' class="on"' : "") + ">" + s + "</span>";
      }).join("") + "</div></div>";
  }
  function setLoadingText(wrap, title, activeStep) {
    if (!wrap) return;
    var titleEl = wrap.querySelector(".loadtop span:first-child");
    if (titleEl) titleEl.textContent = title || "Đang xử lý";
    wrap.querySelectorAll(".loadsteps span").forEach(function (s, i) {
      s.classList.toggle("on", i === activeStep);
    });
  }
  // v0.4.0: chỉ hiện hotspot khi /api/stage định vị được chính sản phẩm trên ảnh đã gen.
  // Không dùng vùng "khả thi" từ ảnh gốc để tránh marker sai/vague.
  function computeHotspots(products, stageHotspots) {
    if (!Array.isArray(stageHotspots) || !stageHotspots.length) return [];
    var out = [];
    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      var h = stageHotspots.find(function (x) { return (x.productId || x.id || x.pid) === p.id; }) || stageHotspots[i];
      if (!h || (h.confidence != null && Number(h.confidence) < 0.55)) continue;
      if (typeof h.x !== "number" || typeof h.y !== "number") continue;
      out.push({
        pid: p.id,
        name: p.name,
        idx: i + 1,
        x: Math.max(0, Math.min(1, h.x)),
        y: Math.max(0, Math.min(1, h.y)),
        w: Math.max(0.02, Math.min(1, h.w || 0.08)),
        h: Math.max(0.02, Math.min(1, h.h || 0.08)),
      });
    }
    return out;
  }

  function stagedImageHtml(data, label, opts) {
    opts = opts || {};
    var products = data.products || [];
    var isArtPreview = profile().previewMode === "multi-single";
    var spots = isArtPreview ? [] : computeHotspots(products, data.hotspots);
    var markers = spots.map(function (s) {
      var cx = (s.x + s.w / 2) * 100, cy = (s.y + s.h / 2) * 100;
      return '<button class="hotspot" data-pid="' + s.pid + '" style="left:' + cx + "%;top:" + cy + '%">' + s.idx + "</button>";
    }).join("");
    var caption = isArtPreview
      ? "Bức tranh đang xem trước được tick sẵn."
      : (spots.length ? "Marker được định vị sau khi gen ảnh. Di chuột/chạm số để xem sản phẩm. " : "") +
        "Ảnh minh hoạ — sản phẩm thật theo card.";
    return (label ? '<div class="ophead"><span>' + escapeHtml(label) + '</span><span>' + escapeHtml(products[0]?.name || "") + "</span></div>" : "") +
      '<div class="imgwrap"><img class="genimg" src="' + data.image + '"/>' + markers + "</div>" +
      '<div class="cap">' + (data.mock ? '<span class="badge">Mẫu</span> ' : "") +
      caption + "</div>" + (opts.skipCards ? "" :
      renderCards(products, S.catalog.currency, {
        defaultChecked: isArtPreview ? true : profile().previewMode !== "multi-single",
        previewCard: isArtPreview,
      }));
  }

  function fillImage(wrap, data) {
    var products = data.products || [];
    wrap.innerHTML = stagedImageHtml(data);
    bindCards(wrap, products);
    bindHotspots(wrap, products);
    scroll();
  }

  function fillMultiImages(wrap, results) {
    var allProducts = [];
    wrap.innerHTML = results.map(function (data, i) {
      allProducts = allProducts.concat(data.products || []);
      return '<div class="option">' + stagedImageHtml(data, "Phương án " + (i + 1)) + "</div>";
    }).join("");
    bindCards(wrap, allProducts);
    bindHotspots(wrap, allProducts);
    scroll();
  }

  // R-005: tương tác hotspot ↔ card (hover/tap đồng bộ 2 chiều, click → popup mua)
  function bindHotspots(wrap, products) {
    wrap.querySelectorAll(".hotspot").forEach(function (sp) {
      var pid = sp.dataset.pid;
      var card = wrap.querySelector('.card[data-pid="' + pid + '"]');
      sp.addEventListener("mouseenter", function () { sp.classList.add("on"); if (card) card.classList.add("hl"); });
      sp.addEventListener("mouseleave", function () { sp.classList.remove("on"); if (card) card.classList.remove("hl"); });
      sp.addEventListener("click", function (e) {
        e.stopPropagation();
        openSpotPopup(sp, products.find(function (p) { return p.id === pid; }));
      });
    });
    wrap.querySelectorAll(".card").forEach(function (card) {
      var sp = wrap.querySelector('.hotspot[data-pid="' + card.dataset.pid + '"]');
      if (!sp) return;
      card.addEventListener("mouseenter", function () { sp.classList.add("on"); });
      card.addEventListener("mouseleave", function () { sp.classList.remove("on"); });
    });
  }

  function openSpotPopup(sp, p) {
    if (!p) return;
    var box = sp.parentNode;
    var old = box.querySelector(".spotpop"); if (old) old.remove();
    var pop = document.createElement("div"); pop.className = "spotpop";
    pop.style.left = sp.style.left; pop.style.top = sp.style.top;
    pop.innerHTML = '<div class="sp-n">' + escapeHtml(p.name) + "</div>" +
      '<div class="sp-p">' + fmtPrice(p.price, S.catalog.currency) + "</div>" +
      "<button>" + labelIcon("cart", "Thêm vào giỏ") + "</button>";
    box.appendChild(pop);
    pop.querySelector("button").onclick = function (e) { e.stopPropagation(); addToCart(p); pop.remove(); };
    setTimeout(function () {
      root.addEventListener("click", function close() { if (pop.parentNode) pop.remove(); root.removeEventListener("click", close); });
    }, 0);
  }

  // R-007: variants
  function getVariants(p) { return Array.isArray(p.variants) && p.variants.length ? p.variants : null; }
  function defaultVariant(p) {
    var vs = getVariants(p); if (!vs) return null;
    var inStock = vs.filter(function (v) { return v.inStock !== false; });
    return inStock[0] || vs[0];
  }
  function allOOS(p) { var vs = getVariants(p); return vs ? vs.every(function (v) { return v.inStock === false; }) : false; }

  // R-002 + R-007: product cards có checkbox chọn sản phẩm + swatch biến thể.
  function renderCards(products, cur, opts) {
    opts = opts || {};
    if (!products.length) return "";
    var cards = products.map(function (p) {
      var vs = getVariants(p), def = defaultVariant(p);
      var previewImg = opts.previewImagesById && opts.previewImagesById[p.id];
      var img = previewImg || (def && def.cutoutImage) || p.thumbnail || p.cutoutImage || "";
      var price = def ? def.price : p.price;
      var effid = def ? def.id : p.id;
      var disabled = allOOS(p) ? " disabled" : "";
      var isChecked = opts.checkedIds ? !!opts.checkedIds[p.id] : !!opts.defaultChecked;
      var checked = isChecked && !disabled ? " checked" : "";
      var sw = vs ? '<div class="swatches">' + vs.map(function (v) {
        var oos = v.inStock === false, sel = def && v.id === def.id;
        return '<button class="swatch' + (sel ? " sel" : "") + (oos ? " oos" : "") + '"' +
          ' data-vid="' + v.id + '" data-img="' + escapeHtml(v.cutoutImage || img) + '"' +
          ' data-price="' + (v.price || price) + '" title="' + escapeHtml((v.label || "") + (oos ? " (Hết hàng)" : "")) + '"' +
        ' style="background:' + (v.swatch || "#ddd") + '"></button>';
      }).join("") + "</div>" : "";
      return '<div class="card' + (opts.previewCard ? " preview-card" : "") + '" data-pid="' + p.id + '" data-effid="' + effid + '" data-price="' + price + '">' +
        '<label class="pick" title="' + (opts.previewSelector ? "Xem trước tranh này" : (opts.previewCard ? "Tranh đang xem trước" : "Chọn sản phẩm")) + '">' +
        '<input class="pickbox" type="checkbox"' + disabled + checked + "/></label>" +
        '<img class="cimg" src="' + img + '"/>' +
        '<div class="ci">' + (opts.previewCard ? '<div class="previewtag">Đang xem trước</div>' : "") +
        '<div class="cn">' + escapeHtml(p.name) + "</div>" +
        '<div class="cp">' + fmtPrice(price, cur) + "</div>" + sw + "</div></div>";
    }).join("");
    var bar = '<div class="selectbar"><div><div class="bt">Đã chọn <span class="selcount">0 món</span></div>' +
      '<div class="bp selprice">' + fmtPrice(0, cur) + "</div></div>" +
      '<button class="selectedbtn" disabled>' + labelIcon("cart", "Thêm đã chọn") + "</button></div>";
    return '<div class="cards">' + cards + "</div>" + bar;
  }

  function bindCards(wrap, products, opts) {
    opts = opts || {};
    wrap.querySelectorAll(".card").forEach(function (card) {
      var p = products.find(function (x) { return x.id === card.dataset.pid; });
      var pick = card.querySelector(".pickbox");
      // chọn variant → cập nhật card TẠI CHỖ, KHÔNG gen lại ảnh phòng (R-007)
      card.querySelectorAll(".swatch").forEach(function (sw) {
        if (sw.classList.contains("oos")) return;
        sw.onclick = function () {
          card.querySelectorAll(".swatch").forEach(function (s) { s.classList.remove("sel"); });
          sw.classList.add("sel");
          card.dataset.effid = sw.dataset.vid;
          card.dataset.price = sw.dataset.price;
          var im = card.querySelector(".cimg"); if (im && sw.dataset.img) im.src = sw.dataset.img;
          var cp = card.querySelector(".cp"); if (cp) cp.textContent = fmtPrice(Number(sw.dataset.price), S.catalog.currency);
          refreshSelection(wrap);
        };
      });
      if (pick) pick.onchange = function () {
        if (opts.singleSelect) {
          if (!pick.checked) {
            pick.checked = true;
            return;
          }
          wrap.querySelectorAll(".card").forEach(function (other) {
            if (other === card) return;
            var otherPick = other.querySelector(".pickbox");
            if (otherPick) otherPick.checked = false;
            other.classList.remove("sel");
          });
          if (typeof opts.onPick === "function") opts.onPick(p, card);
        }
        card.classList.toggle("sel", pick.checked);
        refreshSelection(wrap);
      };
      if (opts.previewSelector && pick) {
        card.onclick = function (e) {
          if (e.target.closest(".pick,input,button,.swatch")) return;
          pick.checked = true;
          pick.onchange();
        };
      }
    });
    refreshSelection(wrap);
    var selectedBtn = wrap.querySelector(".selectedbtn");
    if (selectedBtn) selectedBtn.onclick = function () {
      var n = 0;
      wrap.querySelectorAll(".card").forEach(function (card) {
        var pick = card.querySelector(".pickbox");
        if (!pick || !pick.checked || pick.disabled) return;
        var p = products.find(function (x) { return x.id === card.dataset.pid; });
        cartAdd(card.dataset.effid, p, true); n++;
      });
      if (n) botToast("Đã thêm " + n + " sản phẩm vào giỏ.");
    };
  }

  function renderArtResultSelector(results) {
    if (!results.length) return "";
    var cur = currentProductId();
    var selected = results.find(function (item) { return cur && item.product && item.product.id === cur; }) || results[0];
    var checkedIds = {};
    var previewImagesById = {};
    var products = results.map(function (item) {
      var p = (item.data && item.data.products && item.data.products[0]) || item.product || {};
      if (item.data && item.data.image) previewImagesById[p.id] = item.data.image;
      if (selected && item.product && selected.product && item.product.id === selected.product.id) checkedIds[p.id] = true;
      return p;
    });
    return '<div class="artcardselect" data-selected-pid="' + escapeHtml((selected && selected.product && selected.product.id) || "") + '">' +
      '<div class="previewbox"></div>' +
      renderCards(products, S.catalog.currency, {
        checkedIds: checkedIds,
        previewImagesById: previewImagesById,
        previewSelector: true,
      }) + "</div>";
  }

  function bindArtResultSelector(wrap, results) {
    var products = results.map(function (item) {
      return (item.data && item.data.products && item.data.products[0]) || item.product || {};
    });
    var selectedPid = wrap.querySelector(".artcardselect")?.dataset.selectedPid;
    var selected = results.find(function (item) {
      return item.product && item.product.id === selectedPid;
    }) || results[0];
    bindCards(wrap, products, { previewSelector: true });
    wrap.querySelectorAll(".card").forEach(function (card) {
      var pick = card.querySelector(".pickbox");
      if (!pick) return;
      pick.onchange = function () {
        pick.checked = true;
        wrap.querySelectorAll(".card").forEach(function (other) {
          var otherPick = other.querySelector(".pickbox");
          var isCurrent = other === card;
          if (otherPick) otherPick.checked = isCurrent;
          other.classList.toggle("sel", isCurrent);
        });
        refreshSelection(wrap);
        var item = results.find(function (x) {
          var p = (x.data && x.data.products && x.data.products[0]) || x.product || {};
          return p.id === card.dataset.pid;
        });
        if (item) showArtPreview(wrap, item);
      };
    });
    showArtPreview(wrap, selected);
  }

  function generateArtPreviews(wrap, products, token, runToken) {
    var done = 0;
    setLoadingText(wrap, "Đang tạo " + products.length + " ảnh xem trước", 2);
    Promise.all(products.map(function (product) {
      return postStage({ products: [product], style: S.style, mode: "art-preview", answers: S.answers })
        .then(function (data) {
          done++;
          if (S.previewToken === token && S.runToken === runToken) setLoadingText(wrap, "Đã tạo " + done + "/" + products.length + " ảnh xem trước", 2);
          return { ok: true, product: product, data: data };
        })
        .catch(function (err) {
          done++;
          if (S.previewToken === token && S.runToken === runToken) setLoadingText(wrap, "Đã tạo " + done + "/" + products.length + " ảnh xem trước", 2);
          return { ok: false, product: product, err: err };
        });
    })).then(function (items) {
      if (S.previewToken !== token || S.runToken !== runToken) return;
      var results = items.filter(function (x) { return x.ok && x.data && x.data.image; });
      if (!results.length) {
        wrap.classList.remove("genwrap"); wrap.className = "bubble bot";
        wrap.innerHTML = '<div class="err">Chưa tạo được ảnh xem trước cho tranh. Vui lòng thử ảnh khác.</div>';
        S.step = "select_preview";
        updateActions();
        return;
      }
      S.step = "select_preview";
      wrap.innerHTML = renderArtResultSelector(results);
      bindArtResultSelector(wrap, results);
      botText("Đã có ảnh xem trước. Tick card tranh bạn muốn xem.");
      updateActions();
      scroll();
    });
  }

  function showArtPreview(wrap, item) {
    var box = wrap.querySelector(".previewbox");
    if (!box) return;
    var product = item.product;
    var data = item.data || {};
    S.selectedPreviewProduct = product;
    S.products = [product];
    S.lastImage = data.image;
    S.step = "result";
    box.innerHTML = stagedImageHtml(data, "Xem trước", { skipCards: true });
    bindHotspots(box, data.products || [product]);
    updateActions();
    scroll();
  }

  function refreshSelection(wrap) {
    var countEl = wrap.querySelector(".selcount");
    var priceEl = wrap.querySelector(".selprice");
    var selectedBtn = wrap.querySelector(".selectedbtn");
    if (!countEl || !priceEl) return;
    var total = 0;
    var count = 0;
    wrap.querySelectorAll(".card").forEach(function (card) {
      var pick = card.querySelector(".pickbox");
      var selected = !!(pick && pick.checked && !pick.disabled);
      card.classList.toggle("sel", selected);
      if (!selected) return;
      count++;
      total += Number(card.dataset.price) || 0;
    });
    countEl.textContent = count + " món";
    priceEl.textContent = fmtPrice(total, S.catalog.currency);
    if (selectedBtn) selectedBtn.disabled = count === 0;
  }

  function cartAdd(id, p, silent) {
    if (window.VStage && typeof window.VStage.addToCart === "function") {
      window.VStage.addToCart(id, 1);
      if (!silent) botToast("Đã thêm vào giỏ.");
    } else if (p && p.productUrl && p.productUrl !== "#") {
      window.location.href = p.productUrl;
    } else if (!silent) botToast("Đã chọn sản phẩm");
  }

  // R-007: gợi ý variant bằng text, không gen lại.
  function suggestVariants(products) {
    var withV = products.filter(function (p) { var vs = getVariants(p); return vs && vs.length > 1; });
    if (!withV.length) return;
    var lines = withV.slice(0, 2).map(function (p) {
      var labels = getVariants(p).filter(function (v) { return v.inStock !== false; })
        .map(function (v) { return v.label; }).filter(Boolean);
      return "“" + p.name + "” còn " + labels.join(", ");
    });
    botText(lines.join("; ") + ". Chọn màu trên card nếu cần.");
  }

  // ---------- Flow ----------
  function onRoom(file) {
    var runToken = newRunToken("upload");
    S.roomFile = file; S.override = false; S.analysis = null; S.step = "analyzing";
    updateActions();
    var reader = new FileReader();
    reader.onload = function (e) {
      if (S.runToken !== runToken) return;
      userImage(e.target.result);
      var thinking = botImageLoading();
      setLoadingText(thinking, "Đang phân tích ảnh", 0);
      // R-006: 1 vision pass phân tích ảnh đầu vào
      postAnalyze().then(function (a) {
        if (S.runToken !== runToken) return;
        if (thinking) thinking.remove();
        S.analysis = a;
        routeByAnalysis(a);
      }).catch(function () {
        if (S.runToken !== runToken) return;
        if (thinking) thinking.remove();
        S.analysis = null; // lỗi vision → cứ coi như tốt, không chặn luồng
        proceedGood();
      });
    };
    reader.readAsDataURL(file);
  }

  // R-006: rẽ nhánh theo kết quả phân tích
  function routeByAnalysis(a) {
    if (a && a.isRoom === false) {
      S.step = "await_room";
      botText("Ảnh này chưa phải không gian nội thất. Vui lòng chọn ảnh phòng hoặc góc trưng bày.");
      updateActions();
      return;
    }
    var bad = a && (a.quality === "poor" || a.angle === "bad");
    if (bad && !S.override) { renderFallback(a); return; }
    proceedGood();
  }

  // Nhánh ảnh TỐT → speculative + hỏi style → ngân sách → gen
  function proceedGood() {
    S.step = "store_questions";
    updateActions();
    fireSpeculative(); // chỉ chạy nếu data-speculative="true"
    askStoreQuestion(0);
  }

  // Nhánh ảnh XẤU (R-006 nhánh 2): KHÔNG gen, đề xuất sản phẩm theo detectedItems + cho override/retake
  function renderFallback(a) {
    S.step = "fallback";
    updateActions();
    var items = (a && a.detectedItems && a.detectedItems.length) ? a.detectedItems.join(", ") : "không gian của bạn";
    botText("Ảnh hơi khó dựng. Mình gợi ý vài sản phẩm phù hợp với " + items + ".");
    var recs = chooseProducts(S.catalog, { answers: S.answers });
    var wrap = document.createElement("div"); wrap.className = "row bot";
    var b = document.createElement("div"); b.className = "bubble bot genwrap";
    b.innerHTML = renderCards(recs, S.catalog.currency);
    wrap.appendChild(b); msgsEl.appendChild(wrap); bindCards(b, recs); scroll();
    // nút hành động
    botChips(
      [{ label: "Chọn ảnh khác", value: "retake" }, { label: "Vẫn thử ảnh này", value: "force" }],
      function (it) {
        if (it.value === "retake") { restart(); }
        else { S.override = true; botText("Mình sẽ thử với ảnh này."); proceedGood(); }
      }
    );
  }
  function storeQuestions() {
    var qs = S.catalog && S.catalog.stagingProfile && Array.isArray(S.catalog.stagingProfile.questions)
      ? S.catalog.stagingProfile.questions
      : FALLBACK_QUESTIONS;
    return qs.filter(function (q) { return q && q.text && Array.isArray(q.chips) && q.chips.length; });
  }

  function selectedAnswer(q, it) {
    return {
      questionId: q.id,
      label: it.label,
      value: it.value,
      tags: it.tags || null,
      categories: it.categories || null,
      prompt: it.prompt || "",
    };
  }

  function inferContext() {
    var a = S.analysis || {};
    var text = norm([
      a.environment,
      a.roomType,
      a.detectedItems,
      a.suggestedContext,
      (a.hotspots || []).map(function (h) { return h.area; }),
    ]);
    var ctx = { text: text };
    ctx.outdoor = includesAny(text, ["ngoài trời", "ban công", "sân", "vườn", "outdoor", "balcony", "garden"]);
    ctx.indoor = !ctx.outdoor && includesAny(text, ["trong nhà", "phòng", "bàn", "sofa", "giường", "tường", "văn phòng", "indoor", "room", "office"]);
    ctx.desk = includesAny(text, ["bàn", "laptop", "máy tính", "desk", "office", "văn phòng"]);
    ctx.floor = includesAny(text, ["sàn", "góc", "floor", "corner"]);
    ctx.wall = includesAny(text, ["tường", "wall", "trống"]);
    ctx.living = includesAny(text, ["phòng khách", "sofa", "living"]);
    ctx.bedroom = includesAny(text, ["phòng ngủ", "giường", "bedroom", "bed"]);
    ctx.lobby = includesAny(text, ["lễ tân", "sảnh", "lối vào", "reception", "lobby", "entry"]);
    ctx.shelf = includesAny(text, ["kệ", "shelf", "console"]);
    return ctx;
  }

  function chipText(chip) {
    return norm([chip.label, chip.value, chip.prompt, chip.tags, chip.categories]);
  }

  function chipContextScore(chip, ctx) {
    var t = chipText(chip), score = 0;
    if (ctx.desk && includesAny(t, ["desk", "bàn", "văn phòng", "office"])) score += 5;
    if (ctx.floor && includesAny(t, ["floor", "sàn", "góc"])) score += 5;
    if (ctx.shelf && includesAny(t, ["kệ", "treo", "shelf"])) score += 4;
    if (ctx.living && includesAny(t, ["phòng khách", "living"])) score += 5;
    if (ctx.bedroom && includesAny(t, ["phòng ngủ", "bedroom"])) score += 5;
    if (ctx.lobby && includesAny(t, ["lễ tân", "sảnh", "lối vào", "lobby"])) score += 5;
    if (ctx.outdoor && includesAny(t, ["ngoài trời", "ban công", "outdoor"])) score += 5;
    if (ctx.indoor && includesAny(t, ["trong nhà", "indoor", "chịu bóng", "sáng gián tiếp"])) score += 4;
    return score;
  }

  function rankedChips(chips, ctx) {
    return chips.map(function (chip, index) {
      return { chip: chip, score: chipContextScore(chip, ctx), index: index };
    }).sort(function (a, b) {
      return (b.score - a.score) || (a.index - b.index);
    }).map(function (item) { return item.chip; });
  }

  function smartChips(q, chips, ctx) {
    var out = chips.slice();
    if (q.id === "loaiCay") {
      if (ctx.outdoor) out = out.filter(function (c) { return c.value === "outdoor"; });
      else if (ctx.indoor || ctx.desk) out = out.filter(function (c) { return c.value !== "outdoor"; });
    }
    return out.length ? out : chips;
  }

  function autoChip(q, chips, ctx) {
    if (["phongHop", "viTri", "loaiCay"].indexOf(q.id) === -1) return null;
    var scored = chips.map(function (c) { return { chip: c, score: chipContextScore(c, ctx) }; })
      .sort(function (a, b) { return b.score - a.score; });
    if (scored[0] && scored[0].score >= 5) return scored[0].chip;
    if (q.id === "loaiCay" && chips.length === 1) return chips[0];
    return null;
  }

  function noteSmartSkip(chip) {
    if (S.autoContextNoted) return;
    S.autoContextNoted = true;
    botText("Đã nhận ra bối cảnh: " + chip.label + ". Mình hỏi tiếp thông tin còn thiếu.");
  }

  function askStoreQuestion(index) {
    var qs = storeQuestions();
    if (index >= qs.length) {
      generate();
      return;
    }
    S.qIndex = index;
    var q = qs[index];
    var ctx = inferContext();
    var chips = smartChips(q, q.chips, ctx);
    var firstChoice = index === 0 && !S.answers.length;
    if (firstChoice) {
      var minCount = Math.min(3, q.chips.length);
      if (chips.length < minCount) chips = rankedChips(q.chips, ctx);
      chips = rankedChips(chips, ctx).slice(0, 3);
    }
    var picked = firstChoice ? null : autoChip(q, chips, ctx);
    if (picked) {
      S.answers.push(selectedAnswer(q, picked));
      if (q.id === "budget") S.budget = picked.value;
      if (q.id === "style") S.style = picked.value;
      noteSmartSkip(picked);
      askStoreQuestion(index + 1);
      return;
    }
    botText(firstChoice ? "Chọn nhanh một hướng để mình tối ưu ảnh:" : q.text);
    botChips(chips, function (it) {
      S.answers.push(selectedAnswer(q, it));
      if (q.id === "budget") S.budget = it.value;
      if (q.id === "style") S.style = it.value;
      askStoreQuestion(index + 1);
    });
  }

  // R-004: speculative — chỉ 1 lần/phiên, style mặc định, sản phẩm phổ biến (không lọc ngân sách)
  function fireSpeculative() {
    if (!cfg.speculative) return;
    if (S.specFired) return; S.specFired = true;
    var products = chooseProducts(S.catalog, { answers: S.answers });
    S.spec = { products: products, promise: postStage({ products: products, style: SPEC_STYLE, mode: "speculative", answers: S.answers }) };
    S.spec.promise.catch(function () {}); // nuốt lỗi ngầm, không phá UI
    if (!S.specNoted) {
      S.specNoted = true;
      botText("Mình đang dựng thử trước một mẫu phù hợp/bán chạy.");
    }
  }

  function profile() {
    return (S.catalog && S.catalog.stagingProfile) || {};
  }

  function generate(opts) {
    opts = opts || {};
    S.step = "generating";
    var runToken = S.runToken || newRunToken("generate");
    updateActions();
    var wrap = botImageLoading();
    var prof = profile();

    if (!opts.refine && prof.previewMode === "multi-single") {
      var count = Math.max(1, Math.min(Number(prof.previewCount) || 3, 3));
      var candidates = chooseProducts(S.catalog, { budget: S.budget, answers: S.answers, limit: count });
      candidates = withCurrentProduct(candidates, S.catalog).slice(0, count);
      S.products = candidates;
      S.previewToken = runToken + ":art";
      generateArtPreviews(wrap, candidates, S.previewToken, runToken);
      return;
    }

    var desiredProducts = opts.refine && S.products && S.products.length
      ? S.products
      : chooseProducts(S.catalog, { budget: S.budget, answers: S.answers });
    // Chỉ reuse speculative nếu style VÀ danh sách sản phẩm giống nhau.
    // Nếu user chọn ngân sách/lọc khác, phải gen lại đúng bộ đề xuất.
    var reuse = !opts.refine && S.style === SPEC_STYLE && S.spec && sameProductIds(S.spec.products, desiredProducts);
    var products = reuse ? S.spec.products : desiredProducts;
    S.products = products;

    var p = reuse ? S.spec.promise
      : postStage({ products: products, style: S.style, refine: opts.refine || "", answers: S.answers });

    // Nếu speculative call lỗi, retry bằng request thường để không kẹt UI ở lỗi cũ.
    if (reuse) {
      p = p.catch(function () {
        return postStage({ products: products, style: S.style, refine: opts.refine || "", answers: S.answers });
      });
    }

    p.then(function (data) {
      if (S.runToken !== runToken) return;
      S.lastImage = data.image; S.step = "result";
      fillImage(wrap, data);
      updateActions();
      if (!opts.refine) {
        suggestVariants(S.products);
        botText("Đã tạo ảnh. Tick sản phẩm để thêm vào giỏ.");
      }
    }).catch(function (err) {
      if (S.runToken !== runToken) return;
      wrap.classList.remove("genwrap"); wrap.className = "bubble bot";
      wrap.innerHTML = '<div class="err">' + escapeHtml(err.message || "Lỗi tạo ảnh") + "</div>";
      S.step = "result";
      updateActions();
    });
  }

  function restart() {
    S.step = "await_room"; S.roomFile = null; S.style = null; S.budget = null;
    S.spec = null; S.specFired = false; S.products = []; S.analysis = null; S.override = false; S.answers = []; S.qIndex = 0;
    botText("Chọn ảnh khác để thử lại.");
    updateActions();
  }

  // ---------- API ----------
  function postAnalyze() {
    var fd = new FormData();
    fd.append("room", S.roomFile);
    fd.append("shopId", cfg.shopId);
    return fetch(cfg.apiBase + "/api/analyze", { method: "POST", body: fd })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.error) throw new Error(d.error); return d.analysis || null; });
  }

  function postStage(o) {
    var fd = new FormData();
    fd.append("room", S.roomFile);
    fd.append("products", JSON.stringify(o.products || []));
    fd.append("shopId", cfg.shopId);
    if (o.style) fd.append("style", o.style);
    if (o.refine) fd.append("refine", o.refine);
    if (o.mode) fd.append("mode", o.mode);
    if (o.answers) fd.append("answers", JSON.stringify(o.answers || []));
    return fetch(cfg.apiBase + "/api/stage", { method: "POST", body: fd })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || res.d.error) throw new Error(res.d.error || "Lỗi tạo ảnh");
        return res.d;
      });
  }

  fab.onclick = openPanel;
})();
