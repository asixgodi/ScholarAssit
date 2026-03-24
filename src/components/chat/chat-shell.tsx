"use client";

import { FormEvent, useEffect, useState } from "react";
import { marked } from "marked";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useLocale } from "@/hooks/use-locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { LanguageToggle } from "@/components/language-toggle";

marked.setOptions({
    breaks: true,
    gfm: true,
});

type SessionOption = {
    id: number;
    title: string;
};

type Props = {
    initialSessions: SessionOption[];
    initialDocuments: Array<{ id: number; filename: string; uploadedAt: string }>;
};

export function ChatShell({ initialSessions, initialDocuments }: Props) {
    const { t } = useLocale();

    const [sessions, setSessions] = useState<SessionOption[]>(initialSessions);
    const [documents, setDocuments] = useState(initialDocuments);
    const [activeSessionId, setActiveSessionId] = useState<number | null>(initialSessions[0]?.id ?? null);
    const [message, setMessage] = useState("");
    const [sessionTitleDraft, setSessionTitleDraft] = useState(initialSessions[0]?.title ?? "");
    const [flashcards, setFlashcards] = useState<Array<{ question: string; answer: string }>>([]);
    const [audioSummary, setAudioSummary] = useState("");
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const [uploadWarning, setUploadWarning] = useState("");
    const { messages, setMessages, sendMessage, isStreaming } = useChatStream(activeSessionId);

    useEffect(() => {
        if (!activeSessionId) return;

        fetch(`/api/history?sessionId=${activeSessionId}`)
            .then((r) => r.json())
            .then((history) => {
                setMessages(history);
            })
            .catch(() => setMessages([]));
    }, [activeSessionId, setMessages]);

    useEffect(() => {
        if (!activeSessionId) return;
        const active = sessions.find((s) => s.id === activeSessionId);
        if (active) setSessionTitleDraft(active.title);
    }, [activeSessionId, sessions]);

    const refreshDocuments = async () => {
        const response = await fetch("/api/documents");
        if (!response.ok) return;
        const data = await response.json();
        setDocuments(data);
    };

    const createSession = async () => {
        const response = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: t.defaultSessionTitle }),
        });

        if (!response.ok) return;
        const data = await response.json();

        const next = [{ id: data.sessionId, title: data.title }, ...sessions];
        setSessions(next);
        setActiveSessionId(data.sessionId);
        setSessionTitleDraft(data.title);
        setMessages([]);
    };

    const renameSession = async () => {
        if (!activeSessionId) return;
        const response = await fetch(`/api/sessions/${activeSessionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: sessionTitleDraft.trim() || t.defaultSessionTitle }),
        });
        if (!response.ok) return;
        const data = await response.json();
        setSessions((prev) => prev.map((item) => (item.id === activeSessionId ? { ...item, title: data.title } : item)));
    };

    const uploadDocument = async (file: File) => {
        setUploading(true);
        setUploadError("");
        setUploadWarning("");

        try {
            const formData = new FormData();
            formData.append("file", file);
            const response = await fetch("/api/documents", { method: "POST", body: formData });
            const body = await response.json().catch(() => null);

            if (!response.ok) {
                const errorMessage = typeof body?.error === "string" ? body.error : "Upload failed";
                setUploadError(errorMessage);
                return;
            }

            if (typeof body?.warning === "string" && body.warning) {
                setUploadWarning(body.warning);
            }

            await refreshDocuments();
        } catch {
            setUploadError("Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const renameDocument = async (docId: number, oldName: string) => {
        const nextName = window.prompt(t.renamePrompt, oldName);
        if (!nextName || nextName === oldName) return;

        const response = await fetch(`/api/documents/${docId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: nextName }),
        });

        if (!response.ok) return;
        await refreshDocuments();
    };

    const deleteDocument = async (docId: number) => {
        if (!window.confirm(t.deleteConfirm)) return;

        const response = await fetch(`/api/documents/${docId}`, {
            method: "DELETE",
        });
        if (!response.ok) return;
        await refreshDocuments();
    };

    const generateFlashcards = async () => {
        if (!activeSessionId) return;
        const response = await fetch("/api/flashcards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: activeSessionId }),
        });
        if (!response.ok) return;
        const data = await response.json();
        setFlashcards(data.flashcards || []);
    };

    const generateAudioSummary = async () => {
        if (!activeSessionId) return;
        const response = await fetch("/api/audio-summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: activeSessionId }),
        });
        if (!response.ok) return;
        const data = await response.json();
        setAudioSummary(data.summary || "");
    };

    const downloadMarkdown = () => {
        if (!activeSessionId) return;
        window.open(`/api/download/${activeSessionId}`, "_blank");
    };

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const value = message.trim();
        if (!value) return;
        setMessage("");
        await sendMessage(value);
    };

    return (
        <div className="grid min-h-[78vh] grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
            <Card>
                <CardContent className="space-y-4 p-4">
                    <LanguageToggle />

                    <Button onClick={createSession} className="w-full">
                        {t.newSession}
                    </Button>

                    <div className="space-y-2 rounded-md border p-2">
                        <Input
                            value={sessionTitleDraft}
                            onChange={(e) => setSessionTitleDraft(e.target.value)}
                            placeholder={t.sessionTitle}
                        />
                        <Button onClick={renameSession} size="sm" className="w-full" variant="secondary">
                            {t.saveTitle}
                        </Button>
                    </div>

                    <div className="space-y-2">
                        {sessions.map((item) => (
                            <button
                                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${activeSessionId === item.id ? "bg-slate-900 text-white" : "bg-white"}`}
                                key={item.id}
                                onClick={() => setActiveSessionId(item.id)}
                            >
                                {item.title}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-2 border-t pt-3">
                        <label className="text-xs font-semibold text-slate-500">{t.documents}</label>
                        <Input
                            type="file"
                            accept="application/pdf"
                            disabled={uploading}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) uploadDocument(file);
                                e.currentTarget.value = "";
                            }}
                        />
                        {uploadError ? <p className="text-xs text-red-600">{uploadError}</p> : null}
                        {uploadWarning ? <p className="text-xs text-amber-600">{uploadWarning}</p> : null}
                        <div className="max-h-48 space-y-2 overflow-auto">
                            {documents.map((doc) => (
                                <div key={doc.id} className="rounded border bg-white p-2 text-xs">
                                    <p className="truncate font-medium">{doc.filename}</p>
                                    <div className="mt-2 flex gap-1">
                                        <Button size="xs" variant="outline" onClick={() => renameDocument(doc.id, doc.filename)}>
                                            {t.rename}
                                        </Button>
                                        <Button size="xs" variant="destructive" onClick={() => deleteDocument(doc.id)}>
                                            {t.delete}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="flex min-h-[78vh] flex-col">
                <CardContent className="flex flex-1 flex-col p-0">
                    <div className="flex flex-wrap gap-2 border-b px-4 py-3">
                        <Button size="sm" variant="outline" onClick={generateFlashcards} disabled={!activeSessionId}>
                            {t.generateFlashcards}
                        </Button>
                        <Button size="sm" variant="outline" onClick={generateAudioSummary} disabled={!activeSessionId}>
                            {t.audioSummary}
                        </Button>
                        <Button size="sm" variant="outline" onClick={downloadMarkdown} disabled={!activeSessionId}>
                            {t.exportMarkdown}
                        </Button>
                    </div>

                    <ScrollArea className="flex-1 px-5 py-4">
                        <div className="mb-4 space-y-2 rounded-lg border bg-amber-50/60 p-3 text-sm">
                            <p className="font-semibold">{t.appName}</p>
                            <p className="text-slate-600">{t.subtitle}</p>
                        </div>

                        {flashcards.length ? (
                            <div className="mb-4 rounded-lg border bg-white p-3">
                                <p className="mb-2 text-sm font-semibold">{t.flashcards}</p>
                                <div className="space-y-2 text-sm">
                                    {flashcards.map((f, idx) => (
                                        <div key={`${f.question}-${idx}`} className="rounded border p-2">
                                            <p className="font-medium">Q: {f.question}</p>
                                            <p className="text-slate-700">A: {f.answer}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {audioSummary ? (
                            <div className="mb-4 rounded-lg border bg-cyan-50/60 p-3 text-sm">
                                <p className="mb-1 font-semibold">{t.summary}</p>
                                <p>{audioSummary}</p>
                            </div>
                        ) : null}

                        <div className="space-y-4">
                            {messages.map((item, idx) => {
                                const html = marked.parse(item.content, {
                                    async: false,
                                    pedantic: false,
                                    renderer: new marked.Renderer(),
                                }) as string;

                                return (
                                    <div
                                        key={`${item.role}-${idx}`}
                                        className={`max-w-3xl rounded-2xl p-4 ${item.role === "user" ? "ml-auto bg-slate-900 text-white" : "bg-slate-100 text-slate-900"}`}
                                    >
                                        <div
                                            dangerouslySetInnerHTML={{ __html: html }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>

                    <form className="border-t p-4" onSubmit={onSubmit}>
                        <div className="flex gap-3">
                            <Textarea
                                className="min-h-[80px]"
                                placeholder={t.askPlaceholder}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                            />
                            <Button disabled={isStreaming || !activeSessionId} type="submit">
                                {t.send}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
