import { ArrowDownUp, Music2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveVocalRangeForDisplay } from "@/lib/pitch/known-keys";
import {
  formatKeyShift,
  type AggregateVocalRange,
  type VocalRangeReport,
} from "@/lib/pitch/vocal-range";

function NotePair({
  low,
  high,
  span,
}: {
  low: string | null;
  high: string | null;
  span?: number | null;
}) {
  if (!low && !high) {
    return <p className="text-sm text-white/45">暫未量到音域</p>;
  }
  return (
    <div className="flex items-end gap-3">
      <div>
        <p className="text-xs text-white/40">最低</p>
        <p className="font-[family-name:var(--font-display)] text-3xl text-white">
          {low ?? "—"}
        </p>
      </div>
      <ArrowDownUp className="mb-2 h-4 w-4 text-amber-300/80" />
      <div>
        <p className="text-xs text-white/40">最高</p>
        <p className="font-[family-name:var(--font-display)] text-3xl text-amber-300">
          {high ?? "—"}
        </p>
      </div>
      {span != null && (
        <p className="mb-1 ml-auto text-sm text-white/45">約 {span} 個半音</p>
      )}
    </div>
  );
}

function RangeMeter({
  lowMidi,
  highMidi,
}: {
  lowMidi: number | null;
  highMidi: number | null;
}) {
  if (lowMidi == null || highMidi == null || highMidi <= lowMidi) return null;
  // Display window roughly G2–C6
  const min = 43;
  const max = 84;
  const clamp = (m: number) => Math.min(max, Math.max(min, m));
  const lo = ((clamp(lowMidi) - min) / (max - min)) * 100;
  const hi = ((clamp(highMidi) - min) / (max - min)) * 100;
  return (
    <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
      <div
        className="absolute inset-y-0 rounded-full bg-gradient-to-r from-teal-400/80 to-amber-400"
        style={{ left: `${lo}%`, width: `${Math.max(4, hi - lo)}%` }}
      />
    </div>
  );
}

export function VocalRangePanel({
  report,
  songName,
  artist,
}: {
  report: VocalRangeReport;
  songName?: string;
  artist?: string | null;
}) {
  const { report: resolved, songKeyVerified } = resolveVocalRangeForDisplay(
    report,
    songName ?? "",
    artist
  );
  const view = resolved ?? report;
  const span =
    view.lowest_midi != null && view.highest_midi != null
      ? Math.round(view.highest_midi - view.lowest_midi)
      : null;
  const shiftLabel = formatKeyShift(view.key_shift_semitones);

  return (
    <Card className="mb-6 border-teal-400/20 bg-gradient-to-br from-teal-400/10 via-white/[0.03] to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-teal-100">
          <Music2 className="h-4 w-4" />
          音域與 Key
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-white/40">
          音域取自信賴度高嘅人聲基頻；原曲 Key 優先用內建已核對曲庫（唔係結他 Capo 指法調），曲庫冇先先估計。
        </p>
        <NotePair
          low={view.lowest_note}
          high={view.highest_note}
          span={span}
        />
        <RangeMeter lowMidi={view.lowest_midi} highMidi={view.highest_midi} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs text-white/40">
              {songKeyVerified ? "原曲 Key（已核對）" : "原曲 Key（估計）"}
            </p>
            <p className="mt-1 text-lg font-semibold text-white">
              {view.song_key ?? "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs text-white/40">你唱嘅 Key（估計）</p>
            <p className="mt-1 text-lg font-semibold text-amber-200">
              {view.user_key ?? "—"}
            </p>
            {shiftLabel && (
              <p className="mt-1 text-xs text-white/45">{shiftLabel}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProfileRangeBlock({
  range,
}: {
  range: AggregateVocalRange;
}) {
  return (
    <div className="rounded-2xl border border-teal-400/20 bg-teal-400/5 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-teal-200/70">
        <Music2 className="h-3.5 w-3.5" />
        音域分析
      </p>
      <NotePair
        low={range.lowest_note}
        high={range.highest_note}
        span={range.span_semitones}
      />
      <RangeMeter lowMidi={range.lowest_midi} highMidi={range.highest_midi} />
      <p className="mt-2 text-xs text-white/45">
        根據 {range.sampleCount} 次錄音嘅最低／最高音合併
        {range.typical_user_key
          ? ` · 常見演唱 key：${range.typical_user_key}`
          : ""}
      </p>
    </div>
  );
}
