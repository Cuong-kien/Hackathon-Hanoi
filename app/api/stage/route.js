import OpenAI, { toFile } from "openai";
import fs from "fs/promises";
import path from "path";
import { getShopList } from "@/lib/store";

// Node runtime (cần để xử lý file buffer + gọi OpenAI SDK)
export const runtime = "nodejs";
export const maxDuration = 300; // gpt-image-1 có thể mất 10-40s

const MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const QUALITY = process.env.OPENAI_IMAGE_QUALITY || "medium";
const SIZE = process.env.OPENAI_IMAGE_SIZE || "1536x1024";
const MAX_PRODUCTS = 4; // giới hạn để nhanh + ổn định
const HOTSPOT_MODEL = process.env.OPENAI_HOTSPOT_MODEL || process.env.OPENAI_VISION_MODEL || "gpt-4o";
const ENABLE_POSTGEN_HOTSPOTS = process.env.POSTGEN_HOTSPOTS !== "0";

// --- CORS: widget được nhúng trên site khác origin ---
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

const STYLE_MAP = {
  "bac-au": "phong cách Bắc Âu (Scandinavian): tối giản, gỗ sáng, tông trắng/be, nhiều ánh sáng tự nhiên",
  "hien-dai": "phong cách hiện đại tối giản: đường nét gọn gàng, tông màu trung tính, sạch sẽ",
  "co-dien": "phong cách cổ điển ấm cúng: gỗ tối, chi tiết tinh tế, ánh sáng vàng dịu",
  "tu-nhien": "phong cách tự nhiên, nhiều ánh sáng mềm, giữ cảm giác đời thường và sạch sẽ",
  luxury: "phong cách sang trọng tiết chế: bề mặt gọn, ánh sáng ấm, vật phẩm nổi bật nhưng không rối",
  gallery: "phong cách gallery treo tranh: tường sạch, ánh sáng đều, khung tranh đúng tỉ lệ",
};

function findShop(shopId) {
  if (!shopId) return null;
  return getShopList().find((s) => s.id === shopId || s.slug === shopId) || null;
}

function selectedIntent(answers) {
  if (!Array.isArray(answers)) return "";
  return answers.map((a) => a?.prompt || a?.label).filter(Boolean).join(" ");
}

function textOf(v) {
  if (Array.isArray(v)) return v.join(", ");
  if (v && typeof v === "object") return Object.values(v).map(textOf).filter(Boolean).join(", ");
  return String(v || "");
}

// R-003/v0.4.0: hướng BEAUTIFY nhưng kiểm soát chặt số lượng và profile từng store.
function buildPrompt(products, opts = {}) {
  const { style, refine, shop, answers } = opts;
  const profile = shop?.stagingProfile || {};
  const styleKey = style || profile.defaultStyle || "";
  const lines = products.map((p, i) => {
    const hint = p.placementHint ? ` (${p.placementHint})` : "";
    const size = p.realWidthCm ? `, rộng khoảng ${p.realWidthCm}cm` : "";
    const tags = p.tags ? ` Tags: ${textOf(p.tags)}.` : "";
    return `- Sản phẩm ${i + 1}: "${p.name}"${size}${hint}.${tags} Dùng ảnh tham chiếu thứ ${i + 2}.`;
  });

  const parts = [
    "Bạn là chuyên gia dàn cảnh & chụp ảnh nội thất cao cấp (interior staging photographer).",
    "Ảnh ĐẦU TIÊN là không gian gốc của khách. Giữ bố cục kiến trúc chính (tường, sàn, cửa sổ, vị trí nội thất lớn). Chỉ chỉnh ánh sáng, cân màu và bóng đổ vừa đủ để ảnh đẹp hơn.",
    "QUY TẮC CỨNG: chỉ đặt đúng các sản phẩm trong danh sách bên dưới. KHÔNG thêm sản phẩm phụ cùng loại, KHÔNG thêm đồ nội thất lớn, KHÔNG thêm tranh/cây/tượng/đèn ngoài danh sách, KHÔNG thêm chữ hoặc watermark.",
    profile.prompt ? `Quy chuẩn riêng của store "${shop?.name || ""}": ${profile.prompt}` : "",
    profile.compositionMode === "primary-plus-support"
      ? "Bố cục: Sản phẩm 1 là HERO chính, đặt rõ nhất. Các sản phẩm còn lại chỉ là phụ kiện hỗ trợ, nhỏ hơn/ít nổi hơn, dùng để làm bố cục đầy đặn nhưng không tranh spotlight."
      : "",
    profile.previewMode === "multi-single"
      ? "Preview tranh: request này chỉ có MỘT bức tranh. Chỉ treo bức tranh đó, không tạo gallery wall, không thêm tranh khác."
      : "",
    selectedIntent(answers) ? `Ý định khách đã chọn qua câu hỏi của store: ${selectedIntent(answers)}` : "",
    "Đặt sản phẩm vào không gian tự nhiên, đúng tỉ lệ, đúng phối cảnh, bóng đổ mềm và ánh sáng khớp ảnh gốc:",
    ...lines,
    styleKey && STYLE_MAP[styleKey] ? `Tổng thể theo ${STYLE_MAP[styleKey]}.` : "",
    "Sản phẩm phải GIỮ ĐÚNG kiểu dáng, màu sắc, chất liệu, artwork/nội dung in và tỉ lệ như ảnh tham chiếu. Nếu không chắc vị trí, ưu tiên đặt ít sản phẩm hơn và giữ ảnh sạch.",
    "Kết quả: ảnh photorealistic, sắc nét, không méo, không chữ, không watermark.",
  ];
  if (refine) parts.push(`Điều chỉnh thêm theo yêu cầu khách: "${refine}".`);
  return parts.filter(Boolean).join("\n");
}

