import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";

export async function GET() {
    try {
        const user = await requireUser();
        if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const logs = await prisma.activityLog.findMany({
            orderBy: { timestamp: "desc" },
            select: {
                id: true,
                userId: true,
                action: true,
                details: true,
                timestamp: true,
            },
        });

        const header = "ID,User ID,Action,Details,Timestamp";
        const rows = logs.map((log) => {
            const safeDetails = (log.details || "").replace(/,/g, " ");
            return [log.id, log.userId ?? "", log.action, safeDetails, log.timestamp.toISOString()].join(",");
        });

        return new Response([header, ...rows].join("\n"), {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename=activity_logs_${new Date().toISOString().slice(0, 10)}.csv`,
            },
        });
    } catch {
        return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }
}
