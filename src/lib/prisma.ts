import { PrismaClient } from "@prisma/client";

// 给全局的global对象添加一个prisma属性，类型为PrismaClient或undefined
declare global {
    var prisma: PrismaClient | undefined;
}

// 单例模式，确保在开发环境中只创建一个PrismaClient实例，避免过多的数据库连接
export const prisma =
    global.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });

if (process.env.NODE_ENV !== "production") {
    global.prisma = prisma;
}
