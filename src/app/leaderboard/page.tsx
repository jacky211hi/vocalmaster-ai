import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { LeaderboardTabs } from "@/components/leaderboard-tabs";
import type { Recording } from "@/lib/types";

type GlobalRow = {
  id: string;
  song_name: string;
  artist: string;
  total_score: number;
  created_at: string;
  profiles: { username: string } | { username: string }[] | null;
};

function usernameFromJoin(
  profiles: GlobalRow["profiles"]
): string {
  if (!profiles) return "匿名";
  if (Array.isArray(profiles)) return profiles[0]?.username ?? "匿名";
  return profiles.username ?? "匿名";
}

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const { data: personal } = await supabase
    .from("recordings")
    .select("*")
    .eq("user_id", user.id)
    .order("total_score", { ascending: false })
    .limit(50);

  const { data: globalRows } = await supabase
    .from("recordings")
    .select("id, song_name, artist, total_score, created_at, profiles(username)")
    .order("total_score", { ascending: false })
    .limit(30);

  const personalList = (personal ?? []) as Recording[];
  const globalList = ((globalRows ?? []) as GlobalRow[]).map((row, index) => ({
    rank: index + 1,
    id: row.id,
    song_name: row.song_name,
    artist: row.artist,
    total_score: row.total_score,
    created_at: row.created_at,
    username: usernameFromJoin(row.profiles),
  }));

  return (
    <div className="min-h-screen">
      <Navbar username={profile?.username} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-white">
            排行榜
          </h1>
          <p className="mt-2 text-white/55">
            分數與分析全部保留；只有個人 Top 10 會保存音檔。朋友排行榜即將推出。
          </p>
        </div>

        <LeaderboardTabs
          personal={
            personalList.length === 0 ? (
              <EmptyState text="尚未有個人成績，去錄一首吧！" />
            ) : (
              <ol className="space-y-3">
                {personalList.map((r, i) => (
                  <RankRow
                    key={r.id}
                    href={`/result/${r.id}`}
                    rank={i + 1}
                    title={r.song_name}
                    subtitle={`${r.artist || "未知歌手"} · ${format(new Date(r.created_at), "yyyy-MM-dd")}`}
                    score={r.total_score}
                  />
                ))}
              </ol>
            )
          }
          global={
            globalList.length === 0 ? (
              <EmptyState text="全球榜暫時沒有資料。" />
            ) : (
              <ol className="space-y-3">
                {globalList.map((r) => (
                  <RankRow
                    key={r.id}
                    href={`/result/${r.id}`}
                    rank={r.rank}
                    title={r.song_name}
                    subtitle={`${r.username} · ${r.artist || "未知歌手"}`}
                    score={r.total_score}
                  />
                ))}
              </ol>
            )
          }
        />
      </main>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-white/55">
        <p>{text}</p>
        <Link href="/sing" className="mt-3 inline-block text-amber-300 hover:underline">
          去唱歌 →
        </Link>
      </CardContent>
    </Card>
  );
}

function RankRow({
  rank,
  title,
  subtitle,
  score,
  href,
}: {
  rank: number;
  title: string;
  subtitle: string;
  score: number;
  href: string;
}) {
  return (
    <li>
      <Link href={href}>
        <Card className="transition hover:border-amber-400/30 hover:bg-white/[0.06]">
          <CardContent className="flex items-center gap-4 py-4">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                rank <= 3
                  ? "bg-amber-400 text-slate-950"
                  : "bg-white/10 text-white/70"
              }`}
            >
              {rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-white">{title}</p>
              <p className="truncate text-sm text-white/45">{subtitle}</p>
            </div>
            <p className="font-[family-name:var(--font-display)] text-2xl text-amber-300">
              {score}
            </p>
          </CardContent>
        </Card>
      </Link>
    </li>
  );
}
