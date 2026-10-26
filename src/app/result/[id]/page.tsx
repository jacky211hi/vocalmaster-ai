import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import { Lightbulb, ArrowLeft, Mic2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { ScoreBars } from "@/components/score-bars";
import { ScoreRadar } from "@/components/score-radar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("recordings")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) notFound();
  const recording = data as Recording;

  const scores = {
    timbre_score: recording.timbre_score,
    mechanism_score: recording.mechanism_score,
    breath_score: recording.breath_score,
    pitch_score: recording.pitch_score,
  };

  return (
    <div className="min-h-screen">
      <Navbar username={profile?.username} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Link href="/sing">
            <Button variant="secondary" size="sm">
              <Mic2 className="h-4 w-4" />
              再唱一首
            </Button>
          </Link>
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
              {recording.total_score}
            </p>
          </div>
        </div>

        {recording.audio_url ? (
          <Card className="mb-6">
            <CardContent className="py-4">
              <audio src={recording.audio_url} controls className="w-full" />
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-6 border-dashed border-white/15">
            <CardContent className="py-4 text-sm text-white/50">
              此錄音未進入個人 Top 10，音檔未保存；分數與 AI 分析報告仍然保留。
            </CardContent>
          </Card>
        )}

        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>四維雷達圖</CardTitle>
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

        <Card className="mb-6 border-amber-400/25 bg-gradient-to-br from-amber-400/10 via-white/[0.03] to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-200">
              <Lightbulb className="h-5 w-5" />
              Actionable Advice · 改善建議
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose-vocal">
              <ReactMarkdown>
                {recording.actionable_advice || "暫無具體練習建議。"}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>

        <Card>
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
      </main>
    </div>
  );
}
