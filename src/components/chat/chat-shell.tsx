"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Bot, CalendarClock, Check, FileText, Loader2, PencilLine, Trash2, UploadCloud, User, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { marked } from "marked";
import { useChatStream } from "@/hooks/use-chat-stream";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

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
};

type SessionDocument = {
    id: number;
    filename: string;
    uploadedAt: string;
};

const ACTIVE_SESSION_STORAGE_KEY = "scholarsync.activeSessionId";

export function ChatShell({ initialSessions }: Props) {
    const t = useTranslations();
    const uploadInputId = useId();
    // const renderCount = useRef(0);
    // renderCount.current += 1;
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const [sessions, setSessions] = useState<SessionOption[]>(initialSessions);
    const [documents, setDocuments] = useState<SessionDocument[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
    const [message, setMessage] = useState("");
    const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
    const [editingTitleDraft, setEditingTitleDraft] = useState("");
    const [flashcards, setFlashcards] = useState<Array<{ question: string; answer: string }>>([]);
    const [audioSummary, setAudioSummary] = useState("");
    const [uploading, setUploading] = useState(false);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [loadingSession, setLoadingSession] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const [uploadWarning, setUploadWarning] = useState("");
    const { messages, setMessages, sendMessage, isStreaming } = useChatStream(activeSessionId);

    const virtualizer = useVirtualizer({
        count: messages.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: () => 120,
        // 额外多算上下各 5 条
        overscan: 5,
        measureElement: (el) => el.getBoundingClientRect().height,
    });

    // 消息更新时自动跟随滚动
    useEffect(() => {
        if (messages.length === 0) return;
        const container = scrollContainerRef.current;
        if (!container) return;
        const { scrollTop, scrollHeight, clientHeight } = container;

        // scrollHeight是整个滚动内容的总高度，clientHeight是可视区域高度，scrollTop是滚动条顶部到内容顶部的距离。
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
        if (!isNearBottom) return;

        if (isStreaming) {
            // 流式输出时直接贴底，跟随内容实时增长
            container.scrollTop = container.scrollHeight;
        } else {
            virtualizer.scrollToIndex(messages.length - 1, { behavior: "smooth" });
        }
    }, [messages, isStreaming, virtualizer]);

    // 切换会话且历史加载完成后，无条件跳到底部
    useEffect(() => {
        if (loadingSession || messages.length === 0) return;
        virtualizer.scrollToIndex(messages.length - 1, { behavior: "instant" });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingSession]);

    useEffect(() => {
        if (activeSessionId || sessions.length === 0) return;

        // 切换语言后优先恢复上一次会话。
        const rawSavedSessionId = globalThis.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
        const savedSessionId = rawSavedSessionId ? Number(rawSavedSessionId) : NaN;
        if (Number.isInteger(savedSessionId) && savedSessionId > 0) {
            const matched = sessions.find((item) => item.id === savedSessionId);
            if (matched) {
                setActiveSessionId(matched.id);
                return;
            }
        }

        setActiveSessionId(sessions[0].id);
    }, [activeSessionId, sessions]);

    useEffect(() => {
        // 只在有会话时写入，避免组件初始化阶段把历史值误删。
        if (activeSessionId) {
            globalThis.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, String(activeSessionId));
        }
    }, [activeSessionId]);

    useEffect(() => {
        if (!activeSessionId) {
            setDocuments([]);
            setMessages([]);
            setFlashcards([]);
            setAudioSummary("");
            setLoadingSession(false);
            setLoadingDocs(false);
            return;
        }

        // 切换会话时先清空旧数据，避免短暂展示上一个会话内容。
        setDocuments([]);
        setMessages([]);
        setFlashcards([]);
        setAudioSummary("");
        setLoadingSession(true);
        setLoadingDocs(true);
        const controller = new AbortController();

        Promise.all([
            // 获取历史消息
            fetch(`/api/history?sessionId=${activeSessionId}`, { signal: controller.signal })
                .then((r) => r.json())
                .then((history) => {
                    setMessages(Array.isArray(history) ? history : []);
                })
                .catch(() => setMessages([])),
            // 获取会话文档列表    
            fetch(`/api/sessions/${activeSessionId}`, { signal: controller.signal })
                .then((r) => r.json())
                .then((data) => {
                    setDocuments(Array.isArray(data?.documents) ? data.documents : []);
                })
                .catch(() => setDocuments([])),
        ]).finally(() => {
            if (!controller.signal.aborted) {
                setLoadingSession(false);
                setLoadingDocs(false);
            }
        });

        return () => controller.abort();
    }, [activeSessionId, sessions, setMessages]);

    const createSession = async () => {
        const response = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: t("defaultSessionTitle") }),
        });

        if (!response.ok) return;
        const data = await response.json();

        const next = [{ id: data.sessionId, title: data.title }, ...sessions];
        setSessions(next);
        setActiveSessionId(data.sessionId);
        setMessages([]);
    };

    const deleteSession = async (sessionId: number) => {
        if (!window.confirm(t("deleteSessionConfirm"))) return;

        const response = await fetch(`/api/sessions/${sessionId}`, {
            method: "DELETE",
        });
        if (!response.ok) return;

        const remaining = sessions.filter((item) => item.id !== sessionId);
        setSessions(remaining);

        if (editingSessionId === sessionId) {
            setEditingSessionId(null);
            setEditingTitleDraft("");
        }

        if (activeSessionId === sessionId) {
            const nextActiveSessionId = remaining[0]?.id ?? null;
            setActiveSessionId(nextActiveSessionId);

            if (!nextActiveSessionId) {
                setMessages([]);
                setDocuments([]);
                setFlashcards([]);
                setAudioSummary("");
            }
        }
    };

    const renameSession = async (sessionId: number) => {
        const title = editingTitleDraft.trim() || t("defaultSessionTitle");
        const response = await fetch(`/api/sessions/${sessionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
        });
        if (!response.ok) return;
        const data = await response.json();
        setSessions((prev) => prev.map((item) => (item.id === sessionId ? { ...item, title: data.title } : item)));
        setEditingSessionId(null);
        setEditingTitleDraft("");
    };

    const uploadDocument = async (file: File) => {
        if (!activeSessionId) {
            setUploadError(t("selectSessionFirst"));
            return;
        }

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

            if (body?.id) {
                await fetch(`/api/sessions/${activeSessionId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ docIds: [body.id] }),
                });
            }

            const docsRes = await fetch(`/api/sessions/${activeSessionId}`);
            if (docsRes.ok) {
                const docsBody = await docsRes.json();
                setDocuments(Array.isArray(docsBody?.documents) ? docsBody.documents : []);
            }
        } catch {
            setUploadError("Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const renameDocument = async (docId: number, oldName: string) => {
        const nextName = window.prompt(t("renamePrompt"), oldName);
        if (!nextName || nextName === oldName) return;

        const response = await fetch(`/api/documents/${docId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: nextName }),
        });

        if (!response.ok) return;
        const docsRes = await fetch(`/api/sessions/${activeSessionId}`);
        if (!docsRes.ok) return;
        const docsBody = await docsRes.json();
        setDocuments(Array.isArray(docsBody?.documents) ? docsBody.documents : []);
    };

    const deleteDocument = async (docId: number) => {
        if (!window.confirm(t("deleteConfirm"))) return;

        const response = await fetch(`/api/documents/${docId}`, {
            method: "DELETE",
        });
        if (!response.ok) return;
        if (!activeSessionId) return;
        const docsRes = await fetch(`/api/sessions/${activeSessionId}`);
        if (!docsRes.ok) return;
        const docsBody = await docsRes.json();
        setDocuments(Array.isArray(docsBody?.documents) ? docsBody.documents : []);
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

    const formatDocumentTime = (raw: string) => {
        const time = new Date(raw);
        if (Number.isNaN(time.getTime())) return t("uploadTimeUnknown");
        return new Intl.DateTimeFormat("zh-CN", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }).format(time);
    };

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const value = message.trim();
        if (!value) return;
        setMessage("");
        // 发送后立即贴底。dom挂载后执行渲染，贴底。measureElement的计算是在渲染阶段结束后，通常在useEffect中执行
        requestAnimationFrame(() => {
            const container = scrollContainerRef.current;
            if (container) container.scrollTop = container.scrollHeight;
        });
        await sendMessage(value);
    };

    return (
        <div className="grid min-h-[78vh] grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
            {/* 左侧会话和文档管理区域  */}
            <Card className="border-slate-200/70 bg-white/90 backdrop-blur">
                <CardContent className="space-y-4 p-4">
                    <Button onClick={createSession} className="w-full bg-sky-600 text-white hover:bg-sky-500">
                        {t("newSession")}
                    </Button>

                    <div className="space-y-2">
                        <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-1.5">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold tracking-wide text-slate-600">{t("historySessions")}</p>
                                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-white">{sessions.length}</span>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500">{t("historySessionsHint")}</p>
                        </div>

                        <ScrollArea className="h-40 rounded-xl border border-slate-200 bg-slate-50/60 p-2">
                            <div className="space-y-2 p-2">
                                {sessions.map((item) => (
                                    <div
                                        className={`rounded-xl border p-0.5 transition ${activeSessionId === item.id ? "border-sky-300 bg-gradient-to-r from-sky-50 to-cyan-50 shadow-sm" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"}`}
                                        key={item.id}
                                    >
                                        {editingSessionId === item.id ? (
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    value={editingTitleDraft}
                                                    onChange={(e) => setEditingTitleDraft(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            void renameSession(item.id);
                                                        }
                                                    }}
                                                />
                                                <Button size="icon-sm" variant="secondary" onClick={() => void renameSession(item.id)}>
                                                    <Check className="size-4" />
                                                </Button>
                                                <Button
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setEditingSessionId(null);
                                                        setEditingTitleDraft("");
                                                    }}
                                                >
                                                    <X className="size-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    className="group flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left"
                                                    onClick={() => setActiveSessionId(item.id)}
                                                >
                                                    <span
                                                        className={`size-2 shrink-0 rounded-full transition ${activeSessionId === item.id ? "bg-sky-500" : "bg-slate-300 group-hover:bg-slate-400"}`}
                                                    />
                                                    <span className="truncate text-sm font-medium text-slate-700">{item.title}</span>
                                                </button>
                                                <Button
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    className="text-slate-500 hover:text-slate-700"
                                                    onClick={() => {
                                                        setEditingSessionId(item.id);
                                                        setEditingTitleDraft(item.title);
                                                    }}
                                                >
                                                    <PencilLine className="size-4" />
                                                </Button>
                                                <Button
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    className="text-red-500 hover:text-red-600"
                                                    onClick={() => void deleteSession(item.id)}
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    <div className="relative space-y-2 border-t border-slate-200 pt-3">
                        {uploading && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-white/80 backdrop-blur-sm">
                                <Loader2 className="size-6 animate-spin text-sky-500" />
                                <p className="text-xs font-medium text-slate-600">{t("uploading")}</p>
                            </div>
                        )}
                        <label className="text-xs font-semibold text-slate-500">{t("sessionDocuments")}</label>

                        <label
                            htmlFor={uploadInputId}
                            className={`block rounded-xl border border-dashed p-2 text-center transition ${activeSessionId ? "cursor-pointer border-sky-300 bg-sky-50/70 hover:border-sky-400 hover:bg-sky-100/60" : "cursor-not-allowed border-slate-300 bg-slate-100"}`}
                        >
                            <span
                                aria-hidden="true"
                                className="mx-auto mb-2 inline-flex size-10 items-center justify-center rounded-full border border-sky-200 bg-white text-sky-600 shadow-sm"
                            >
                                <UploadCloud className="size-5" />
                            </span>
                            <p className="text-xs text-slate-600">{t("uploadPdfHint")}</p>
                            <Input
                                id={uploadInputId}
                                type="file"
                                accept="application/pdf"
                                disabled={uploading || !activeSessionId}
                                className="sr-only"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) uploadDocument(file);
                                    e.currentTarget.value = "";
                                }}
                            />
                        </label>

                        {!activeSessionId ? <p className="text-xs text-slate-500">{t("selectSessionToManageDocs")}</p> : null}

                        {uploadError ? <p className="text-xs text-red-600">{uploadError}</p> : null}
                        {uploadWarning ? <p className="text-xs text-amber-600">{uploadWarning}</p> : null}

                        <ScrollArea className="h-52 rounded-xl border border-slate-200 bg-slate-50/50 p-2">
                            <div className="space-y-2 p-1.5">
                                {loadingDocs ? <p className="text-xs text-slate-500">{t("loadingDocuments")}</p> : null}
                                {!loadingDocs && activeSessionId && documents.length === 0 ? (
                                    <p className="text-xs text-slate-500">{t("noDocumentsInSession")}</p>
                                ) : null}
                                {documents.map((doc) => (
                                    <div
                                        key={doc.id}
                                        className="group rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                                                <FileText className="size-4" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold text-slate-800">{doc.filename}</p>
                                                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                                                    <CalendarClock className="size-3.5" />
                                                    <span>{formatDocumentTime(doc.uploadedAt)}</span>
                                                </div>
                                            </div>
                                            <Badge variant="secondary" className="rounded-md px-1.5 py-0.5 text-[10px]">
                                                PDF
                                            </Badge>
                                        </div>

                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                            <Button
                                                size="xs"
                                                variant="outline"
                                                className="justify-center gap-1"
                                                onClick={() => renameDocument(doc.id, doc.filename)}
                                            >
                                                <PencilLine className="size-3.5" />
                                                {t("rename")}
                                            </Button>
                                            <Button
                                                size="xs"
                                                variant="destructive"
                                                className="justify-center gap-1"
                                                onClick={() => deleteDocument(doc.id)}
                                            >
                                                <Trash2 className="size-3.5" />
                                                {t("delete")}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </CardContent>
            </Card>
            {/* 右侧聊天区域  */}
            <Card className="flex min-h-[78vh] flex-col">
                <CardContent className="flex flex-1 flex-col p-0">
                    <div className="flex flex-wrap gap-2 border-b px-4 py-3">
                        <Button size="sm" variant="outline" onClick={generateFlashcards} disabled={!activeSessionId}>
                            {t("generateFlashcards")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={generateAudioSummary} disabled={!activeSessionId}>
                            {t("audioSummary")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={downloadMarkdown} disabled={!activeSessionId}>
                            {t("exportMarkdown")}
                        </Button>
                    </div>

                    <div
                        ref={scrollContainerRef}
                        className="h-[calc(72vh)] overflow-y-auto px-5 py-4"
                    >
                        {/* <div className="mb-1 text-right text-[11px] text-red-400">re-renders: {renderCount.current}</div> */}
                        <div className="mb-4 space-y-2 rounded-lg border bg-amber-50/60 p-1.5 text-sm">
                            <p className="font-semibold">{t("appName")}</p>
                            <p className="text-slate-600">{t("subtitle")}</p>
                        </div>

                        {loadingSession ? (
                            <div className="mb-4 rounded-lg border bg-slate-50 p-3 text-sm text-slate-600">{t("loadingSession")}</div>
                        ) : null}

                        {!loadingSession && flashcards.length ? (
                            <div className="mb-4 rounded-lg border bg-white p-3">
                                <p className="mb-2 text-sm font-semibold">{t("flashcards")}</p>
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

                        {!loadingSession && audioSummary ? (
                            <div className="mb-4 rounded-lg border bg-cyan-50/60 p-3 text-sm">
                                <p className="mb-1 font-semibold">{t("summary")}</p>
                                <p>{audioSummary}</p>
                            </div>
                        ) : null}

                        {/* 虚拟列表容器 */}
                        {/* virtualizer.getTotalSize()返回的是当前所有消息的高度总和（包含已测量的真实高度 + 未测量的预估高度） */}
                        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                            {virtualizer.getVirtualItems().map((virtualItem) => {
                                const item = messages[virtualItem.index];
                                const isUser = item.role === "user";
                                const isLastMessage = virtualItem.index === messages.length - 1;
                                const isStreamingThis = isStreaming && isLastMessage && !isUser;
                                const isEmpty = !item.content.trim();

                                const html = isEmpty
                                    ? ""
                                    : (marked.parse(item.content, {
                                        async: false,
                                        pedantic: false,
                                        renderer: new marked.Renderer(),
                                    }) as string);

                                return (
                                    <div
                                        key={virtualItem.key}
                                        data-index={virtualItem.index}
                                        ref={virtualizer.measureElement}
                                        style={{
                                            position: "absolute",
                                            top: 0,
                                            transform: `translateY(${virtualItem.start}px)`,
                                            width: "100%",
                                            paddingBottom: "1.5rem",
                                        }}
                                    >
                                        <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                                            <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${isUser ? "bg-slate-900 text-white" : "bg-sky-100 text-sky-600"}`}>
                                                {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
                                            </div>
                                            <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${isUser ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-900 shadow-sm"}`}>
                                                {isEmpty && isStreamingThis ? (
                                                    <Loader2 className="size-4 animate-spin text-sky-500" />
                                                ) : (
                                                    <>
                                                        <div
                                                            className="prose prose-sm max-w-none dark:prose-invert"
                                                            dangerouslySetInnerHTML={{ __html: html }}
                                                        />
                                                        {isStreamingThis && (
                                                            <Loader2 className="mt-2 size-3 animate-spin text-slate-400" />
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <form className="border-t p-4" onSubmit={onSubmit}>
                        <div className="flex gap-3">
                            <Textarea
                                className="min-h-[80px]"
                                placeholder={t("askPlaceholder")}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                disabled={!activeSessionId}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        if (!isStreaming && activeSessionId) onSubmit(e as any);
                                    }
                                }}
                            />
                            <Button disabled={isStreaming || !activeSessionId} type="submit">
                                {t("send")}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
