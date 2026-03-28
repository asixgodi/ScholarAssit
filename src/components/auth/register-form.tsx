"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
    const t = useTranslations();
    const locale = useLocale();
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password }),
        });

        setLoading(false);

        if (!response.ok) {
            const data = await response.json();
            setError(data.error || t("registerError"));
            return;
        }

        const signInResult = await signIn("credentials", {
            email,
            password,
            redirect: false,
        });

        if (signInResult?.error) {
            setError(t("loginError"));
            return;
        }

        router.push("/dashboard", { locale });
        router.refresh();
    };

    return (
        <Card className="w-full max-w-md border-white/40 bg-white/80 shadow-xl backdrop-blur-xl">
            <CardHeader>
                <CardTitle className="text-2xl">{t("registerTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
                <form className="space-y-4" onSubmit={onSubmit}>
                    <div className="space-y-2">
                        <Label htmlFor="username">{t("username")}</Label>
                        <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">{t("email")}</Label>
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">{t("password")}</Label>
                        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    {error ? <p className="text-sm text-red-600">{error}</p> : null}
                    <Button disabled={loading} className="w-full" type="submit">
                        {loading ? t("registering") : t("register")}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
