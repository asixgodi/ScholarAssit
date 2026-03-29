import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ProtectedNav } from "@/components/protected/protected-nav";

export default async function ProtectedLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const session = await getServerSession(authOptions);
    const { locale } = await params;

    if (!session?.user) redirect(`/${locale}/login`);

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <span>ScholarAssit</span>
                        <span className="text-slate-400">/</span>
                        <span>{session.user.name}</span>
                    </div>
                    <ProtectedNav isAdmin={session.user.isAdmin} />
                </div>
            </header>
            <main className="mx-auto max-w-7xl px-4 py-4">{children}</main>
        </div>
    );
}
