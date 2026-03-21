import { generateObject } from "ai";
import { z } from "zod";
import { getReasoningModel } from "@/lib/llm";
import { RagState } from "@/lib/rag/types";

const gradeSchema = z.object({
    relevant: z.boolean(),
});

export async function graderNode(state: RagState): Promise<RagState> {
    if (!state.chunks.length) {
        return { ...state, shouldRewrite: true };
    }

    const sample = state.chunks.slice(0, 2).map((c) => c.content).join("\n\n");
    const { object } = await generateObject({
        model: getReasoningModel(),
        schema: gradeSchema,
        prompt: `Question: ${state.activeQuery}\n\nContext:\n${sample}\n\nIs this context relevant?`,
    });

    return { ...state, shouldRewrite: !object.relevant };
}
