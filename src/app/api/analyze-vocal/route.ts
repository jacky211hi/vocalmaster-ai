import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeVocalAudio } from "@/lib/gemini";
import {
  PERSONAL_TOP_N,
  pruneUserRecordingsToTopN,
  scoreQualifiesForTopN,
} from "@/lib/prune-recordings";

// Hobby plan allows up to 60s; Gemini audio analysis needs the full window
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

/**
 * Expects JSON body after client already uploaded audio to Supabase Storage:
 * { song_name, artist, storage_path, mime_type? }
 * Avoids Vercel 4.5MB request body limit (phone uploads often exceed it).
 */
export async function POST(request: Request) {
  let storagePathToCleanup: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "無效請求" }, { status: 400 });
    }

    const songName = String(body.song_name ?? "").trim();
    const artist = String(body.artist ?? "").trim();
    const storagePath = String(body.storage_path ?? "").trim();
    const mimeType = normalizeMime(
      String(body.mime_type ?? ""),
      storagePath
    );

    if (!songName) {
      return NextResponse.json({ error: "請輸入歌名" }, { status: 400 });
    }
    if (!storagePath) {
      return NextResponse.json({ error: "缺少音訊路徑" }, { status: 400 });
    }
    // Only allow paths under this user's folder
    if (
      !storagePath.startsWith(`${user.id}/`) ||
      storagePath.includes("..")
    ) {
      return NextResponse.json({ error: "無效的音訊路徑" }, { status: 403 });
    }

    storagePathToCleanup = storagePath;

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("recordings")
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error("Storage download error:", downloadError);
      return NextResponse.json(
        { error: `讀取音訊失敗：${downloadError?.message ?? "unknown"}` },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: "音訊檔是空的" }, { status: 400 });
    }
    if (buffer.length > 20 * 1024 * 1024) {
      await supabase.storage.from("recordings").remove([storagePath]);
      return NextResponse.json({ error: "檔案請小於 20MB" }, { status: 400 });
    }

    const audioBase64 = buffer.toString("base64");

    const analysis = await analyzeVocalAudio({
      audioBase64,
      mimeType,
      songName,
      artist,
    });

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

    let objectPath: string | null = storagePath;
    let audioUrl = "";

    if (keepAudio) {
      const { data: signed } = await supabase.storage
        .from("recordings")
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
      audioUrl = signed?.signedUrl ?? storagePath;
      storagePathToCleanup = null; // keep file
    } else {
      await supabase.storage.from("recordings").remove([storagePath]);
      objectPath = null;
      storagePathToCleanup = null;
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
      if (objectPath) {
        await supabase.storage.from("recordings").remove([objectPath]);
      }
      return NextResponse.json(
        { error: `儲存失敗：${insertError?.message ?? "unknown"}` },
        { status: 500 }
      );
    }

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
    if (storagePathToCleanup) {
      try {
        const supabase = await createClient();
        await supabase.storage
          .from("recordings")
          .remove([storagePathToCleanup]);
      } catch {
        // ignore cleanup errors
      }
    }
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
