"use client";

import { useEffect, useMemo, useState } from "react";
import {
    getDictionary,
    isLocale,
    LOCALE_COOKIE_KEY,
    LOCALE_STORAGE_KEY,
    Locale,
} from "@/lib/i18n";

const DEFAULT_LOCALE: Locale = "zh";

export function useLocale() {
    const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

    useEffect(() => {
        const fromStorage = window.localStorage.getItem(LOCALE_STORAGE_KEY);
        if (isLocale(fromStorage)) {
            setLocaleState(fromStorage);
            return;
        }

        const navLang = navigator.language.toLowerCase();
        if (navLang.startsWith("zh")) {
            setLocale("zh");
            return;
        }

        setLocale("en");
    }, []);

    const setLocale = (nextLocale: Locale) => {
        setLocaleState(nextLocale);
        window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
        document.cookie = `${LOCALE_COOKIE_KEY}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    };

    const t = useMemo(() => getDictionary(locale), [locale]);

    return { locale, setLocale, t };
}
