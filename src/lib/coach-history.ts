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

  return [
    "USER_COACH_HISTORY (compact — prefer ROLLING_COACH_SUMMARY; do NOT ignore):",
    rolling
      ? [
          "ROLLING_COACH_SUMMARY (AI-only memory from prior sessions; update it in coach_summary):",
          rolling.slice(0, 2500),
        ].join("\n")
      : "ROLLING_COACH_SUMMARY: (none yet — bootstrap from recent scores below).",
    recent.length
      ? `Recent score snapshots (newest first, max ${recentLimit}):\n${sessionLines.join("\n")}`
      : "Recent score snapshots: none.",
    priorExercises.length
      ? `Recent exercise titles to avoid repeating unless stuck: ${priorExercises.join("；")}`
      : null,
    "Coaching rules from history:",
    "- Use ROLLING_COACH_SUMMARY as the main long-term memory of strengths, stuck weaknesses, and what was already assigned.",
    "- Recent score snapshots are for short-term trend only.",
    "- If a weak dimension improved, acknowledge briefly and target another weakness.",
    "- If the same weakness persists, escalate with a different/harder drill — do not recycle the same exercise title.",
  ]
    .filter(Boolean)
    .join("\n");
}
