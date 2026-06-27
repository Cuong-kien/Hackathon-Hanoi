import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getShopList, addProduct } from "@/lib/store";

export const dynamic = "force-dynamic";

// GET: danh sách shop + sản phẩm (cho admin)
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  const shops = getShopList().map((s) => ({
    slug: s.slug,
    name: s.name,
    theme: s.theme,
    products: s.products,
  }));
  return NextResponse.json({ ok: true, shops });
}

// POST: tạo sản phẩm { shop, ...fields }
export async function POST(req) {
  if (!(await isAuthed())) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  try {
    const body = await req.json();
    if (!body.shop) throw new Error("Thiếu shop");
    if (!body.name) throw new Error("Thiếu tên sản phẩm");
    const product = addProduct(body.shop, body);
    return NextResponse.json({ ok: true, product });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 400 });
  }
}
