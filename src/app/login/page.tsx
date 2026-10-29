"use client";

import { FormEvent, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mic2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useI18n } from "@/components/locale-provider";

type Mode = "login" | "signup" | "forgot";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const { t } = useI18n();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    setMessage(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    try {
      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
          }
        );
        if (resetError) throw resetError;
        setMessage(t("auth.resetSent"));
        return;
      }

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
        setMessage(t("auth.signupOk"));
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
      setError(err instanceof Error ? err.message : t("auth.failed"));
    } finally {
      setLoading(false);
    }
  }

  const title =
    mode === "forgot"
      ? t("auth.forgotTitle")
      : mode === "login"
        ? t("auth.welcomeBack")
        : t("auth.createAccount");
  const description =
    mode === "forgot"
      ? t("auth.forgotDesc")
      : mode === "login"
        ? t("auth.loginDesc")
        : t("auth.signupDesc");

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="font-[family-name:var(--font-display)] text-2xl">
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <label className="text-sm text-white/70">{t("auth.username")}</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="MelodyJack"
                autoComplete="username"
              />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm text-white/70">{t("auth.email")}</label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm text-white/70">{t("auth.password")}</label>
                {mode === "login" && (
                  <button
                    type="button"
                    className="text-xs text-amber-300 hover:underline"
                    onClick={() => switchMode("forgot")}
                  >
                    {t("auth.forgot")}
                  </button>
                )}
              </div>
              <Input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.passwordHint")}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </div>
          )}

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
            {loading
              ? t("auth.processing")
              : mode === "forgot"
                ? t("auth.sendReset")
                : mode === "login"
                  ? t("auth.login")
                  : t("auth.signup")}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-white/50">
          {mode === "forgot" ? (
            <button
              type="button"
              className="text-amber-300 hover:underline"
              onClick={() => switchMode("login")}
            >
              {t("auth.backToLogin")}
            </button>
          ) : (
            <>
              {mode === "login" ? t("auth.noAccount") : t("auth.hasAccount")}{" "}
              <button
                type="button"
                className="text-amber-300 hover:underline"
                onClick={() =>
                  switchMode(mode === "login" ? "signup" : "login")
                }
              >
                {mode === "login" ? t("auth.signup") : t("auth.login")}
              </button>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  const { t } = useI18n();
  return (
    <main className="relative mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <LocaleSwitcher />
      </div>
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-slate-950">
          <Mic2 className="h-5 w-5" />
        </span>
        <div>
          <p className="font-[family-name:var(--font-display)] text-xl text-white">
            VocalMaster AI
          </p>
          <p className="text-xs text-amber-200/70">{t("brand.tagline")}</p>
        </div>
      </Link>
      <Suspense fallback={<div className="text-white/50">…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
