import { embedText } from "@/lib/embeddings";
import { searchChunks } from "@/lib/astra";
import { RagChunk, RagState } from "@/lib/rag/types";

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchChunksWithRetry(args: {
    embedding: number[];
    userId: string;
    docNames?: string[];
    limit?: number;
}) {
    const delays = [300, 700];

    for (let attempt = 0; attempt <= delays.length; attempt += 1) {
        const rows = await searchChunks(args);
        if (rows.length > 0) return rows;

        // 上传后短时间内向量库可能尚未可检索，空结果时进行短重试。
        const shouldRetry = Boolean(args.docNames?.length) && attempt < delays.length;
        if (!shouldRetry) return rows;
        await sleep(delays[attempt]);
    }

    return [];
}

export async function retrieveNode(
    state: RagState,
    params: { userId: string; docNames?: string[] },
): Promise<RagState> {
    const embedding = await embedText(state.activeQuery);
    const rows = await searchChunksWithRetry({
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
