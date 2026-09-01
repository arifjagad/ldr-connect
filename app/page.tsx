import { Metadata } from "next";
import { Hero } from "@/components/landing/Hero";
import { Stats } from "@/components/landing/Stats";
import { Games } from "@/components/landing/Games";
import { Features } from "@/components/landing/Features";
import { Testimonials } from "@/components/landing/Testimonials";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ldr-connect.netlify.app";

export const metadata: Metadata = {
  title: "LDR-Connect — Two Players, One Screen",
  description: "Platform gaming interaktif & video call khusus pasangan hubungan jarak jauh (LDR). Mainkan Truth or Dare, Quoridor 9x9, Dare Derby, dan Snake & Ladder secara real-time.",
  keywords: ["LDR", "game couple", "couple games", "pasangan jarak jauh", "long distance relationship", "quoridor couple", "truth or dare online"],
};

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "LDR-Connect",
    description: "Platform gaming interaktif khusus pasangan LDR",
    url: baseUrl,
    applicationCategory: "GameApplication",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "IDR",
    },
  };

  return (
    <main className="min-h-screen bg-[#FCFBF7] text-[#1F1D1B]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Hero />
      <Stats />
      <div id="games">
        <Games />
      </div>
      <div id="features">
        <Features />
      </div>
      <Testimonials />
      <div id="faq">
        <FAQ />
      </div>
      <FinalCTA />
      <Footer />
    </main>
  );
}
