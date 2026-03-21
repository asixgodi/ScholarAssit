import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";

export async function GET() {
    try {
        const user = await requireUser();
        if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const [users, docs, sessions, logs] = await Promise.all([
            prisma.user.count(),
            prisma.document.count(),
            prisma.chatSession.count(),
            prisma.activityLog.findMany({ orderBy: { timestamp: "desc" }, take: 30 }),
        ]);

        return NextResponse.json({ users, docs, sessions, logs });
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
}
