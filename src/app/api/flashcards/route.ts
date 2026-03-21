import { generateObject } from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { getReasoningModel } from "@/lib/llm";

const flashcardSchema = z.object({
    flashcards: z.array(
        z.object({
            question: z.string(),
            answer: z.string(),
        }),
    ),
});

export async function POST(req: Request) {
    try {
        const user = await requireUser();
        const { sessionId } = await req.json();

        const messages = await prisma.chatMessage.findMany({
            where: {
                sessionId: Number(sessionId),
                session: { userId: user.id },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { content: true },
        });

        const context = messages.map((m) => m.content).join("\n\n");

        const { object } = await generateObject({
            model: getReasoningModel(),
            schema: flashcardSchema,
            prompt: `Create 5 study flashcards from this chat context:\n\n${context}`,
        });

        return NextResponse.json(object);
    } catch {
        return NextResponse.json({ error: "Failed to generate flashcards" }, { status: 500 });
    }
}
