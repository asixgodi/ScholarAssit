import { generateText } from "ai";
import { getReasoningModel } from "@/lib/llm";
import { RagState } from "@/lib/rag/types";

export async function rewriteNode(state: RagState): Promise<RagState> {
    const { text } = await generateText({
        model: getReasoningModel(),
        prompt: `Rewrite this query for semantic retrieval: ${state.activeQuery}`,
    });

    return { ...state, activeQuery: text.trim() || state.activeQuery };
}
