import Script from "next/script";

// Đặt trên các trang storefront. Tuân thủ INTEGRATION_CONTRACT.md §2 (cách 1) & §3.
// 1) Expose window.VSTAGE_CATALOG  2) set data-vstage-current  3) nhúng widget Session B.
export default function VStageIntegration({ catalog, currentId }) {
  const setup = `
    window.VSTAGE_CATALOG = ${JSON.stringify(catalog)};
    ${currentId ? `try { document.body.setAttribute("data-vstage-current", ${JSON.stringify(currentId)}); } catch (e) {}` : ""}
  `;
  const suffix = `${catalog.shopId}-${currentId || "all"}`;
  return (
    <>
      <Script id={`vstage-catalog-${suffix}`} strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: setup }} />
      {/* === Embed snippet — Virtual Staging Widget (Session B cung cấp) === */}
      {/* Fallback /virtualstage.js cùng repo cho tới khi Session B chốt <widget-domain> (contract §3). */}
      <Script
        id={`vstage-widget-${suffix}`}
        src="/virtualstage.js?v=demo-20260627-2"
        data-speculative="true"
        strategy="afterInteractive"
        data-shop-id={catalog.shopId}
        data-position="bottom-right"
        data-button-text="Xem thử trong phòng bạn"
      />
    </>
  );
}
