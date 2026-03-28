"use client";

import { useLocale, useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { ModeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { Link } from "@/i18n/navigation";

type Props = {
    isAdmin: boolean;
};

export function ProtectedNav({ isAdmin }: Props) {
    const t = useTranslations();
    const locale = useLocale();

    return (
        <nav className="flex items-center gap-2">
            <Link className="inline-flex h-9 items-center rounded-md px-3 text-sm hover:bg-slate-100" href="/dashboard">
                {t("navDashboard")}
            </Link>
            <Link className="inline-flex h-9 items-center rounded-md px-3 text-sm hover:bg-slate-100" href="/chat">
                {t("navChat")}
            </Link>
            {isAdmin ? (
                <Link className="inline-flex h-9 items-center rounded-md px-3 text-sm hover:bg-slate-100" href="/admin">
                    {t("navAdmin")}
                </Link>
            ) : null}
            <button
                className="inline-flex h-9 items-center rounded-md px-3 text-sm text-slate-700 hover:bg-slate-100"
                onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
                type="button"
            >
                {t("navLogout")}
            </button>
            <LanguageToggle />
            <ModeToggle />
        </nav>
    );
}
