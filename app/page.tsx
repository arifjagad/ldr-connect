import { Hero } from "@/components/landing/Hero";
import { MarqueeTicker } from "@/components/landing/MarqueeTicker";
import { Stats } from "@/components/landing/Stats";
import { Games } from "@/components/landing/Games";
import { Features } from "@/components/landing/Features";
import { Testimonials } from "@/components/landing/Testimonials";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <main className="bg-[#0A0A0B]">
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
