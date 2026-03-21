import { groq } from "@ai-sdk/groq";
import { openai } from "@ai-sdk/openai";

export function getReasoningModel() {
    if (process.env.OPENAI_API_KEY) {
        return openai("gpt-4o-mini");
    }

    if (process.env.GROQ_API_KEY) {
        return groq("llama-3.3-70b-versatile");
    }

    throw new Error("OPENAI_API_KEY or GROQ_API_KEY is required.");
}

export function getGenerationModel() {
    if (process.env.OPENAI_API_KEY) {
        return openai("gpt-4o");
    }
    return getReasoningModel();
}
