"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  recordingId: string;
  songName?: string;
  variant?: "danger" | "ghost";
  size?: "default" | "sm" | "icon";
  redirectTo?: string;
  className?: string;
};

export function DeleteRecordingButton({
  recordingId,
  songName,
  variant = "danger",
  size = "sm",
  redirectTo = "/dashboard",
  className,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const label = songName ? `「${songName}」` : "呢條";
    const ok = window.confirm(
      `確定刪除${label}錄音紀錄？分數、分析同音檔都會一併刪除，無法還原。`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/recordings/${recordingId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "刪除失敗");
      }
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "刪除失敗");
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={onDelete}
      disabled={loading}
      aria-label="刪除錄音紀錄"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
      {size !== "icon" && <span>{loading ? "刪除中…" : "刪除紀錄"}</span>}
    </Button>
  );
}
