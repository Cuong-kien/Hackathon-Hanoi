import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { updateProduct, deleteProduct } from "@/lib/store";

export const dynamic = "force-dynamic";

// PUT /api/admin/products/[id]?shop=slug   body = patch fields
export async function PUT(req, { params }) {
  if (!(await isAuthed())) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");
    if (!shop) throw new Error("Thiếu shop");
    const patch = await req.json();
    const product = updateProduct(shop, id, patch);
    return NextResponse.json({ ok: true, product });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 400 });
  }
}

// DELETE /api/admin/products/[id]?shop=slug
export async function DELETE(req, { params }) {
  if (!(await isAuthed())) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");
    if (!shop) throw new Error("Thiếu shop");
    deleteProduct(shop, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 400 });
  }
}
