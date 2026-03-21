import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { Faq } from "@/components/landing/faq";
import { LanguageToggle } from "@/components/language-toggle";

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div className="flex justify-end">
        <LanguageToggle />
      </div>
      <Hero />
      <Features />
      <Faq />
    </main>
  );
}
