import { RagState } from "@/lib/rag/types";

export async function contextualizeNode(state: RagState): Promise<RagState> {
    return {
        ...state,
        activeQuery: state.activeQuery.trim(),
    };
}
