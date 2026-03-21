import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";

export default async function DashboardPage() {
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
}
