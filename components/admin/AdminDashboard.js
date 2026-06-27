import Link from "next/link";
import { getShopList, listOrders, formatVND } from "@/lib/store";

export default function AdminDashboard() {
  const shops = getShopList();
  const orders = listOrders();
  const totalProducts = shops.reduce((s, sh) => s + sh.products.length, 0);
  const revenue = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);

  const cards = [
    { label: "Cửa hàng", value: shops.length },
    { label: "Sản phẩm", value: totalProducts },
    { label: "Đơn hàng", value: orders.length },
    { label: "Doanh thu (tạm tính)", value: formatVND(revenue) },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">Tổng quan</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
            <div className="text-sm text-neutral-500">{c.label}</div>
            <div className="mt-1 text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-bold">Cửa hàng</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {shops.map((s) => (
          <Link
            key={s.slug}
            href="/admin/products"
            className="rounded-2xl bg-white p-5 ring-1 ring-black/5 transition hover:shadow-md"
          >
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: s.theme?.brand }} />
              <span className="font-semibold">{s.name}</span>
            </div>
            <div className="mt-2 text-sm text-neutral-500">{s.products.length} sản phẩm</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
