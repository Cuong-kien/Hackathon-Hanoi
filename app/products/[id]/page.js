import { notFound } from "next/navigation";
import { getShop } from "@/lib/shops";
import StoreShell from "@/components/storefront/StoreShell";
import ProductDetailView from "@/components/storefront/ProductDetailView";
import { getConfiguredShopSlug, withStorePaths } from "@/components/storefront/paths";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const slug = getConfiguredShopSlug();
  if (!slug) return { title: "Không tìm thấy sản phẩm" };
  const rawShop = getShop(slug);
  const shop = rawShop ? withStorePaths(rawShop, "") : null;
  const { id } = await params;
  const product = shop?.products.find((item) => item.id === id);
  if (!product) return { title: "Không tìm thấy sản phẩm" };
  return { title: product.name, description: product.desc };
}

export default async function RootProductDetail({ params }) {
  const slug = getConfiguredShopSlug();
  if (!slug) notFound();
  const rawShop = getShop(slug);
  const shop = rawShop ? withStorePaths(rawShop, "") : null;
  const { id } = await params;
  const product = shop?.products.find((item) => item.id === id);
  if (!shop || !product) notFound();

  return (
    <StoreShell shop={shop}>
      <ProductDetailView shop={shop} product={product} />
    </StoreShell>
  );
}
