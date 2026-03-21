import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";

export async function GET(req: Request) {
    try {
        const user = await requireUser();
        const { searchParams } = new URL(req.url);
        const sessionId = Number(searchParams.get("sessionId"));

        if (!sessionId) {
            return NextResponse.json([]);
        }

        const session = await prisma.chatSession.findFirst({
            where: { id: sessionId, userId: user.id },
            include: {
                messages: {
                    orderBy: { createdAt: "asc" },
                    select: {
                        role: true,
                        content: true,
                    },
                },
            },
        });

        return NextResponse.json(session?.messages || []);
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
}
