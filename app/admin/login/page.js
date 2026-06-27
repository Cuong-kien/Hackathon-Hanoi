"use client";
import { useState } from "react";

export default function AdminLogin() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    const j = await r.json();
    if (j.ok) {
      // tải lại cứng để server đọc cookie (tránh cache điều hướng client)
      window.location.href = "/admin";
      return;
    }
    setLoading(false);
    setErr(j.error || "Đăng nhập thất bại");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <h1 className="text-xl font-bold">Quản trị cửa hàng</h1>
        <p className="mt-1 text-sm text-neutral-500">Đăng nhập để quản lý sản phẩm & đơn hàng</p>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Mật khẩu admin"
          className="mt-5 w-full rounded-xl border border-neutral-300 px-4 py-2.5 outline-none focus:border-neutral-900"
        />
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <button
          disabled={loading}
          className="mt-4 w-full rounded-xl bg-neutral-900 py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Đang vào…" : "Đăng nhập"}
        </button>
        <p className="mt-3 text-center text-xs text-neutral-400">Demo: mật khẩu mặc định <code>admin123</code></p>
      </form>
    </main>
  );
}
