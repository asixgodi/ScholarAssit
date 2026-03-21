import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";
import { ingestPdf } from "@/lib/ingest";
import { uploadPdfToBlob } from "@/lib/blob";

export async function GET() {
    try {
        const user = await requireUser();
        const docs = await prisma.document.findMany({
            where: { userId: user.id },
            orderBy: { uploadedAt: "desc" },
        });

        return NextResponse.json(docs);
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

        const chunkCount = await ingestPdf({
            buffer,
            userId: String(user.id),
            filename: file.name,
        });

        const blobName = `${user.id}_${Date.now()}_${file.name}`;
        const fileUrl = await uploadPdfToBlob(blobName, buffer);

        const doc = await prisma.document.create({
            data: {
                userId: user.id,
                filename: file.name,
                chunkCount,
                fileUrl,
            },
        });

        await prisma.activityLog.create({
            data: {
                userId: user.id,
                action: "upload",
                details: file.name,
            },
        });

        return NextResponse.json(doc);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        const status = message === "UNAUTHORIZED" ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
