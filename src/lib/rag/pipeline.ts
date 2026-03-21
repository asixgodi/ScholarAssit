import { contextualizeNode } from "@/lib/rag/nodes/contextualize";
import { routeNode } from "@/lib/rag/nodes/route";
import { retrieveNode } from "@/lib/rag/nodes/retrieve";
import { graderNode } from "@/lib/rag/nodes/grader";
import { rewriteNode } from "@/lib/rag/nodes/rewrite";
import { webSearchNode } from "@/lib/rag/nodes/web-search";
import { generateNode } from "@/lib/rag/nodes/generate";
import { RagState } from "@/lib/rag/types";

export async function runRagPipeline(params: {
    message: string;
    userId: string;
    docNames?: string[];
}) {
    let state: RagState = {
        originalQuery: params.message,
        activeQuery: params.message,
        chunks: [],
    };

    state = await contextualizeNode(state);
    state = await routeNode(state);

    if (state.route === "web_search") {
        state = await webSearchNode(state);
        return generateNode(state);
    }

    if (state.route === "retrieve") {
        state = await retrieveNode(state, { userId: params.userId, docNames: params.docNames });
        state = await graderNode(state);

        if (state.shouldRewrite) {
            state = await rewriteNode(state);
            state = await retrieveNode(state, { userId: params.userId, docNames: params.docNames });
        }
    }

    return generateNode(state);
}
