import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { dictionaries, isLocale } from "@/lib/i18n";
import { routing } from "@/i18n/routing";

// 
export default getRequestConfig(async ({ requestLocale }) => {
    // requestLocale 是 next-intl 自动从 URL（如 /zh/chat）中提取出的语言字符串
    const candidate = await requestLocale;
    // 检查语言是否在支持的列表中，并且是有效的 Locale 类型，否则使用默认语言
    const locale = hasLocale(routing.locales, candidate) && isLocale(candidate) ? candidate : routing.defaultLocale;

    // 注入字典数据，数据交给了getTranslations() 或 useTranslations() 函数
    return {
        locale,
        messages: dictionaries[locale],
    };
});
