import { HttpClient } from "@zilliz/milvus2-sdk-node";

const ZILLIZ_COLLECTION = process.env.ZILLIZ_COLLECTION || "scholarassit_vector_db";
const ZILLIZ_VECTOR_FIELD = process.env.ZILLIZ_VECTOR_FIELD || "vector";
const ZILLIZ_PRIMARY_KEY_FIELD = process.env.ZILLIZ_PRIMARY_KEY_FIELD || "primary_key";
const ZILLIZ_PRIMARY_KEY_TYPE = (process.env.ZILLIZ_PRIMARY_KEY_TYPE || "int64").toLowerCase();

type ChunkInput = {
    id: string;
    text: string;
    embedding: number[];
    metadata: Record<string, unknown>;
};

function toMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return String(error);
}

function normalize(value: string | undefined): string {
    return value?.trim() ?? "";
}

function parseStatus(error: unknown): number | null {
    const maybe = error as { status?: number; code?: number };
    if (typeof maybe?.status === "number") return maybe.status;
    if (typeof maybe?.code === "number") return maybe.code;
    return null;
}

function escapeFilterValue(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function toDeterministicInt64String(value: string): string {
    let hash = 2166136261;

    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }

    const normalized = (hash >>> 0) || 1;
    return String(normalized);
}

function formatPrimaryKey(rawId: string): string {
    if (ZILLIZ_PRIMARY_KEY_TYPE === "varchar" || ZILLIZ_PRIMARY_KEY_TYPE === "string") {
        return rawId;
    }

    const normalized = rawId.trim();
    if (/^-?\d+$/.test(normalized)) {
        return normalized;
    }

    return toDeterministicInt64String(normalized);
}

let cachedClient: HttpClient | null = null;
let collectionReady = false;
let cachedDbName: string | null = null;

function inferDbFromEndpoint(endpoint: string): string | null {
    const match = endpoint.match(/in\d+-([a-z0-9]+)\./i);
    if (!match?.[1]) return null;
    return `db_${match[1]}`;
}

function getDbName(endpoint: string): string {
    if (cachedDbName) return cachedDbName;

    const configured = normalize(process.env.ZILLIZ_DB);
    if (configured) {
        cachedDbName = configured;
        return cachedDbName;
    }

    const inferred = inferDbFromEndpoint(endpoint);
    cachedDbName = inferred || "default";
    return cachedDbName;
}

function getClient(): HttpClient {
    if (cachedClient) return cachedClient;

    const endpoint = normalize(process.env.ZILLIZ_ENDPOINT || process.env.MILVUS_ENDPOINT || process.env.MILVUS_ADDRESS);
    const token = normalize(process.env.ZILLIZ_TOKEN || process.env.MILVUS_TOKEN);
    const dbName = getDbName(endpoint);

    if (!endpoint || !token) {
        throw new Error(
            "Zilliz credentials are missing. Please set ZILLIZ_ENDPOINT/ZILLIZ_TOKEN (or MILVUS_ENDPOINT or MILVUS_ADDRESS, plus MILVUS_TOKEN).",
        );
    }

    cachedClient = new HttpClient({
        endpoint,
        token,
        database: dbName,
        timeout: 30_000,
    });

    return cachedClient;
}

async function ensureCollection(client: HttpClient): Promise<void> {
    if (collectionReady) return;

    const endpoint = normalize(process.env.ZILLIZ_ENDPOINT || process.env.MILVUS_ENDPOINT || process.env.MILVUS_ADDRESS);
    const dbName = getDbName(endpoint);
    const has = await client.hasCollection({ collectionName: ZILLIZ_COLLECTION, dbName });
    if (!has?.data?.has) {
        throw new Error(
            `Zilliz collection '${ZILLIZ_COLLECTION}' not found in database '${dbName}'. ` +
            "Please create this collection in Zilliz console before uploading documents.",
        );
    }

    collectionReady = true;
}

function buildFilter(userId: string, docNames?: string[]): string {
    const userFilter = `user_id == "${escapeFilterValue(userId)}"`;
    if (!docNames?.length) return userFilter;

    if (docNames.length === 1) {
        return `${userFilter} and source == "${escapeFilterValue(docNames[0])}"`;
    }

    const sourceList = docNames.map((name) => `"${escapeFilterValue(name)}"`).join(",");
    return `${userFilter} and source in [${sourceList}]`;
}

