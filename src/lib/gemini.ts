import { GoogleGenAI } from "@google/genai";
import type { Locale } from "@/lib/i18n/config";
import {
  geminiLanguageInstruction,
  geminiStructureInstruction,
} from "@/lib/i18n/gemini-locale";
import { lyricsPrompt, type LyricMatch } from "@/lib/lyrics";
import { coachPitchBrief } from "@/lib/pitch/report";
import type { PitchReport } from "@/lib/pitch/score";
import {
  parseVocalRange,
  type VocalRangeReport,
} from "@/lib/pitch/vocal-range";
import type { VocalAnalysisResult } from "@/lib/types";

function buildSystemInstruction(locale: Locale): string {
  return `You are a fair, expert vocal coach for "VocalMaster AI (AI 聲樂教練)".

## CRITICAL: score THIS clip independently (no historical anchoring)
1. Listen and grade the CURRENT audio alone first.
2. Set each dimension's score_10 100% from what you hear NOW (the app converts to 0–100 + total).
3. USER_COACH_HISTORY / ROLLING_COACH_SUMMARY must NEVER lower, raise, or "cap" scores near a past average.
4. History is ONLY allowed inside actionable_advice (progress compare / next drills). Never in scores, timed diagnosis, or six-dimension notes.

## Scoring Principle (Pure Vocal Merit — 1.0–10.0 continuous rubric)
Do NOT use artificial score ceilings, or penalize a track based on whether it is a cappella, an isolated vocal stem, a phone/home recording, karaoke, or an official master. Production context is irrelevant to the grade.

Do NOT output 0–100 timbre_score / pitch_score / total_score integers (models collapse onto template averages). For each of the 6 dimensions output:
- **score_10**: float **1.0–10.0 to one decimal place** (e.g. 6.4, 7.8, 8.9, 9.4) — continuous, not a 5-bucket severity.
- **evidence**: one concrete observation from THIS clip

Acoustic rubric for score_10 (apply per dimension independently):
- **9.0–9.8**: Studio/live master execution (rock-solid intonation, seamless mixed voice, masterful dynamics).
- **8.0–8.9**: Strong, expressive vocal with good technique and only minor micro-flaws.
- **7.0–7.9**: Pleasant voice and musicality, but audible room to improve in breath endurance, register transitions, or phrase-end pitch.
- **6.0–6.9**: Noticeable pitch drift, throat tension, or breath shortage across multiple phrases.
- **Below 6.0**: Frequent off-key notes or severe vocal breakdown.

Dimensions:
1. **pitch** 音準 — note centers + phrase-end intonation
2. **rhythm** 節奏 — timing, groove, intentional rubato
3. **phonation** 發聲 — cord closure, register transitions, no unintentional strain
4. **breath** 呼吸 — phrase endurance, long-note stability, support
5. **timbre** 音色 — resonance, warmth, consistency across registers
6. **dynamics** 力度 — contrast, micro-dynamics, expressive storytelling

The six score_10 values MUST reflect the singer's actual relative strengths and weaknesses (e.g. timbre 8.8, breath 6.2, pitch 7.1). Never flatline all dimensions to the same number. The app multiplies by 10 and averages for total.

## Recording / isolation artifacts (do NOT penalize the singer)
Phone noise, room tone, compression, slight phaseiness, metallic thinness, watery/flanged mids, or abrupt tails from vocal isolation (Demucs, UVR, etc.) or noise gates are **processing / capture artifacts**, not the singer. Do NOT lower any dimension for those. Grade the voice only.

## Soft / airy falsetto vs pressed belting (CRITICAL — listen to volume & weight)
Listen carefully to the **actual volume and vocal weight** in chorus / high phrases!
- If the singer uses a soft, light, airy head voice or falsetto (弱混聲／氣假聲／輕柔頭聲): NEVER accuse them of 「壓喉」, 「死頂」, 「用喉部肌肉去頂」, or 「氣流壓力過大／高音爆發力硬推」.
- For soft phonation, evaluate whether cord edges have enough closure (聲帶邊緣閉合) vs becoming too hollow / leaky / unstable (發虛／漏氣／飄).
- Only diagnose pressed belting / throat push when you truly hear loud, heavy, squeezed chest-dominant force — not quiet airy highs.

## Lyrics anti-hallucination (CRITICAL)
Anchor ALL quoted lyric lines to OFFICIAL_LYRICS when provided, and/or your knowledge of the official lyrics for this songTitle + artist.
- NEVER invent bizarre homophones (e.g. mishearing 好不具象→好不健康, 帶走陽光→如此冷酷).
- Do NOT critique specific lyric words unless you are ≥100% sure of the official line at that moment.
- If unsure which line is sung, write the unmatched placeholder — do not speech-recognize fake words and then coach those fakes.

## Style vs flaw + always-useful 改善點
Distinguish amateur technical faults (uncontrolled throat squeeze, running out of breath, cracked unintended breaks, chronic flat/sharp) from advanced stylistic choices (intentional raspy belt, emotional cry/sob, breathy phrase endings, controlled grit). Do NOT mark stylistic choices as amateur faults.
For EVERY timed section's improvements field: never leave blank and never paste generic empty praise. Even for 80+ singers, give **specific advanced micro-polishing advice** (進階細節雕琢)—e.g. vowel modification, micro-timing/groove tightness, consonant clarity, vibrato tail control, or resonance consistency—tied to that timestamp.

${geminiLanguageInstruction(locale)}

${geminiStructureInstruction(locale)}

## coach_summary（AI-only rolling memory — NOT shown to the user）
Short English bullet brief (max ~1200 characters) for the NEXT call only.
Merge prior ROLLING_COACH_SUMMARY with THIS session's objective outcome.
Do not use this field to justify lowering current scores.

## vocal_range（song_key ≠ user_key by default）
MUST fill vocal_range from ears + song/artist knowledge:
- song_key (original): **sounding concert key** for this track+artist when known. Never confuse guitar **指法調 / Capo shape** with concert pitch (G-shape Capo 2 still sounds A).
- If OFFICIAL_SONG_KEY is present in the user message, song_key MUST equal that value exactly (app-verified catalog). Do not substitute D/F/other guesses.
- Known anchors (when no OFFICIAL_SONG_KEY): 陳奕迅〈葡萄成熟時〉→ "G major"; 陳奕迅〈十面埋伏〉→ "C major"; 單依純〈像風一樣〉→ "A major".
- user_key (sung): estimate the **tonic of THIS take from the audio alone** (verse opening / stable phrases). **NEVER copy song_key as a shortcut.** Home / karaoke / phone covers are often transposed — different keys are normal and expected. Set user_key = song_key ONLY when you clearly hear the same tonic.
- key_shift_semitones: sung tonic − original tonic (G→A#/Bb = +3, not +1). 0 only when tonics truly match.
- lowest_note / highest_note: true sung F0 extremes — OVERRIDE DSP highs/lows when wrong.
MEASURED_VOCAL_RANGE.user_key is a soft sung-key hint only (can be noisy) — use ears first.

Return ONLY JSON (schema placeholders — fill with THIS clip's real values; do NOT copy example literals):
{"dimension_grades":{"pitch":{"score_10":"<float 1.0-10.0>","evidence":"<concrete observation>"},"rhythm":{"score_10":"<float 1.0-10.0>","evidence":"<concrete observation>"},"phonation":{"score_10":"<float 1.0-10.0>","evidence":"<concrete observation>"},"breath":{"score_10":"<float 1.0-10.0>","evidence":"<concrete observation>"},"timbre":{"score_10":"<float 1.0-10.0>","evidence":"<concrete observation>"},"dynamics":{"score_10":"<float 1.0-10.0>","evidence":"<concrete observation>"}},"detailed_feedback":"<markdown>","actionable_advice":"<markdown>","coach_summary":"<string>","vocal_range":{"lowest_note":"<note>","highest_note":"<note>","song_key":"<key or OFFICIAL_SONG_KEY>","user_key":"<sung key>","key_shift_semitones":"<int>"}}`;
}

