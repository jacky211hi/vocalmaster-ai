import { Sparkles, TrendingUp, Target, Waves } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DIMENSIONS,
  type VocalProfileInsight,
} from "@/lib/vocal-profile";

export function VocalProfileCard({
  insight,
}: {
  insight: VocalProfileInsight;
}) {
  return (
    <section className="mb-10 space-y-4">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-white">
          個人聲線畫像
        </h2>
        <p className="mt-1 text-sm text-white/50">
          根據你過往 {insight.sampleCount}{" "}
          次已完成分析嘅錄音分數自動整理（唔計分析中／失敗紀錄）
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1 border-amber-400/20 bg-gradient-to-br from-amber-400/10 via-white/[0.03] to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-200">
              <Sparkles className="h-5 w-5" />
              {insight.styleTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-white/70">
            <p>{insight.styleSummary}</p>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-white/40">
                <Waves className="h-3.5 w-3.5" />
                音域／曲風提示
              </p>
              <p className="text-white/75">{insight.rangeHint}</p>
            </div>
            <p className="text-xs text-white/40">
              平均總分{" "}
              <span className="font-semibold text-amber-300">
                {insight.avgTotal}
              </span>
              {insight.trendDelta !== null && (
                <>
                  {" "}
                  · 近期{" "}
                  <span
                    className={
                      insight.trendDelta >= 0
                        ? "text-emerald-300"
                        : "text-rose-300"
                    }
                  >
                    {insight.trendDelta >= 0 ? "+" : ""}
                    {insight.trendDelta}
                  </span>
                </>
              )}
            </p>
            <p className="flex items-start gap-1.5 text-xs text-white/45">
              <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {insight.trendLabel}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base text-white/80">
              六維平均表現
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {DIMENSIONS.map((d) => {
              const score = insight.averages[d.key];
              const isStrong = d.key === insight.strongest.key;
              const isWeak = d.key === insight.weakest.key;
              return (
                <div key={d.key} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/75">
                      {d.label}
                      {isStrong && (
                        <span className="ml-2 text-xs text-emerald-300">
                          強項
                        </span>
                      )}
                      {isWeak && (
                        <span className="ml-2 text-xs text-amber-200/80">
                          可加強
                        </span>
                      )}
                    </span>
                    <span className="font-semibold tabular-nums text-white">
                      {score}
                    </span>
                  </div>
                  <Progress
                    value={score}
                    indicatorClassName={
                      isStrong
                        ? "bg-gradient-to-r from-emerald-400 to-teal-300"
                        : isWeak
                          ? "bg-gradient-to-r from-amber-400 to-orange-400"
                          : undefined
                    }
                  />
                </div>
              );
            })}

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <Target className="h-4 w-4 text-amber-300" />
                下一步練習重點
              </p>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-white/65">
                {insight.focusTips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
