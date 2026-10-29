import { isAnalyzingFeedback } from "@/lib/analysis-status";
import { SCORE_DIMENSIONS, type DimensionKey } from "@/lib/score-dimensions";

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

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function isComplete(row: CoachHistoryRow): boolean {
  if (isAnalyzingFeedback(row.ai_feedback_md)) return false;
  return (
    row.total_score > 0 ||
    DIM_KEYS.some((key) => (row[key] as number) > 0)
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

function riskSnippet(feedback: string): string {
  const cleaned = feedback
    .replace(/^歌詞對照：.*\n+/m, "")
    .replace(/^未搵到正式歌詞[^\n]*\n+/m, "")
    .replace(/^##\s*本地音高量測[\s\S]*?(?=^##\s)/m, "")
    .trim();
  const risk = cleaned.match(
    /##\s*亮點與風險[\s\S]*?(?=^##\s|$)/m
  )?.[0];
  const source = (risk || cleaned).replace(/\s+/g, " ").trim();
  return source.slice(0, 180);
}

function scoreLine(row: CoachHistoryRow): string {
  const parts = SCORE_DIMENSIONS.map(
    (d) => `${d.short}=${row[d.key]}`
  ).join(" ");
  return `total=${row.total_score} ${parts}`;
}

function averages(rows: CoachHistoryRow[]): Record<DimensionKey, number> {
  return {
    timbre_score: avg(rows.map((r) => r.timbre_score)),
    phonation_score: avg(rows.map((r) => r.phonation_score)),
    pitch_score: avg(rows.map((r) => r.pitch_score)),
    breath_score: avg(rows.map((r) => r.breath_score)),
    rhythm_score: avg(rows.map((r) => r.rhythm_score)),
    dynamics_score: avg(rows.map((r) => r.dynamics_score)),
  };
}

function dimTrend(
  older: CoachHistoryRow[],
  newer: CoachHistoryRow[]
): string[] {
  if (older.length === 0 || newer.length === 0) return [];
  const a = averages(older);
  const b = averages(newer);
  return SCORE_DIMENSIONS.map((d) => {
    const delta = b[d.key] - a[d.key];
    const sign = delta > 0 ? "+" : "";
    return `${d.short} ${a[d.key]}→${b[d.key]} (${sign}${delta})`;
  });
}

/**
 * Compact history block for Gemini: past scores, prior drills, progress hints.
 * Keep short — this rides with every audio analysis call.
 */
export function coachHistoryPrompt(
  rows: CoachHistoryRow[],
  opts?: { limit?: number }
): string | null {
  const done = rows.filter(isComplete);
  if (done.length === 0) return null;

  const limit = opts?.limit ?? 6;
  const sorted = [...done].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const recent = sorted.slice(0, limit);
  const older = sorted.slice(limit);
  const means = averages(done);
  const meanLine = SCORE_DIMENSIONS.map(
    (d) => `${d.short}=${means[d.key]}`
  ).join(" ");
  const ranked = [...SCORE_DIMENSIONS].sort(
    (a, b) => means[b.key] - means[a.key]
  );
  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];

  const priorExercises = recent.flatMap((r) =>
    extractExerciseNames(r.actionable_advice || "")
  );
  const uniqueExercises = [...new Set(priorExercises)].slice(0, 12);

  const mid = Math.ceil(recent.length / 2);
  const newerHalf = recent.slice(0, mid);
  const olderHalf = recent.slice(mid);
  const trendLines =
    olderHalf.length > 0
      ? dimTrend(olderHalf, newerHalf)
      : older.length > 0
        ? dimTrend(older, recent)
        : [];

  const sessionLines = recent.map((row, i) => {
    const day = row.created_at.slice(0, 10);
    const drills = extractExerciseNames(row.actionable_advice || "");
    const risk = riskSnippet(row.ai_feedback_md || "");
    return [
      `${i + 1}. ${day} 〈${row.song_name}〉 ${row.artist || "未知"} · ${scoreLine(row)}`,
      drills.length
        ? `   Prior exercises: ${drills.join("；")}`
        : "   Prior exercises: (none listed)",
      risk ? `   Focus then: ${risk}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    "USER_COACH_HISTORY (this singer's past analyses — personalize advice; do NOT ignore):",
    `Sessions on file: ${done.length} (showing newest ${recent.length})`,
    `Career averages: ${meanLine}`,
    `Usually strongest: ${strongest.short} (${means[strongest.key]}). Usually weakest: ${weakest.short} (${means[weakest.key]}).`,
    trendLines.length
      ? `Recent dimension drift (older→newer in this window): ${trendLines.join("; ")}`
      : "Recent dimension drift: not enough sessions yet.",
    uniqueExercises.length
      ? `Exercises already assigned recently (avoid repeating titles unless the same weakness did NOT improve — then escalate with a harder/different drill): ${uniqueExercises.join("；")}`
      : "No prior exercise titles on file.",
    "Chronology (newest first):",
    ...sessionLines,
    "Coaching rules from history:",
    "- If a weak dimension improved vs earlier sessions, briefly acknowledge progress and target another remaining weakness.",
    "- If the same weakness persists after prior drills, do NOT recycle the same exercise name; prescribe a progression, variation, or different method aimed at that stuck issue.",
    "- Tie drills to THIS clip's weak moments, but bias priority using the user's recurring weak dimensions.",
  ].join("\n");
}