async function locateHotspots(openai, imageDataUrl, products) {
  if (!ENABLE_POSTGEN_HOTSPOTS || !products.length) return [];
  const productLines = products.map((p, i) => `${i + 1}. productId="${p.id}", name="${p.name}"`).join("\n");
  const prompt = [
    "Bạn là bộ định vị vật thể cho ảnh staging đã tạo.",
    "Hãy tìm chính xác từng sản phẩm trong danh sách trên ảnh. Chỉ trả JSON.",
    "Toạ độ bbox chuẩn hoá 0..1 theo chiều rộng/cao ảnh.",
    "Nếu không thấy rõ hoặc không chắc sản phẩm nào, bỏ qua sản phẩm đó thay vì đoán.",
    "Schema: {\"hotspots\":[{\"productId\":\"...\",\"x\":0..1,\"y\":0..1,\"w\":0..1,\"h\":0..1,\"confidence\":0..1}]}",
    "Danh sách sản phẩm:",
    productLines,
  ].join("\n");

  try {
    const resp = await openai.chat.completions.create({
      model: HOTSPOT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    });
    const parsed = JSON.parse(resp.choices?.[0]?.message?.content || "{}");
    const ids = new Set(products.map((p) => p.id));
    return Array.isArray(parsed.hotspots)
      ? parsed.hotspots
          .filter((h) => ids.has(h.productId) && typeof h.x === "number" && typeof h.y === "number")
          .slice(0, products.length)
          .map((h) => ({
            productId: h.productId,
            x: Math.max(0, Math.min(1, Number(h.x))),
            y: Math.max(0, Math.min(1, Number(h.y))),
            w: Math.max(0.02, Math.min(1, Number(h.w) || 0.08)),
            h: Math.max(0.02, Math.min(1, Number(h.h) || 0.08)),
            confidence: Math.max(0, Math.min(1, Number(h.confidence) || 0)),
          }))
      : [];
  } catch (err) {
    console.warn("[/api/stage] hotspot fallback:", err?.message || err);
    return [];
  }
}

function extFromType(type, fallback = "png") {
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  if (type.includes("png")) return "png";
  return fallback;
}

function typeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

