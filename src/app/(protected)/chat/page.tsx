import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";
import { ChatShell } from "@/components/chat/chat-shell";

function isPrismaPoolTimeout(message: string): boolean {
    return message.toLowerCase().includes("timed out fetching a new connection from the connection pool");
}

async function withPoolRetry<T>(operation: () => Promise<T>): Promise<T> {
    const delays = [200, 400, 800];

    for (let attempt = 0; attempt < delays.length + 1; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!isPrismaPoolTimeout(message) || attempt >= delays.length) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
        }
    }

    throw new Error("Database connection pool timeout");
}

export default async function ChatPage() {
    const user = await requireUser();

    const [sessions, documents] = await withPoolRetry(() =>
        prisma.$transaction([
            prisma.chatSession.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: "desc" },
                select: { id: true, title: true },
                take: 30,
            }),
            prisma.document.findMany({
                where: { userId: user.id },
                orderBy: { uploadedAt: "desc" },
                select: { id: true, filename: true, uploadedAt: true },
                take: 100,
            }),
        ]),
    );

    return (
        <ChatShell
            initialSessions={sessions}
            initialDocuments={documents.map((d) => ({
                ...d,
                uploadedAt: d.uploadedAt.toISOString(),
            }))}
        />
    );
}
