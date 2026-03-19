import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  weight: ["400", "500", "700", "900"],
  display: "swap",
  preload: false, // CJK fonts are large — avoid blocking preload
});

export const metadata: Metadata = {
  title: "日本語歌詞解析 | Japanese Lyrics Parser",
  description:
    "Analyze Japanese song lyrics with hiragana annotations, romaji, and Chinese translations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="ja">
        <body className={notoSansJP.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
