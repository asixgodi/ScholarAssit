import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";
import { runRagPipeline } from "@/lib/rag/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
    try {
        const user = await requireUser();
        const { message, sessionId } = await req.json();

        if (!message || !sessionId) {
            return NextResponse.json({ error: "message and sessionId are required" }, { status: 400 });
        }

        const session = await prisma.chatSession.findFirst({
            where: { id: Number(sessionId), userId: user.id },
            include: {
                documents: {
                    include: { document: { select: { filename: true } } },
                },
            },
        });

        if (!session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        await prisma.chatMessage.create({
            data: {
                sessionId: session.id,
                role: "user",
                content: String(message),
            },
        });

        const streamResult = await runRagPipeline({
            message: String(message),
            userId: String(user.id),
            docNames: session.documents.map((item) => item.document.filename),
        });

        const response = streamResult.toTextStreamResponse();
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        const customStream = new ReadableStream({
            async start(controller) {
                if (!reader) {
                    controller.close();
                    return;
                }

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    fullText += chunk;
                    controller.enqueue(value);
                }

                await prisma.chatMessage.create({
                    data: {
                        sessionId: session.id,
                        role: "ai",
                        content: fullText,
                    },
                });

                await prisma.activityLog.create({
                    data: {
                        userId: user.id,
                        action: "chat",
                    },
                });

                controller.close();
            },
        });

        return new Response(customStream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache",
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        const status = message === "UNAUTHORIZED" ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
