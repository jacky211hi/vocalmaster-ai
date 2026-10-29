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

    const body = (await request.json()) as {
      share_audio?: boolean;
      share_audio_friends?: boolean;
    };
    const patch: {
      share_audio?: boolean;
      share_audio_friends?: boolean;
    } = {};
    if (typeof body.share_audio === "boolean") {
      patch.share_audio = body.share_audio;
    }
    if (typeof body.share_audio_friends === "boolean") {
      patch.share_audio_friends = body.share_audio_friends;
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "請提供 share_audio 或 share_audio_friends（true／false）" },
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

    const enabling =
      patch.share_audio === true || patch.share_audio_friends === true;
    if (enabling && !recording.storage_path && !recording.audio_url) {
      return NextResponse.json(
        { error: "此錄音沒有保存音檔，無法分享到排行榜" },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("recordings")
      .update(patch)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, share_audio, share_audio_friends")
      .single();

    if (updateError) {
      const missingFriends = updateError.message?.includes(
        "share_audio_friends"
      );
      return NextResponse.json(
        {
          error: missingFriends
            ? "資料庫未有 share_audio_friends 欄。請喺 Supabase SQL Editor 執行 supabase/add-share-audio-friends.sql"
            : `更新失敗：${updateError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      share_audio: updated.share_audio,
      share_audio_friends: updated.share_audio_friends,
    });
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

    // Rolling coach memory lives on profiles — wipe it when no recordings remain.
    const { count } = await supabase
      .from("recordings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) === 0) {
      const { error: clearError } = await supabase
        .from("profiles")
        .update({ coach_summary: null })
        .eq("id", user.id);
      if (clearError) {
        console.warn(
          "[coach-summary] clear after last delete failed:",
          clearError.message
        );
      }
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
