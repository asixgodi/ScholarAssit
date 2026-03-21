import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ModeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) redirect("/login");

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <span>ScholarSync</span>
                        <span className="text-slate-400">/</span>
                        <span>{session.user.name}</span>
                    </div>
                    <nav className="flex items-center gap-2">
                        <Link className="inline-flex h-9 items-center rounded-md px-3 text-sm hover:bg-slate-100" href="/dashboard">仪表盘</Link>
                        <Link className="inline-flex h-9 items-center rounded-md px-3 text-sm hover:bg-slate-100" href="/chat">聊天</Link>
                        {session.user.isAdmin ? <Link className="inline-flex h-9 items-center rounded-md px-3 text-sm hover:bg-slate-100" href="/admin">管理</Link> : null}
                        <LanguageToggle />
                        <ModeToggle />
                    </nav>
                </div>
            </header>
            <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </div>
    );
}
