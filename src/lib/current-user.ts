import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireUser() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        throw new Error("UNAUTHORIZED");
    }

    const user = await prisma.user.findUnique({
        where: { id: Number(session.user.id) },
    });

    if (!user) {
        throw new Error("UNAUTHORIZED");
    }

    return user;
}
