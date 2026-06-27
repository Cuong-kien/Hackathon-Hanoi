import ProductCard from "@/components/ProductCard";
import VStageIntegration from "@/components/VStageIntegration";
import { buildCatalog } from "@/lib/shops";

export default function ShopHomeView({ shop }) {
  const catalog = buildCatalog(shop);

  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-6 py-12 lg:grid-cols-2 lg:py-16">
          <div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{shop.tagline}</h1>
            <p className="mt-4 max-w-md opacity-70">
              Mỗi sản phẩm đều có nút{" "}
              <b style={{ color: shop.theme.brand }}>“Xem thử trong phòng bạn”</b> — tải ảnh phòng/bàn làm việc
              để xem sản phẩm được đặt vào bằng AI.
            </p>
            <div className="mt-6 flex gap-3 text-sm">
              <span
                className="rounded-full px-3 py-1.5"
                style={{ background: shop.theme.brandSoft, color: shop.theme.brand }}
              >
                Thủ công Việt Nam
              </span>
              <span
                className="rounded-full px-3 py-1.5"
                style={{ background: shop.theme.brandSoft, color: shop.theme.brand }}
              >
                Giao toàn quốc
              </span>
            </div>
          </div>
          <div className="overflow-hidden rounded-3xl shadow-lg ring-1 ring-black/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shop.hero} alt={shop.name} className="aspect-[4/3] w-full object-cover" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-8">
        <h2 className="mb-6 text-xl font-bold">Sản phẩm nổi bật</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {shop.products.map((product, index) => (
            <ProductCard key={product.id} product={product} theme={shop.theme} i={index} />
          ))}
        </div>
      </section>

      <VStageIntegration catalog={catalog} />
    </main>
  );
}
