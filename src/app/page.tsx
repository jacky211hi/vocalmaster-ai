import Link from "next/link";
import { Mic2, Sparkles, Trophy, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-24 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 pb-16 pt-10">
        <header className="mb-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/30">
              <Mic2 className="h-5 w-5" />
            </span>
            <div>
              <p className="font-[family-name:var(--font-display)] text-xl text-white">
                VocalMaster AI
              </p>
              <p className="text-xs text-amber-200/70">AI 聲樂教練</p>
            </div>
          </div>
          <Link href="/login">
            <Button variant="secondary" size="sm">
              登入
            </Button>
          </Link>
        </header>

        <section className="flex flex-1 flex-col justify-center gap-10 py-8 md:gap-12">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">
              <Sparkles className="h-3.5 w-3.5" />
              Gemini 原生音訊分析
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-5xl leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl">
              VocalMaster AI
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/60">
              錄音或上傳歌聲，即時取得音色、發聲機制、呼吸與音準評分，並收到可執行的練習建議。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login">
                <Button size="lg">開始練唱</Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  免費註冊
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Waves,
                title: "四維評分",
                desc: "音色 · 機制 · 呼吸 · 音準",
              },
              {
                icon: Sparkles,
                title: "改善建議",
                desc: "Twang、唇顫、「ma」等具體練習",
              },
              {
                icon: Trophy,
                title: "進度排行",
                desc: "個人最佳與全球榜追蹤成長",
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div
                key={title}
                className="animate-float-soft rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur"
                style={{ animationDelay: `${i * 0.4}s` }}
              >
                <Icon className="mb-3 h-5 w-5 text-amber-300" />
                <p className="font-semibold text-white">{title}</p>
                <p className="mt-1 text-sm text-white/50">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
