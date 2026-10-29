import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Headphones } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAcceptedFriendIds } from "@/lib/friends";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/messages";
import { Navbar } from "@/components/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { LeaderboardTabs } from "@/components/leaderboard-tabs";
import type { Recording } from "@/lib/types";

type GlobalRow = {
  id: string;
  user_id?: string;
  song_name: string;
  artist: string;
  total_score: number;
  created_at: string;
  share_audio?: boolean | null;
  share_audio_friends?: boolean | null;
  storage_path?: string | null;
  audio_url?: string | null;
  profiles: { username: string } | { username: string }[] | null;
};

function usernameFromJoin(
  profiles: GlobalRow["profiles"]
): string {
  if (!profiles) return "匿名";
  if (Array.isArray(profiles)) return profiles[0]?.username ?? "匿名";
  return profiles.username ?? "匿名";
}

function hasAudioFile(row: {
  storage_path?: string | null;
  audio_url?: string | null;
}) {
  return Boolean(row.storage_path || row.audio_url);
}

/** Global tab: only worldwide share. */
function hasSharedGlobal(row: {
  share_audio?: boolean | null;
  storage_path?: string | null;
  audio_url?: string | null;
}) {
  return Boolean(row.share_audio && hasAudioFile(row));
}

/** Friends tab: friends-only or global (friends can hear either). */
function hasSharedWithFriends(row: {
  share_audio?: boolean | null;
  share_audio_friends?: boolean | null;
  storage_path?: string | null;
  audio_url?: string | null;
}) {
  return Boolean(
    hasAudioFile(row) && (row.share_audio_friends || row.share_audio)
  );
}

