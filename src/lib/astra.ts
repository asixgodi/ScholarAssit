import { DataAPIClient } from "@datastax/astra-db-ts";

const ASTRA_COLLECTION = process.env.ASTRA_DB_COLLECTION || "scholarsync_vector_db";

function getClient() {
    const token = process.env.ASTRA_DB_APPLICATION_TOKEN;
    const endpoint = process.env.ASTRA_DB_API_ENDPOINT;

    if (!token || !endpoint) {
        throw new Error("Astra DB credentials are missing.");
    }

    return new DataAPIClient(token).db(endpoint);
}

export async function upsertChunks(
    chunks: Array<{ id: string; text: string; embedding: number[]; metadata: Record<string, unknown> }>,
): Promise<void> {
    const collection = getClient().collection(ASTRA_COLLECTION);
    if (!chunks.length) return;

    await collection.insertMany(
        chunks.map((item) => ({
            _id: item.id,
            $vector: item.embedding,
            text: item.text,
            metadata: item.metadata,
        })),
    );
}

export async function searchChunks(args: {
    embedding: number[];
    userId: string;
    docNames?: string[];
    limit?: number;
}) {
    const collection = getClient().collection(ASTRA_COLLECTION);
    const filter: Record<string, unknown> = {
        "metadata.user_id": args.userId,
    };

    if (args.docNames?.length) {
        filter["metadata.source"] =
            args.docNames.length === 1 ? args.docNames[0] : { $in: args.docNames };
    }

    const result = await collection.find(
        filter,
        {
            sort: { $vector: args.embedding },
            limit: args.limit ?? 5,
            includeSimilarity: true,
        },
    );

    return result.toArray();
}
