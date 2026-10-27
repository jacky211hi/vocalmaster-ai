"use client";

import { useState } from "react";
import { Headphones, Loader2 } from "lucide-react";

export function ShareAudioToggle({
  recordingId,
  initialShared,
  hasAudio,
}: {
  recordingId: string;
  initialShared: boolean;
  hasAudio: boolean;
}) {
  const [shared, setShared] = useState(initialShared);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (!hasAudio || loading) return;
    const next = !shared;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recordings/${recordingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ share_audio: next }),
      });
      const data = (await res.json()) as { error?: string; share_audio?: boolean };
      if (!res.ok) {
        setError(data.error ?? "更新失敗");
        return;
      }
      setShared(Boolean(data.share_audio));
    } catch {
      setError("網絡錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  if (!hasAudio) {
    return (
      <p className="text-xs text-white/40">
        未保存音檔（非個人 Top 10），無法分享音樂到排行榜。
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-amber-400/25 hover:bg-white/[0.05]">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-amber-400"
          checked={shared}
          disabled={loading}
          onChange={toggle}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <Headphones className="h-4 w-4 text-amber-300" />
            分享音樂檔到全球排行榜
            {loading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50" />
            )}
          </span>
          <span className="mt-0.5 block text-xs text-white/45">
            開啟後，其他人喺排行榜／結果頁可以收聽你呢次錄音。關閉則只顯示分數同報告。
          </span>
        </span>
      </label>
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}
