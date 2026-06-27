import { notFound } from "next/navigation";
import { getShop, getProduct } from "@/lib/shops";
import ProductDetailView from "@/components/storefront/ProductDetailView";
import { withStorePaths } from "@/components/storefront/paths";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { shop: slug, id } = await params;
  const product = getProduct(slug, id);
  if (!product) return { title: "Không tìm thấy sản phẩm" };
  return { title: product.name, description: product.desc };
}

export default async function ProductDetail({ params }) {
  const { shop: slug, id } = await params;
  const rawShop = getShop(slug);
  const shop = rawShop ? withStorePaths(rawShop, `/${slug}`) : null;
  const product = shop?.products.find((item) => item.id === id) || getProduct(slug, id);
  if (!shop || !product) notFound();

  return <ProductDetailView shop={shop} product={product} basePath={`/${slug}`} />;
}
