import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireUser();
        const { id } = await params;

        const generation = await prisma.generation.findFirst({
            where: { id, userId: user.id },
            select: { id: true, status: true, partialContent: true },
        });

        if (!generation) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        return NextResponse.json(generation);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
    }
}
