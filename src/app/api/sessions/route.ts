import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";

export async function GET() {
    try {
        const user = await requireUser();
        const sessions = await prisma.chatSession.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            include: {
                documents: {
                    include: { document: true },
                },
            },
        });

        return NextResponse.json(
            sessions.map((item) => ({
                id: item.id,
                title: item.title,
                docNames: item.documents.map((sd) => sd.document.filename),
                createdAt: item.createdAt,
            })),
        );
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await requireUser();
        const { title, docIds = [] } = await req.json();

        const session = await prisma.chatSession.create({
            data: {
                userId: user.id,
                title: title || "New Research",
            },
        });

        if (Array.isArray(docIds) && docIds.length) {
            await prisma.sessionDocument.createMany({
                data: docIds.map((docId: number) => ({
                    sessionId: session.id,
                    documentId: docId,
                })),
                skipDuplicates: true,
            });
        }

        return NextResponse.json({ sessionId: session.id, title: session.title });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create session";
        return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
    }
}
