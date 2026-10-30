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
    total_score: 83,
    timbre_score: 85,
    phonation_score: 82,
    pitch_score: 80,
    breath_score: 78,
    rhythm_score: 84,
    dynamics_score: 81,
    ai_feedback_md: "## 亮點與風險\n- 風險：氣息不足",
    actionable_advice: "### 1. 唇震音\n- **點做**：brr",
    created_at: "2026-10-28T12:00:00Z",
  },
  {
    song_name: "大個女",
    artist: "陳奕迅",
    total_score: 83,
    timbre_score: 84,
    phonation_score: 82,
    pitch_score: 81,
    breath_score: 79,
    rhythm_score: 83,
    dynamics_score: 80,
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
assert(withSummary!.includes("### 個人進度"), "requires personal progress heading");
assert(withSummary!.includes("Recurring weaker dims"), "weak dims line");
assert(!withSummary!.includes("喉位偏高"), "does not dump old risk prose");
// Must not leak numeric scores that models echo as ~83
assert(!/\btotal\s*=\s*\d/.test(withSummary!), "no total=N");
assert(!withSummary!.includes("83"), "no literal 83 in history prompt");
assert(!withSummary!.includes("avg~"), "no avg~ leak");

const bootstrap = coachHistoryPrompt(rows);
assert(bootstrap?.includes("ROLLING_COACH_SUMMARY: (none)"), "bootstrap without summary");
assert(bootstrap!.includes("### 個人進度"), "bootstrap still requires progress");
assert(!bootstrap!.includes("83"), "bootstrap no 83");

assert(coachHistoryPrompt([]) == null, "empty history");

console.log("coach-history ok");
