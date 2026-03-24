import { groq } from "@ai-sdk/groq";
import { openai } from "@ai-sdk/openai";
import { siliconflow } from "./ai-clients";
export function getReasoningModel() {
    if (process.env.SILICONFLOW_API_KEY) {
        return siliconflow("deepseek-ai/DeepSeek-V3");
    }

    if (process.env.GROQ_API_KEY) {
        return groq("llama-3.3-70b-versatile");
    }

    throw new Error("SILICONFLOW_API_KEY or GROQ_API_KEY is required.");
}

export function getGenerationModel() {
    if (process.env.OPENAI_API_KEY) {
        return openai("gpt-4o");
    }
    return getReasoningModel();
}
