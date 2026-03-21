import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";
import { ChatShell } from "@/components/chat/chat-shell";

export default async function ChatPage() {
    const user = await requireUser();

    const [sessions, documents] = await Promise.all([
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
    ]);

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
