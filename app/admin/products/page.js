import AdminShell from "@/components/admin/AdminShell";
import ProductsAdminClient from "@/components/admin/ProductsAdminClient";

export const dynamic = "force-dynamic";

export default function AdminProductsPage() {
  return (
    <AdminShell>
      <ProductsAdminClient />
    </AdminShell>
  );
}
