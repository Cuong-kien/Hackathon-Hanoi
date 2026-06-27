import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import LogoutButton from "@/components/admin/LogoutButton";

export default async function AdminShell({ children }) {
  if (!(await isAuthed())) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="font-bold">Admin</span>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/admin" className="rounded-lg px-3 py-1.5 hover:bg-neutral-100">
                Tổng quan
              </Link>
              <Link href="/admin/products" className="rounded-lg px-3 py-1.5 hover:bg-neutral-100">
                Sản phẩm
              </Link>
              <Link href="/admin/orders" className="rounded-lg px-3 py-1.5 hover:bg-neutral-100">
                Đơn hàng
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" target="_blank" className="text-sm text-neutral-500 hover:text-neutral-900">
              Xem storefront
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
