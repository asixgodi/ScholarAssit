import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";

type Params = { params: { sessionId: string } };

export async function GET(_req: Request, { params }: Params) {
    try {
        const user = await requireUser();
        const sessionId = Number(params.sessionId);

        const session = await prisma.chatSession.findFirst({
            where: { id: sessionId, userId: user.id },
            include: {
                messages: {
                    orderBy: { createdAt: "asc" },
                    select: { role: true, content: true },
                },
            },
        });

        if (!session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        let markdown = `# Transkrip Bimbingan: ${session.title}\n\n`;
        for (const msg of session.messages) {
            markdown += `**${msg.role === "user" ? "User" : "Dr. scholarAssit"}**\n\n${msg.content}\n\n---\n\n`;
        }

        return new Response(markdown, {
            headers: {
                "Content-Type": "text/markdown; charset=utf-8",
                "Content-Disposition": `attachment; filename=Draft_Skripsi_${sessionId}.md`,
            },
        });
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
}
