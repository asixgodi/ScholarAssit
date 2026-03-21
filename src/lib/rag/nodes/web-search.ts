import { RagChunk, RagState } from "@/lib/rag/types";

export async function webSearchNode(state: RagState): Promise<RagState> {
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!tavilyKey) return state;

    const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            api_key: tavilyKey,
            query: state.activeQuery,
            max_results: 3,
        }),
    });

    if (!response.ok) return state;
    const data = await response.json();

    const webChunks: RagChunk[] = (data.results || []).map((item: any) => ({
        source: item.url,
        content: item.content,
    }));

    return { ...state, chunks: webChunks };
}
