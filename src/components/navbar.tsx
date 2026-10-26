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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b1220]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/30">
            <Mic2 className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="font-[family-name:var(--font-display)] text-lg tracking-tight text-white">
              VocalMaster AI
            </p>
            <p className="text-[11px] text-amber-200/70">AI 聲樂教練</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl transition",
                pathname.startsWith(href)
                  ? "bg-white/10 text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5" />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {username && (
            <Link
              href="/profile"
              className={cn(
                "flex max-w-[10rem] items-center gap-2 truncate rounded-xl px-2 py-1 text-sm transition sm:max-w-[14rem]",
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
              <span className="truncate">{username}</span>
            </Link>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">登出</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
