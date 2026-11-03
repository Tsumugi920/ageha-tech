import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { site } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Momori — 助手 Momori 的个人站和作品集",
    template: "%s | Momori",
  },
  description: site.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen flex-col">
        {/* 键盘跳转链接：Tab 首项，聚焦时浮现（sr-only → not-sr-only） */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-full focus:bg-white/95 focus:px-5 focus:text-sm focus:font-semibold focus:text-text-primary focus:shadow-[0_12px_36px_rgba(71,115,183,0.3)]"
        >
          跳到主内容
        </a>
        <Navbar />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
