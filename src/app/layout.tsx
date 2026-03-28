import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScholarAssit",
  description: "你的 AI 论文助手",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body className="min-h-full font-sans">
        {children}
      </body>
    </html>
  );
}
