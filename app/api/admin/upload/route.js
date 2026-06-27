import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { isAuthed } from "@/lib/auth";
import { slugify } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST multipart { file, shop } → lưu vào public/images/<shop>/<name>.<ext>, trả { path }
export async function POST(req) {
  if (!(await isAuthed())) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    const shop = form.get("shop") || "misc";
    if (!file || typeof file === "string") throw new Error("Thiếu file");

    const ext = (file.name?.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const baseName = slugify(form.get("name") || file.name?.replace(/\.[^.]+$/, "") || "anh") || "anh";
    const fname = `${baseName}-${Date.now().toString(36)}.${ext}`;

    const dir = path.join(process.cwd(), "public", "images", String(shop));
    fs.mkdirSync(dir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(dir, fname), buf);

    const publicPath = `/images/${shop}/${fname}`;
    return NextResponse.json({ ok: true, path: publicPath });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 400 });
  }
}
