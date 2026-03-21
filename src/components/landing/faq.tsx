"use client";

import { useLocale } from "@/hooks/use-locale";

export function Faq() {
    const { t } = useLocale();
    const faq = [
        { q: t.faqQ1, a: t.faqA1 },
        { q: t.faqQ2, a: t.faqA2 },
        { q: t.faqQ3, a: t.faqA3 },
    ];

    return (
        <section className="space-y-3">
            {faq.map((item) => (
                <details key={item.q} className="rounded-xl border bg-white/75 p-4">
                    <summary className="cursor-pointer font-semibold">{item.q}</summary>
                    <p className="mt-2 text-sm text-slate-600">{item.a}</p>
                </details>
            ))}
        </section>
    );
}
