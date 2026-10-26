import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** POST — add a comment on a recording */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const recordingId = String(body.recording_id ?? "").trim();
    const content = String(body.content ?? "").trim();

    if (!recordingId) {
      return NextResponse.json({ error: "缺少 recording_id" }, { status: 400 });
    }
    if (!content) {
      return NextResponse.json({ error: "請輸入留言" }, { status: 400 });
    }
    if (content.length > 1000) {
      return NextResponse.json({ error: "留言最多 1000 字" }, { status: 400 });
    }

    const { data: recording } = await supabase
      .from("recordings")
      .select("id")
      .eq("id", recordingId)
      .maybeSingle();

    if (!recording) {
      return NextResponse.json({ error: "找不到錄音" }, { status: 404 });
    }

    const { data: comment, error } = await supabase
      .from("comments")
      .insert({
        recording_id: recordingId,
        user_id: user.id,
        content,
      })
      .select("id, content, created_at, user_id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, comment });
  } catch (err) {
    console.error("comments POST:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "失敗" },
      { status: 500 }
    );
  }
}
