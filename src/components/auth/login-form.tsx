"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/hooks/use-locale";

export function LoginForm() {
    const { t } = useLocale();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
        });

        if (result?.error) {
            setError(t.loginError);
            setLoading(false);
            return;
        }

        router.push("/dashboard");
        setLoading(false);
        router.refresh();
    };

    return (
        <Card className="w-full max-w-md border-white/40 bg-white/80 shadow-xl backdrop-blur-xl">
            <CardHeader>
                <CardTitle className="text-2xl">{t.loginTitle}</CardTitle>
            </CardHeader>
            <CardContent>
                <form className="space-y-4" onSubmit={onSubmit}>
                    <div className="space-y-2">
                        <Label htmlFor="email">{t.email}</Label>
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">{t.password}</Label>
                        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    {error ? <p className="text-sm text-red-600">{error}</p> : null}
                    <Button disabled={loading} className="w-full" type="submit">
                        {loading ? t.loggingIn : t.login}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
