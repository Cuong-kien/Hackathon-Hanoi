import Link from "next/link";
import { formatVND } from "@/lib/shops";

// Product card mang đủ data-attributes (INTEGRATION_CONTRACT.md §2 cách 2)
export default function ProductCard({ product, theme, i = 0 }) {
  return (
    <Link
      href={product.productUrl}
      className="product-card group animate-fade-up block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-xl"
      style={{ animationDelay: `${i * 60}ms` }}
      data-vstage-id={product.id}
      data-vstage-name={product.name}
      data-vstage-price={product.price}
      data-vstage-cutout={product.cutoutImage}
      data-vstage-category={product.category}
    >
      <div className="relative aspect-square overflow-hidden bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.thumbnail}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <span
          className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: theme.brandSoft, color: theme.brand }}
        >
          {product.category}
        </span>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-1 text-[15px] font-semibold" style={{ color: theme.ink }}>
          {product.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-[13px] text-neutral-500">{product.desc}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-bold" style={{ color: theme.brand }}>
            {formatVND(product.price)}
          </span>
          <span
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition group-hover:text-white"
            style={{ border: `1px solid ${theme.brand}`, color: theme.brand, "--tw-bg": theme.brand }}
          >
            Xem chi tiết →
          </span>
        </div>
      </div>
    </Link>
  );
}
