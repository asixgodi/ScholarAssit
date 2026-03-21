import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";

export async function GET() {
    try {
        const user = await requireUser();
        return NextResponse.json({ thesisStage: user.thesisStage });
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await requireUser();
        const body = await req.json();
        const stage = Number(body.stage ?? 0);

        const updated = await prisma.user.update({
            where: { id: user.id },
            data: { thesisStage: stage },
            select: { thesisStage: true },
        });

        return NextResponse.json(updated);
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
}
