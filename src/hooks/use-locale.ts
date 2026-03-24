"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
    getDictionary,
    isLocale,
    LOCALE_COOKIE_KEY,
    LOCALE_STORAGE_KEY,
    Locale,
} from "@/lib/i18n";

const DEFAULT_LOCALE: Locale = "zh";
type Listener = () => void;

const listeners = new Set<Listener>();
let currentLocale: Locale = DEFAULT_LOCALE;
let isInitialized = false;

function notifyListeners() {
    listeners.forEach((listener) => listener());
}

function readInitialLocale(): Locale {
    if (typeof window === "undefined") return DEFAULT_LOCALE;

    const fromStorage = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(fromStorage)) return fromStorage;

    const navLang = navigator.language.toLowerCase();
    return navLang.startsWith("zh") ? "zh" : "en";
}

function persistLocale(locale: Locale) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.cookie = `${LOCALE_COOKIE_KEY}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

function ensureInitialized() {
    if (isInitialized || typeof window === "undefined") return;

    isInitialized = true;
    currentLocale = readInitialLocale();
    persistLocale(currentLocale);

    window.addEventListener("storage", (event) => {
        if (event.key !== LOCALE_STORAGE_KEY || !isLocale(event.newValue)) return;
        if (event.newValue === currentLocale) return;

        currentLocale = event.newValue;
        notifyListeners();
    });
}

function subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getSnapshot() {
    ensureInitialized();
    return currentLocale;
}

function getServerSnapshot() {
    return DEFAULT_LOCALE;
}

function setLocale(nextLocale: Locale) {
    ensureInitialized();
    if (nextLocale === currentLocale) return;

    currentLocale = nextLocale;
    persistLocale(nextLocale);
    notifyListeners();
}

export function useLocale() {
    const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const t = useMemo(() => getDictionary(locale), [locale]);

    return { locale, setLocale, t };
}
