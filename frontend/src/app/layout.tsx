import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { PersistentAppShell } from "@/components/layout";

export const metadata: Metadata = {
  title: "AI 투자비서",
  description: "음성 기반 AI 투자 전략 분석 및 실행 플랫폼",
  icons: {
    icon: "/favicon.ico?v=20260603",
    shortcut: "/favicon.ico?v=20260603",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased min-h-screen">
        <Providers>
          <Suspense fallback={children}>
            <PersistentAppShell>{children}</PersistentAppShell>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
