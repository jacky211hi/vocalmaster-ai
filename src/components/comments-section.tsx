"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { MessageCircle, Send, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { useI18n } from "@/components/locale-provider";

export type CommentItem = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  username: string;
  avatar_url?: string | null;
};

type Props = {
  recordingId: string;
  currentUserId: string;
  isRecordingOwner: boolean;
  initialComments: CommentItem[];
};

export function CommentsSection({
  recordingId,
  currentUserId,
  isRecordingOwner,
  initialComments,
}: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recording_id: recordingId, content: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "留言失敗");
      setContent("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "留言失敗");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(commentId: string) {
    if (!window.confirm(t("comments.deleteConfirm"))) return;
    setDeletingId(commentId);
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "刪除失敗");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "刪除失敗");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-amber-300" />
          {t("comments.title")} ({initialComments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={onSubmit} className="space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("comments.placeholder")}
            maxLength={1000}
            rows={3}
            disabled={loading}
            className="w-full resize-y rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-50"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-white/35">{content.length}/1000</span>
            <Button type="submit" size="sm" disabled={loading || !content.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {t("comments.send")}
            </Button>
          </div>
          {error && (
            <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}
        </form>

        {initialComments.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/45">
            {t("comments.empty")}
          </p>
        ) : (
          <ul className="space-y-3">
            {initialComments.map((c) => {
              const canDelete =
                c.user_id === currentUserId || isRecordingOwner;
              return (
                <li
                  key={c.id}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar
                        avatarUrl={c.avatar_url}
                        username={c.username}
                        size={36}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-amber-200/90">
                          {c.username}
                        </p>
                        <p className="text-xs text-white/35">
                          {format(new Date(c.created_at), "yyyy-MM-dd HH:mm")}
                        </p>
                      </div>
                    </div>
                    {canDelete && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        disabled={deletingId === c.id}
                        onClick={() => onDelete(c.id)}
                        aria-label="刪除留言"
                      >
                        {deletingId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap pl-12 text-sm text-white/80">
                    {c.content}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
