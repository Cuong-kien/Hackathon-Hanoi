import Link from "next/link";
import AddToCartButton from "@/components/AddToCartButton";
import ProductCard from "@/components/ProductCard";
import VStageIntegration from "@/components/VStageIntegration";
import { buildCatalog, formatVND } from "@/lib/shops";

export default function ProductDetailView({ shop, product, basePath = "" }) {
  const catalog = buildCatalog(shop, product.id);
  const related = shop.products.filter((item) => item.id !== product.id).slice(0, 4);
  const shopHref = basePath || "/";

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <nav className="mb-6 text-sm opacity-60">
        <Link href={shopHref} className="hover:underline">
          {shop.name}
        </Link>{" "}
        / <span>{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.thumbnail} alt={product.name} className="aspect-square w-full object-cover" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[product.thumbnail, product.cutoutImage, shop.hero].map((src, index) => (
              <div key={`${src}-${index}`} className="overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="aspect-square w-full object-cover" />
              </div>
            ))}
          </div>
        </div>

        <div>
          <span
            className="inline-block rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: shop.theme.brandSoft, color: shop.theme.brand }}
          >
            {product.category}
          </span>
          <h1 className="mt-3 text-3xl font-bold leading-tight">{product.name}</h1>
          <p className="mt-3 text-3xl font-bold" style={{ color: shop.theme.brand }}>
            {formatVND(product.price)}
          </p>
          <p className="mt-5 leading-relaxed opacity-80">{product.desc}</p>

          <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl bg-white p-5 text-sm ring-1 ring-black/5">
            <div>
              <dt className="opacity-50">Chất liệu</dt>
              <dd className="mt-0.5 font-medium">{product.material}</dd>
            </div>
            <div>
              <dt className="opacity-50">Kích thước</dt>
              <dd className="mt-0.5 font-medium">{product.dims}</dd>
            </div>
            <div className="col-span-2">
              <dt className="opacity-50">Gợi ý bài trí</dt>
              <dd className="mt-0.5 font-medium">{product.placementHint}</dd>
            </div>
          </dl>

          <div className="mt-7 max-w-sm">
            <AddToCartButton productId={product.id} color={shop.theme.brand} />
          </div>
          <p className="mt-3 text-sm opacity-60">
            Bấm nút nổi <b>“Xem thử trong phòng bạn”</b> ở góc phải để xem sản phẩm này trong ảnh phòng của bạn.
          </p>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-xl font-bold">Sản phẩm khác của {shop.name}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((item, index) => (
              <ProductCard key={item.id} product={item} theme={shop.theme} i={index} />
            ))}
          </div>
        </section>
      )}

      <VStageIntegration catalog={catalog} currentId={product.id} />
    </main>
  );
}
