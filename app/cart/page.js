"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

function fmt(n) {
  return new Intl.NumberFormat("vi-VN").format(n) + "₫";
}

export default function CartPage() {
  const [items, setItems] = useState([]);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(null);

  const load = () => {
    try {
      const c = JSON.parse(localStorage.getItem("vstage_cart") || "{}");
      setItems(Object.values(c));
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    load();
    window.addEventListener("vstage:cart", load);
    return () => window.removeEventListener("vstage:cart", load);
  }, []);

  const setQty = (id, qty) => {
    const c = JSON.parse(localStorage.getItem("vstage_cart") || "{}");
    if (!c[id]) return;
    if (qty <= 0) delete c[id];
    else c[id].qty = qty;
    localStorage.setItem("vstage_cart", JSON.stringify(c));
    window.dispatchEvent(new CustomEvent("vstage:cart"));
  };

  const clear = () => {
    localStorage.setItem("vstage_cart", "{}");
    window.dispatchEvent(new CustomEvent("vstage:cart"));
  };

  const checkout = async () => {
    setPlacing(true);
    const payload = {
      items: items.map((it) => ({ id: it.id, name: it.name, price: it.price, qty: it.qty })),
      customer: { name: "Khách demo", phone: "", address: "" },
    };
    const r = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    setPlacing(false);
    if (j.ok) {
      setPlaced(j.order);
      clear();
    } else {
      alert(j.error || "Đặt hàng lỗi");
    }
  };

  const total = items.reduce((s, e) => s + (e.price || 0) * (e.qty || 0), 0);

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-6 py-4">
          <Link href="/" className="text-sm opacity-60 hover:opacity-100">
            ← Tiếp tục mua sắm
          </Link>
          <h1 className="mx-auto text-lg font-bold">Giỏ hàng</h1>
          <div className="w-28" />
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10">
        {placed ? (
          <div className="rounded-2xl bg-white p-12 text-center ring-1 ring-black/5">
            <p className="text-lg font-medium">Đặt hàng thành công</p>
            <p className="mt-1 text-neutral-500">Mã đơn <b>{placed.id}</b> · Tổng {fmt(placed.total)}</p>
            <p className="mt-1 text-sm text-neutral-400">Đơn đã được gửi vào trang quản trị (Admin → Đơn hàng).</p>
            <Link href="/" className="mt-6 inline-block rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white">
              Tiếp tục mua sắm
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center ring-1 ring-black/5">
            <p className="text-lg font-medium">Giỏ hàng đang trống</p>
            <p className="mt-1 text-neutral-500">Khám phá các cửa hàng và thêm sản phẩm yêu thích.</p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white"
            >
              Về trang chủ
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
            <div className="space-y-3">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.image}
                    alt={it.name}
                    className="h-20 w-20 flex-none rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <Link href={it.url || "#"} className="line-clamp-1 font-medium hover:underline">
                      {it.name || it.id}
                    </Link>
                    <p className="mt-1 text-sm font-bold text-neutral-700">{fmt(it.price || 0)}</p>
                    <div className="mt-2 inline-flex items-center rounded-lg border border-neutral-200">
                      <button onClick={() => setQty(it.id, it.qty - 1)} className="px-3 py-1 text-lg">
                        −
                      </button>
                      <span className="min-w-8 text-center text-sm font-medium">{it.qty}</span>
                      <button onClick={() => setQty(it.id, it.qty + 1)} className="px-3 py-1 text-lg">
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setQty(it.id, 0)}
                    className="flex-none text-sm text-neutral-400 hover:text-red-500"
                  >
                    Xoá
                  </button>
                </div>
              ))}
              <button onClick={clear} className="text-sm text-neutral-400 hover:text-red-500">
                Xoá toàn bộ giỏ hàng
              </button>
            </div>

            <aside className="h-fit rounded-2xl bg-white p-6 ring-1 ring-black/5">
              <h2 className="font-bold">Tóm tắt đơn hàng</h2>
              <div className="mt-4 flex justify-between text-sm">
                <span className="opacity-60">Tạm tính</span>
                <span>{fmt(total)}</span>
              </div>
              <div className="mt-1 flex justify-between text-sm">
                <span className="opacity-60">Phí vận chuyển</span>
                <span className="text-green-600">Miễn phí</span>
              </div>
              <div className="mt-4 flex justify-between border-t border-neutral-100 pt-4 text-lg font-bold">
                <span>Tổng</span>
                <span>{fmt(total)}</span>
              </div>
              <button
                onClick={checkout}
                disabled={placing}
                className="mt-5 w-full rounded-xl bg-neutral-900 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {placing ? "Đang đặt hàng…" : "Đặt hàng"}
              </button>
              <p className="mt-2 text-center text-xs opacity-50">Demo · đơn sẽ hiện trong trang quản trị</p>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
