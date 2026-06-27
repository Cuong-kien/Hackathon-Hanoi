"use client";
import { useEffect, useState } from "react";

const STATUS = {
  new: { label: "Mới", cls: "bg-blue-100 text-blue-700" },
  confirmed: { label: "Đã xác nhận", cls: "bg-amber-100 text-amber-700" },
  shipped: { label: "Đang giao", cls: "bg-purple-100 text-purple-700" },
  done: { label: "Hoàn tất", cls: "bg-green-100 text-green-700" },
  cancelled: { label: "Đã huỷ", cls: "bg-neutral-200 text-neutral-600" },
};
const fmt = (n) => new Intl.NumberFormat("vi-VN").format(n || 0) + "₫";

export default function OrdersPage() {
  const [orders, setOrders] = useState(null);
  const [err, setErr] = useState("");

  async function load() {
    const r = await fetch("/api/orders");
    const j = await r.json();
    if (j.ok) setOrders(j.orders);
    else setErr(j.error || "Lỗi tải đơn");
  }
  useEffect(() => {
    load();
  }, []);

  async function setStatus(id, status) {
    await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  if (err) return <p className="text-red-600">{err}</p>;
  if (!orders) return <p className="text-neutral-500">Đang tải…</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Đơn hàng</h1>
      {orders.length === 0 && <p className="mt-6 text-neutral-500">Chưa có đơn nào. Hãy thêm sản phẩm vào giỏ ở storefront rồi đặt hàng.</p>}
      <div className="mt-6 space-y-4">
        {orders.map((o) => (
          <div key={o.id} className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-bold">{o.id}</span>
                <span className="ml-3 text-sm text-neutral-500">{new Date(o.createdAt).toLocaleString("vi-VN")}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS[o.status]?.cls || ""}`}>
                  {STATUS[o.status]?.label || o.status}
                </span>
                <select
                  value={o.status}
                  onChange={(e) => setStatus(o.id, e.target.value)}
                  className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                >
                  {Object.entries(STATUS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 divide-y divide-neutral-100 text-sm">
              {o.items.map((it, i) => (
                <div key={i} className="flex justify-between py-1.5">
                  <span>{it.name} <span className="text-neutral-400">× {it.qty}</span></span>
                  <span>{fmt(it.price * it.qty)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 font-bold">
              <span>Tổng</span>
              <span>{fmt(o.total)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
