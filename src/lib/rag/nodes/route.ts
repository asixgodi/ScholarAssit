import { generateText, Output } from "ai";
import { z } from "zod";
import { getReasoningModel } from "@/lib/llm";
import { RagState } from "@/lib/rag/types";

// zod定义路由节点的输出结构
const routeSchema = z.object({
    datasource: z.enum(["retrieve", "web_search", "generate"]),
});

export async function routeNode(state: RagState): Promise<RagState> {
    try {
        const { output } = await generateText({
            model: getReasoningModel(),
            output: Output.object({ schema: routeSchema }),
            prompt: `Question: ${state.activeQuery}\nChoose datasource: retrieve | web_search | generate`,
        });

        return { ...state, route: output.datasource };
    } catch {
        return { ...state, route: "retrieve" };
    }
}
