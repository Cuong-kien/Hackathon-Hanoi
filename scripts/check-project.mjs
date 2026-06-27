import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import process from "process";

const root = process.cwd();
const categories = new Set(["chair", "table", "lamp", "rug", "art", "decor", "plant", "shelf"]);
const expectedShopSlugs = ["cay-canh", "decor-vang", "in-tranh"];
const errors = [];
const warnings = [];

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  } catch (err) {
    errors.push(`${file}: ${err.message}`);
    return null;
  }
}

function existsPublicAsset(src) {
  if (!src || !src.startsWith("/")) return true;
  const publicPath = path.normalize(path.join(root, "public", src));
  const publicRoot = path.join(root, "public");
  return publicPath.startsWith(publicRoot) && fs.existsSync(publicPath);
}

function checkImage(label, src) {
  if (!src) {
    errors.push(`${label}: missing image path`);
    return;
  }
  if (!existsPublicAsset(src)) errors.push(`${label}: missing public asset ${src}`);
}

const shopsData = readJSON("data/shops.json");
readJSON("data/orders.json");

if (shopsData?.shops) {
  const shops = Object.entries(shopsData.shops);
  const slugs = shops.map(([slug]) => slug);
  if (slugs.join(",") !== expectedShopSlugs.join(",")) {
    errors.push(`Demo shops must be ${expectedShopSlugs.join(", ")} in that order; found ${slugs.join(", ")}.`);
  }

  for (const [slug, shop] of shops) {
    if (shop.slug !== slug) errors.push(`${slug}: shop.slug is ${shop.slug}`);
    for (const field of ["id", "name", "tagline", "currency", "theme", "hero"]) {
      if (!shop[field]) errors.push(`${slug}: missing ${field}`);
    }
    checkImage(`${slug}.hero`, shop.hero);

    if (!Array.isArray(shop.products) || shop.products.length === 0) {
      errors.push(`${slug}: products must be a non-empty array`);
      continue;
    }

    const ids = new Set();
    for (const p of shop.products) {
      const label = `${slug}/${p.id || "(missing-id)"}`;
      if (!p.id) errors.push(`${label}: missing id`);
      if (ids.has(p.id)) errors.push(`${label}: duplicate product id`);
      ids.add(p.id);
      if (!p.name) errors.push(`${label}: missing name`);
      if (!Number.isFinite(Number(p.price))) errors.push(`${label}: price is not numeric`);
      if (!categories.has(p.category)) errors.push(`${label}: unsupported category ${p.category}`);
      if (p.productUrl !== `/${slug}/products/${p.id}`) {
        errors.push(`${label}: productUrl should be /${slug}/products/${p.id}`);
      }
      checkImage(`${label}.thumbnail`, p.thumbnail);
      checkImage(`${label}.cutoutImage`, p.cutoutImage);
    }
  }
}

const widgetCheck = spawnSync(process.execPath, ["--check", "public/virtualstage.js"], {
  cwd: root,
  encoding: "utf8",
});
if (widgetCheck.status !== 0) {
  errors.push(`public/virtualstage.js syntax error:\n${widgetCheck.stderr || widgetCheck.stdout}`);
}

if (warnings.length) {
  console.warn("Warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error("Project check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Project check passed.");
console.log("Demo shops:");
for (const shop of Object.values(shopsData.shops)) {
  console.log(`- /${shop.slug} (${shop.products.length} products): ${shop.name}`);
}
