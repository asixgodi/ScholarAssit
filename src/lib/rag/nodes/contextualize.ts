import { generateText } from "ai";
import { getReasoningModel } from "@/lib/llm";
import { RagState } from "@/lib/rag/types";

export async function contextualizeNode(state: RagState): Promise<RagState> {
    const history = state.chatHistory;

    // 没有历史记录时，无需改写
    if (!history?.length) {
        return {
            ...state,
            activeQuery: state.activeQuery.trim(),
        };
    }

    // 将历史压缩成对话摘要，再结合当前问题改写为独立查询
    const historyText = history
        .map((m) => `${m.role === "user" ? "用户" : "助手"}: ${m.content}`)
        .join("\n");

    const { text } = await generateText({
        model: getReasoningModel(),
        system: `你是一个查询改写助手。根据聊天历史和最新问题，生成一个独立的、
适合用于向量检索的查询语句。要求：
1. 合并历史中的关键上下文（如主题、实体、限定条件）
2. 去掉寒暄、确认等无关信息
3. 只输出改写后的查询，不要任何解释`,
        prompt: `聊天历史：
${historyText}

最新问题：${state.originalQuery}

改写后的独立查询：`,
    });

    return {
        ...state,
        activeQuery: text.trim() || state.originalQuery,
    };
}
