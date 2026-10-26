"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mic2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username.trim() || email.split("@")[0] },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          },
        });
        if (signUpError) throw signUpError;
        setMessage("註冊成功！若啟用電郵驗證，請先到信箱確認，否則可直接登入。");
        setMode("login");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "認證失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="font-[family-name:var(--font-display)] text-2xl">
          {mode === "login" ? "歡迎回來" : "建立帳戶"}
        </CardTitle>
        <CardDescription>
          {mode === "login"
            ? "登入以繼續你的練唱紀錄與 AI 分析"
            : "註冊後即可錄音、評分與追蹤進度"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <label className="text-sm text-white/70">用戶名稱</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="例如：MelodyJack"
                autoComplete="username"
              />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm text-white/70">電郵</label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-white/70">密碼</label>
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {error && (
            <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-xl bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">
              {message}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "處理中…" : mode === "login" ? "登入" : "註冊"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-white/50">
          {mode === "login" ? "還沒有帳戶？" : "已經有帳戶？"}{" "}
          <button
            type="button"
            className="text-amber-300 hover:underline"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setMessage(null);
            }}
          >
            {mode === "login" ? "註冊" : "登入"}
          </button>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-slate-950">
          <Mic2 className="h-5 w-5" />
        </span>
        <div>
          <p className="font-[family-name:var(--font-display)] text-xl text-white">
            VocalMaster AI
          </p>
          <p className="text-xs text-amber-200/70">AI 聲樂教練</p>
        </div>
      </Link>
      <Suspense fallback={<div className="text-white/50">載入中…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
