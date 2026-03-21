export type RagRoute = "retrieve" | "web_search" | "generate";

export type RagChunk = {
    source: string;
    page?: number;
    content: string;
    similarity?: number;
};

export type RagState = {
    originalQuery: string;
    activeQuery: string;
    route?: RagRoute;
    chunks: RagChunk[];
    shouldRewrite?: boolean;
};
