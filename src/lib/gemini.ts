import { GoogleGenAI } from "@google/genai";
import type { VocalAnalysisResult } from "@/lib/types";

const SYSTEM_INSTRUCTION = `You are a strict but encouraging professional vocal coach for "VocalMaster AI (AI 聲樂教練)".

Evaluate the singing on FOUR dimensions (0–100 ints): Timbre, Mechanism, Breath, Pitch.
Give brief physiological feedback and 1–2 specific exercises (e.g. Twang/puppy sound, lip trill, "ma").
Write detailed_feedback and actionable_advice in Traditional Chinese Markdown.
Keep the report concise (under ~400 Chinese characters for detailed_feedback) so analysis stays fast.

Return ONLY JSON:
{"total_score":int,"timbre_score":int,"mechanism_score":int,"breath_score":int,"pitch_score":int,"detailed_feedback":"markdown","actionable_advice":"markdown"}`;

/**
 * Ordered fallback pool. Free-tier quotas are usually per-model,
 * so when one hits RPD/RPM we switch to the next.
 *
 * Note: "Antigravity" is a Google agent product, not a generateContent
 * chat model — it cannot replace Gemini Flash for audio analysis.
 */
const DEFAULT_MODEL_POOL = [
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
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
  const data = JSON.parse(cleaned) as Partial<VocalAnalysisResult>;
  return {
    total_score: clampScore(data.total_score),
    timbre_score: clampScore(data.timbre_score),
    mechanism_score: clampScore(data.mechanism_score),
    breath_score: clampScore(data.breath_score),
    pitch_score: clampScore(data.pitch_score),
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
  const preferred = process.env.GEMINI_MODEL?.trim();
  const fromEnv = (process.env.GEMINI_MODEL_FALLBACKS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const ordered = [
    ...(preferred ? [preferred] : []),
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
}): Promise<VocalAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey });
  const userPrompt = `Song: ${params.songName}
Artist: ${params.artist || "Unknown"}

Analyze this singing clip and return the JSON evaluation. Be concise.`;

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
    systemInstruction: SYSTEM_INSTRUCTION,
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
