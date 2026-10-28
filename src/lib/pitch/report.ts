import { isExerciseId } from "@/lib/pitch/exercises";
import { formatCents } from "@/lib/pitch/notes";
import type { PitchReport } from "@/lib/pitch/score";

export function parsePitchReport(value: unknown): PitchReport | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Partial<PitchReport>;
  if (r.version !== 1) return null;
  if (typeof r.exerciseId !== "string" || !isExerciseId(r.exerciseId)) return null;
  if (typeof r.pitchScore !== "number" || typeof r.rhythmScore !== "number") return null;
  if (!Array.isArray(r.notes) || !Array.isArray(r.trace) || !Array.isArray(r.windows)) {
    return null;
  }
  return r as PitchReport;
}

export function measuredMarkdown(report: PitchReport): string {
  const abs =
    report.meanAbsCents == null ? "無聲" : `${report.meanAbsCents} 音分`;
  return [
    "## 實測（音高演算法）",
    `- 音準 ${report.pitchScore}／100：唱窗入面 ${report.pitchScore}% 時間喺目標 ±${report.centsTolerance} 音分（無聲計為唔中）。`,
    `- 節奏 ${report.rhythmScore}／100：${report.noteCount} 粒音有 ${report.notesOnTime} 粒喺提示結束後 ${report.onsetLateMs / 1000} 秒內唱中。`,
    `- 有聲時間 ${Math.round(report.coverage * 100)}%，有聲片段平均偏離 ${abs}。`,
    "",
  ].join("\n");
}

export function coachPitchBrief(report: PitchReport): string {
  const lines = report.notes.map((note) => {
    const hit = Math.round(note.hitRatio * 100);
    const cents =
      note.meanCents == null ? "沒有穩定音高" : formatCents(note.meanCents);
    const onset =
      note.onsetLagMs == null
        ? "沒有唱中"
        : note.onsetLagMs > report.onsetLateMs
          ? `入拍遲 ${note.onsetLagMs}ms`
          : `入拍 ${note.onsetLagMs}ms`;
    return `- ${note.label}：命中 ${hit}%（${cents}），${onset}`;
  });
  return [
    "Measured pitch (ground truth from a pitch tracker; do not replace these numbers):",
    `pitch_score MUST be ${report.pitchScore}.`,
    `rhythm_score MUST be ${report.rhythmScore}.`,
    `Rule: a frame counts as in-tune only when |cents| <= ${report.centsTolerance}. Silence counts as a miss.`,
    `Rhythm: a note is on time when the first in-tune frame is within ${report.onsetLateMs}ms after the sing window opens.`,
    ...lines,
    "Still listen for timbre, phonation, breath support, and dynamics.",
    "In detailed_feedback, explain the weak notes above. Do not invent a different pitch percentage.",
  ].join("\n");
}
