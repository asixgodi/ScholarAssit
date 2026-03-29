import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";
import { deleteChunksBySource } from "@/lib/astra";

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
    try {
        const user = await requireUser();
        const id = Number(params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
        }
        const { filename } = await req.json();

        const doc = await prisma.document.findFirst({ where: { id, userId: user.id } });
        if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const updated = await prisma.document.update({
            where: { id },
            data: { filename },
        });

        return NextResponse.json(updated);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message === "UNAUTHORIZED") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.error("[api/documents/:id] PATCH failed:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: Params) {
    try {
        const user = await requireUser();
        const id = Number(params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
        }

        const doc = await prisma.document.findFirst({ where: { id, userId: user.id } });
        if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

        await deleteChunksBySource(user.id, doc.filename);
        await prisma.document.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message === "UNAUTHORIZED") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.error("[api/documents/:id] DELETE failed:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
