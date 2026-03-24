import { createOpenAI } from "@ai-sdk/openai";

export const siliconflow = createOpenAI({
    apiKey: process.env.SILICONFLOW_API_KEY,
    baseURL: "https://api.siliconflow.cn/v1",
});
