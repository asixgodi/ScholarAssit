import { generateObject } from "ai";
import { z } from "zod";
import { getReasoningModel } from "@/lib/llm";
import { RagState } from "@/lib/rag/types";

const routeSchema = z.object({
    datasource: z.enum(["retrieve", "web_search", "generate"]),
});

export async function routeNode(state: RagState): Promise<RagState> {
    const { object } = await generateObject({
        model: getReasoningModel(),
        schema: routeSchema,
        prompt: `Question: ${state.activeQuery}\nChoose datasource: retrieve | web_search | generate`,
    });

    return { ...state, route: object.datasource };
}
