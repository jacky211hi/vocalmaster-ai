import type { SupabaseClient } from "@supabase/supabase-js";

export type FriendRow = {
  id: string;
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
};

export type FriendWithProfile = FriendRow & {
  other_id: string;
  username: string;
  avatar_url?: string | null;
  direction: "incoming" | "outgoing" | "friend";
};

/** True if an accepted friendship exists between the two users (either direction). */
export async function areAcceptedFriends(
  supabase: SupabaseClient,
  userId: string,
  otherUserId: string
): Promise<boolean> {
  if (userId === otherUserId) return true;
  const { data } = await supabase
    .from("friends")
    .select("id")
    .eq("status", "accepted")
    .or(
      `and(user_id.eq.${userId},friend_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},friend_id.eq.${userId})`
    )
    .maybeSingle();
  return Boolean(data);
}

export async function listFriendships(
  supabase: SupabaseClient,
  userId: string
): Promise<FriendWithProfile[]> {
  const { data: rows, error } = await supabase
    .from("friends")
    .select("id, user_id, friend_id, status, created_at")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error || !rows) {
    console.error("listFriendships:", error);
    return [];
  }

  const otherIds = [
    ...new Set(
      (rows as FriendRow[]).map((r) =>
        r.user_id === userId ? r.friend_id : r.user_id
      )
    ),
  ];

  if (otherIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", otherIds);

  const profileById = new Map(
    (profiles ?? []).map(
      (p: { id: string; username: string; avatar_url?: string | null }) => [
        p.id,
        p,
      ]
    )
  );

  return (rows as FriendRow[]).map((r) => {
    const other_id = r.user_id === userId ? r.friend_id : r.user_id;
    let direction: FriendWithProfile["direction"] = "friend";
    if (r.status === "pending") {
      direction = r.friend_id === userId ? "incoming" : "outgoing";
    }
    const profile = profileById.get(other_id);
    return {
      ...r,
      other_id,
      username: profile?.username ?? "未知用戶",
      avatar_url: profile?.avatar_url ?? null,
      direction,
    };
  });
}

export async function getAcceptedFriendIds(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("friends")
    .select("user_id, friend_id")
    .eq("status", "accepted")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

  if (!data) return [];
  return data.map((r: { user_id: string; friend_id: string }) =>
    r.user_id === userId ? r.friend_id : r.user_id
  );
}
