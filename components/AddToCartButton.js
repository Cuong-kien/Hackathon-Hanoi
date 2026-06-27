"use client";

export default function AddToCartButton({ productId, color = "#111", label = "Thêm vào giỏ" }) {
  return (
    <button
      onClick={() => window.VStage && window.VStage.addToCart(productId, 1)}
      className="w-full rounded-xl px-6 py-3.5 text-base font-semibold text-white shadow-sm transition active:scale-[.98] hover:opacity-90"
      style={{ background: color }}
    >
      {label}
    </button>
  );
}
