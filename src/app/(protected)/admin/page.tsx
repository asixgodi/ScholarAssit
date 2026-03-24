import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";
import { AdminStats } from "@/components/admin/admin-stats";
import { AdminOverview } from "@/components/admin/admin-overview";

function getLast7Days() {
    const labels: string[] = [];
    const dates: string[] = [];
    for (let i = 6; i >= 0; i -= 1) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString("id-ID", { weekday: "short" }));
        dates.push(d.toISOString().slice(0, 10));
    }
    return { labels, dates };
}

export default async function AdminPage() {
    const user = await requireUser();
    if (!user.isAdmin) redirect("/dashboard");

    const [users, docs, sessions, logs] = await Promise.all([
        prisma.user.count(),
        prisma.document.count(),
        prisma.chatSession.count(),
        prisma.activityLog.findMany({
            orderBy: { timestamp: "desc" },
            take: 500,
            select: { timestamp: true },
        }),
    ]);

    const { labels, dates } = getLast7Days();
    const valueMap = new Map<string, number>();
    dates.forEach((d) => valueMap.set(d, 0));

    for (const log of logs) {
        const key = log.timestamp.toISOString().slice(0, 10);
        if (valueMap.has(key)) valueMap.set(key, (valueMap.get(key) || 0) + 1);
    }

    return (
        <div className="space-y-6">
            <AdminStats users={users} docs={docs} sessions={sessions} />
            <AdminOverview labels={labels} values={dates.map((d) => valueMap.get(d) || 0)} />
        </div>
    );
}
