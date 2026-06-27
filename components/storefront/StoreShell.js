import Link from "next/link";
import CartButton from "@/components/CartButton";

export default function StoreShell({ shop, basePath = "", children, grouped = false }) {
  const homeHref = basePath || "/";
  const sideHref = grouped ? "/" : "/admin";
  const sideLabel = grouped ? "← Chợ Thủ Công" : "Admin";

  return (
    <div style={{ background: shop.theme.bg, color: shop.theme.ink, minHeight: "100vh" }}>
      <header
        className="sticky top-0 z-40 backdrop-blur"
        style={{ background: `${shop.theme.bg}e6`, borderBottom: `1px solid ${shop.theme.ink}1a` }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
          <Link href={sideHref} className="text-sm opacity-60 transition hover:opacity-100">
            {sideLabel}
          </Link>
          <Link href={homeHref} className="mx-auto flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight" style={{ color: shop.theme.brand }}>
              {shop.name}
            </span>
          </Link>
          <CartButton color={shop.theme.brand} />
        </div>
      </header>

      {children}

      <footer className="mt-20" style={{ borderTop: `1px solid ${shop.theme.ink}1a` }}>
        <div className="mx-auto max-w-6xl px-6 py-10 text-sm opacity-70">
          <p className="font-semibold">{shop.name}</p>
          <p className="mt-1">{shop.tagline}</p>
          <p className="mt-2 text-xs italic opacity-70">{shop.inspiredBy}</p>
          <p className="mt-4 text-xs opacity-60">
            Đây là website demo phục vụ trình diễn. Hình ảnh mang tính minh hoạ.
          </p>
        </div>
      </footer>
    </div>
  );
}
