import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ldr-connect.netlify.app";

export const metadata: Metadata = {
  title: "LDR-Connect | Game Couple LDR Terbaik Indonesia",
  description: "Platform gaming untuk pasangan LDR di mana kalian bisa bermain bersama, mengumpulkan coin, dan memperkuat hubungan jarak jauh. Tersedia Truth or Dare, Snake & Ladder, dan Quiz.",
  keywords: ["LDR", "game couple", "couple games", "pasangan jarak jauh", "long distance relationship", "gaming platform", "coin system"],
  metadataBase: new URL(baseUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: baseUrl,
    siteName: "LDR-Connect",
    title: "LDR-Connect | Game Couple LDR Terbaik Indonesia",
    description: "Platform gaming untuk pasangan LDR. Main bareng, kumpulkan coin, dan perkuat hubungan kalian!",
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "LDR-Connect - Game untuk Pasangan LDR",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LDR-Connect | Game Couple LDR",
    description: "Platform gaming untuk pasangan LDR. Main bareng dan perkuat hubungan kalian!",
    images: [`${baseUrl}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${sora.variable} ${jakarta.variable} h-full antialiased`}>
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#FF3D7F" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="LDR-Connect" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="alternate" hrefLang="id" href={`${baseUrl}/`} />
      </head>
      <body className="min-h-full bg-[#0A0A0B] text-[#FFF5F8]">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
