import { PitchChart } from "@/components/pitch-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/pitch/notes";
import type { PitchReport } from "@/lib/pitch/score";

function onsetText(lag: number | null, lateMs: number): string {
  if (lag == null) return "未唱中";
  if (lag > lateMs) return `遲 ${lag} ms`;
  if (lag < -80) return `早 ${-lag} ms`;
  return "入拍";
}

export function PitchReportPanel({ report }: { report: PitchReport }) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>實測音準 · {report.exerciseName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="音準" value={`${report.pitchScore}`} />
          <Stat label="節奏" value={`${report.rhythmScore}`} />
          <Stat
            label="平均偏離"
            value={
              report.meanAbsCents == null ? "—" : `${report.meanAbsCents} 音分`
            }
          />
          <Stat
            label="入拍"
            value={`${report.notesOnTime}/${report.noteCount}`}
          />
        </div>
        <PitchChart
          duration={report.duration}
          windows={report.windows}
          trace={report.trace}
        />
        <p className="text-xs text-white/45">
          綠色係目標音 ±{report.centsTolerance} 音分。琥珀色係你嘅音高。音準分計唱窗入面唱中嘅時間，無聲當唔中。節奏分計提示完結後{" "}
          {report.onsetLateMs / 1000} 秒內唱中嘅音。
        </p>
        <ul className="divide-y divide-white/10 text-sm">
          {report.notes.map((note, i) => (
            <li
              key={`${note.label}-${i}`}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-white/75"
            >
              <span>{note.label}</span>
              <span className="text-white/50">
                命中 {Math.round(note.hitRatio * 100)}%
                {" · "}
                {note.meanCents == null ? "無聲" : formatCents(note.meanCents)}
                {" · "}
                {onsetText(note.onsetLagMs, report.onsetLateMs)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-xs text-white/45">{label}</p>
      <p className="font-[family-name:var(--font-display)] text-2xl text-amber-200">
        {value}
      </p>
    </div>
  );
}
