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
        .map((chunk) => `Source: ${chunk.source}\\nContent: ${chunk.content}`)
        .join("\n\n");

    const citations = citationsFromChunks(state.chunks);

    return streamText({
        model: getGenerationModel(),
        temperature: 0.2,
        prompt: [
            "You are Dr. Sync, an academic thesis consultant.",
            "Answer in Indonesian formal style unless user asks otherwise.",
            "Use provided context first and avoid hallucination.",
            citations ? `Use citation format like this when relevant: ${citations}` : "",
            `Context:\n${context}`,
            `Question:\n${state.activeQuery}`,
        ].join("\n\n"),
    });
}
