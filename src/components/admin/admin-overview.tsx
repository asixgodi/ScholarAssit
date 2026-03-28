"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type Props = {
    labels: string[];
    values: number[];
};

export function AdminOverview({ labels, values }: Props) {
    const t = useTranslations();
    const data = useMemo(
        () => ({
            labels,
            datasets: [
                {
                    label: t("activityLabel"),
                    data: values,
                    borderColor: "#0f172a",
                    backgroundColor: "rgba(15, 23, 42, 0.2)",
                    tension: 0.35,
                },
            ],
        }),
        [labels, t, values],
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("activityTrend7d")}</CardTitle>
            </CardHeader>
            <CardContent>
                <Line data={data} />
            </CardContent>
        </Card>
    );
}
