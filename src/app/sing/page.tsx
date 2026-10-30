"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { AudioCapture } from "@/components/audio-capture";
import { ExerciseSession } from "@/components/exercise-session";
import { Button } from "@/components/ui/button";
import type { ExerciseId } from "@/lib/pitch/exercises";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/locale-provider";
import { measureVocalRangeFromFile } from "@/lib/pitch/vocal-range";

function extForFile(file: File): string {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  if (name.endsWith(".mp3") || type.includes("mpeg")) return "mp3";
  if (
    name.endsWith(".m4a") ||
    name.endsWith(".mp4") ||
    type.includes("mp4") ||
    type.includes("m4a") ||
    type.includes("aac")
  )
    return "m4a";
  if (name.endsWith(".wav") || type.includes("wav")) return "wav";
  if (name.endsWith(".ogg") || type.includes("ogg")) return "ogg";
  if (name.endsWith(".webm") || type.includes("webm")) return "webm";
  // iPhone Safari often records as mp4/m4a with empty type
  return "m4a";
}

function mimeForExt(ext: string, fileType: string): string {
  if (fileType && fileType !== "application/octet-stream") return fileType;
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "m4a") return "audio/mp4";
  if (ext === "wav") return "audio/wav";
  if (ext === "ogg") return "audio/ogg";
  if (ext === "webm") return "audio/webm";
  return "audio/mp4";
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (
    /did not match the expected pattern/i.test(msg) ||
    /string did not match/i.test(msg)
  ) {
    return "上傳失敗（常見於 iPhone／大檔案）。請用較短錄音（建議 1 分鐘內）再試一次。";
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
    return "網絡中斷或上傳超時，請檢查 Wi‑Fi／流動數據後再試。";
  }
  if (/Payload Too Large|413|body.*limit/i.test(msg)) {
    return "檔案太大。請上傳較短錄音（建議少於 4MB／約 1 分鐘）。";
  }
  return msg || "分析失敗，請稍後再試";
}

export default function SingPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [songName, setSongName] = useState("");
  const [artist, setArtist] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [mode, setMode] = useState<"exercise" | "free">("free");
  const submittingRef = useRef(false);

  async function uploadRecording(opts: {
    file: File;
    songName: string;
    artist: string;
    exerciseId?: ExerciseId;
    tonicMidi?: number;
  }) {
    if (submittingRef.current) return;
    setError(null);
    if (!opts.songName.trim()) {
      setError("請輸入歌名");
      return;
    }
    if (!opts.artist.trim()) {
      setError("請輸入歌手");
      return;
    }
    if (opts.file.size > 20 * 1024 * 1024) {
      setError("檔案請小於 20MB");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    let uploadedPath: string | null = null;

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("請先登入再提交");
      }

      const ext = extForFile(opts.file);
      const mimeType = mimeForExt(ext, opts.file.type);
      uploadedPath = `${user.id}/${Date.now()}-${newId()}.${ext}`;

      setStatus(`上傳音訊中…（${(opts.file.size / 1024 / 1024).toFixed(1)} MB）`);

      // ArrayBuffer upload is more reliable on iOS Safari than File/Blob directly
      const bytes = await opts.file.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from("recordings")
        .upload(uploadedPath, bytes, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`上傳失敗：${uploadError.message}`);
      }

      setStatus(
        opts.exerciseId ? "計算音準並建立分析…" : "量度音域並建立分析…"
      );

      let vocalRange = null;
      if (!opts.exerciseId) {
        try {
          vocalRange = await measureVocalRangeFromFile(opts.file);
        } catch {
          vocalRange = null;
        }
      }

      const res = await fetch("/api/analyze-vocal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          song_name: opts.songName.trim(),
          artist: opts.artist.trim(),
          storage_path: uploadedPath,
          mime_type: mimeType,
          exercise_id: opts.exerciseId,
          tonic_midi: opts.tonicMidi,
          ...(vocalRange ? { vocal_range: vocalRange } : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `建立失敗（HTTP ${res.status}）`);
      }

      uploadedPath = null; // server owns cleanup / keep
      setStatus("跳轉結果頁，AI 將開始分析…");
      router.push(`/result/${data.id}`);
      // Keep loading=true until this page unmounts — avoid flash of
      // "提交並分析" that could double-submit during navigation.
      return;
    } catch (err) {
      if (uploadedPath) {
        try {
          const supabase = createClient();
          await supabase.storage.from("recordings").remove([uploadedPath]);
        } catch {
          // ignore
        }
      }
      setError(friendlyError(err));
      setStatus(null);
      submittingRef.current = false;
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading || submittingRef.current) return;
    if (!audioFile) {
      setError("請先錄音或上傳音檔");
      return;
    }
    void uploadRecording({
      file: audioFile,
      songName,
      artist,
    });
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-white">
            {t("sing.title")}
          </h1>
          <p className="mt-2 text-white/55">{t("sing.desc")}</p>
        </div>

        <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-black/30 p-1">
          <button
            type="button"
            disabled={loading}
            onClick={() => setMode("free")}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium",
              mode === "free" ? "bg-amber-400 text-slate-950" : "text-white/60"
            )}
          >
            {t("sing.mode.free")}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => setMode("exercise")}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium",
              mode === "exercise"
                ? "bg-amber-400 text-slate-950"
                : "text-white/60"
            )}
          >
            {t("sing.mode.exercise")}
          </button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {mode === "exercise" ? t("sing.card.exercise") : t("sing.card.free")}
            </CardTitle>
            <CardDescription>
              {mode === "exercise"
                ? t("sing.desc.exercise")
                : t("sing.desc.free")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "exercise" ? (
              <ExerciseSession disabled={loading} />
            ) : (
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm text-white/70">歌名 *</label>
                  <Input
                    value={songName}
                    onChange={(e) => setSongName(e.target.value)}
                    placeholder="例如：第一次愛的人"
                    disabled={loading}
                    required
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm text-white/70">歌手 *</label>
                  <Input
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    placeholder="例如：陳奕迅"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <AudioCapture onAudioReady={setAudioFile} disabled={loading} />

              {error && (
                <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
                  {error}
                </p>
              )}
              {status && (
                <p className="flex items-center gap-2 rounded-xl bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {status}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    處理中…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    提交並分析
                  </>
                )}
              </Button>
            </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
