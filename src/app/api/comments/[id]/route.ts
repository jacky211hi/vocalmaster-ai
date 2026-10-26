import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** DELETE — remove own comment (or as recording owner via RLS) */
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

    const { error } = await supabase.from("comments").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("comments DELETE:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "失敗" },
      { status: 500 }
    );
  }
}
