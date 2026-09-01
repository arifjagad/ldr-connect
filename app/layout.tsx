import type { Metadata, Viewport } from "next";
import { Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

const serifFont = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ldr-connect.netlify.app";

export const metadata: Metadata = {
  title: "LDR-Connect | Mendekatkan yang Jauh dengan Tawa dan Rahasia",
  description: "Platform romantis khusus pasangan LDR untuk bermain mini-games interaktif, berbagi kejujuran, dan menciptakan memori bermakna secara real-time.",
  keywords: ["LDR", "game couple", "couple games", "pasangan jarak jauh", "long distance relationship", "truth or dare online"],
  metadataBase: new URL(baseUrl),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <html lang="id" className={`${serifFont.variable} ${jakarta.variable} h-full antialiased`} nonce={nonce} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#C84B31" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-full bg-[#FCFBF7] text-[#2D2926]">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
