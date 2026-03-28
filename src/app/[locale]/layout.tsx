import { hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales } from "@/i18n/routing";
import { AppProviders } from "@/components/providers/app-providers";
import { isLocale, type Locale } from "@/lib/i18n";

type Props = {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
    return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
    const { locale } = await params;

    if (!hasLocale(locales, locale)) {
        notFound();
    }

    setRequestLocale(locale);
    const currentLocale: Locale = isLocale(locale) ? locale : "zh";
    const messages = await getMessages();

    return <AppProviders locale={currentLocale} messages={messages}>{children}</AppProviders>;
}