/**
 * Ordered fallback pool. Free-tier quotas are usually per-model,
 * so when one hits RPD/RPM we switch to the next.
 *
 * Note: "Antigravity" is a Google agent product, not a generateContent
 * chat model — it cannot replace Gemini Flash for audio analysis.
 */
/** Models this project can call for audio analysis. */
const DEFAULT_MODEL_POOL = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];

function clampScore(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function parseGeminiVocalRange(raw: unknown): Partial<VocalRangeReport> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const lowest_note = r.lowest_note != null ? String(r.lowest_note).trim() : "";
  const highest_note =
    r.highest_note != null ? String(r.highest_note).trim() : "";
  const song_key = r.song_key != null ? String(r.song_key).trim() : "";
  const user_key = r.user_key != null ? String(r.user_key).trim() : "";
  const shift =
    typeof r.key_shift_semitones === "number"
      ? Math.round(r.key_shift_semitones)
      : Number.isFinite(Number(r.key_shift_semitones))
        ? Math.round(Number(r.key_shift_semitones))
        : null;
  if (!lowest_note && !highest_note && !song_key && !user_key) return null;
  return {
    version: 1,
    lowest_note: lowest_note || null,
    highest_note: highest_note || null,
    lowest_midi: null,
    highest_midi: null,
    song_key: song_key || null,
    user_key: user_key || null,
    key_shift_semitones: shift,
    source: "gemini",
  };
}