export default async function LeaderboardPage() {
  const locale = await getRequestLocale();
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url")
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
    .select(
      "id, user_id, song_name, artist, total_score, created_at, share_audio, share_audio_friends, storage_path, audio_url, profiles(username)"
    )
    .order("total_score", { ascending: false })
    .limit(30);

  const friendIds = await getAcceptedFriendIds(supabase, user.id);
  const circleIds = [user.id, ...friendIds];

  let friendsList: {
    rank: number;
    id: string;
    song_name: string;
    artist: string;
    total_score: number;
    created_at: string;
    username: string;
    audioShared: boolean;
  }[] = [];

  if (circleIds.length > 0) {
    const { data: friendRows } = await supabase
      .from("recordings")
      .select(
        "id, song_name, artist, total_score, created_at, share_audio, share_audio_friends, storage_path, audio_url, profiles(username)"
      )
      .in("user_id", circleIds)
      .order("total_score", { ascending: false })
      .limit(30);

    friendsList = ((friendRows ?? []) as GlobalRow[]).map((row, index) => ({
      rank: index + 1,
      id: row.id,
      song_name: row.song_name,
      artist: row.artist,
      total_score: row.total_score,
      created_at: row.created_at,
      username: usernameFromJoin(row.profiles),
      audioShared: hasSharedWithFriends(row),
    }));
  }

  const personalList = (personal ?? []) as Recording[];
  const globalList = ((globalRows ?? []) as GlobalRow[]).map((row, index) => ({
    rank: index + 1,
    id: row.id,
    song_name: row.song_name,
    artist: row.artist,
    total_score: row.total_score,
    created_at: row.created_at,
    username: usernameFromJoin(row.profiles),
    audioShared: hasSharedGlobal(row),
    isSelf: row.user_id === user.id,
  }));

  return (
    <div className="min-h-screen">
      <Navbar username={profile?.username} avatarUrl={profile?.avatar_url} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-white">
            {t("leaderboard.title")}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-white/55">
            <span>{t("leaderboard.descBefore")}</span>
            <span
              title={t("leaderboard.shared")}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-amber-400/15 text-amber-300"
            >
              <Headphones className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span>{t("leaderboard.descAfter")}</span>
          </p>
        </div>

        <LeaderboardTabs
          personal={
            personalList.length === 0 ? (
              <EmptyState
                text={t("leaderboard.empty.personal")}
                href="/sing"
                linkLabel={t("leaderboard.goSing")}
              />
            ) : (
              <ol className="space-y-3">
                {personalList.map((r, i) => (
                  <RankRow
                    key={r.id}
                    href={`/result/${r.id}?from=leaderboard`}
                    rank={i + 1}
                    title={r.song_name}
                    subtitle={`${r.artist || t("leaderboard.unknownArtist")} · ${format(new Date(r.created_at), "yyyy-MM-dd")}`}
                    score={r.total_score}
                    audioShared={hasSharedWithFriends(r)}
                    sharedTitle={t("leaderboard.shared")}
                  />
                ))}
              </ol>
            )
          }
          friends={
            friendIds.length === 0 ? (
              <EmptyState
                text={t("leaderboard.empty.friends.nofriends")}
                href="/friends"
                linkLabel={t("leaderboard.goFriends")}
              />
            ) : friendsList.length === 0 ? (
              <EmptyState
                text={t("leaderboard.empty.friends.none")}
                href="/sing"
                linkLabel={t("leaderboard.goSing")}
              />
            ) : (
              <ol className="space-y-3">
                {friendsList.map((r) => (
                  <RankRow
                    key={r.id}
                    href={`/result/${r.id}?from=leaderboard`}
                    rank={r.rank}
                    title={r.song_name}
                    subtitle={`${r.username} · ${r.artist || t("leaderboard.unknownArtist")}`}
                    score={r.total_score}
                    audioShared={r.audioShared}
                    sharedTitle={t("leaderboard.shared")}
                  />
                ))}
              </ol>
            )
          }
          global={
            globalList.length === 0 ? (
              <EmptyState
                text={t("leaderboard.empty.global")}
                href="/sing"
                linkLabel={t("leaderboard.goSing")}
              />
            ) : (
              <ol className="space-y-3">
                {globalList.map((r) => (
                  <RankRow
                    key={r.id}
                    href={`/result/${r.id}?from=leaderboard`}
                    rank={r.rank}
                    title={r.song_name}
                    username={r.username}
                    highlightUsername={r.isSelf}
                    artist={r.artist || t("leaderboard.unknownArtist")}
                    score={r.total_score}
                    audioShared={r.audioShared}
                    sharedTitle={t("leaderboard.shared")}
                    isSelf={r.isSelf}
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

function EmptyState({
  text,
  href,
  linkLabel = "去唱歌 →",
}: {
  text: string;
  href: string;
  linkLabel?: string;
}) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-white/55">
        <p>{text}</p>
        <Link
          href={href}
          className="mt-3 inline-block text-amber-300 hover:underline"
        >
          {linkLabel}
        </Link>
      </CardContent>
    </Card>
  );
}

function RankRow({
  rank,
  title,
  subtitle,
  username,
  artist,
  highlightUsername,
  score,
  href,
  audioShared,
  sharedTitle,
  isSelf,
}: {
  rank: number;
  title: string;
  subtitle?: string;
  username?: string;
  artist?: string;
  highlightUsername?: boolean;
  score: number;
  href: string;
  audioShared?: boolean;
  sharedTitle?: string;
  isSelf?: boolean;
}) {
  return (
    <li>
      <Link href={href}>
        <Card
          className={`transition hover:border-amber-400/30 hover:bg-white/[0.06] ${
            isSelf ? "border-amber-400/35 bg-amber-400/[0.07]" : ""
          }`}
        >
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
              {subtitle ? (
                <p className="truncate text-sm text-white/45">{subtitle}</p>
              ) : (
                <p className="truncate text-sm text-white/45">
                  <span
                    className={
                      highlightUsername
                        ? "rounded-md bg-amber-400/20 px-1.5 py-0.5 font-semibold text-amber-200"
                        : undefined
                    }
                  >
                    {username}
                  </span>
                  <span> · {artist}</span>
                </p>
              )}
            </div>
            {audioShared && (
              <span
                title={sharedTitle}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300"
              >
                <Headphones className="h-4 w-4" />
              </span>
            )}
            <p className="font-[family-name:var(--font-display)] text-2xl text-amber-300">
              {score}
            </p>
          </CardContent>
        </Card>
      </Link>
    </li>
  );
}
