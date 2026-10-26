import { redirect } from "next/navigation";
import { format } from "date-fns";
import { User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { ProfileForm } from "@/components/profile-form";
import { UserAvatar } from "@/components/user-avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, email, created_at, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const username =
    profile?.username ?? user.email?.split("@")[0] ?? "用戶";
  const email = profile?.email ?? user.email ?? "";
  const avatarUrl = profile?.avatar_url ?? null;

  const { data: recordings } = await supabase
    .from("recordings")
    .select("total_score")
    .eq("user_id", user.id);

  const list = recordings ?? [];
  const highest = list.reduce(
    (max, r) => Math.max(max, r.total_score ?? 0),
    0
  );

  return (
    <div className="min-h-screen">
      <Navbar username={username} avatarUrl={avatarUrl} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center gap-4">
          <UserAvatar avatarUrl={avatarUrl} username={username} size={72} />
          <div>
            <p className="text-sm text-amber-200/70">個人檔案</p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl text-white">
              {username}
            </h1>
            <p className="mt-2 text-white/55">
              修改頭像、顯示名稱或密碼。
              {profile?.created_at && (
                <>
                  {" "}
                  加入於 {format(new Date(profile.created_at), "yyyy-MM-dd")}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="py-5">
              <p className="text-sm text-white/45">錄音總數</p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-3xl text-white">
                {list.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-5">
              <p className="text-sm text-white/45">最高分</p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-3xl text-amber-300">
                {list.length ? highest : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-amber-300" />
              個人資料
            </CardTitle>
            <CardDescription>更改頭像、顯示名稱或密碼</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              email={email}
              initialUsername={username}
              initialAvatarUrl={avatarUrl}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
