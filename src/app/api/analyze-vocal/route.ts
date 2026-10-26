import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeVocalAudio } from "@/lib/gemini";
import {
  PERSONAL_TOP_N,
  pruneUserRecordingsToTopN,
  scoreQualifiesForTopN,
} from "@/lib/prune-recordings";

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

function normalizeMime(mime: string, filename: string): string {
  if (mime && ALLOWED_MIME.has(mime))
    return mime === "audio/mp3" ? "audio/mpeg" : mime;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".m4a") || lower.endsWith(".mp4")) return "audio/mp4";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".webm")) return "audio/webm";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  return mime || "audio/webm";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await request.formData();
    const songName = String(form.get("song_name") ?? "").trim();
    const artist = String(form.get("artist") ?? "").trim();
    const file = form.get("audio");

    if (!songName) {
      return NextResponse.json({ error: "請輸入歌名" }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "請提供錄音檔" }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "檔案請小於 20MB" }, { status: 400 });
    }

    const mimeType = normalizeMime(file.type, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    const audioBase64 = buffer.toString("base64");

    const analysis = await analyzeVocalAudio({
      audioBase64,
      mimeType,
      songName,
      artist,
    });

    // Only keep audio files for personal top-N scores
    const { data: existingRows } = await supabase
      .from("recordings")
      .select("total_score")
      .eq("user_id", user.id);

    const existingScores = (existingRows ?? []).map(
      (r: { total_score: number }) => r.total_score
    );
    const keepAudio = scoreQualifiesForTopN(
      existingScores,
      analysis.total_score,
      PERSONAL_TOP_N
    );

    let objectPath: string | null = null;
    let audioUrl = "";

    if (keepAudio) {
      const ext =
        mimeType.includes("mpeg") || file.name.toLowerCase().endsWith(".mp3")
          ? "mp3"
          : mimeType.includes("mp4") || file.name.toLowerCase().endsWith(".m4a")
            ? "m4a"
            : mimeType.includes("wav")
              ? "wav"
              : mimeType.includes("ogg")
                ? "ogg"
                : "webm";

      objectPath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("recordings")
        .upload(objectPath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        return NextResponse.json(
          { error: `上傳失敗：${uploadError.message}` },
          { status: 500 }
        );
      }

      const { data: signed } = await supabase.storage
        .from("recordings")
        .createSignedUrl(objectPath, 60 * 60 * 24 * 365);

      audioUrl = signed?.signedUrl ?? objectPath;
    }

    const { data: recording, error: insertError } = await supabase
      .from("recordings")
      .insert({
        user_id: user.id,
        song_name: songName,
        artist,
        audio_url: audioUrl,
        storage_path: objectPath,
        total_score: analysis.total_score,
        timbre_score: analysis.timbre_score,
        mechanism_score: analysis.mechanism_score,
        breath_score: analysis.breath_score,
        pitch_score: analysis.pitch_score,
        ai_feedback_md: analysis.detailed_feedback,
        actionable_advice: analysis.actionable_advice,
      })
      .select("id")
      .single();

    if (insertError || !recording) {
      console.error("DB insert error:", insertError);
      // Roll back orphaned upload if DB insert failed
      if (objectPath) {
        await supabase.storage.from("recordings").remove([objectPath]);
      }
      return NextResponse.json(
        { error: `儲存失敗：${insertError?.message ?? "unknown"}` },
        { status: 500 }
      );
    }

    // Drop anything outside personal top N (keep this result viewable once)
    await pruneUserRecordingsToTopN(supabase, user.id, {
      protectId: recording.id,
      topN: PERSONAL_TOP_N,
    });

    return NextResponse.json({
      id: recording.id,
      kept_audio: keepAudio,
      ...analysis,
    });
  } catch (err) {
    console.error("analyze-vocal error:", err);
    const message =
      err instanceof Error ? err.message : "分析失敗，請稍後再試";
    const busy =
      message.includes("繁忙") ||
      message.includes("503") ||
      message.includes("UNAVAILABLE") ||
      message.includes("high demand");
    return NextResponse.json(
      { error: message },
      { status: busy ? 503 : 500 }
    );
  }
}
