"use client";

import { FormEvent, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_AVATARS, resolveAvatarUrl } from "@/lib/avatars";
import { cn } from "@/lib/utils";

type Props = {
  email: string;
  initialUsername: string;
  initialAvatarUrl?: string | null;
};

export function ProfileForm({
  email,
  initialUsername,
  initialAvatarUrl,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? "mic");
  const [previewOverride, setPreviewOverride] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewSrc = previewOverride ?? resolveAvatarUrl(avatarUrl);

  function selectPreset(id: string) {
    setUploadFile(null);
    setPreviewOverride(null);
    setAvatarUrl(id);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("請上傳圖片檔（JPG / PNG / WebP）");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("頭像請小於 2MB");
      return;
    }
    setError(null);
    setUploadFile(file);
    setPreviewOverride(URL.createObjectURL(file));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password && password !== confirm) {
      setError("兩次輸入嘅新密碼不一致");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append("username", username.trim());
      if (password) form.append("password", password);
      if (uploadFile) {
        form.append("avatar_file", uploadFile);
      } else {
        form.append("avatar_url", avatarUrl);
      }

      const res = await fetch("/api/profile", {
        method: "PATCH",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "更新失敗");

      setPassword("");
      setConfirm("");
      setUploadFile(null);
      if (data.avatar_url) setAvatarUrl(data.avatar_url);
      setPreviewOverride(null);
      setMessage("個人資料已更新");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-3">
        <label className="text-sm text-white/70">頭像</label>
        <div className="flex items-center gap-4">
          <Image
            src={previewSrc}
            alt="目前頭像預覽"
            width={80}
            height={80}
            className="h-20 w-20 rounded-full object-cover ring-2 ring-amber-400/40"
            unoptimized={previewSrc.startsWith("blob:") || previewSrc.startsWith("http")}
          />
          <div className="space-y-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              上傳自己的頭像
            </Button>
            <p className="text-xs text-white/40">JPG / PNG / WebP，最大 2MB</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/jpg"
              className="hidden"
              onChange={onFileChange}
            />
          </div>
        </div>

        <p className="text-xs text-white/45">或選擇預設頭像：</p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {DEFAULT_AVATARS.map((a) => {
            const selected =
              !uploadFile &&
              (avatarUrl === a.id ||
                avatarUrl === a.src ||
                resolveAvatarUrl(avatarUrl) === a.src);
            return (
              <button
                key={a.id}
                type="button"
                disabled={loading}
                onClick={() => selectPreset(a.id)}
                className={cn(
                  "rounded-2xl border p-1.5 transition",
                  selected
                    ? "border-amber-400 bg-amber-400/15 ring-2 ring-amber-400/40"
                    : "border-white/10 hover:border-amber-400/40"
                )}
                title={a.label}
              >
                <Image
                  src={a.src}
                  alt={a.label}
                  width={72}
                  height={72}
                  className="aspect-square w-full rounded-xl object-cover"
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-white/70">電郵</label>
        <Input value={email} disabled className="opacity-70" />
        <p className="text-xs text-white/40">登入電郵暫時不可喺此更改</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-white/70">用戶名稱</label>
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={2}
          maxLength={32}
          disabled={loading}
          placeholder="你的顯示名稱"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-white/70">新密碼（可留空）</label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          disabled={loading}
          placeholder="至少 6 位"
          autoComplete="new-password"
        />
      </div>

      {password.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm text-white/70">確認新密碼</label>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            disabled={loading}
            placeholder="再輸入一次"
            autoComplete="new-password"
          />
        </div>
      )}

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

      <Button type="submit" disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        儲存變更
      </Button>
    </form>
  );
}
