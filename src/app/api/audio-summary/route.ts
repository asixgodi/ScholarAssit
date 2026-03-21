import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const user = await requireUser();
        const { sessionId } = await req.json();

        const lastAi = await prisma.chatMessage.findFirst({
            where: {
                role: "ai",
                sessionId: Number(sessionId),
                session: { userId: user.id },
            },
            orderBy: { createdAt: "desc" },
            select: { content: true },
        });

        return NextResponse.json({
            summary: (lastAi?.content || "Belum ada ringkasan.").slice(0, 600),
            provider: "placeholder",
            note: "Hubungkan OpenAI TTS endpoint untuk output MP3 produksi.",
        });
    } catch {
        return NextResponse.json({ error: "Failed to summarize" }, { status: 500 });
    }
}
