import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Headphones, Music2, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { areAcceptedFriends } from "@/lib/friends";
import { Navbar } from "@/components/navbar";
import { UserAvatar } from "@/components/user-avatar";
import { VocalProfileCard } from "@/components/vocal-profile-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildVocalProfile } from "@/lib/vocal-profile";
import type { Recording } from "@/lib/types";

export default async function FriendDashboardPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: friendId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (friendId === user.id) redirect("/dashboard");

  const friendsOk = await areAcceptedFriends(supabase, user.id, friendId);
  if (!friendsOk) notFound();

  const { data: me } = await supabase
    .from("profiles")
    .select("username, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const { data: friendProfile } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .eq("id", friendId)
    .maybeSingle();

  if (!friendProfile) notFound();

  const { data: recordings } = await supabase
    .from("recordings")
    .select("*")
    .eq("user_id", friendId)
    .order("created_at", { ascending: false });

  const list = (recordings ?? []) as Recording[];
  const totalSongs = list.length;
  const highest = list.reduce((max, r) => Math.max(max, r.total_score), 0);
  const recent = list.slice(0, 8);
  const username = friendProfile.username;
  const vocalProfile = buildVocalProfile(list);

  return (
    <div className="min-h-screen">
      <Navbar username={me?.username} avatarUrl={me?.avatar_url} />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-6">
          <Link href="/friends">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              返回朋友
            </Button>
          </Link>
        </div>

        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-4">
            <UserAvatar
              avatarUrl={friendProfile.avatar_url}
              username={username}
              size={72}
            />
            <div>
              <p className="text-sm text-amber-200/70">朋友練習室</p>
              <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl text-white sm:text-5xl">
                {username}
              </h1>
              <p className="mt-2 max-w-lg text-white/55">
                睇吓朋友嘅分數、聲線畫像同最近錄音。
              </p>
            </div>
          </div>
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
            <CardContent className="py-10 text-center text-white/60">
              呢位朋友暫時未有完成嘅 AI 分析，未有聲線畫像。
            </CardContent>
          </Card>
        )}

        <section>
          <div className="mb-4">
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-white">
              最近錄音
            </h2>
          </div>

          {recent.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-white/60">
                尚未有錄音紀錄
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recent.map((r) => {
                const audioShared = Boolean(
                  (r.share_audio || r.share_audio_friends) &&
                    (r.storage_path || r.audio_url)
                );
                return (
                  <Link key={r.id} href={`/result/${r.id}`}>
                    <Card className="transition hover:border-amber-400/30 hover:bg-white/[0.06]">
                      <CardContent className="flex items-center gap-4 py-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-white">
                            {r.song_name}
                          </p>
                          <p className="truncate text-sm text-white/45">
                            {r.artist || "未知歌手"} ·{" "}
                            {format(
                              new Date(r.created_at),
                              "yyyy-MM-dd HH:mm"
                            )}
                          </p>
                        </div>
                        {audioShared && (
                          <span
                            title="已分享音樂檔，可收聽"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300"
                          >
                            <Headphones className="h-4 w-4" />
                          </span>
                        )}
                        <div className="shrink-0 text-right">
                          <p className="font-[family-name:var(--font-display)] text-2xl text-amber-300">
                            {r.total_score}
                          </p>
                          <p className="text-xs text-white/40">總分</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
