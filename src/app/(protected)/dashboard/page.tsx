import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
    try {
        const user = await requireUser();

        const [docsCount, sessionsCount, messagesCount] = await Promise.all([
            prisma.document.count({ where: { userId: user.id } }),
            prisma.chatSession.count({ where: { userId: user.id } }),
            prisma.chatMessage.count({ where: { session: { userId: user.id } } }),
        ]);
        return (
            <DashboardOverview
                stats={{
                    docsCount,
                    sessionsCount,
                    messagesCount,
                    thesisStage: user.thesisStage,
                }}
            />
        );
    } catch (error) {
        if (error instanceof Error && error.message === "UNAUTHORIZED") {
            redirect("/login");
        }

        return (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
                <h2 className="text-lg font-semibold">Database temporarily unavailable</h2>
                <p className="mt-2 text-sm">
                    Please refresh in a few seconds. If this keeps happening, check your database/network connection.
                </p>
            </div>
        );
    }
}
