import fs from "fs/promises";
import path from "path";
import OpenAI, { toFile } from "openai";

const root = process.cwd();
const sourceDir = "/Users/daokiencuong/Downloads/hackathon";
const backupDir = path.join(sourceDir, "backup ");
const shopsPath = path.join(root, "data", "shops.json");
const publicDir = path.join(root, "public");

const STYLE_MAP = {
  "bac-au": "phong cach Bac Au (Scandinavian): toi gian, go sang, tong trang/be, nhieu anh sang tu nhien",
  "hien-dai": "phong cach hien dai toi gian: duong net gon gang, tong mau trung tinh, sach se",
  "co-dien": "phong cach co dien am cung: go toi, chi tiet tinh te, anh sang vang diu",
  "tu-nhien": "phong cach tu nhien, nhieu anh sang mem, giu cam giac doi thuong va sach se",
  luxury: "phong cach sang trong tiet che: be mat gon, anh sang am, vat pham noi bat nhung khong roi",
  gallery: "phong cach gallery treo tranh: tuong sach, anh sang deu, khung tranh dung ti le",
};

const scenarios = [
  {
    id: "01-tuong-trang-tranh-song-bien-nhat",
    room: "tuong trang.jpeg",
    shop: "in-tranh",
    products: ["tranh-song-bien-nhat"],
    style: "gallery",
    size: "1024x1536",
    intent: "Treo mot buc tranh song bien tren mang tuong trong cua van phong, canh thang, khong them tranh khac.",
  },
  {
    id: "02-goc-nho-tranh-canh-vang-nen-den",
    room: "goc nho .jpeg",
    shop: "in-tranh",
    products: ["tranh-canh-vang-nen-den"],
    style: "gallery",
    size: "1024x1536",
    intent: "Treo mot buc tranh nen den sang trong tren mang tuong trang, giu van phong sach va sang.",
  },
  {
    id: "03-phong-khach-nho-tranh-thuyen-tron",
    room: "phong khach nho .jpg",
    shop: "decor-vang",
    products: ["vang-tranh-thuyen-tron"],
    style: "luxury",
    size: "1536x1024",
    intent: "Dat tranh thuyen buon ma vang thanh diem nhan sang tren he tu hoac mang go phong khach, khong che TV.",
  },
  {
    id: "04-phong-khach-trong-kim-tien-mini",
    room: "phong khach trong 1.webp",
    shop: "cay-canh",
    products: ["kim-tien-mini"],
    style: "tu-nhien",
    size: "1024x1024",
    intent: "Dat cay kim tien mini tren mat ban go, dung ti le nho gon, anh sang tu nhien.",
  },
  {
    id: "05-ban-giam-doc-thuyen-buom-nho",
    room: "ban giam doc .jpg",
    shop: "decor-vang",
    products: ["vang-thuyen-buom-nho"],
    style: "luxury",
    size: "1024x1024",
    intent: "Dat thuyen buon nho ma vang tren ban giam doc, vi tri trang trong, khong che mat ban qua nhieu.",
  },
  {
    id: "06-ban-giam-doc-2-kim-ngan-de-ban",
    room: "ban giam doc 2.webp",
    shop: "cay-canh",
    products: ["kim-ngan-de-ban"],
    style: "tu-nhien",
    size: "1024x1024",
    intent: "Dat cay kim ngan de ban tren goc ban giam doc, bong do mem, dung ti le.",
  },
];

function loadEnv(file) {
  return fs.readFile(file, "utf8")
    .then((text) => {
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (key && process.env[key] == null) process.env[key] = value;
      }
    })
    .catch(() => {});
}

function typeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function extFromType(type) {
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  return "png";
}

async function localImageToFile(filePath, name) {
  const buf = await fs.readFile(filePath);
  const type = typeFromPath(filePath);
  return toFile(buf, `${name}.${extFromType(type)}`, { type });
}

function textOf(v) {
  if (Array.isArray(v)) return v.join(", ");
  if (v && typeof v === "object") return Object.values(v).map(textOf).filter(Boolean).join(", ");
  return String(v || "");
}