/** Convert score_10 (1.0–10.0, one decimal) → 0–100 int. */
function scoreFromTen(grade: unknown): number | null {
  if (!grade || typeof grade !== "object") return null;
  const g = grade as { score_10?: unknown; score10?: unknown };
  const raw = g.score_10 ?? g.score10;
  const v = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(v)) return null;
  // Accept 1.0–10.0; also tolerate accidental 0–100 if model slips.
  if (v > 10 && v <= 100) return clampScore(v);
  if (v < 1 || v > 10) return null;
  return clampScore(v * 10);
}

function parseAnalysis(raw: string): VocalAnalysisResult {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const data = JSON.parse(cleaned) as Partial<VocalAnalysisResult> & {
    mechanism_score?: number;
    vocal_range?: unknown;
    dimension_grades?: Record<string, unknown>;
  };
  const grades = data.dimension_grades ?? {};
  const fromTen = {
    pitch: scoreFromTen(grades.pitch),
    rhythm: scoreFromTen(grades.rhythm),
    phonation: scoreFromTen(grades.phonation),
    breath: scoreFromTen(grades.breath),
    timbre: scoreFromTen(grades.timbre),
    dynamics: scoreFromTen(grades.dynamics),
  };
  // Prefer score_10 grades; fall back to legacy int fields only if missing.
  const timbre_score = fromTen.timbre ?? clampScore(data.timbre_score);
  const phonation_score =
    fromTen.phonation ??
    clampScore(data.phonation_score ?? data.mechanism_score);
  const pitch_score = fromTen.pitch ?? clampScore(data.pitch_score);
  const breath_score = fromTen.breath ?? clampScore(data.breath_score);
  const rhythm_score = fromTen.rhythm ?? clampScore(data.rhythm_score);
  const dynamics_score =
    fromTen.dynamics ?? clampScore(data.dynamics_score);
  const total_score = clampScore(
    (timbre_score +
      phonation_score +
      pitch_score +
      breath_score +
      rhythm_score +
      dynamics_score) /
      6
  );
  return {
    total_score,
    timbre_score,
    phonation_score,
    pitch_score,
    breath_score,
    rhythm_score,
    dynamics_score,
    detailed_feedback: String(data.detailed_feedback ?? ""),
    actionable_advice: String(data.actionable_advice ?? ""),
    coach_summary: String(data.coach_summary ?? "").trim().slice(0, 2500),
    vocal_range: parseVocalRange(parseGeminiVocalRange(data.vocal_range)),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Cap each model attempt so a hung Gemini call cannot burn the full Vercel budget. */
const MODEL_CALL_TIMEOUT_MS = 70_000;

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`MODEL_TIMEOUT after ${ms}ms (${label})`));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isModelTimeoutError(err: unknown): boolean {
  return errMessage(err).includes("MODEL_TIMEOUT");
}

function isQuotaError(err: unknown): boolean {
  const msg = errMessage(err);
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    /quota/i.test(msg) ||
    /rate limit/i.test(msg)
  );
}

function isBusyError(err: unknown): boolean {
  const msg = errMessage(err);
  return (
    msg.includes("503") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("high demand") ||
    msg.includes("overloaded")
  );
}

function isMissingModelError(err: unknown): boolean {
  const msg = errMessage(err);
  return (
    msg.includes("404") ||
    msg.includes("NOT_FOUND") ||
    msg.includes("no longer available") ||
    msg.includes("is not found")
  );
}

/** Build ordered unique list: preferred → env fallbacks → defaults */
function modelCandidates(): string[] {
  const allowed = new Set(DEFAULT_MODEL_POOL);
  const preferred = process.env.GEMINI_MODEL?.trim();
  const fromEnv = (process.env.GEMINI_MODEL_FALLBACKS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((m) => allowed.has(m));

  const ordered = [
    ...(preferred && allowed.has(preferred) ? [preferred] : []),
    ...fromEnv,
    ...DEFAULT_MODEL_POOL,
  ];

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const m of ordered) {
    if (seen.has(m)) continue;
    seen.add(m);
    unique.push(m);
  }
  // Cap attempts so one user action doesn't burn entire free tier
  return unique.slice(0, 4);
}

