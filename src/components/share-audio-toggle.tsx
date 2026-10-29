"use client";

import { useState, type ReactNode } from "react";
import { Headphones, Loader2, Users } from "lucide-react";
import { useI18n } from "@/components/locale-provider";

type ShareField = "share_audio" | "share_audio_friends";

export function ShareAudioToggle({
  recordingId,
  initialSharedGlobal,
  initialSharedFriends,
  hasAudio,
}: {
  recordingId: string;
  initialSharedGlobal: boolean;
  initialSharedFriends: boolean;
  hasAudio: boolean;
}) {
  const { t } = useI18n();
  const [sharedGlobal, setSharedGlobal] = useState(initialSharedGlobal);
  const [sharedFriends, setSharedFriends] = useState(initialSharedFriends);
  const [loading, setLoading] = useState<ShareField | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(field: ShareField) {
    if (!hasAudio || loading) return;
    const next =
      field === "share_audio" ? !sharedGlobal : !sharedFriends;
    setLoading(field);
    setError(null);
    try {
      const res = await fetch(`/api/recordings/${recordingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: next }),
      });
      const data = (await res.json()) as {
        error?: string;
        share_audio?: boolean;
        share_audio_friends?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "更新失敗");
        return;
      }
      if (typeof data.share_audio === "boolean") {
        setSharedGlobal(data.share_audio);
      }
      if (typeof data.share_audio_friends === "boolean") {
        setSharedFriends(data.share_audio_friends);
      }
    } catch {
      setError("網絡錯誤，請稍後再試");
    } finally {
      setLoading(null);
    }
  }

  if (!hasAudio) {
    return <p className="text-xs text-white/40">{t("share.noAudio")}</p>;
  }

  return (
    <div className="space-y-2">
      <ShareOption
        checked={sharedFriends}
        loading={loading === "share_audio_friends"}
        disabled={Boolean(loading)}
        onToggle={() => void toggle("share_audio_friends")}
        icon={<Users className="h-4 w-4 text-sky-300" />}
        title={t("share.friends.title")}
        description={t("share.friends.desc")}
      />
      <ShareOption
        checked={sharedGlobal}
        loading={loading === "share_audio"}
        disabled={Boolean(loading)}
        onToggle={() => void toggle("share_audio")}
        icon={<Headphones className="h-4 w-4 text-amber-300" />}
        title={t("share.global.title")}
        description={t("share.global.desc")}
      />
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}

function ShareOption({
  checked,
  loading,
  disabled,
  onToggle,
  icon,
  title,
  description,
}: {
  checked: boolean;
  loading: boolean;
  disabled: boolean;
  onToggle: () => void;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-amber-400/25 hover:bg-white/[0.05]">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-amber-400"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          {icon}
          {title}
          {loading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50" />
          )}
        </span>
        <span className="mt-0.5 block text-xs text-white/45">{description}</span>
      </span>
    </label>
  );
}
