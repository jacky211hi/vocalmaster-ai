import { GoogleGenAI } from "@google/genai";
import type { Locale } from "@/lib/i18n/config";
import { geminiLanguageInstruction } from "@/lib/i18n/gemini-locale";
import { lyricsPrompt, type LyricMatch } from "@/lib/lyrics";
import { coachPitchBrief } from "@/lib/pitch/report";
import type { PitchReport } from "@/lib/pitch/score";
import type { VocalAnalysisResult } from "@/lib/types";

function buildSystemInstruction(locale: Locale): string {
  return `You are a strict but encouraging professional vocal coach for "VocalMaster AI (AI 聲樂教練)".

Evaluate the singing on SIX dimensions (0–100 ints):
- timbre_score：音色 Timbre（聲線質感、個性）
- phonation_score：發聲 Phonation（換聲、共鳴、喉位、擠壓等）
- pitch_score：音準 Pitch
- breath_score：呼吸 Breath（氣息支持）
- rhythm_score：節奏 Rhythm（拍子、進出拍、groove）
- dynamics_score：力度 Dynamics（強弱起伏、對比、情感張力）

${geminiLanguageInstruction(locale)}

## detailed_feedback（AI diagnostic report）— thorough, timed
Structure with these sections (use ## headings; translate section titles to the LANGUAGE above):
1. **整體印象** / Overall impression: 2–4 sentences.
2. **時間段分析** / Timed sections: split the clip (verse / chorus / high notes / ending; times on the user's recording mm:ss–mm:ss). If OFFICIAL_LYRICS are provided, each section title must copy one exact line from those lyrics — never speech-recognize lyrics from audio, never invent words. If unmatched, write 「未能對上歌詞」 (or English "Could not align lyrics"). If no lyrics, use section names only without quoted lyric lines. Each section:
   - time range (e.g. \`0:00–0:25\`)
   - strengths (pitch, breath, timbre, phonation, rhythm, dynamics)
   - improvements (squeeze, pitch drift, short breath, register break, dragging, flat dynamics)
3. **六維細評** / Six dimensions: brief note per dimension; strongest and weakest.
4. **亮點與風險** / Highlights & risks: 1–2 strengths; 1–2 priority issues.

Be specific — quote moments, vowels, register shifts, beat placement, or volume arcs. Aim for a thorough coach report (~600–1200 words / equivalent Chinese length). Avoid vague praise.

## actionable_advice（practice tips）— actionable, personalized, low repetition
The page already shows the advice card title — do not repeat that title in the body.
If USER_COACH_HISTORY is present: open with 1–2 sentences on which dimensions improved or remain stuck, then list drills.
Use level-3 headings for 2–4 drills:
### 1. Drill name
- **點做** / How:
- **練幾耐** / How long:
- **對應問題** / Targets:
Pick varied drills by weakness (breath support, SOVT straw, sirens, humming, twang, pitch matching, metronome phrasing, messa di voce, etc.). Do not reuse recent exercise titles unless the same weakness did not improve — then escalate. Keep concise and executable.

Return ONLY JSON:
{"total_score":int,"timbre_score":int,"phonation_score":int,"pitch_score":int,"breath_score":int,"rhythm_score":int,"dynamics_score":int,"detailed_feedback":"markdown","actionable_advice":"markdown"}`;
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

function parseAnalysis(raw: string): VocalAnalysisResult {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const data = JSON.parse(cleaned) as Partial<VocalAnalysisResult> & {
    mechanism_score?: number;
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
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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
  const userPrompt = `Song: ${params.songName}
Artist: ${params.artist || "Unknown"}
${lyrics}${measured}${history}
Listen carefully to the full clip. Section times are on the user's recording, starting at 0:00.
In detailed_feedback, mark which time ranges went well vs poorly.
If OFFICIAL_LYRICS are present, quote those lines exactly in the section titles. Do not transcribe lyrics from the audio.
If USER_COACH_HISTORY is present: briefly note progress or stuck weaknesses vs past sessions; for actionable_advice prioritize recurring weak dimensions, avoid repeating prior exercise titles when possible, and escalate if the same issue persists.
Follow the LANGUAGE rule in the system instruction for all written fields.
Then give actionable_advice exercises tied to this clip's weak moments and this user's history.
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
  let lastError: unknown;

  for (const model of models) {
    try {
      tried.push(model);
      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      const text = response.text;
      if (!text) throw new Error("Gemini returned an empty response");
      console.info(`[gemini] success with model=${model}`);
      return parseAnalysis(text);
    } catch (err) {
      lastError = err;
      const msg = errMessage(err);
      console.warn(`[gemini] ${model} failed:`, msg);

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

  if (busyHit.length > 0) {
    throw new Error(
      `Gemini 暫時繁忙（已自動換 model：${tried.join(" → ")}）。請一分鐘後重試。`
    );
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(
        `Gemini 分析失敗（已試：${tried.join("、") || "無"}）`
      );
}
