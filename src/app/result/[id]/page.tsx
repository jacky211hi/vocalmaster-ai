import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import { Lightbulb, ArrowLeft, Mic2, Headphones } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { ScoreBars } from "@/components/score-bars";
import { ScoreRadar } from "@/components/score-radar";
import { DeleteRecordingButton } from "@/components/delete-recording-button";
import { ShareAudioToggle } from "@/components/share-audio-toggle";
import {
  CommentsSection,
  type CommentItem,
} from "@/components/comments-section";
import { AnalysisRunner } from "@/components/analysis-runner";
import { AdviceBlock } from "@/components/advice-block";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { areAcceptedFriends } from "@/lib/friends";
import { isAnalyzingFeedback } from "@/lib/analysis-status";
import { parsePitchReport } from "@/lib/pitch/report";
import { PitchReportPanel } from "@/components/pitch-report-panel";
import type { Recording } from "@/lib/types";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data, error } = await supabase
    .from("recordings")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) notFound();
  const recording = data as Recording;
  const isOwner = recording.user_id === user.id;
  const viewingFriend =
    !isOwner &&
    (await areAcceptedFriends(supabase, user.id, recording.user_id));

  let friendUsername: string | null = null;
  if (viewingFriend) {
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", recording.user_id)
      .maybeSingle();
    friendUsername = ownerProfile?.username ?? null;
  }

  const backHref = viewingFriend
    ? `/friends/${recording.user_id}`
    : "/dashboard";
  const backLabel = viewingFriend
    ? `${friendUsername ?? "朋友"} 練習室`
    : "練習室";
  const analyzing = isAnalyzingFeedback(recording.ai_feedback_md);
  const pitchReport = parsePitchReport(recording.pitch_report);
  const hasStoredAudio = Boolean(
    recording.storage_path || recording.audio_url
  );
  const shareAudio = Boolean(recording.share_audio);
  const canListen =
    hasStoredAudio && (isOwner || shareAudio);

  let playUrl = "";
  if (canListen) {
    if (recording.storage_path) {
      const { data: signed } = await supabase.storage
        .from("recordings")
        .createSignedUrl(recording.storage_path, 60 * 60);
      playUrl = signed?.signedUrl ?? recording.audio_url ?? "";
    } else {
      playUrl = recording.audio_url ?? "";
    }
  }

  const scores = {
    timbre_score: recording.timbre_score ?? 0,
    phonation_score: recording.phonation_score ?? 0,
    pitch_score: recording.pitch_score ?? 0,
    breath_score: recording.breath_score ?? 0,
    rhythm_score: recording.rhythm_score ?? 0,
    dynamics_score: recording.dynamics_score ?? 0,
  };

  const { data: commentRows } = await supabase
    .from("comments")
    .select("id, content, created_at, user_id, profiles(username, avatar_url)")
    .eq("recording_id", id)
    .order("created_at", { ascending: true });

  const comments: CommentItem[] = (commentRows ?? []).map(
    (row: {
      id: string;
      content: string;
      created_at: string;
      user_id: string;
      profiles:
        | { username: string; avatar_url?: string | null }
        | { username: string; avatar_url?: string | null }[]
        | null;
    }) => {
      const profiles = row.profiles;
      const profile = Array.isArray(profiles) ? profiles[0] : profiles;
      return {
        id: row.id,
        content: row.content,
        created_at: row.created_at,
        user_id: row.user_id,
        username: profile?.username ?? "匿名",
        avatar_url: profile?.avatar_url ?? null,
      };
    }
  );

  return (
    <div className="min-h-screen">
      <Navbar username={profile?.username} avatarUrl={profile?.avatar_url} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href={backHref}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Button>
          </Link>
          {isOwner && (
            <>
              <Link href="/sing">
                <Button variant="secondary" size="sm">
                  <Mic2 className="h-4 w-4" />
                  再唱一首
                </Button>
              </Link>
              <DeleteRecordingButton
                recordingId={recording.id}
                songName={recording.song_name}
              />
            </>
          )}
        </div>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-white/45">
              {format(new Date(recording.created_at), "yyyy-MM-dd HH:mm")}
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl text-white">
              {recording.song_name}
            </h1>
            <p className="mt-1 text-white/55">
              {recording.artist || "未知歌手"}
            </p>
          </div>
          <div className="rounded-3xl border border-amber-400/30 bg-amber-400/10 px-6 py-4 text-center">
            <p className="text-xs uppercase tracking-wider text-amber-200/70">
              Total Score
            </p>
            <p className="font-[family-name:var(--font-display)] text-5xl text-amber-300">
              {analyzing ? "…" : recording.total_score}
            </p>
          </div>
        </div>

        {pitchReport && <PitchReportPanel report={pitchReport} />}

        {analyzing && isOwner ? (
          <AnalysisRunner recordingId={recording.id} />
        ) : analyzing ? (
          <Card className="mb-6">
            <CardContent className="py-8 text-center text-white/55">
              AI 分析進行中，請稍後刷新頁面。
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-6">
              <CardContent className="space-y-4 py-4">
                {playUrl ? (
                  <audio src={playUrl} controls className="w-full" />
                ) : hasStoredAudio && !isOwner ? (
                  <p className="flex items-center gap-2 text-sm text-white/50">
                    <Headphones className="h-4 w-4 shrink-0" />
                    歌手未開放分享此錄音音樂檔；分數同 AI 報告仍可睇。
                  </p>
                ) : (
                  <p className="text-sm text-white/50">
                    此錄音未進入個人 Top 10，音檔未保存；分數與 AI
                    分析報告仍然保留。
                  </p>
                )}

                {isOwner && (
                  <ShareAudioToggle
                    recordingId={recording.id}
                    initialShared={shareAudio}
                    hasAudio={hasStoredAudio}
                  />
                )}
              </CardContent>
            </Card>

            <div className="mb-6 grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>六維雷達圖</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScoreRadar scores={scores} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>分項評分</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScoreBars scores={scores} />
                </CardContent>
              </Card>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>AI 診斷報告</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose-vocal">
                  <ReactMarkdown>
                    {recording.ai_feedback_md || "暫無詳細報告。"}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-6 border-amber-400/25 bg-gradient-to-br from-amber-400/10 via-white/[0.03] to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-200">
                  <Lightbulb className="h-5 w-5" />
                  改善建議
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AdviceBlock markdown={recording.actionable_advice || ""} />
              </CardContent>
            </Card>

            <CommentsSection
              recordingId={recording.id}
              currentUserId={user.id}
              isRecordingOwner={isOwner}
              initialComments={comments}
            />
          </>
        )}
      </main>
    </div>
  );
}
