"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Mic2, LogOut, Trophy, LayoutDashboard, Music2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sing", label: "唱歌", icon: Music2 },
  { href: "/leaderboard", label: "排行榜", icon: Trophy },
];

export function Navbar({ username }: { username?: string }) {
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
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                pathname.startsWith(href)
                  ? "bg-white/10 text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {username && (
            <span className="hidden text-sm text-white/60 sm:inline">
              {username}
            </span>
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
