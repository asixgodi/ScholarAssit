// 定义路由选项：去本地查、去网上搜、还是直接回答
export type RagRoute = "retrieve" | "web_search" | "generate";

// 检索到的“知识碎片”结构
export type RagChunk = {
    source: string;
    page?: number;
    content: string;
    similarity?: number;
};

// 聊天历史消息
export type ChatMessage = {
    role: "user" | "ai";
    content: string;
};

// 核心状态机接口：记录整个处理过程中的所有变量
export type RagState = {
    originalQuery: string;
    activeQuery: string;
    chatHistory?: ChatMessage[];
    route?: RagRoute;
    chunks: RagChunk[];
    shouldRewrite?: boolean;
};
