import "./globals.css";
import CartCore from "@/components/CartCore";

export const metadata = {
  title: "Chợ Thủ Công Việt — Cây cảnh · Decor vàng · Tranh canvas",
  description:
    "Sàn demo thương mại điện tử đồ decor Việt Nam: cây cảnh để bàn, decor mạ vàng phong thuỷ và tranh canvas. Tích hợp Virtual Staging AI.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body className="font-sans antialiased">
        {/* window.VStage (giỏ hàng) — contract §5, có trên mọi trang */}
        <CartCore />
        {children}
      </body>
    </html>
  );
}
