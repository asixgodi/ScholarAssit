import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
    session: { strategy: "jwt" },
    providers: [
        CredentialsProvider({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                });

                if (!user) return null;

                const isValid = await bcrypt.compare(credentials.password, user.password);
                if (!isValid) return null;

                return {
                    id: String(user.id),
                    email: user.email,
                    name: user.username,
                    isAdmin: user.isAdmin,
                    thesisStage: user.thesisStage,
                };
            },
        }),
    ],
    callbacks: {
        // JWT回调，在这里我们把用户信息存储在token中，存储在浏览器的 Cookie 里
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
                token.thesisStage = (user as { thesisStage?: number }).thesisStage ?? 0;
            }
            return token;
        },
        // 给前端准备的session对象，包含了用户信息
        async session({ session, token }) {
            if (session.user) {
                session.user.id = String(token.id ?? "");
                session.user.isAdmin = Boolean(token.isAdmin);
                session.user.thesisStage = Number(token.thesisStage ?? 0);
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
    // 使用环境变量中的SECRET来加密JWT
    secret: process.env.NEXTAUTH_SECRET,
};