export async function analyzeVocalAudio(params: {
  audioBase64: string;
  mimeType: string;
  songName: string;
  artist: string;
  pitchReport?: PitchReport | null;
  lyrics?: LyricMatch | null;
  coachHistory?: string | null;
  locale?: Locale;
  measuredVocalRange?: Partial<VocalRangeReport> | null;
  /** Authoritative published concert key from app catalog — must be used as song_key. */
  knownSongKey?: string | null;
}): Promise<VocalAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const locale = params.locale ?? "hk";
  const ai = new GoogleGenAI({ apiKey });
  const measured = params.pitchReport
    ? `\n${coachPitchBrief(params.pitchReport)}\n`
    : "";
  const lyrics = params.lyrics ? `\n${lyricsPrompt(params.lyrics)}\n` : "";
  const history = params.coachHistory
    ? `\n${params.coachHistory}\n`
    : "";
  const knownKey = (params.knownSongKey ?? "").trim();
  const officialSongKey = knownKey
    ? `\nOFFICIAL_SONG_KEY (authoritative catalog — you MUST set vocal_range.song_key to exactly "${knownKey}"; do not invent another original key):\n${knownKey}\n`
    : "";
  const rangeHint = params.measuredVocalRange
    ? `\nMEASURED_VOCAL_RANGE (soft hints — OVERRIDE freely; user_key is sung-key estimate only, can be noisy):\n${JSON.stringify(
        {
          lowest_note: params.measuredVocalRange.lowest_note,
          highest_note: params.measuredVocalRange.highest_note,
          user_key: params.measuredVocalRange.user_key ?? null,
        }
      )}\n`
    : "";
  const userPrompt = `Song: ${params.songName}
Artist: ${params.artist || "Unknown"}
${lyrics}${measured}${officialSongKey}${rangeHint}${history}
STEP 1 — Pure vocal merit: fill dimension_grades with score_10 (1.0–10.0, one decimal) + evidence for all six dims. Reflect real strength/weakness gaps — never flatline. No ceilings for a cappella / stem / phone / cover vs master. Soft airy falsetto ≠ 壓喉/死頂. Ignore capture/isolation artifacts.
STEP 2 — Timed sections: unique micro-polish 改善點. Soft quiet highs → evaluate 閉合 vs 發虛, never fake "pressed belt". Quote ONLY official lyrics (OFFICIAL_LYRICS / song knowledge)—never critique hallucinated words.
STEP 3 — vocal_range: song_key = OFFICIAL_SONG_KEY when provided (else published knowledge); user_key from THIS audio's sung tonic independently (NEVER copy song_key). Report real key_shift. True climax may be A4/B4.
STEP 4 — If USER_COACH_HISTORY exists: actionable_advice MUST open with ### 個人進度 / ### Personal progress (compare THIS take vs past for THIS singer), then personalised drills. Never skip. Never say "still stuck" unless THIS clip shows it. Grades/scores ignore history.
Always return coach_summary (English). Follow LANGUAGE rules (no bilingual labels).
Return the JSON evaluation.`;

  const contents = [
    {
      role: "user" as const,
      parts: [
        { text: userPrompt },
        {
          inlineData: {
            mimeType: params.mimeType,
            data: params.audioBase64,
          },
        },
      ],
    },
  ];

  const config = {
    systemInstruction: buildSystemInstruction(locale),
    responseMimeType: "application/json",
    temperature: 0.4,
  };

  const models = modelCandidates();
  const tried: string[] = [];
  const quotaHit: string[] = [];
  const busyHit: string[] = [];
  const timeoutHit: string[] = [];
  let lastError: unknown;

  for (const model of models) {
    try {
      tried.push(model);
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents,
          config,
        }),
        MODEL_CALL_TIMEOUT_MS,
        model
      );
      const text = response.text;
      if (!text) throw new Error("Gemini returned an empty response");
      console.info(`[gemini] success with model=${model}`);
      return parseAnalysis(text);
    } catch (err) {
      lastError = err;
      const msg = errMessage(err);
      console.warn(`[gemini] ${model} failed:`, msg);

      if (isModelTimeoutError(err)) {
        timeoutHit.push(model);
        continue;
      }

      if (isQuotaError(err)) {
        // This model is over limit — switch to next available model
        quotaHit.push(model);
        await sleep(200);
        continue;
      }

      if (isBusyError(err)) {
        busyHit.push(model);
        await sleep(400);
        continue;
      }

      if (isMissingModelError(err)) {
        continue;
      }

      // Unknown error — still try next model once
      continue;
    }
  }

  if (quotaHit.length > 0 && quotaHit.length === tried.length) {
    throw new Error(
      `所有試過嘅 Gemini model 今日額度都用完（${quotaHit.join("、")}）。請等每日重置或升級計劃。`
    );
  }

  if (busyHit.length > 0 || timeoutHit.length > 0) {
    throw new Error(
      `Gemini 暫時繁忙或回應太慢（已試：${tried.join(" → ")}）。請一分鐘後喺結果頁撳「重試分析」。`
    );
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(
        `Gemini 分析失敗（已試：${tried.join("、") || "無"}）`
      );
}
