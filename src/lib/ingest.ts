import crypto from "crypto";
import { createRequire } from "module";
import { embedText } from "@/lib/embeddings";
import { upsertChunks } from "@/lib/astra";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (buffer: Buffer) => Promise<{ text?: string }>;

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

export type IngestChunk = {
    content: string;
    index: number;
};

export function splitTextRecursively(text: string): IngestChunk[] {
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (!cleaned) return [];

    const chunks: IngestChunk[] = [];
    let start = 0;
    let index = 0;

    while (start < cleaned.length) {
        const end = Math.min(start + CHUNK_SIZE, cleaned.length);
        chunks.push({
            content: cleaned.slice(start, end),
            index,
        });

        if (end >= cleaned.length) break;
        start = Math.max(0, end - CHUNK_OVERLAP);
        index += 1;
    }

    return chunks;
}

export async function ingestPdf(params: {
    buffer: Buffer;
    userId: string;
    filename: string;
}): Promise<number> {
    const parsed = await pdfParse(params.buffer);
    const chunks = splitTextRecursively(parsed.text || "");

    if (!chunks.length) return 0;

    const now = new Date().toISOString();

    const payload = await Promise.all(
        chunks.map(async (chunk) => {
            const embedding = await embedText(chunk.content);
            return {
                id: crypto.createHash("sha1").update(`${params.userId}:${params.filename}:${chunk.index}`).digest("hex"),
                text: chunk.content,
                embedding,
                metadata: {
                    user_id: params.userId,
                    source: params.filename,
                    chunk_index: chunk.index,
                    ingested_at: now,
                },
            };
        }),
    );

    await upsertChunks(payload);
    return payload.length;
}
