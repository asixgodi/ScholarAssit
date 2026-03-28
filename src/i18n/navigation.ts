import { createNavigation } from "next-intl/navigation";
import { routing } from "@/i18n/routing";

// 基于routing 规则，生成一套自带语言意识的导航组件和钩子。 使用 Link这些组件时，路径会自动加上当前语言前缀（如 /zh/chat）
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
