import { streamText } from "ai";
import { getGenerationModel } from "@/lib/llm";
import { RagState } from "@/lib/rag/types";

function citationsFromChunks(chunks: RagState["chunks"]): string {
    if (!chunks.length) return "";
    const top = chunks.slice(0, 3);
    return top
        .map((c) => `[[${c.source}|${c.page ?? 1}]]`)
        .join(" ");
}

export function generateNode(state: RagState) {
    const context = state.chunks
        .map((chunk) => `Source: ${chunk.source}\nContent: ${chunk.content}`)
        .join("\n\n");

    const citations = citationsFromChunks(state.chunks);

    return streamText({
        model: getGenerationModel(),
        temperature: 1.0,
        system: [
            "你是 Dr. Sync，一位专业的学术论文顾问。",
            "请始终使用用户提问所用的语言回答，用户用中文提问就用中文回答。",
            "优先基于提供的 Context 内容作答，没有相关内容时可结合自身知识回答，但不要捏造事实。",
            citations ? `引用格式示例（相关时使用）：${citations}` : "",
        ].filter(Boolean).join("\n"),
        prompt: [
            context ? `Context:\n${context}` : "",
            `Question:\n${state.activeQuery}`,
        ].filter(Boolean).join("\n\n"),
    });
}
