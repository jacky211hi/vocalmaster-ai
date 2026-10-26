"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function AnalysisRunner({ recordingId }: { recordingId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(true);

  async function runAnalysis() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze-vocal/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recordingId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error ||
            (res.status === 504
              ? "分析逾時（伺服器限制約 60 秒）。請用較短錄音再試。"
              : `分析失敗（HTTP ${res.status}）`)
        );
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失敗");
      setRunning(false);
    }
  }

  useEffect(() => {
    void runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingId]);

  return (
    <Card className="mb-6 border-amber-400/30 bg-amber-400/10">
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        {running ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
            <div>
              <p className="font-semibold text-white">AI 教練分析中…</p>
              <p className="mt-1 text-sm text-white/55">
                通常 20–60 秒。請唔好關閉頁面。
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-rose-200">{error}</p>
            <Button type="button" onClick={() => void runAnalysis()}>
              <RefreshCw className="h-4 w-4" />
              重試分析
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
