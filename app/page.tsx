import { Metadata } from "next";
import { Hero } from "@/components/landing/Hero";
import { MarqueeTicker } from "@/components/landing/MarqueeTicker";
import { Stats } from "@/components/landing/Stats";
import { Games } from "@/components/landing/Games";
import { Features } from "@/components/landing/Features";
import { Testimonials } from "@/components/landing/Testimonials";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ldr-connect.netlify.app";

export const metadata: Metadata = {
  title: "LDR-Connect | Game Couple LDR Terbaik Indonesia",
  description: "Platform gaming untuk pasangan LDR di mana kalian bisa bermain bersama, mengumpulkan coin, dan memperkuat hubungan jarak jauh. Tersedia Truth or Dare, Snake & Ladder, dan Quiz.",
  keywords: ["LDR", "game couple", "couple games", "pasangan jarak jauh", "long distance relationship"],
};

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "LDR-Connect",
    description: "Platform gaming untuk pasangan LDR",
    url: baseUrl,
    applicationCategory: "GameApplication",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "IDR",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "150",
    },
  };

  return (
    <main className="bg-[#0A0A0B]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Hero />
      <MarqueeTicker />
      <Stats />
      <Games />
      <Features />
      <Testimonials />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
