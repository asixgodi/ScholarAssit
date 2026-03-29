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

        // 获取该会话的历史消息（排除刚插入的当前消息）
        const historyMessages = await prisma.chatMessage.findMany({
            where: { sessionId: session.id },
            orderBy: { createdAt: "asc" },
            select: { role: true, content: true },
        });
        // 去掉最后一条（刚插入的当前用户消息）
        const chatHistory = historyMessages.slice(0, -1).map((m) => ({
            role: m.role as "user" | "ai",
            content: m.content,
        }));

        let streamResult;
        try {
            streamResult = await runRagPipeline({
                message: String(message),
                userId: String(user.id),
                docNames: session.documents.map((item) => item.document.filename),
                chatHistory,
            });
        } catch (pipelineError) {
            const errMsg = pipelineError instanceof Error ? pipelineError.message : "AI 处理失败，请稍后重试";
            await prisma.chatMessage.create({
                data: { sessionId: session.id, role: "ai", content: `[错误] ${errMsg}` },
            });
            console.error("[api/chat] pipeline failed:", pipelineError);
            return NextResponse.json({ error: errMsg }, { status: 500 });
        }

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

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value, { stream: true });
                        fullText += chunk;
                        controller.enqueue(value);
                    }
                } catch (streamError) {
                    const errMsg = streamError instanceof Error ? streamError.message : "流式输出中断";
                    const saved = fullText || `[错误] ${errMsg}`;
                    await prisma.chatMessage.create({
                        data: { sessionId: session.id, role: "ai", content: saved },
                    });
                    console.error("[api/chat] stream failed:", streamError);
                    controller.close();
                    return;
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
        console.error("[api/chat] POST failed:", error);
        const status = message === "UNAUTHORIZED" ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
