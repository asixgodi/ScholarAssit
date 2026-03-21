import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const { username, email, password } = await req.json();

        if (!username || !email || !password) {
            return NextResponse.json({ error: "Incomplete input" }, { status: 400 });
        }

        const existing = await prisma.user.findFirst({
            where: { OR: [{ email }, { username }] },
        });

        if (existing) {
            return NextResponse.json({ error: "Email/username already exists" }, { status: 409 });
        }

        const hash = await bcrypt.hash(password, 12);
        const isAdmin = email === "admin@scholarsync.com";

        await prisma.user.create({
            data: {
                username,
                email,
                password: hash,
                isAdmin,
            },
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to register" }, { status: 500 });
    }
}
