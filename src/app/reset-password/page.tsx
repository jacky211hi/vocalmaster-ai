"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export default function ResetPasswordPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session));
      setReady(true);
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 6) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      setMessage(t("auth.resetOk"));
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.failed"));
    } finally {
      setLoading(false);
    }
  }

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

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-display)] text-2xl">
            {t("auth.resetPageTitle")}
          </CardTitle>
          <CardDescription>{t("auth.resetPageDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <p className="text-sm text-white/50">{t("auth.processing")}</p>
          ) : !hasSession ? (
            <div className="space-y-4">
              <p className="rounded-xl bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                {t("auth.resetNeedLink")}
              </p>
              <Link href="/login">
                <Button type="button" className="w-full">
                  {t("auth.goLogin")}
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">
                  {t("auth.newPassword")}
                </label>
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.passwordHint")}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">
                  {t("auth.confirmPassword")}
                </label>
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={t("auth.passwordHint")}
                  autoComplete="new-password"
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
                {loading ? t("auth.processing") : t("auth.savePassword")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
