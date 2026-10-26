import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
