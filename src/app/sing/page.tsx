"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { AudioCapture } from "@/components/audio-capture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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

    setLoading(true);
    setStatus("上傳音訊並交俾 AI 教練分析中…");

    try {
      const form = new FormData();
      form.append("song_name", songName.trim());
      form.append("artist", artist.trim());
      form.append("audio", audioFile);

      const res = await fetch("/api/analyze-vocal", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "分析失敗");
      }
      setStatus("分析完成，跳轉結果頁…");
      router.push(`/result/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失敗");
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
              建議錄 15–60 秒副歌或高音段，效果最好。
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

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI 分析中…
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
