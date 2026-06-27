import Link from "next/link";
import { notFound } from "next/navigation";
import { getShop, getShopList, formatVND } from "@/lib/shops";
import StoreShell from "@/components/storefront/StoreShell";
import ShopHomeView from "@/components/storefront/ShopHomeView";
import { getConfiguredShopSlug, withStorePaths } from "@/components/storefront/paths";

export const dynamic = "force-dynamic";

export default function Home() {
  const configuredSlug = getConfiguredShopSlug();
  if (configuredSlug) {
    const rawShop = getShop(configuredSlug);
    if (!rawShop) notFound();
    const shop = withStorePaths(rawShop, "");
    return (
      <StoreShell shop={shop}>
        <ShopHomeView shop={shop} />
      </StoreShell>
    );
  }

  const SHOP_LIST = getShopList();
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            Sàn demo · Decor Việt Nam
          </span>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Chợ Thủ Công Việt
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-neutral-600">
            Ba cửa hàng, một trải nghiệm. Khám phá cây cảnh để bàn, decor mạ vàng phong thuỷ và
            tranh canvas in theo yêu cầu. Mỗi sản phẩm đều có thể{" "}
            <b className="text-neutral-900">thử ngay trong không gian của bạn</b> bằng AI.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {SHOP_LIST.map((s) => (
              <a
                key={s.slug}
                href={`#${s.slug}`}
                className="rounded-full px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                style={{ background: s.theme.brand }}
              >
                {s.name}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Shops */}
      <div className="mx-auto max-w-6xl space-y-20 px-6 py-16">
        {SHOP_LIST.map((shop) => (
          <section key={shop.slug} id={shop.slug} className="scroll-mt-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: shop.theme.ink }}>
                  {shop.name}
                </h2>
                <p className="mt-1 text-neutral-600">{shop.tagline}</p>
                <p className="mt-1 text-xs italic text-neutral-400">{shop.inspiredBy}</p>
              </div>
              <Link
                href={`/${shop.slug}`}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: shop.theme.brand }}
              >
                Vào cửa hàng →
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {shop.products.slice(0, 4).map((p) => (
                <Link
                  key={p.id}
                  href={p.productUrl}
                  className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="aspect-square overflow-hidden bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.thumbnail}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="line-clamp-1 text-sm font-medium">{p.name}</h3>
                    <p className="mt-1 text-sm font-bold" style={{ color: shop.theme.brand }}>
                      {formatVND(p.price)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Khu vực kỹ thuật / Demo widget (Session B) */}
      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-neutral-500">
          <p className="font-semibold text-neutral-700">Demo kỹ thuật — Virtual Staging Widget</p>
          <p className="mt-1">
            Tích hợp theo <code className="rounded bg-neutral-100 px-1">INTEGRATION_CONTRACT.md</code>. Widget &amp;
            API do Session B cung cấp.
          </p>
          <div className="mt-3 flex flex-wrap gap-4">
            <a className="underline hover:text-neutral-900" href="/admin">
              Admin sản phẩm & đơn hàng
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