export async function upsertChunks(chunks: ChunkInput[]): Promise<void> {
    try {
        if (!chunks.length) return;

        const client = getClient();
        const endpoint = normalize(process.env.ZILLIZ_ENDPOINT || process.env.MILVUS_ENDPOINT || process.env.MILVUS_ADDRESS);
        const dbName = getDbName(endpoint);
        await ensureCollection(client);

        const result = await client.upsert({
            collectionName: ZILLIZ_COLLECTION,
            dbName,
            data: chunks.map((item) => ({
                [ZILLIZ_PRIMARY_KEY_FIELD]: formatPrimaryKey(item.id),
                text: item.text,
                [ZILLIZ_VECTOR_FIELD]: item.embedding,
                user_id: String(item.metadata.user_id ?? ""),
                source: String(item.metadata.source ?? ""),
                chunk_index: Number(item.metadata.chunk_index ?? 0),
                metadata_json: item.metadata,
            })),
        });

        const code = typeof result?.code === "number" ? result.code : 0;
        const upsertCount = Number(result?.data?.upsertCount ?? 0);
        if (code !== 0) {
            throw new Error(`Zilliz returned non-zero code (${code}): ${result?.message || "Unknown error"}`);
        }

        if (upsertCount <= 0) {
            throw new Error(
                `Zilliz upsert succeeded but wrote 0 rows. collection='${ZILLIZ_COLLECTION}', db='${dbName}'. ` +
                `Please verify schema field names (primary key '${ZILLIZ_PRIMARY_KEY_FIELD}' of type '${ZILLIZ_PRIMARY_KEY_TYPE}', vector field '${ZILLIZ_VECTOR_FIELD}') and vector dimension.`,
            );
        }
    } catch (error) {
        const status = parseStatus(error);
        const message = toMessage(error);

        throw new Error(`Zilliz upsert failed${status ? ` (status ${status})` : ""}: ${message}`);
    }
}

export async function deleteChunksBySource(userId: number | string, filename: string): Promise<void> {
    try {
        const client = getClient();
        const endpoint = normalize(process.env.ZILLIZ_ENDPOINT || process.env.MILVUS_ENDPOINT || process.env.MILVUS_ADDRESS);
        const dbName = getDbName(endpoint);
        await ensureCollection(client);

        await client.delete({
            collectionName: ZILLIZ_COLLECTION,
            dbName,
            filter: buildFilter(String(userId), [filename]),
        });
    } catch (error) {
        const status = parseStatus(error);
        const message = toMessage(error);
        throw new Error(`Zilliz delete failed${status ? ` (status ${status})` : ""}: ${message}`);
    }
}

export async function searchChunks(args: {
    embedding: number[];
    userId: string;
    docNames?: string[];
    limit?: number;
}) {
    try {
        const client = getClient();
        const endpoint = normalize(process.env.ZILLIZ_ENDPOINT || process.env.MILVUS_ENDPOINT || process.env.MILVUS_ADDRESS);
        const dbName = getDbName(endpoint);
        await ensureCollection(client);

        const response = await client.search({
            collectionName: ZILLIZ_COLLECTION,
            dbName,
            data: [args.embedding],
            annsField: ZILLIZ_VECTOR_FIELD,
            limit: args.limit ?? 5,
            filter: buildFilter(args.userId, args.docNames),
            outputFields: ["text", "source", "chunk_index", "metadata_json"],
            searchParams: {
                metric_type: "COSINE",
                params: {
                    nprobe: 16,
                },
            },
        });

        if (typeof response?.code === "number" && response.code !== 0) {
            throw new Error(`Zilliz returned non-zero code (${response.code}): ${response?.message || "Unknown error"}`);
        }

        const raw = Array.isArray(response?.data) ? response.data : [];
        const rows = Array.isArray(raw[0]) ? raw[0] : raw;

        return rows.map((row: any) => {
            const metadata =
                row?.metadata_json && typeof row.metadata_json === "object"
                    ? row.metadata_json
                    : {
                        user_id: row?.user_id,
                        source: row?.source,
                        chunk_index: row?.chunk_index,
                    };

            return {
                text: row?.text ?? "",
                metadata,
                $similarity: row?.distance,
            };
        });
    } catch (error) {
        const status = parseStatus(error);
        const message = toMessage(error);
        throw new Error(`Zilliz search failed${status ? ` (status ${status})` : ""}: ${message}`);
    }
}
