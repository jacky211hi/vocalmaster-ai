import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** POST — send friend request by username */
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
    const username = String(body.username ?? "").trim();
    if (!username) {
      return NextResponse.json({ error: "請輸入用戶名稱" }, { status: 400 });
    }

    const { data: target, error: findError } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", username)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }
    if (!target) {
      return NextResponse.json({ error: "找不到呢個用戶" }, { status: 404 });
    }
    if (target.id === user.id) {
      return NextResponse.json({ error: "唔可以加自己做朋友" }, { status: 400 });
    }

    // Already friends / pending either direction?
    const { data: existing } = await supabase
      .from("friends")
      .select("id, user_id, friend_id, status")
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${target.id}),and(user_id.eq.${target.id},friend_id.eq.${user.id})`
      )
      .maybeSingle();

    if (existing) {
      if (existing.status === "accepted") {
        return NextResponse.json({ error: "已經係朋友" }, { status: 409 });
      }
      if (existing.status === "pending") {
        if (existing.friend_id === user.id) {
          // They already requested you — accept instead
          const { error: acceptError } = await supabase
            .from("friends")
            .update({ status: "accepted" })
            .eq("id", existing.id);
          if (acceptError) {
            return NextResponse.json(
              { error: acceptError.message },
              { status: 500 }
            );
          }
          return NextResponse.json({
            ok: true,
            status: "accepted",
            message: "已接受對方嘅朋友邀請",
          });
        }
        return NextResponse.json(
          { error: "已發送邀請，等候對方接受" },
          { status: 409 }
        );
      }
      if (existing.status === "blocked") {
        return NextResponse.json({ error: "無法加呢個用戶" }, { status: 403 });
      }
    }

    const { data: row, error: insertError } = await supabase
      .from("friends")
      .insert({
        user_id: user.id,
        friend_id: target.id,
        status: "pending",
      })
      .select("id, status")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      status: "pending",
      id: row.id,
      username: target.username,
      message: `已向 ${target.username} 發送朋友邀請`,
    });
  } catch (err) {
    console.error("friends POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "失敗" },
      { status: 500 }
    );
  }
}
