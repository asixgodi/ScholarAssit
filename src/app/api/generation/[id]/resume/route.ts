import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";
import { runRagPipeline } from "@/lib/rag/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

const FLUSH_EVERY = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireUser();
        const { id } = await params;

        const generation = await prisma.generation.findFirst({
            where: { id, userId: user.id },
            include: {
                session: {
                    include: {
                        documents: { include: { document: { select: { filename: true } } } },
                    },
                },
            },
        });

        if (!generation) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        if (generation.status !== "interrupted") {
            return NextResponse.json({ error: "Generation is not interrupted" }, { status: 409 });
        }

        await prisma.generation.update({
            where: { id },
            data: { status: "streaming" },
        });

        const dbSessionId = generation.sessionId;
        const partial = generation.partialContent;

        // 把"原问题 + 已生成内容"一起喂给模型，让它从断点继续
        const resumeMessage = [
            `原始问题：${generation.question}`,
            partial ? `已生成内容（请勿重复）：\n${partial}\n\n请从断点处继续完成回答：` : generation.question,
        ].join("\n");

        let streamResult;
        try {
            streamResult = await runRagPipeline({
                message: resumeMessage,
                userId: String(user.id),
                docNames: generation.session.documents.map((d) => d.document.filename),
                chatHistory: [],
            });
        } catch (pipelineError) {
            await prisma.generation.update({
                where: { id },
                data: { status: "interrupted" },
            });
            const errMsg = pipelineError instanceof Error ? pipelineError.message : "AI 处理失败";
            return NextResponse.json({ error: errMsg }, { status: 500 });
        }

        const response = streamResult.toTextStreamResponse();
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let continuation = "";
        let sinceLastFlush = 0;
        let settled = false;

        async function finalize(status: "done" | "interrupted") {
            if (settled) return;
            settled = true;
            const fullText = partial + continuation;
            await Promise.all([
                // 只在正常完成时才写 ChatMessage（断线由下次 resume 处理）
                status === "done"
                    ? prisma.chatMessage.create({
                          data: { sessionId: dbSessionId, role: "ai", content: fullText },
                      })
                    : Promise.resolve(),
                prisma.generation.update({
                    where: { id },
                    data: { status, partialContent: fullText },
                }),
            ]);
        }

        req.signal.addEventListener("abort", () => {
            void finalize("interrupted");
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
                        continuation += chunk;
                        sinceLastFlush += chunk.length;
                        controller.enqueue(value);

                        if (sinceLastFlush >= FLUSH_EVERY) {
                            sinceLastFlush = 0;
                            const snapshot = partial + continuation;
                            prisma.generation
                                .update({ where: { id }, data: { partialContent: snapshot } })
                                .catch(console.error);
                        }
                    }
                } catch {
                    controller.close();
                    return;
                }

                await finalize("done");
                controller.close();
            },
        });

        return new Response(customStream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache",
                "X-Generation-Id": id,
                "Access-Control-Expose-Headers": "X-Generation-Id",
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
    }
}
