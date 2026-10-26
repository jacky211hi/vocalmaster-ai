import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** PATCH — accept or reject a pending request */
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

    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "").trim(); // accept | reject

    const { data: row, error: fetchError } = await supabase
      .from("friends")
      .select("id, user_id, friend_id, status")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: "找不到邀請" }, { status: 404 });
    }
    if (row.status !== "pending") {
      return NextResponse.json({ error: "呢個邀請已處理" }, { status: 400 });
    }
    // Only the recipient can accept/reject
    if (row.friend_id !== user.id) {
      return NextResponse.json({ error: "無權處理此邀請" }, { status: 403 });
    }

    if (action === "accept") {
      const { error } = await supabase
        .from("friends")
        .update({ status: "accepted" })
        .eq("id", id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, status: "accepted" });
    }

    if (action === "reject") {
      const { error } = await supabase.from("friends").delete().eq("id", id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, status: "rejected" });
    }

    return NextResponse.json(
      { error: "action 必須係 accept 或 reject" },
      { status: 400 }
    );
  } catch (err) {
    console.error("friends PATCH error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "失敗" },
      { status: 500 }
    );
  }
}

/** DELETE — remove friendship / cancel outgoing request */
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

    const { data: row, error: fetchError } = await supabase
      .from("friends")
      .select("id, user_id, friend_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: "找不到紀錄" }, { status: 404 });
    }
    if (row.user_id !== user.id && row.friend_id !== user.id) {
      return NextResponse.json({ error: "無權刪除此關係" }, { status: 403 });
    }

    const { error } = await supabase.from("friends").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("friends DELETE error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "失敗" },
      { status: 500 }
    );
  }
}
