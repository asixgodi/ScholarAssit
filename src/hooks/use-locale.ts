"use client";

import { useLocale as useNextIntlLocale } from "next-intl";
import { usePathname as useRawPathname } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Locale, isLocale } from "@/lib/i18n";

const DEFAULT_LOCALE: Locale = "zh";
const localePrefixMatcher = /^\/(zh|en)(?=\/|$)/;

// 移出 URL 中的语言前缀，得到不带语言部分的路径
function stripLocalePrefix(path: string): string {
    return path.replace(localePrefixMatcher, "") || "/";
}

export function useLocale() {
    const router = useRouter();
    // 原生的 pathname (例如 "/zh/chat")
    const pathname = useRawPathname();
    const localeFromIntl = useNextIntlLocale();
    // 提取出 URL 中的语言部分 (例如 "zh")
    const localeFromPath = pathname?.match(localePrefixMatcher)?.[1];
    const locale = isLocale(localeFromPath)
        ? localeFromPath
        : isLocale(localeFromIntl)
            ? localeFromIntl
            : DEFAULT_LOCALE;

    // 将一个不带语言前缀的路径转换成带有目标语言前缀的路径，默认使用当前语言
    const toLocalePath = (path: string, targetLocale: Locale = locale) => {
        const normalized = path.startsWith("/") ? path : `/${path}`;
        const stripped = stripLocalePrefix(normalized);
        return `/${targetLocale}${stripped === "/" ? "" : stripped}`;
    };

    const setLocale = (nextLocale: Locale) => {
        if (nextLocale === locale) return;

        const currentPath = pathname || "/";
        const normalizedPath = stripLocalePrefix(currentPath);
        // 使用 i18n 路由器的 replace 方法，会自动把 "/chat" 加上新前缀 "{ locale: 'en' }" 变成 "/en/chat"
        router.replace(normalizedPath, { locale: nextLocale });
    };

    return { locale, setLocale, toLocalePath };
}
