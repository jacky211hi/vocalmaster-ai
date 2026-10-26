import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_AVATAR_SRC,
  isDefaultAvatarId,
  resolveAvatarUrl,
} from "@/lib/avatars";

const ALLOWED_IMAGE = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

/** PATCH — update username, password, and/or avatar (preset or upload) */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await request.formData();
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const avatarField = String(form.get("avatar_url") ?? "").trim();
    const avatarFile = form.get("avatar_file");

    if (!username) {
      return NextResponse.json({ error: "用戶名稱不能空白" }, { status: 400 });
    }
    if (username.length < 2 || username.length > 32) {
      return NextResponse.json(
        { error: "用戶名稱需為 2–32 個字元" },
        { status: 400 }
      );
    }
    if (!/^[a-zA-Z0-9_\u4e00-\u9fff]+$/.test(username)) {
      return NextResponse.json(
        { error: "用戶名稱只可用字母、數字、底線或中文" },
        { status: 400 }
      );
    }
    if (password && password.length < 6) {
      return NextResponse.json({ error: "新密碼至少 6 位" }, { status: 400 });
    }

    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .neq("id", user.id)
      .maybeSingle();

    if (taken) {
      return NextResponse.json({ error: "呢個用戶名稱已被使用" }, { status: 409 });
    }

    let nextAvatar: string | undefined;

    if (avatarFile instanceof File && avatarFile.size > 0) {
      if (!ALLOWED_IMAGE.has(avatarFile.type)) {
        return NextResponse.json(
          { error: "頭像只支援 JPG / PNG / WebP" },
          { status: 400 }
        );
      }
      if (avatarFile.size > 2 * 1024 * 1024) {
        return NextResponse.json({ error: "頭像請小於 2MB" }, { status: 400 });
      }

      const ext =
        avatarFile.type === "image/png"
          ? "png"
          : avatarFile.type === "image/webp"
            ? "webp"
            : "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const buffer = Buffer.from(await avatarFile.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, buffer, {
          contentType: avatarFile.type,
          upsert: true,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: `頭像上傳失敗：${uploadError.message}` },
          { status: 500 }
        );
      }

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      // cache-bust so UI refreshes immediately
      nextAvatar = `${pub.publicUrl}?t=${Date.now()}`;
    } else if (avatarField) {
      if (isDefaultAvatarId(avatarField)) {
        nextAvatar = avatarField;
      } else if (avatarField.startsWith("/avatars/")) {
        nextAvatar = avatarField;
      } else if (
        avatarField.startsWith("http://") ||
        avatarField.startsWith("https://")
      ) {
        nextAvatar = avatarField;
      } else {
        return NextResponse.json({ error: "無效的頭像選擇" }, { status: 400 });
      }
    }

    const updatePayload: { username: string; avatar_url?: string } = {
      username,
    };
    if (nextAvatar !== undefined) {
      updatePayload.avatar_url = nextAvatar;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    await supabase.auth.updateUser({
      data: {
        username,
        ...(nextAvatar !== undefined ? { avatar_url: nextAvatar } : {}),
      },
      ...(password.length >= 6 ? { password } : {}),
    });

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      username: profile?.username ?? username,
      avatar_url: profile?.avatar_url ?? nextAvatar ?? DEFAULT_AVATAR_SRC,
      avatar_resolved: resolveAvatarUrl(profile?.avatar_url ?? nextAvatar),
    });
  } catch (err) {
    console.error("profile PATCH:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "更新失敗" },
      { status: 500 }
    );
  }
}
