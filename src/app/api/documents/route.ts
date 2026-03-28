import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";

export const runtime = "nodejs";

function isPrismaPoolTimeout(message: string): boolean {
    const normalized = message.toLowerCase();
    return normalized.includes("timed out fetching a new connection from the connection pool");
}

async function withPoolRetry<T>(operation: () => Promise<T>): Promise<T> {
    const delays = [250, 500, 1000];
    let lastError: unknown;

    for (let attempt = 0; attempt < delays.length + 1; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!isPrismaPoolTimeout(message) || attempt >= delays.length) {
                throw error;
            }

            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
        }
    }

    throw lastError instanceof Error ? lastError : new Error("Database connection pool timeout");
}

export async function GET() {
    try {
        const user = await requireUser();
        const docs = await withPoolRetry(() =>
            prisma.document.findMany({
                where: { userId: user.id },
                orderBy: { uploadedAt: "desc" },
            }),
        );

        return NextResponse.json(docs);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch documents";
        if (message === "UNAUTHORIZED") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const status = isPrismaPoolTimeout(message) ? 503 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function POST(req: Request) {
    try {
        const user = await requireUser();
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "Missing file" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

        const existingDoc = await withPoolRetry(() =>
            prisma.document.findFirst({
                where: {
                    userId: user.id,
                    fileHash,
                },
                orderBy: { uploadedAt: "desc" },
            }),
        );

        if (existingDoc) {
            return NextResponse.json({
                ...existingDoc,
                duplicated: true,
                warning: "This file has already been uploaded. Skipped re-indexing.",
            });
        }

        const [{ ingestPdf }, { uploadPdfToBlob }] = await Promise.all([
            import("@/lib/ingest"),
            import("@/lib/blob"),
        ]);

        let chunkCount = 0;
        let warning: string | null = null;

        // 向量化失败不影响文件落库，避免上游 embedding 服务异常导致“无法上传文件”。
        try {
            chunkCount = await ingestPdf({
                buffer,
                userId: String(user.id),
                filename: file.name,
            });
            if (chunkCount === 0) {
                warning = "Document uploaded, but no extractable text was found in this PDF, so no vectors were indexed.";
            }
        } catch (ingestError) {
            const ingestMessage = ingestError instanceof Error ? ingestError.message : "Indexing failed";
            warning = `Document uploaded, but indexing failed: ${ingestMessage}`;
            console.error("PDF ingest failed", {
                filename: file.name,
                userId: user.id,
                message: ingestMessage,
            });
        }

        const blobName = `${user.id}_${Date.now()}_${file.name}`;
        const fileUrl = await uploadPdfToBlob(blobName, buffer);

        const [doc] = await withPoolRetry(() =>
            prisma.$transaction([
                prisma.document.create({
                    data: {
                        userId: user.id,
                        filename: file.name,
                        fileHash,
                        chunkCount,
                        fileUrl,
                    },
                }),
                prisma.activityLog.create({
                    data: {
                        userId: user.id,
                        action: "upload",
                        details: file.name,
                    },
                }),
            ]),
        );

        return NextResponse.json({ ...doc, warning });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        const status =
            message === "UNAUTHORIZED"
                ? 401
                : message.toLowerCase().includes("forbidden")
                    ? 403
                    : isPrismaPoolTimeout(message)
                        ? 503
                        : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
