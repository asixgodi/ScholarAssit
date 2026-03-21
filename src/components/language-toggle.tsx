"use client";

import { Button } from "@/components/ui/button";
import { useLocale } from "@/hooks/use-locale";

export function LanguageToggle() {
    const { locale, setLocale, t } = useLocale();

    return (
        <div className="flex items-center gap-2">
            <Button
                type="button"
                variant={locale === "zh" ? "default" : "outline"}
                size="sm"
                onClick={() => setLocale("zh")}
            >
                {t.switchToZh}
            </Button>
            <Button
                type="button"
                variant={locale === "en" ? "default" : "outline"}
                size="sm"
                onClick={() => setLocale("en")}
            >
                {t.switchToEn}
            </Button>
        </div>
    );
}
