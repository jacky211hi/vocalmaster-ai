import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Mic2, Trophy, Music2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { DeleteRecordingButton } from "@/components/delete-recording-button";
import { VocalProfileCard } from "@/components/vocal-profile-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildVocalProfile } from "@/lib/vocal-profile";
import type { Recording } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url")
    .eq("id", user.id)
    .single();

  const { data: recordings } = await supabase
    .from("recordings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const list = (recordings ?? []) as Recording[];
  const totalSongs = list.length;
  const highest = list.reduce((max, r) => Math.max(max, r.total_score), 0);
  const recent = list.slice(0, 5);
  const username = profile?.username ?? user.email?.split("@")[0] ?? "歌手";
  const vocalProfile = buildVocalProfile(list);

  return (
    <div className="min-h-screen">
      <Navbar username={username} avatarUrl={profile?.avatar_url} />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-amber-200/70">練習室</p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl text-white sm:text-5xl">
              歡迎回來，{username}
            </h1>
            <p className="mt-2 max-w-lg text-white/55">
              繼續練唱、追蹤分數，讓 AI 教練幫你找出可以改善的地方。
            </p>
          </div>
          <Link href="/sing">
            <Button size="lg">
              <Mic2 className="h-5 w-5" />
              準備練歌
            </Button>
          </Link>
        </div>

        <div className="mb-10 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-white/70">
                <Music2 className="h-4 w-4 text-amber-300" />
                總共唱過
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-[family-name:var(--font-display)] text-4xl text-white">
                {totalSongs}
              </p>
              <p className="mt-1 text-sm text-white/45">首錄音紀錄</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-white/70">
                <Trophy className="h-4 w-4 text-amber-300" />
                最高分
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-[family-name:var(--font-display)] text-4xl text-white">
                {totalSongs ? highest : "—"}
              </p>
              <p className="mt-1 text-sm text-white/45">個人最佳 total score</p>
            </CardContent>
          </Card>
        </div>

        {vocalProfile ? (
          <VocalProfileCard insight={vocalProfile} />
        ) : (
          <Card className="mb-10 border-dashed border-white/15">
            <CardContent className="py-10 text-center">
              <p className="text-white/60">
                完成至少一次 AI 分析後，呢度會顯示你嘅音域風格、強弱項同練習建議。
              </p>
              <Link href="/sing" className="mt-4 inline-block">
                <Button>去錄第一首</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-white">
              最近錄音
            </h2>
          </div>

          {recent.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-white/60">尚未有錄音紀錄</p>
                <Link href="/sing" className="mt-4 inline-block">
                  <Button>錄第一首歌</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recent.map((r) => (
                <Card
                  key={r.id}
                  className="transition hover:border-amber-400/30 hover:bg-white/[0.06]"
                >
                  <CardContent className="flex items-center justify-between gap-4 py-4">
                    <Link href={`/result/${r.id}`} className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">
                        {r.song_name}
                      </p>
                      <p className="truncate text-sm text-white/45">
                        {r.artist || "未知歌手"} ·{" "}
                        {format(new Date(r.created_at), "yyyy-MM-dd HH:mm")}
                      </p>
                    </Link>
                    <div className="flex shrink-0 items-center gap-3">
                      <Link href={`/result/${r.id}`} className="text-right">
                        <p className="font-[family-name:var(--font-display)] text-2xl text-amber-300">
                          {r.total_score}
                        </p>
                        <p className="text-xs text-white/40">總分</p>
                      </Link>
                      <DeleteRecordingButton
                        recordingId={r.id}
                        songName={r.song_name}
                        variant="ghost"
                        size="icon"
                        redirectTo="/dashboard"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
