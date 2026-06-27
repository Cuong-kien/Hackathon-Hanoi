import { notFound } from "next/navigation";
import { getShop } from "@/lib/shops";
import ShopHomeView from "@/components/storefront/ShopHomeView";
import { withStorePaths } from "@/components/storefront/paths";

export const dynamic = "force-dynamic";

export default async function ShopHome({ params }) {
  const { shop: slug } = await params;
  const rawShop = getShop(slug);
  const shop = rawShop ? withStorePaths(rawShop, `/${slug}`) : null;
  if (!shop) notFound();

  return <ShopHomeView shop={shop} />;
}
