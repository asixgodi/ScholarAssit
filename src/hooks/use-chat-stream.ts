"use client";

import { useCallback, useRef, useState } from "react";

export type UIMessage = {
    role: "user" | "ai";
    content: string;
};

export type InterruptedGeneration = {
    id: string;
    partialContent: string;
};

// 每帧最多渲染的字符数，调大更快但略跳，调小更丝滑但慢
const CHARS_PER_FRAME = 12;

export function useChatStream(sessionId: number | null) {
    const [messages, setMessages] = useState<UIMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [interruptedGeneration, setInterruptedGeneration] = useState<InterruptedGeneration | null>(null);

    const charQueueRef = useRef<string>("");
    const rafRef = useRef<number | null>(null);

    const drip = useCallback(() => {
        rafRef.current = null;
        if (charQueueRef.current.length === 0) return;

        const batch = charQueueRef.current.slice(0, CHARS_PER_FRAME);
        charQueueRef.current = charQueueRef.current.slice(CHARS_PER_FRAME);

        setMessages((prev) => {
            const cloned = [...prev];
            const idx = cloned.length - 1;
            if (idx >= 0 && cloned[idx].role === "ai") {
                cloned[idx] = { ...cloned[idx], content: cloned[idx].content + batch };
            }
            return cloned;
        });

        if (charQueueRef.current.length > 0) {
            rafRef.current = requestAnimationFrame(drip);
        }
    }, []);

    const enqueueChars = useCallback(
        (chunk: string) => {
            charQueueRef.current += chunk;
            if (rafRef.current === null) {
                rafRef.current = requestAnimationFrame(drip);
            }
        },
        [drip],
    );

    /** 等待 drip 队列清空后执行回调 */
    const waitDrain = useCallback((cb: () => void) => {
        const check = () => {
            if (charQueueRef.current.length > 0) {
                requestAnimationFrame(check);
            } else {
                cb();
            }
        };
        requestAnimationFrame(check);
    }, []);

    /** 从服务端拉取 generation 状态，恢复断线时已生成的内容 */
    const recoverPartial = useCallback(async (generationId: string) => {
        try {
            const res = await fetch(`/api/generation/${generationId}`);
            if (!res.ok) return;
            const data = (await res.json()) as { status: string; partialContent: string };

            if (data.status !== "interrupted" || !data.partialContent) return;

            // 把已生成内容渲染到最后一条 AI 消息
            setMessages((prev) => {
                const cloned = [...prev];
                const idx = cloned.length - 1;
                if (idx >= 0 && cloned[idx].role === "ai") {
                    cloned[idx] = { ...cloned[idx], content: data.partialContent };
                }
                return cloned;
            });

            setInterruptedGeneration({ id: generationId, partialContent: data.partialContent });
        } catch {
            // 恢复失败静默处理，不影响主流程
        }
    }, []);

    /** 读取流并把 chunk 送入 drip 队列，完成后执行 onDone */
    const consumeStream = useCallback(
        async (
            response: Response,
            opts: { onDone?: () => void; onError?: (generationId: string | null) => void } = {},
        ) => {
            const generationId = response.headers.get("X-Generation-Id");

            if (!response.ok || !response.body) {
                let errorText = "请求失败，请稍后重试。";
                try {
                    const data = await response.json();
                    if (data?.error) errorText = String(data.error);
                } catch { /* ignore */ }
                setMessages((prev) => {
                    const cloned = [...prev];
                    const idx = cloned.length - 1;
                    if (idx >= 0 && cloned[idx].role === "ai") {
                        cloned[idx] = { ...cloned[idx], content: `Error: ${errorText}` };
                    }
                    return cloned;
                });
                setIsStreaming(false);
                opts.onError?.(generationId);
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    enqueueChars(decoder.decode(value, { stream: true }));
                }
            } catch {
                // 网络断开：拉取已保存的 partialContent 恢复 UI
                if (generationId) {
                    await recoverPartial(generationId);
                }
                waitDrain(() => setIsStreaming(false));
                return;
            }

            waitDrain(() => {
                setIsStreaming(false);
                opts.onDone?.();
            });
        },
        [enqueueChars, recoverPartial, waitDrain],
    );

    const sendMessage = useCallback(
        async (message: string) => {
            if (!sessionId) return;

            setInterruptedGeneration(null);
            setMessages((prev) => [...prev, { role: "user", content: message }, { role: "ai", content: "" }]);
            setIsStreaming(true);

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message, sessionId }),
            });

            await consumeStream(response);
        },
        [sessionId, consumeStream],
    );

    /**
     * 续写被中断的 generation。
     * 前端已展示 partialContent，此函数只追加新生成的部分。
     */
    const resumeGeneration = useCallback(
        async (gen: InterruptedGeneration) => {
            setInterruptedGeneration(null);
            setIsStreaming(true);

            const response = await fetch(`/api/generation/${gen.id}/resume`, {
                method: "POST",
            });

            await consumeStream(response);
        },
        [consumeStream],
    );

    return { messages, setMessages, sendMessage, isStreaming, interruptedGeneration, resumeGeneration };
}
