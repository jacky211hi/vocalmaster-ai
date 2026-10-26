import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ANALYZING_MARKER } from "@/lib/analysis-status";

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
  return mime || "audio/mp4";
}

/**
 * Fast start: verify upload exists, create pending recording, return id.
 * Heavy Gemini work runs on /api/analyze-vocal/run to avoid gateway 504.
 */
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
    if (
      !storagePath.startsWith(`${user.id}/`) ||
      storagePath.includes("..")
    ) {
      return NextResponse.json({ error: "無效的音訊路徑" }, { status: 403 });
    }

    // Confirm object exists (fast metadata check)
    const folder = storagePath.includes("/")
      ? storagePath.slice(0, storagePath.lastIndexOf("/"))
      : user.id;
    const fileName = storagePath.slice(storagePath.lastIndexOf("/") + 1);
    const { data: listed, error: listError } = await supabase.storage
      .from("recordings")
      .list(folder, { search: fileName, limit: 5 });

    if (listError) {
      return NextResponse.json(
        { error: `讀取音訊失敗：${listError.message}` },
        { status: 500 }
      );
    }
    const found = (listed ?? []).some((f) => f.name === fileName);
    if (!found) {
      return NextResponse.json(
        { error: "找不到已上傳的音訊，請重新上傳" },
        { status: 404 }
      );
    }

    const { data: signed } = await supabase.storage
      .from("recordings")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    const { data: recording, error: insertError } = await supabase
      .from("recordings")
      .insert({
        user_id: user.id,
        song_name: songName,
        artist,
        audio_url: signed?.signedUrl ?? "",
        storage_path: storagePath,
        total_score: 0,
        timbre_score: 0,
        mechanism_score: 0,
        breath_score: 0,
        pitch_score: 0,
        ai_feedback_md: ANALYZING_MARKER,
        actionable_advice: "",
      })
      .select("id")
      .single();

    if (insertError || !recording) {
      return NextResponse.json(
        { error: `儲存失敗：${insertError?.message ?? "unknown"}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: recording.id,
      status: "analyzing",
      mime_type: mimeType,
    });
  } catch (err) {
    console.error("analyze-vocal start error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "建立分析失敗" },
      { status: 500 }
    );
  }
}
