"use client";

import Link from "next/link";
import { useLocale } from "@/hooks/use-locale";

export function Hero() {
    const { t } = useLocale();

    return (
        <section className="relative overflow-hidden rounded-3xl border border-white/30 bg-white/70 p-8 shadow-2xl backdrop-blur-xl md:p-12">
            <div className="absolute -left-16 -top-20 h-56 w-56 rounded-full bg-amber-300/30 blur-3xl" />
            <div className="absolute -right-16 bottom-0 h-56 w-56 rounded-full bg-cyan-300/30 blur-3xl" />
            <div className="relative space-y-6">
                <p className="inline-flex rounded-full border border-slate-300/80 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                    {t.heroBadge}
                </p>
                <h1 className="font-heading max-w-3xl text-4xl font-black leading-tight text-slate-900 md:text-6xl">
                    {t.heroTitle}
                </h1>
                <p className="max-w-2xl text-lg text-slate-700">
                    {t.heroDesc}
                </p>
                <div className="flex flex-wrap gap-3">
                    <Link className="inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700" href="/register">
                        {t.startNow}
                    </Link>
                    <Link className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-100" href="/login">
                        {t.loginNow}
                    </Link>
                </div>
            </div>
        </section>
    );
}
