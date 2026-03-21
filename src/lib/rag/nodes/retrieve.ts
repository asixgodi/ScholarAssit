import { embedText } from "@/lib/embeddings";
import { searchChunks } from "@/lib/astra";
import { RagChunk, RagState } from "@/lib/rag/types";

export async function retrieveNode(
    state: RagState,
    params: { userId: string; docNames?: string[] },
): Promise<RagState> {
    const embedding = await embedText(state.activeQuery);
    const rows = await searchChunks({
        embedding,
        userId: params.userId,
        docNames: params.docNames,
        limit: 5,
    });

    const chunks: RagChunk[] = rows.map((row: any) => ({
        source: row?.metadata?.source ?? "Unknown",
        page: row?.metadata?.page ? Number(row.metadata.page) : undefined,
        content: row?.text ?? "",
        similarity: row?.$similarity,
    }));

    return { ...state, chunks };
}
