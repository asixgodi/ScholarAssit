import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";

export async function POST() {
    try {
        const user = await requireUser();
        if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        await prisma.$transaction([
            prisma.activityLog.deleteMany(),
            prisma.chatMessage.deleteMany(),
            prisma.sessionDocument.deleteMany(),
            prisma.chatSession.deleteMany(),
            prisma.document.deleteMany(),
            prisma.user.deleteMany({ where: { id: { not: user.id } } }),
            prisma.user.update({ where: { id: user.id }, data: { thesisStage: 0 } }),
        ]);

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: "Reset failed" }, { status: 500 });
    }
}
