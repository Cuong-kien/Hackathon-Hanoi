import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { updateOrderStatus } from "@/lib/store";

export const dynamic = "force-dynamic";

// PATCH /api/orders/[id]  body { status }  (chỉ admin)
export async function PATCH(req, { params }) {
  if (!(await isAuthed())) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  try {
    const { id } = await params;
    const { status } = await req.json();
    const order = updateOrderStatus(id, status);
    return NextResponse.json({ ok: true, order });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 400 });
  }
}
