import { notFound } from "next/navigation";
import { getShop } from "@/lib/shops";
import StoreShell from "@/components/storefront/StoreShell";

export async function generateMetadata({ params }) {
  const { shop: slug } = await params;
  const shop = getShop(slug);
  if (!shop) return { title: "Không tìm thấy cửa hàng" };
  return { title: `${shop.name} — ${shop.tagline}`, description: shop.tagline };
}

export default async function ShopLayout({ children, params }) {
  const { shop: slug } = await params;
  const shop = getShop(slug);
  if (!shop) notFound();

  return <StoreShell shop={shop} basePath={`/${shop.slug}`} grouped>{children}</StoreShell>;
}
