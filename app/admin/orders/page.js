import AdminShell from "@/components/admin/AdminShell";
import OrdersAdminClient from "@/components/admin/OrdersAdminClient";

export const dynamic = "force-dynamic";

export default function AdminOrdersPage() {
  return (
    <AdminShell>
      <OrdersAdminClient />
    </AdminShell>
  );
}
