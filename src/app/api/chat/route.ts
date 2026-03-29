import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";
import { runRagPipeline } from "@/lib/rag/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

// 每累积 300 字符刷一次 partialContent 到库
const FLUSH_EVERY = 300;

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

        const historyMessages = await prisma.chatMessage.findMany({
            where: { sessionId: session.id },
            orderBy: { createdAt: "asc" },
            select: { role: true, content: true },
        });
        const chatHistory = historyMessages.slice(0, -1).map((m) => ({
            role: m.role as "user" | "ai",
            content: m.content,
        }));

        // 提前解构，避免闭包内 TypeScript 丢失 null narrowing
        const dbSessionId = session.id;

        // 创建 generation 记录，状态为 streaming
        const generation = await prisma.generation.create({
            data: {
                sessionId: session.id,
                userId: user.id,
                question: String(message),
                status: "streaming",
            },
        });

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
            await Promise.all([
                prisma.chatMessage.create({
                    data: { sessionId: session.id, role: "ai", content: `[错误] ${errMsg}` },
                }),
                prisma.generation.update({
                    where: { id: generation.id },
                    data: { status: "failed" },
                }),
            ]);
            console.error("[api/chat] pipeline failed:", pipelineError);
            return NextResponse.json({ error: errMsg }, { status: 500 });
        }

        const response = streamResult.toTextStreamResponse();
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let sinceLastFlush = 0;

        // 标记是否已在处理断线（避免 abort + 流结束 双写）
        let settled = false;

        async function markInterrupted() {
            if (settled) return;
            settled = true;
            await prisma.generation.update({
                where: { id: generation.id },
                data: { status: "interrupted", partialContent: fullText },
            });
        }

        async function markDone() {
            if (settled) return;
            settled = true;
            await Promise.all([
                prisma.chatMessage.create({
                    data: { sessionId: dbSessionId, role: "ai", content: fullText },
                }),
                prisma.generation.update({
                    where: { id: generation.id },
                    data: { status: "done", partialContent: fullText },
                }),
                prisma.activityLog.create({
                    data: { userId: user.id, action: "chat" },
                }),
            ]);
        }

        // 客户端主动断开时标记 interrupted
        req.signal.addEventListener("abort", () => {
            void markInterrupted();
        });

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
                        sinceLastFlush += chunk.length;
                        controller.enqueue(value);

                        // 定期把已生成内容落库（fire-and-forget）
                        if (sinceLastFlush >= FLUSH_EVERY) {
                            sinceLastFlush = 0;
                            const snapshot = fullText;
                            prisma.generation
                                .update({
                                    where: { id: generation.id },
                                    data: { partialContent: snapshot },
                                })
                                .catch(console.error);
                        }
                    }
                } catch {
                    // controller.enqueue 抛出意味着客户端已断线，abort 事件会处理落库
                    controller.close();
                    return;
                }

                await markDone();
                controller.close();
            },
        });

        return new Response(customStream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache",
                // 把 generationId 透传给前端，供断线恢复使用
                "X-Generation-Id": generation.id,
                "Access-Control-Expose-Headers": "X-Generation-Id",
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("[api/chat] POST failed:", error);
        const status = message === "UNAUTHORIZED" ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
