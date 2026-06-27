"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function CartButton({ color = "#111" }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      try {
        const c = JSON.parse(localStorage.getItem("vstage_cart") || "{}");
        setCount(Object.values(c).reduce((s, e) => s + (e.qty || 0), 0));
      } catch {
        setCount(0);
      }
    };
    refresh();
    window.addEventListener("vstage:cart", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("vstage:cart", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <Link
      href="/cart"
      className="relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition hover:opacity-80"
      style={{ border: `1px solid ${color}33`, color }}
    >
      <span>Giỏ hàng</span>
      {count > 0 && (
        <span
          className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white"
          style={{ background: color }}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
