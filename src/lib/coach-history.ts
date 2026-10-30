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

/** Weakest dim labels for a row — names only, no numeric scores (avoids 83-echo). */
function weakDimNames(row: CoachHistoryRow, topN = 2): string[] {
  return SCORE_DIMENSIONS.map((d) => ({
    short: d.short,
    score: row[d.key] as number,
  }))
    .filter((d) => typeof d.score === "number" && d.score > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, topN)
    .map((d) => d.short);
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
    .map((d) => d.short); // names only — never leak avg numbers into the prompt
}

function qualitativeTrend(
  latest: CoachHistoryRow,
  previous: CoachHistoryRow | undefined
): string | null {
  if (!previous) return `Most recent session: 〈${latest.song_name}〉.`;
  const delta = latest.total_score - previous.total_score;
  const label =
    delta >= 3 ? "improved vs prior session" : delta <= -3 ? "dipped vs prior session" : "similar overall vs prior session";
  return `Most recent 〈${latest.song_name}〉 was ${label} relative to 〈${previous.song_name}〉 (qualitative only — no score numbers).`;
}

/**
 * Slim history for Gemini: rolling coach_summary + last sessions WITHOUT numeric scores.
 * Exact totals/dims in the prompt cause models to echo ~83.
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
    const weak = weakDimNames(row, 2);
    return [
      `${i + 1}. ${day} 〈${row.song_name}〉 ${row.artist || "未知"}`,
      weak.length ? `   Weaker dims then: ${weak.join("、")}` : null,
      drills.length
        ? `   Prior exercises: ${drills.join("；")}`
        : "   Prior exercises: (none listed)",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const priorExercises = [
    ...new Set(
      recent.flatMap((r) => extractExerciseNames(r.actionable_advice || ""))
    ),
  ].slice(0, 8);
  const weak = recurringWeakDims(recent.length ? recent : done, 2);
  const trend = recent[0]
    ? qualitativeTrend(recent[0], recent[1])
    : null;

  return [
    "USER_COACH_HISTORY (ADVICE ONLY — never for scores or timed diagnosis):",
    "CRITICAL: Grade THIS audio alone. History has NO score numbers on purpose — do not invent or echo past totals.",
    rolling
      ? [
          "ROLLING_COACH_SUMMARY (personal long-term memory for advice + coach_summary update):",
          rolling.slice(0, 2500),
        ].join("\n")
      : "ROLLING_COACH_SUMMARY: (none).",
    recent.length
      ? `Recent sessions (advice context only, max ${recentLimit}):\n${sessionLines.join("\n")}`
      : "Recent sessions: none.",
    weak.length
      ? `Recurring weaker dims for THIS singer: ${weak.join("、")}.`
      : null,
    trend,
    priorExercises.length
      ? `Recent exercise titles — evolve or escalate; do not copy-paste the same title unless THIS clip shows the same fault: ${priorExercises.join("；")}`
      : null,
    "REQUIRED in actionable_advice when any history above exists:",
    "1) Start with heading ### 個人進度 (or ### Personal progress / ### 個人進度對比) — 2–4 sentences naming THIS singer's pattern, comparing THIS take vs latest session by song + which dims feel stronger/weaker (no fabricated past score numbers), and what to focus next.",
    "2) Then 2–4 drill ### headings tailored to THIS clip's faults AND the recurring weak dims above.",
    "3) Never claim still-stuck unless THIS clip clearly shows the same fault.",
    "4) Update coach_summary from THIS session's objective outcome.",
  ]
    .filter(Boolean)
    .join("\n");
}
