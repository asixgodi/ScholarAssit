import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function requireUser() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        throw new Error("UNAUTHORIZED");
    }

    const userId = Number(session.user.id);
    if (Number.isNaN(userId) || userId <= 0) {
        throw new Error("UNAUTHORIZED");
    }

    return {
        id: userId,
        isAdmin: Boolean(session.user.isAdmin),
        thesisStage: Number(session.user.thesisStage ?? 0),
    };
}
