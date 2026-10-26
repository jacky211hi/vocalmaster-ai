"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Mic2, LogOut, Trophy, LayoutDashboard, Music2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "練習室", icon: LayoutDashboard },
  { href: "/sing", label: "唱歌", icon: Music2 },
  { href: "/friends", label: "朋友", icon: Users },
  { href: "/leaderboard", label: "排行榜", icon: Trophy },
];

export function Navbar({
  username,
  avatarUrl,
}: {
  username?: string;
  avatarUrl?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b1220]/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/30 sm:h-9 sm:w-9">
            <Mic2 className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <div className="hidden leading-tight min-[400px]:block">
            <p className="font-[family-name:var(--font-display)] text-base tracking-tight text-white sm:text-lg">
              VocalMaster AI
            </p>
            <p className="text-[10px] text-amber-200/70 sm:text-[11px]">
              AI 聲樂教練
            </p>
          </div>
        </Link>

        <nav className="mx-auto flex items-center gap-0.5 sm:gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl transition sm:h-10 sm:w-10",
                pathname.startsWith(href)
                  ? "bg-white/10 text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5" />
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {username && (
            <Link
              href="/profile"
              className={cn(
                "flex items-center gap-2 rounded-xl px-1.5 py-1 text-sm transition sm:max-w-[14rem] sm:px-2",
                pathname.startsWith("/profile")
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              )}
              title="個人檔案"
            >
              <UserAvatar
                avatarUrl={avatarUrl}
                username={username}
                size={28}
              />
              <span className="hidden truncate sm:inline">{username}</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={handleLogout}
            aria-label="登出"
            title="登出"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
