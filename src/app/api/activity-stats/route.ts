import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";

export async function GET() {
    try {
        const user = await requireUser();

        const labels: string[] = [];
        const keys: string[] = [];

        for (let i = 6; i >= 0; i -= 1) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString("id-ID", { weekday: "short" }));
            keys.push(date.toISOString().slice(0, 10));
        }

        const logs = await prisma.activityLog.findMany({
            where: {
                userId: user.id,
                timestamp: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                },
            },
            select: { timestamp: true },
        });

        const map = new Map<string, number>();
        keys.forEach((k) => map.set(k, 0));

        for (const log of logs) {
            const key = log.timestamp.toISOString().slice(0, 10);
            if (map.has(key)) map.set(key, (map.get(key) || 0) + 1);
        }

        return NextResponse.json({ labels, data: keys.map((k) => map.get(k) || 0) });
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
}
