"use client";

import { useCallback, useState } from "react";

export type UIMessage = {
    role: "user" | "ai";
    content: string;
};

export function useChatStream(sessionId: number | null) {
    const [messages, setMessages] = useState<UIMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);

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
                setIsStreaming(false);
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                setMessages((prev) => {
                    const cloned = [...prev];
                    const idx = cloned.length - 1;
                    if (idx >= 0 && cloned[idx].role === "ai") {
                        cloned[idx] = {
                            ...cloned[idx],
                            content: cloned[idx].content + text,
                        };
                    }
                    return cloned;
                });
            }

            setIsStreaming(false);
        },
        [sessionId],
    );

    return { messages, setMessages, sendMessage, isStreaming };
}
