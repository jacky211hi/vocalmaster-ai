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

export const maxDuration = 60;

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
    const analysis = await analyzeVocalAudio({
      audioBase64: buffer.toString("base64"),
      mimeType,
      songName: recording.song_name,
      artist: recording.artist ?? "",
    });

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
      analysis.total_score,
      PERSONAL_TOP_N
    );

    let audioUrl = recording.audio_url ?? "";
    let storagePath = recording.storage_path as string | null;

    let shareAudio = Boolean(recording.share_audio);
    if (!keepAudio && storagePath) {
      await supabase.storage.from("recordings").remove([storagePath]);
      storagePath = null;
      audioUrl = "";
      shareAudio = false;
    } else if (keepAudio && storagePath && !audioUrl) {
      const { data: signed } = await supabase.storage
        .from("recordings")
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
      audioUrl = signed?.signedUrl ?? "";
    }

    const { error: updateError } = await supabase
      .from("recordings")
      .update({
        total_score: analysis.total_score,
        timbre_score: analysis.timbre_score,
        phonation_score: analysis.phonation_score,
        pitch_score: analysis.pitch_score,
        breath_score: analysis.breath_score,
        rhythm_score: analysis.rhythm_score,
        dynamics_score: analysis.dynamics_score,
        ai_feedback_md: analysis.detailed_feedback,
        actionable_advice: analysis.actionable_advice,
        audio_url: audioUrl,
        storage_path: storagePath,
        share_audio: shareAudio,
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
