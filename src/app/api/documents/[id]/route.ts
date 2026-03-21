import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
    try {
        const user = await requireUser();
        const id = Number(params.id);
        const { filename } = await req.json();

        const doc = await prisma.document.findFirst({ where: { id, userId: user.id } });
        if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const updated = await prisma.document.update({
            where: { id },
            data: { filename },
        });

        return NextResponse.json(updated);
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
}

export async function DELETE(_req: Request, { params }: Params) {
    try {
        const user = await requireUser();
        const id = Number(params.id);

        const doc = await prisma.document.findFirst({ where: { id, userId: user.id } });
        if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

        await prisma.document.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
}
