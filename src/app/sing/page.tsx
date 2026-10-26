"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { AudioCapture } from "@/components/audio-capture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

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
  const router = useRouter();
  const [songName, setSongName] = useState("");
  const [artist, setArtist] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!songName.trim()) {
      setError("請輸入歌名");
      return;
    }
    if (!audioFile) {
      setError("請先錄音或上傳音檔");
      return;
    }
    if (audioFile.size > 20 * 1024 * 1024) {
      setError("檔案請小於 20MB");
      return;
    }

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

      const ext = extForFile(audioFile);
      const mimeType = mimeForExt(ext, audioFile.type);
      uploadedPath = `${user.id}/${Date.now()}-${newId()}.${ext}`;

      setStatus(`上傳音訊中…（${(audioFile.size / 1024 / 1024).toFixed(1)} MB）`);

      // ArrayBuffer upload is more reliable on iOS Safari than File/Blob directly
      const bytes = await audioFile.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from("recordings")
        .upload(uploadedPath, bytes, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`上傳失敗：${uploadError.message}`);
      }

      setStatus("上傳完成，AI 教練分析中（可能需要 30–60 秒）…");

      const res = await fetch("/api/analyze-vocal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          song_name: songName.trim(),
          artist: artist.trim(),
          storage_path: uploadedPath,
          mime_type: mimeType,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `分析失敗（HTTP ${res.status}）`);
      }

      uploadedPath = null; // server owns cleanup / keep
      setStatus("分析完成，跳轉結果頁…");
      router.push(`/result/${data.id}`);
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
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-white">
            準備練歌
          </h1>
          <p className="mt-2 text-white/55">
            填寫歌名，錄音或上傳檔案，讓 Gemini 為你評分並生成練習建議。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>提交錄音</CardTitle>
            <CardDescription>
              建議錄 15–60 秒副歌或高音段。整首歌可以，但分析會較慢。
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                  <label className="text-sm text-white/70">歌手</label>
                  <Input
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    placeholder="例如：王力宏"
                    disabled={loading}
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
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
