import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listFriendships } from "@/lib/friends";
import { Navbar } from "@/components/navbar";
import {
  AddFriendForm,
  FriendRequestActions,
  RemoveFriendButton,
} from "@/components/friends-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function FriendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const friendships = await listFriendships(supabase, user.id);
  const friends = friendships.filter((f) => f.status === "accepted");
  const incoming = friendships.filter((f) => f.direction === "incoming");
  const outgoing = friendships.filter((f) => f.direction === "outgoing");

  return (
    <div className="min-h-screen">
      <Navbar username={profile?.username} avatarUrl={profile?.avatar_url} />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-white">
            朋友
          </h1>
          <p className="mt-2 text-white/55">
          立刻挑戰朋友的歌喉，在排行榜一決高下！
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-300" />
              邀請朋友
            </CardTitle>
            <CardDescription>
              輸入對方註冊時的用戶名稱（不是電郵）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddFriendForm />
          </CardContent>
        </Card>

        {incoming.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/45">
              待處理邀請 ({incoming.length})
            </h2>
            <div className="space-y-3">
              {incoming.map((f) => (
                <Card key={f.id}>
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <div>
                      <p className="font-semibold text-white">{f.username}</p>
                      <p className="text-sm text-white/45">想加你做朋友</p>
                    </div>
                    <FriendRequestActions friendshipId={f.id} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {outgoing.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/45">
              已發送 ({outgoing.length})
            </h2>
            <div className="space-y-3">
              {outgoing.map((f) => (
                <Card key={f.id}>
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <div>
                      <p className="font-semibold text-white">{f.username}</p>
                      <p className="text-sm text-white/45">等候對方接受</p>
                    </div>
                    <RemoveFriendButton
                      friendshipId={f.id}
                      username={f.username}
                      label="取消"
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/45">
            我的朋友 ({friends.length})
          </h2>
          {friends.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-white/50">
                尚未有朋友。用上面搜尋加第一位吧。
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {friends.map((f) => (
                <Card key={f.id}>
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <p className="font-semibold text-white">{f.username}</p>
                    <RemoveFriendButton
                      friendshipId={f.id}
                      username={f.username}
                      label="移除朋友"
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
