import type { Metadata, Viewport } from "next";
import { Manrope, Fraunces } from "next/font/google";
import { LocaleProvider } from "@/components/locale-provider";
import { getRequestLocale } from "@/lib/i18n/server";
import { LOCALE_HTML_LANG } from "@/lib/i18n/config";
import "./globals.css";

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VocalMaster AI · AI 聲樂教練",
  description:
    "錄音或上傳歌聲，取得 AI 音色／發聲／音準／呼吸／節奏／力度分析、改善建議與個人排行榜。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b1220",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();
  return (
    <html
      lang={LOCALE_HTML_LANG[locale]}
      className={`${body.variable} ${display.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
