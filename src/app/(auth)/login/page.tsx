"use client";

import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/hooks/use-locale";

export default function LoginPage() {
    const { t } = useLocale();

    return (
        <main className="grid min-h-screen grid-cols-1 bg-[radial-gradient(circle_at_top,_#fcd34d_0,_#fff7ed_35%,_#ecfeff_100%)] lg:grid-cols-2">
            <section className="hidden flex-col justify-between p-10 lg:flex">
                <div className="flex items-center justify-between gap-4">
                    <h1 className="text-4xl font-black text-slate-900">ScholarSync</h1>
                    <LanguageToggle />
                </div>
                <p className="max-w-md text-lg text-slate-700">
                    {t.sideLoginDesc}
                </p>
            </section>
            <section className="flex items-center justify-center p-6">
                <div className="w-full max-w-md space-y-4">
                    <div className="flex justify-end lg:hidden">
                        <LanguageToggle />
                    </div>
                    <LoginForm />
                    <p className="text-center text-sm text-slate-600">
                        {t.noAccount} <Link className="font-semibold underline" href="/register">{t.register}</Link>
                    </p>
                </div>
            </section>
        </main>
    );
}
