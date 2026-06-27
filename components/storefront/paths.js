export function getConfiguredShopSlug() {
  const slug = process.env.SHOP_SLUG || "";
  return slug.trim() || null;
}

export function withStorePaths(shop, basePath) {
  const cleanBase = basePath && basePath !== "/" ? basePath.replace(/\/$/, "") : "";
  return {
    ...shop,
    products: (shop.products || []).map((product) => ({
      ...product,
      productUrl: `${cleanBase}/products/${product.id}`,
    })),
  };
}
