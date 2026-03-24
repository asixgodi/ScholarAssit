"use client";


import { SessionProvider } from "next-auth/react"; //管理用户登录状态
import { ThemeProvider } from "next-themes"; //管理主题（暗色/亮色模式）
import { Toaster } from "@/components/ui/sonner"; //全局消息提示组件

export function AppProviders({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
                {children}
                <Toaster richColors position="top-right" />
            </ThemeProvider>
        </SessionProvider>
    );
}
