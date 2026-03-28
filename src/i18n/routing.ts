import { defineRouting } from "next-intl/routing";

// 定义路径规则
export const routing = defineRouting({
    locales: ["zh", "en"],
    defaultLocale: "zh",
    localePrefix: "always",
});

export const { locales, defaultLocale } = routing;
export type AppLocale = (typeof locales)[number];