async function urlToFile(url, name, baseUrl) {
  // Server-side fetch không parse được URL tương đối như /images/a.jpg.
  // Với asset local trong public/, đọc thẳng từ filesystem để tránh phụ thuộc localhost fetch.
  if (typeof url === "string" && url.startsWith("/")) {
    const cleanPath = decodeURIComponent(url.split("?")[0]);
    const publicRoot = path.join(process.cwd(), "public");
    const filePath = path.normalize(path.join(publicRoot, cleanPath));
    if (!filePath.startsWith(publicRoot)) throw new Error(`Đường dẫn ảnh không hợp lệ: ${url}`);
    const buf = await fs.readFile(filePath);
    const type = typeFromPath(filePath);
    return toFile(buf, `${name}.${extFromType(type)}`, { type });
  }

  const absoluteUrl = new URL(url, baseUrl).toString();
  const res = await fetch(absoluteUrl);
  if (!res.ok) throw new Error(`Không tải được ảnh sản phẩm: ${url} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get("content-type") || "image/png";
  if (!type.startsWith("image/")) throw new Error(`URL không phải ảnh: ${url}`);
  return toFile(buf, `${name}.${extFromType(type)}`, { type });
}

export async function POST(req) {
  try {
    const form = await req.formData();
    const room = form.get("room");
    const productsRaw = form.get("products");
    const shopId = form.get("shopId") || "";
    const style = form.get("style") || "";        // bac-au | hien-dai | co-dien
    const refine = form.get("refine") || "";       // câu chỉnh sửa tự do (R-001 refine)
    const mode = form.get("mode") || "normal";     // normal | speculative (R-004)
    const answersRaw = form.get("answers") || "[]";
    const shop = findShop(shopId);
    let answers = [];
    try {
      answers = JSON.parse(answersRaw || "[]");
    } catch {
      answers = [];
    }

    if (!room || typeof room === "string") {
      return json({ error: "Thiếu ảnh phòng (field 'room')." }, 400);
    }

    let products = [];
    try {
      products = JSON.parse(productsRaw || "[]");
    } catch {
      return json({ error: "Field 'products' không phải JSON hợp lệ." }, 400);
    }
    if (!Array.isArray(products) || products.length === 0) {
      return json({ error: "Cần chọn ít nhất 1 sản phẩm." }, 400);
    }
    const profileMax = Number(shop?.stagingProfile?.maxProducts) || MAX_PRODUCTS;
    products = products.slice(0, Math.min(MAX_PRODUCTS, profileMax));

    const roomBuf = Buffer.from(await room.arrayBuffer());

    // --- MOCK MODE: chưa có API key -> trả lại ảnh phòng để test UI ---
    if (!process.env.OPENAI_API_KEY) {
      const dataUrl = `data:${room.type || "image/png"};base64,${roomBuf.toString("base64")}`;
      return json({
        image: dataUrl,
        products,
        hotspots: [],
        style,
        mode,
        mock: true,
        note: "MOCK MODE (chưa set OPENAI_API_KEY) — trả lại ảnh gốc, chưa ghép sản phẩm.",
      });
    }

    const openai = new OpenAI();
    const roomFile = await toFile(roomBuf, "room.png", { type: room.type || "image/png" });

    // Tải ảnh cutout sản phẩm làm reference
    const productFiles = [];
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const candidates = [p.cutoutImage, p.thumbnail].filter(Boolean);
      if (!candidates.length) {
        throw new Error(`Sản phẩm "${p.name || p.id || i + 1}" thiếu ảnh tham chiếu.`);
      }

      let file = null;
      let lastErr = null;
      for (const src of candidates) {
        try {
          file = await urlToFile(src, `product-${i}`, req.url);
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!file) {
        throw new Error(`Không tải được ảnh sản phẩm "${p.name || p.id || i + 1}": ${lastErr?.message || "lỗi ảnh"}`);
      }
      productFiles.push(file);
    }

    if (!productFiles.length) {
      return json({ error: "Không có ảnh sản phẩm hợp lệ để dựng cảnh." }, 400);
    }

    const result = await openai.images.edit({
      model: MODEL,
      image: [roomFile, ...productFiles], // ảnh đầu = phòng, còn lại = sản phẩm tham chiếu
      prompt: buildPrompt(products, { style, refine, shop, answers }),
      size: SIZE,
      quality: QUALITY,
    });

    const b64 = result?.data?.[0]?.b64_json;
    if (!b64) return json({ error: "OpenAI không trả về ảnh." }, 502);

    const image = `data:image/png;base64,${b64}`;
    const hotspots = await locateHotspots(openai, image, products);
    return json({ image, products, hotspots, style, mode, mock: false });
  } catch (err) {
    console.error("[/api/stage] error:", err);
    return json({ error: err?.message || "Lỗi không xác định khi tạo ảnh." }, 500);
  }
}
