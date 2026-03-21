import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
    try {
        const user = await requireUser();
        const id = Number(params.id);

        const session = await prisma.chatSession.findFirst({
            where: { id, userId: user.id },
            include: {
                documents: {
                    include: {
                        document: {
                            select: { id: true, filename: true, uploadedAt: true },
                        },
                    },
                },
            },
        });

        if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

        return NextResponse.json({
            id: session.id,
            title: session.title,
            docCount: session.documents.length,
            docNames: session.documents.map((item) => item.document.filename),
            documents: session.documents.map((item) => item.document),
        });
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
}

export async function PATCH(req: Request, { params }: Params) {
    try {
        const user = await requireUser();
        const id = Number(params.id);
        const { title } = await req.json();

        const session = await prisma.chatSession.findFirst({ where: { id, userId: user.id } });
        if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const updated = await prisma.chatSession.update({
            where: { id },
            data: { title },
        });

        return NextResponse.json(updated);
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
}
