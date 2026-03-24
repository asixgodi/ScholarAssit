"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/hooks/use-locale";

type Props = {
    users: number;
    docs: number;
    sessions: number;
};

export function AdminStats({ users, docs, sessions }: Props) {
    const { t } = useLocale();

    return (
        <div className="grid gap-4 md:grid-cols-3">
            <Card>
                <CardHeader>
                    <CardTitle>{t.totalUsers}</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-black">{users}</CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>{t.totalDocuments}</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-black">{docs}</CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>{t.totalAllSessions}</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-black">{sessions}</CardContent>
            </Card>
        </div>
    );
}
