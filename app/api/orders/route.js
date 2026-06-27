import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { createOrder, listOrders } from "@/lib/store";

export const dynamic = "force-dynamic";

// POST: tạo đơn từ giỏ hàng (công khai — khách đặt). body { items:[{id,name,price,qty}], customer }
export async function POST(req) {
  try {
    const body = await req.json();
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ ok: false, error: "Giỏ hàng trống" }, { status: 400 });
    }
    const order = createOrder(body);
    return NextResponse.json({ ok: true, order });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 400 });
  }
}

// GET: danh sách đơn (chỉ admin)
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  return NextResponse.json({ ok: true, orders: listOrders() });
}
