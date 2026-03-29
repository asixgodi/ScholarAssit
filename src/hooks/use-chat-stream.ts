"use client";

import { useCallback, useRef, useState } from "react";

export type UIMessage = {
    role: "user" | "ai";
    content: string;
};

// 每帧最多渲染的字符数，调大更快但略跳，调小更丝滑但慢
const CHARS_PER_FRAME = 12;

export function useChatStream(sessionId: number | null) {
    const [messages, setMessages] = useState<UIMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);

    // 待输出字符队列
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

        // 队列未清空则继续下一帧
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

    const sendMessage = useCallback(
        async (message: string) => {
            if (!sessionId) return;

            setMessages((prev) => [...prev, { role: "user", content: message }, { role: "ai", content: "" }]);
            setIsStreaming(true);

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message, sessionId }),
            });

            if (!response.ok || !response.body) {
                let errorText = "请求失败，请稍后重试。";
                try {
                    const data = await response.json();
                    if (data?.error) errorText = String(data.error);
                } catch {
                    // ignore
                }
                setMessages((prev) => {
                    const cloned = [...prev];
                    const idx = cloned.length - 1;
                    if (idx >= 0 && cloned[idx].role === "ai") {
                        cloned[idx] = { ...cloned[idx], content: `Error: ${errorText}` };
                    }
                    return cloned;
                });
                setIsStreaming(false);
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                enqueueChars(decoder.decode(value, { stream: true }));
            }

            // 网络流结束后等 drip 把队列清空，再标记 isStreaming=false
            const waitDrain = () => {
                if (charQueueRef.current.length > 0) {
                    requestAnimationFrame(waitDrain);
                } else {
                    setIsStreaming(false);
                }
            };
            requestAnimationFrame(waitDrain);
        },
        [sessionId, enqueueChars],
    );

    return { messages, setMessages, sendMessage, isStreaming };
}