function buildPrompt({ shop, products, style, intent }) {
  const profile = shop.stagingProfile || {};
  const productLines = products.map((p, i) => {
    const hint = p.placementHint ? ` (${p.placementHint})` : "";
    const size = p.realWidthCm ? `, rong khoang ${p.realWidthCm}cm` : "";
    const tags = p.tags ? ` Tags: ${textOf(p.tags)}.` : "";
    return `- San pham ${i + 1}: "${p.name}"${size}${hint}.${tags} Dung anh tham chieu thu ${i + 2}.`;
  });

  return [
    "Ban la chuyen gia dan canh va chup anh noi that cao cap.",
    "Anh dau tien la khong gian goc cua khach. Giu bo cuc kien truc chinh, tuong, san, cua so va noi that lon.",
    "Chi dat dung san pham trong danh sach. Khong them san pham phu cung loai, khong them do noi that lon, khong them chu hoac watermark.",
    profile.prompt ? `Quy chuan rieng cua store "${shop.name}": ${profile.prompt}` : "",
    profile.previewMode === "multi-single"
      ? "Preview tranh: request nay chi co mot buc tranh. Chi treo buc tranh do, khong tao gallery wall, khong them tranh khac."
      : "",
    intent ? `Y dinh demo: ${intent}` : "",
    "Dat san pham tu nhien, dung ti le, dung phoi canh, bong do mem va anh sang khop anh goc:",
    ...productLines,
    style && STYLE_MAP[style] ? `Tong the theo ${STYLE_MAP[style]}.` : "",
    "San pham phai giu dung kieu dang, mau sac, chat lieu, noi dung artwork va ti le nhu anh tham chieu.",
    "Ket qua photorealistic, sac net, dung de trinh bay demo offline.",
  ].filter(Boolean).join("\n");
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function productById(shops, slug, id) {
  const shop = shops[slug];
  const product = shop?.products?.find((p) => p.id === id);
  if (!shop || !product) throw new Error(`Missing product ${slug}/${id}`);
  return { shop, product };
}

async function generateScenario(openai, shops, scenario, { force }) {
  const outPath = path.join(backupDir, `${scenario.id}.png`);
  if (!force && await fileExists(outPath)) {
    console.log(`skip existing ${path.basename(outPath)}`);
    return { ...scenario, output: outPath, skipped: true };
  }

  const roomPath = path.join(sourceDir, scenario.room);
  const products = scenario.products.map((id) => productById(shops, scenario.shop, id).product);
  const shop = shops[scenario.shop];
  const roomFile = await localImageToFile(roomPath, "room");
  const productFiles = [];

  for (let i = 0; i < products.length; i++) {
    const src = products[i].cutoutImage || products[i].thumbnail;
    const filePath = path.normalize(path.join(publicDir, src.replace(/^\//, "")));
    if (!filePath.startsWith(publicDir)) throw new Error(`Invalid product image path: ${src}`);
    productFiles.push(await localImageToFile(filePath, `product-${i + 1}`));
  }

  const started = Date.now();
  console.log(`generate ${scenario.id} (${scenario.room})`);
  const result = await openai.images.edit({
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
    image: [roomFile, ...productFiles],
    prompt: buildPrompt({ shop, products, style: scenario.style, intent: scenario.intent }),
    size: scenario.size || process.env.OPENAI_IMAGE_SIZE || "1536x1024",
    quality: process.env.OPENAI_IMAGE_QUALITY || "medium",
  });

  const b64 = result?.data?.[0]?.b64_json;
  if (!b64) throw new Error(`No image returned for ${scenario.id}`);
  await fs.writeFile(outPath, Buffer.from(b64, "base64"));
  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`saved ${path.basename(outPath)} (${seconds}s)`);
  return {
    ...scenario,
    output: outPath,
    productNames: products.map((p) => p.name),
    seconds,
    skipped: false,
  };
}

function galleryHtml(results) {
  const cards = results.map((r) => {
    const file = `${r.id}.png`;
    const products = (r.productNames || []).join(", ");
    return [
      "<article>",
      `<a href="./${file}"><img src="./${file}" alt="${r.id}"></a>`,
      `<h2>${r.id}</h2>`,
      `<p>${r.room}</p>`,
      products ? `<p>${products}</p>` : "",
      "</article>",
    ].join("\n");
  }).join("\n");

  return [
    "<!doctype html>",
    "<meta charset=\"utf-8\">",
    "<title>Virtual staging backup</title>",
    "<style>",
    "body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;margin:24px;background:#f6f6f6;color:#111}",
    "main{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}",
    "article{background:#fff;border:1px solid #ddd;border-radius:8px;padding:12px}",
    "img{width:100%;display:block;border-radius:6px;background:#eee}",
    "h1{font-size:24px}h2{font-size:14px;margin:10px 0 4px}p{font-size:12px;margin:4px 0;color:#555}",
    "</style>",
    "<h1>Virtual staging backup</h1>",
    "<main>",
    cards,
    "</main>",
  ].join("\n");
}

async function main() {
  const force = process.argv.includes("--force");
  await loadEnv(path.join(root, ".env.local"));
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");

  await fs.mkdir(backupDir, { recursive: true });
  const shops = JSON.parse(await fs.readFile(shopsPath, "utf8")).shops;
  const openai = new OpenAI();
  const results = [];

  for (const scenario of scenarios) {
    try {
      results.push(await generateScenario(openai, shops, scenario, { force }));
    } catch (err) {
      console.error(`failed ${scenario.id}: ${err.message}`);
      results.push({ ...scenario, error: err.message });
    }
  }

  const manifestPath = path.join(backupDir, "backup-manifest.json");
  const galleryPath = path.join(backupDir, "backup-gallery.html");
  await fs.writeFile(manifestPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    sourceDir,
    results,
  }, null, 2));
  await fs.writeFile(galleryPath, galleryHtml(results.filter((r) => !r.error)));

  const ok = results.filter((r) => !r.error).length;
  const failed = results.length - ok;
  console.log(`done: ${ok} ok, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
