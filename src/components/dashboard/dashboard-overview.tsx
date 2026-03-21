"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useLocale } from "@/hooks/use-locale";

type Props = {
    stats: {
        docsCount: number;
        sessionsCount: number;
        messagesCount: number;
        thesisStage: number;
    };
};

export function DashboardOverview({ stats }: Props) {
    const { t } = useLocale();
    const progress = Math.min(100, Math.max(0, (stats.thesisStage / 5) * 100));

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>{t.totalDocs}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-3xl font-black">{stats.docsCount}</CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>{t.totalSessions}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-3xl font-black">{stats.sessionsCount}</CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>{t.totalMessages}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-3xl font-black">{stats.messagesCount}</CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t.thesisProgress}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Progress value={progress} />
                    <p className="text-sm text-muted-foreground">{t.currentStage}: {stats.thesisStage} / 5</p>
                </CardContent>
            </Card>

            <div className="flex gap-3">
                <Link className="inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700" href="/chat">
                    {t.openChat}
                </Link>
                <Link className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-100" href="/admin">
                    {t.adminPanel}
                </Link>
            </div>
        </div>
    );
}
