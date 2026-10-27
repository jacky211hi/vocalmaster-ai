import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { share_audio?: boolean };
    if (typeof body.share_audio !== "boolean") {
      return NextResponse.json(
        { error: "請提供 share_audio（true／false）" },
        { status: 400 }
      );
    }

    const { data: recording, error: fetchError } = await supabase
      .from("recordings")
      .select("id, user_id, storage_path, audio_url")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!recording) {
      return NextResponse.json({ error: "找不到紀錄" }, { status: 404 });
    }
    if (recording.user_id !== user.id) {
      return NextResponse.json({ error: "只能修改自己的錄音" }, { status: 403 });
    }

    if (body.share_audio && !recording.storage_path && !recording.audio_url) {
      return NextResponse.json(
        { error: "此錄音沒有保存音檔，無法分享到排行榜" },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("recordings")
      .update({ share_audio: body.share_audio })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, share_audio")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: `更新失敗：${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, share_audio: updated.share_audio });
  } catch (err) {
    console.error("patch recording error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "更新失敗" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: recording, error: fetchError } = await supabase
      .from("recordings")
      .select("id, user_id, storage_path")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!recording) {
      return NextResponse.json({ error: "找不到紀錄" }, { status: 404 });
    }
    if (recording.user_id !== user.id) {
      return NextResponse.json({ error: "只能刪除自己的錄音" }, { status: 403 });
    }

    if (recording.storage_path) {
      const { error: storageError } = await supabase.storage
        .from("recordings")
        .remove([recording.storage_path]);
      if (storageError) {
        console.error("storage delete error:", storageError);
      }
    }

    const { error: deleteError } = await supabase
      .from("recordings")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      return NextResponse.json(
        { error: `刪除失敗：${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete recording error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "刪除失敗" },
      { status: 500 }
    );
  }
}
