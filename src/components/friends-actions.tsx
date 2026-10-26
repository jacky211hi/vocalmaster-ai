"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Check, X, UserMinus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddFriendForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "失敗");
      setMessage(data.message || "已發送邀請");
      setUsername("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="輸入朋友用戶名稱"
          disabled={loading}
          required
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !username.trim()}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          加朋友
        </Button>
      </div>
      {error && (
        <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-xl bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">
          {message}
        </p>
      )}
    </form>
  );
}

export function FriendRequestActions({ friendshipId }: { friendshipId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null);

  async function act(action: "accept" | "reject") {
    setLoading(action);
    try {
      const res = await fetch(`/api/friends/${friendshipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "失敗");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "失敗");
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        onClick={() => act("accept")}
        disabled={!!loading}
      >
        {loading === "accept" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        接受
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => act("reject")}
        disabled={!!loading}
      >
        {loading === "reject" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <X className="h-4 w-4" />
        )}
        拒絕
      </Button>
    </div>
  );
}

export function RemoveFriendButton({
  friendshipId,
  username,
  label = "移除",
}: {
  friendshipId: string;
  username: string;
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onRemove() {
    const ok = window.confirm(`確定移除朋友「${username}」？`);
    if (!ok) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/friends/${friendshipId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "失敗");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "失敗");
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={onRemove}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <UserMinus className="h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
