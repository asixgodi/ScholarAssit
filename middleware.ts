import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { getToken } from "next-auth/jwt";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

const protectedPrefixes = ["/dashboard", "/chat", "/admin"];

// 从 URL 中移除语言前缀，返回不带语言部分的路径
function getPathWithoutLocale(pathname: string): string {
    const localeMatcher = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);
    return pathname.replace(localeMatcher, "") || "/";
}

// 从 URL 中提取当前语言
function getCurrentLocale(pathname: string) {
    const localeMatcher = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);
    const match = pathname.match(localeMatcher);
    return match?.[1] ?? routing.defaultLocale;
}


export default async function middleware(req: NextRequest) {
    // 得到的是类似 /zh/chat 的路径，不带查询参数和端口号
    const { pathname } = req.nextUrl;
    const locale = getCurrentLocale(pathname);
    const pathnameWithoutLocale = getPathWithoutLocale(pathname);

    // 进行权限检查
    const isProtected = protectedPrefixes.some(
        (prefix) => pathnameWithoutLocale === prefix || pathnameWithoutLocale.startsWith(`${prefix}/`),
    );

    if (isProtected) {
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
        if (!token) {
            // req.url 是完整的 URL，包括协议、主机、端口和路径
            const loginUrl = new URL(`/${locale}/login`, req.url);
            loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
            return NextResponse.redirect(loginUrl);
        }

        if (pathnameWithoutLocale.startsWith("/admin") && !token.isAdmin) {
            return NextResponse.redirect(new URL(`/${locale}/dashboard`, req.url));
        }
    }

    // 把请求交给 next-intl，到requst.ts 中定义的 getRequestConfig 进行国际化处理
    return intlMiddleware(req);
}

export const config = {
    matcher: ["/((?!api|_next|.*\\..*).*)"],
};
