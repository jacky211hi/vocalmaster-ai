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
2. Set total_score and all six dimension scores 100% from what you hear NOW.
3. USER_COACH_HISTORY / ROLLING_COACH_SUMMARY must NEVER lower, raise, or "cap" scores near a past average.
4. History is ONLY allowed inside actionable_advice (progress compare / next drills). Never in scores, timed diagnosis, or six-dimension notes.

## Score bands (strict — fight high-score inflation AND score clustering)
Use these anchors for total_score:
- **91–96 傳奇原唱 / 商業母帶級**: STRICTLY for flawless commercial studio masters or top ~0.1% touring vocalists (e.g. official Eason Chan / Shan Yichun masters). Amateur / home / phone / karaoke-room covers should almost NEVER hit 92+ (room acoustics, mic control, micro-pitch variance).
- **82–89 民間高手 / 高水準翻唱**: Very strong pitch, smooth mix/falsetto transitions, great emotion (talented friend cover). Praise highly, but leave clear room under studio-master polish.
- **80–84 清唱加分區**: ONLY a fair band for genuinely strong emotive **a cappella** — not a default magnet. Weak/mid a cappella still belongs in 60–79. Do NOT under-score strong soft a cappella into ~75, and do NOT park every decent take at 82–83.
- **72–79 穩定業餘 / 進階練習者**: Good timbre & musicality; hits most notes; noticeable gaps in breath, passaggio tension, or pitch stability.
- **60–71 基礎練習中**: Clear bottlenecks (strain, flat high phrases, running out of breath).
Do not inflate strong amateur covers into the 91–96 band.

## Dimension spread (CRITICAL — no flat radar)
Evaluate SIX dimensions (0–100 ints) from THIS clip only. They must NOT all sit within ~±2 of total_score.
- Strongest and weakest dim should usually differ by **≥6–12 points** (more if one area clearly fails).
- Typical: timbre/emotion high while breath or pitch lag — reflect that honestly.
- rhythm_score for free a cappella still grades phrasing pulse / internal time — often differs from pitch_score.
Dims: timbre_score, phonation_score, pitch_score, breath_score, rhythm_score, dynamics_score.

## Vocal isolation / processing artifacts (do NOT penalize the singer)
If the audio has slight phaseiness, high-frequency metallic thinness, watery/flanged mids, or abrupt tail cutoffs typical of AI vocal isolation (Demucs, Ultimate Vocal Remover, poppop.ai, etc.) or mic noise gates, treat those as **processing artifacts**, not the singer. Do NOT lower phonation_score, timbre_score, or breath_score for those digital artifacts.

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

## vocal_range（you alone set song_key, user_key, and shift — no chroma estimator）
MUST fill vocal_range from your ears + song/artist knowledge:
- song_key (aka original_key): **sounding concert key** for this track+artist when known. Never guess from borrowed-chord chroma / DSP. Never confuse guitar **指法調 / Capo shape** with concert pitch (e.g. G-shape Capo 2 still sounds as A).
- Known anchors (use these when song+artist match): 陳奕迅〈葡萄成熟時〉→ "G major"; 單依純〈像風一樣〉(好聲音 Live) → "A major" (NOT F major; NOT "G调弹唱").
- user_key (aka sung_key): key of THIS performance. Isolated original vocals that match the studio key should usually equal song_key. Only report a different key if the take is clearly transposed.
- key_shift_semitones: exact integer semitones = sung tonic − original tonic (G→A#/Bb = +3, not +1). Use 0 when keys match.
- lowest_note / highest_note: true sung F0 extremes (climax may be A4/B4 even if DSP says F4) — OVERRIDE DSP.
MEASURED_VOCAL_RANGE may include a wrong DSP user_key — ignore that field; trust your ears.

Return ONLY JSON:
{"total_score":int,"timbre_score":int,"phonation_score":int,"pitch_score":int,"breath_score":int,"rhythm_score":int,"dynamics_score":int,"detailed_feedback":"markdown","actionable_advice":"markdown","coach_summary":"string","vocal_range":{"lowest_note":"B2","highest_note":"A4","song_key":"G major","user_key":"G major","key_shift_semitones":0}}`;
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

function parseAnalysis(raw: string): VocalAnalysisResult {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const data = JSON.parse(cleaned) as Partial<VocalAnalysisResult> & {
    mechanism_score?: number;
    vocal_range?: unknown;
  };
  return {
    total_score: clampScore(data.total_score),
    timbre_score: clampScore(data.timbre_score),
    phonation_score: clampScore(
      data.phonation_score ?? data.mechanism_score
    ),
    pitch_score: clampScore(data.pitch_score),
    breath_score: clampScore(data.breath_score),
    rhythm_score: clampScore(data.rhythm_score),
    dynamics_score: clampScore(data.dynamics_score),
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
  const rangeHint = params.measuredVocalRange
    ? `\nMEASURED_VOCAL_RANGE (F0 note hint only — ignore any key guess; often clips climax highs; OVERRIDE freely):\n${JSON.stringify(
        {
          lowest_note: params.measuredVocalRange.lowest_note,
          highest_note: params.measuredVocalRange.highest_note,
        }
      )}\n`
    : "";
  const userPrompt = `Song: ${params.songName}
Artist: ${params.artist || "Unknown"}
${lyrics}${measured}${rangeHint}${history}
STEP 1 — Score THIS audio only with the bands: 91–96 = masters only; strong covers 82–89; pleasant emotive a cappella often **80–84** (do not strand at ~75). Soft airy falsetto ≠ 壓喉/死頂. Ignore isolation artifacts.
STEP 2 — Timed sections: unique micro-polish 改善點. Soft quiet highs → evaluate 閉合 vs 發虛, never fake "pressed belt". Quote ONLY official lyrics (OFFICIAL_LYRICS / song knowledge)—never critique hallucinated words.
STEP 3 — vocal_range: YOU set song_key + user_key + key_shift_semitones (correct math). True climax may be A4/B4.
STEP 4 — Dimension scores must spread (strongest vs weakest usually ≥6). Do not flatten the radar.
STEP 5 — If USER_COACH_HISTORY exists: actionable_advice MUST open with ### 個人進度 / ### Personal progress (compare THIS take vs past for THIS singer), then personalised drills. Never skip. Never say "still stuck" unless THIS clip shows it.
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
    temperature: 0.3,
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
