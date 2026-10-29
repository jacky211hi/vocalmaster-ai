import { isAnalyzingFeedback } from "@/lib/analysis-status";
import { SCORE_DIMENSIONS } from "@/lib/score-dimensions";

export type CoachHistoryRow = {
  song_name: string;
  artist: string;
  total_score: number;
  timbre_score: number;
  phonation_score: number;
  pitch_score: number;
  breath_score: number;
  rhythm_score: number;
  dynamics_score: number;
  ai_feedback_md: string;
  actionable_advice: string;
  created_at: string;
};

const DIM_KEYS = SCORE_DIMENSIONS.map((d) => d.key);

function isComplete(row: CoachHistoryRow): boolean {
  if (isAnalyzingFeedback(row.ai_feedback_md)) return false;
  return (
    row.total_score > 0 ||
    DIM_KEYS.some((key) => (row[key as keyof CoachHistoryRow] as number) > 0)
  );
}

/** Pull ### 1. 練習名 style titles from prior advice. */
export function extractExerciseNames(advice: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const match of advice.matchAll(/^#{1,6}[ \t]*\d+\.\s*(.+)$/gm)) {
    const name = match[1].trim().replace(/\s+/g, " ").slice(0, 48);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

function scoreLine(row: CoachHistoryRow): string {
  const parts = SCORE_DIMENSIONS.map((d) => `${d.short}=${row[d.key]}`).join(
    " "
  );
  return `total=${row.total_score} ${parts}`;
}

/** Average the weakest 1–2 dimensions across recent rows (for personal advice). */
export function recurringWeakDims(
  rows: CoachHistoryRow[],
  topN = 2
): string[] {
  const totals = new Map<string, { sum: number; n: number; short: string }>();
  for (const dim of SCORE_DIMENSIONS) {
    totals.set(dim.key, { sum: 0, n: 0, short: dim.short });
  }
  for (const row of rows) {
    for (const dim of SCORE_DIMENSIONS) {
      const v = row[dim.key] as number;
      if (typeof v !== "number" || v <= 0) continue;
      const slot = totals.get(dim.key)!;
      slot.sum += v;
      slot.n += 1;
    }
  }
  return [...totals.entries()]
    .filter(([, s]) => s.n > 0)
    .map(([key, s]) => ({
      key,
      short: s.short,
      avg: s.sum / s.n,
    }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, topN)
    .map((d) => `${d.short}(avg~${Math.round(d.avg)})`);
}

/**
 * Slim history for Gemini: rolling coach_summary + last 1–2 score snapshots.
 * Avoids re-sending full past reports/advice bodies.
 */
export function coachHistoryPrompt(
  rows: CoachHistoryRow[],
  opts?: { rollingSummary?: string | null; recentLimit?: number }
): string | null {
  const rolling = (opts?.rollingSummary ?? "").trim();
  const done = rows.filter(isComplete);
  const recentLimit = opts?.recentLimit ?? 2;
  const recent = [...done]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, recentLimit);

  if (!rolling && recent.length === 0) return null;

  const sessionLines = recent.map((row, i) => {
    const day = row.created_at.slice(0, 10);
    const drills = extractExerciseNames(row.actionable_advice || "");
    return [
      `${i + 1}. ${day} 〈${row.song_name}〉 ${row.artist || "未知"} · ${scoreLine(row)}`,
      drills.length
        ? `   Prior exercises: ${drills.join("；")}`
        : "   Prior exercises: (none listed)",
    ].join("\n");
  });

  const priorExercises = [
    ...new Set(
      recent.flatMap((r) => extractExerciseNames(r.actionable_advice || ""))
    ),
  ].slice(0, 8);
  const weak = recurringWeakDims(recent.length ? recent : done, 2);
  const latest = recent[0];
  const previous = recent[1];
  const trend =
    latest && previous
      ? `Latest total ${latest.total_score} vs previous ${previous.total_score} (${
          latest.total_score - previous.total_score >= 3
            ? "up"
            : previous.total_score - latest.total_score >= 3
              ? "down"
              : "flat"
        }).`
      : latest
        ? `Latest total ${latest.total_score} (only one prior snapshot).`
        : null;

  return [
    "USER_COACH_HISTORY (ADVICE ONLY — never for scores or timed diagnosis):",
    "CRITICAL: Grade total_score + six dimensions + detailed_feedback from THIS audio alone.",
    "Do NOT anchor near past scores. A 90+ take must score 90+ even if past takes were ~60–75.",
    rolling
      ? [
          "ROLLING_COACH_SUMMARY (personal long-term memory for advice + coach_summary update):",
          rolling.slice(0, 2500),
        ].join("\n")
      : "ROLLING_COACH_SUMMARY: (none).",
    recent.length
      ? `Recent score snapshots (advice context only, max ${recentLimit}):\n${sessionLines.join("\n")}`
      : "Recent score snapshots: none.",
    weak.length
      ? `Recurring weaker dims for THIS singer (from recent snapshots): ${weak.join(", ")}.`
      : null,
    trend,
    priorExercises.length
      ? `Recent exercise titles — evolve or escalate; do not copy-paste the same title unless THIS clip shows the same fault: ${priorExercises.join("；")}`
      : null,
    "REQUIRED in actionable_advice when any history above exists:",
    "1) Start with heading ### 個人進度 (or ### Personal progress / ### 個人進度對比) — 2–4 sentences naming THIS singer's pattern, comparing THIS take vs latest snapshot (cite song + totals/dims), and what to focus next.",
    "2) Then 2–4 drill ### headings tailored to THIS clip's faults AND the recurring weak dims above.",
    "3) Never claim still-stuck unless THIS clip clearly shows the same fault.",
    "4) Update coach_summary from THIS session's objective outcome.",
  ]
    .filter(Boolean)
    .join("\n");
}
