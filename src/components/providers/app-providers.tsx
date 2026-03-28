"use client";

import type { AbstractIntlMessages } from "next-intl";
import { NextIntlClientProvider } from "next-intl";

import { SessionProvider } from "next-auth/react"; //管理用户登录状态
import { ThemeProvider } from "next-themes"; //管理主题（暗色/亮色模式）
import { Toaster } from "@/components/ui/sonner"; //全局消息提示组件
import type { Locale } from "@/lib/i18n";

type Props = {
    children: React.ReactNode;
    locale: Locale;
    messages: AbstractIntlMessages;
};

export function AppProviders({ children, locale, messages }: Props) {
    return (
        <NextIntlClientProvider locale={locale} messages={messages}>
            <SessionProvider>
                <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
                    {children}
                    <Toaster richColors position="top-right" />
                </ThemeProvider>
            </SessionProvider>
        </NextIntlClientProvider>
    );
}
