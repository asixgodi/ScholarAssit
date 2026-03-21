"use client";

import { BookOpen, FileSearch, Sparkles } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";

export function Features() {
    const { t } = useLocale();
    const items = [
        {
            icon: FileSearch,
            title: t.feature1Title,
            desc: t.feature1Desc,
        },
        {
            icon: Sparkles,
            title: t.feature2Title,
            desc: t.feature2Desc,
        },
        {
            icon: BookOpen,
            title: t.feature3Title,
            desc: t.feature3Desc,
        },
    ];

    return (
        <section className="grid gap-4 md:grid-cols-3">
            {items.map((item) => (
                <article key={item.title} className="rounded-2xl border bg-white/75 p-5 shadow-lg backdrop-blur">
                    <item.icon className="mb-3 h-6 w-6" />
                    <h3 className="font-bold">{item.title}</h3>
                    <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
                </article>
            ))}
        </section>
    );
}
