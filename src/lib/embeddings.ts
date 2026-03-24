import "server-only";
import { siliconflow } from "./ai-clients";
import { embed } from "ai";

function toMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return String(error);
}

export async function embedText(value: string): Promise<number[]> {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
        throw new Error("SILICONFLOW_API_KEY is not set.");
    }

    const normalizedValue = value.trim();
    if (!normalizedValue) {
        throw new Error("Cannot embed empty text.");
    }

    try {
        const result = await embed({
            model: siliconflow.embedding("Pro/BAAI/bge-m3"),
            value: normalizedValue,
        });
        return result.embedding;
    } catch (error) {
        const message = toMessage(error);
        const lower = message.toLowerCase();

        if (lower.includes("forbidden") || lower.includes("403")) {
            throw new Error(
                "Embedding forbidden by SiliconFlow. Check SILICONFLOW_API_KEY validity, model access (BAAI/bge-m3), account quota, and IP/region policy.",
            );
        }

        throw new Error(`Embedding failed: ${message}`);
    }
}
