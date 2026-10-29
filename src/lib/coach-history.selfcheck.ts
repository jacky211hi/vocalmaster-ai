import {
  coachHistoryPrompt,
  extractExerciseNames,
  type CoachHistoryRow,
} from "./coach-history";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const names = extractExerciseNames(`### 1. 唇震音（Lip Trill）氣息線條練習
- **點做**：x
### 2. 歎氣式「Ma」音
- **點做**：y
## ignored
`);
assert(names.length === 2, "extract two exercises");
assert(names[0].includes("唇震"), "first exercise");

const rows: CoachHistoryRow[] = [
  {
    song_name: "像風一樣",
    artist: "單依純",
    total_score: 70,
    timbre_score: 75,
    phonation_score: 68,
    pitch_score: 72,
    breath_score: 60,
    rhythm_score: 80,
    dynamics_score: 65,
    ai_feedback_md: "## 亮點與風險\n- 風險：氣息不足",
    actionable_advice: "### 1. 唇震音\n- **點做**：brr",
    created_at: "2026-10-28T12:00:00Z",
  },
  {
    song_name: "大個女",
    artist: "陳奕迅",
    total_score: 65,
    timbre_score: 70,
    phonation_score: 62,
    pitch_score: 64,
    breath_score: 55,
    rhythm_score: 78,
    dynamics_score: 61,
    ai_feedback_md: "## 亮點與風險\n- 風險：喉位偏高",
    actionable_advice: "### 1. 歎氣式 Ma\n### 2. 強弱對比",
    created_at: "2026-10-20T12:00:00Z",
  },
];

const withSummary = coachHistoryPrompt(rows, {
  rollingSummary:
    "Stuck on breath support. Last drills: lip trill. Avoid repeating lip trill title.",
});
assert(withSummary?.includes("ROLLING_COACH_SUMMARY"), "rolling header");
assert(withSummary!.includes("ADVICE ONLY"), "history advice-only banner");
assert(withSummary!.includes("Stuck on breath"), "includes summary");
assert(withSummary!.includes("像風一樣"), "includes recent song");
assert(!withSummary!.includes("喉位偏高"), "does not dump old risk prose");

const bootstrap = coachHistoryPrompt(rows);
assert(bootstrap?.includes("ROLLING_COACH_SUMMARY: (none)"), "bootstrap without summary");

assert(coachHistoryPrompt([]) == null, "empty history");

console.log("coach-history ok");
