import en from "../../messages/en.json";
import zh from "../../messages/zh.json";

// // 作用于浏览器的
// export const LOCALE_STORAGE_KEY = "scholarsync-locale";
// // 用于服务端的
// export const LOCALE_COOKIE_KEY = "scholarsync-locale";

export const dictionaries = {
    zh,
    en,
} as const; // as const 断言让 TypeScript 将对象属性推断为字面量类型，而不是更宽泛的 string 类型

// typeof获取类型  keyof获取这个对象的key组成的联合类型
export type Locale = keyof typeof dictionaries;
export type Dictionary = (typeof dictionaries)[Locale];

export function isLocale(value: string | null | undefined): value is Locale {
    return value === "zh" || value === "en";
}

export function getDictionary(locale: Locale) {
    return dictionaries[locale] ?? dictionaries.zh;
}
