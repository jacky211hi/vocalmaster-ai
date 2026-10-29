import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeVocalAudio } from "@/lib/gemini";
import {
  ANALYZING_MARKER,
  isAnalyzingFeedback,
} from "@/lib/analysis-status";
import {
  PERSONAL_TOP_N,
  pruneUserRecordingsToTopN,
  scoreQualifiesForTopN,
} from "@/lib/prune-recordings";
import { coachHistoryPrompt } from "@/lib/coach-history";
import { getRequestLocale } from "@/lib/i18n/server";
import { lookupLyrics } from "@/lib/lyrics";
import { measuredMarkdown, parsePitchReport } from "@/lib/pitch/report";

export const maxDuration = 300;

const ALLOWED_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
]);

function normalizeMime(mime: string, path: string): string {
  if (mime && ALLOWED_MIME.has(mime))
    return mime === "audio/mp3" ? "audio/mpeg" : mime;
  const lower = path.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".m4a") || lower.endsWith(".mp4")) return "audio/mp4";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".webm")) return "audio/webm";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  return "audio/mp4";
}

/** Heavy Gemini step — called from result page after pending row is created */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const id = String(body?.id ?? "").trim();
    const mimeHint = String(body?.mime_type ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "缺少錄音 id" }, { status: 400 });
    }

    const { data: recording, error: fetchError } = await supabase
      .from("recordings")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !recording) {
      return NextResponse.json({ error: "找不到錄音" }, { status: 404 });
    }
    if (recording.user_id !== user.id) {
      return NextResponse.json({ error: "無權分析此錄音" }, { status: 403 });
    }
    if (!isAnalyzingFeedback(recording.ai_feedback_md)) {
      // Already done — idempotent success
      return NextResponse.json({ ok: true, id, already_done: true });
    }
    if (!recording.storage_path) {
      return NextResponse.json({ error: "缺少音訊檔" }, { status: 400 });
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("recordings")
      .download(recording.storage_path);

    if (downloadError || !fileData) {
      await supabase
        .from("recordings")
        .update({
          ai_feedback_md: `分析失敗：無法讀取音訊（${downloadError?.message ?? "unknown"}）`,
        })
        .eq("id", id);
      return NextResponse.json(
        { error: `讀取音訊失敗：${downloadError?.message ?? "unknown"}` },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const mimeType = normalizeMime(mimeHint, recording.storage_path);
    const pitchReport = parsePitchReport(recording.pitch_report);
    let lyrics = null;
    try {
      lyrics = await lookupLyrics(
        recording.song_name,
        recording.artist ?? ""
      );
    } catch (err) {
      console.warn(
        "[lyrics] lookup failed:",
        err instanceof Error ? err.message : err
      );
    }

    const { data: historyRows } = await supabase
      .from("recordings")
      .select(
        "song_name, artist, total_score, timbre_score, phonation_score, pitch_score, breath_score, rhythm_score, dynamics_score, ai_feedback_md, actionable_advice, created_at"
      )
      .eq("user_id", user.id)
      .neq("id", id)
      .order("created_at", { ascending: false })
      .limit(12);

    let coachHistory: string | null = null;
    try {
      coachHistory = coachHistoryPrompt(historyRows ?? []);
    } catch (err) {
      console.warn(
        "[coach-history] build failed:",
        err instanceof Error ? err.message : err
      );
    }

    const locale = await getRequestLocale();
    const analysis = await analyzeVocalAudio({
      audioBase64: buffer.toString("base64"),
      mimeType,
      songName: recording.song_name,
      artist: recording.artist ?? "",
      pitchReport,
      lyrics,
      coachHistory,
      locale,
    });
    const pitchScore = pitchReport
      ? pitchReport.pitchScore
      : analysis.pitch_score;
    const rhythmScore = pitchReport
      ? pitchReport.rhythmScore
      : analysis.rhythm_score;
    const totalScore = pitchReport
      ? Math.round(
          (analysis.timbre_score +
            analysis.phonation_score +
            pitchScore +
            analysis.breath_score +
            rhythmScore +
            analysis.dynamics_score) /
            6
        )
      : analysis.total_score;
    const lyricNote = lyrics
      ? locale === "en"
        ? `Lyrics match: ${lyrics.artist} 〈${lyrics.track}〉\n\n`
        : locale === "tw"
          ? `歌詞對照：${lyrics.artist}〈${lyrics.track}〉\n\n`
          : `歌詞對照：${lyrics.artist}〈${lyrics.track}〉\n\n`
      : locale === "en"
        ? "Official lyrics not found; timed sections did not quote transcribed lyrics.\n\n"
        : locale === "tw"
          ? "未找到正式歌詞，時間段分析未引用聽寫歌詞。\n\n"
          : "未搵到正式歌詞，時間段分析冇引用聽寫歌詞。\n\n";
    const feedback = `${lyricNote}${
      pitchReport ? `${measuredMarkdown(pitchReport)}\n` : ""
    }${analysis.detailed_feedback}`;

    const { data: existingRows } = await supabase
      .from("recordings")
      .select("total_score, id")
      .eq("user_id", user.id)
      .neq("id", id);

    const existingScores = (existingRows ?? [])
      .filter((r) => r.total_score > 0)
      .map((r: { total_score: number }) => r.total_score);

    const keepAudio = scoreQualifiesForTopN(
      existingScores,
      totalScore,
      PERSONAL_TOP_N
    );

    let audioUrl = recording.audio_url ?? "";
    let storagePath = recording.storage_path as string | null;

    let shareAudio = Boolean(recording.share_audio);
    let shareAudioFriends = Boolean(recording.share_audio_friends);
    if (!keepAudio && storagePath) {
      await supabase.storage.from("recordings").remove([storagePath]);
      storagePath = null;
      audioUrl = "";
      shareAudio = false;
      shareAudioFriends = false;
    } else if (keepAudio && storagePath && !audioUrl) {
      const { data: signed } = await supabase.storage
        .from("recordings")
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
      audioUrl = signed?.signedUrl ?? "";
    }

    const { error: updateError } = await supabase
      .from("recordings")
      .update({
        total_score: totalScore,
        timbre_score: analysis.timbre_score,
        phonation_score: analysis.phonation_score,
        pitch_score: pitchScore,
        breath_score: analysis.breath_score,
        rhythm_score: rhythmScore,
        dynamics_score: analysis.dynamics_score,
        ai_feedback_md: feedback,
        actionable_advice: analysis.actionable_advice,
        audio_url: audioUrl,
        storage_path: storagePath,
        share_audio: shareAudio,
        share_audio_friends: shareAudioFriends,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: `更新失敗：${updateError.message}` },
        { status: 500 }
      );
    }

    await pruneUserRecordingsToTopN(supabase, user.id, {
      protectId: id,
      topN: PERSONAL_TOP_N,
    });

    return NextResponse.json({
      ok: true,
      id,
      kept_audio: keepAudio,
      ...analysis,
    });
  } catch (err) {
    console.error("analyze-vocal run error:", err);
    const message =
      err instanceof Error ? err.message : "分析失敗，請稍後再試";

    try {
      const body = await request.clone().json().catch(() => ({}));
      const id = String(body?.id ?? "").trim();
      if (id) {
        const supabase = await createClient();
        await supabase
          .from("recordings")
          .update({
            ai_feedback_md: `分析失敗：${message}`,
          })
          .eq("id", id)
          .like("ai_feedback_md", `${ANALYZING_MARKER}%`);
      }
    } catch {
      // ignore
    }

    const timedOut =
      message.includes("504") ||
      message.includes("timeout") ||
      message.includes("TIMEOUT") ||
      message.includes("逾時");

    return NextResponse.json(
      { error: message },
      { status: timedOut ? 504 : 500 }
    );
  }
}
