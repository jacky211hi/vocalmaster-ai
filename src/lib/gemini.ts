import { GoogleGenAI } from "@google/genai";
import type { VocalAnalysisResult } from "@/lib/types";

const SYSTEM_INSTRUCTION = `You are a strict but encouraging professional vocal coach for "VocalMaster AI (AI 聲樂教練)".

Evaluate the singing on FOUR dimensions (0–100 ints): Timbre, Mechanism, Breath, Pitch.
Give brief physiological feedback and 1–2 specific exercises (e.g. Twang/puppy sound, lip trill, "ma").
Write detailed_feedback and actionable_advice in Traditional Chinese Markdown.
Keep the report concise (under ~400 Chinese characters for detailed_feedback) so analysis stays fast.

Return ONLY JSON:
{"total_score":int,"timbre_score":int,"mechanism_score":int,"breath_score":int,"pitch_score":int,"detailed_feedback":"markdown","actionable_advice":"markdown"}`;

/** Keep list short — free tier is ~20 RPD; each try counts. */
const FALLBACK_MODELS = ["gemini-flash-latest", "gemini-3.6-flash"];

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

/** Daily / minute quota — do NOT keep firing more requests. */
function isQuotaError(err: unknown): boolean {
  const msg = errMessage(err);
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota") ||
    msg.includes("Quota") ||
    msg.includes("rate limit") ||
    msg.includes("Rate limit")
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

function modelCandidates(): string[] {
  const preferred = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
  // At most 2 models total per user analysis (protect free-tier RPD)
  return [preferred, ...FALLBACK_MODELS.filter((m) => m !== preferred)].slice(
    0,
    2
  );
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

  const tried: string[] = [];
  let lastError: unknown;

  for (const model of modelCandidates()) {
    try {
      tried.push(model);
      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      const text = response.text;
      if (!text) throw new Error("Gemini returned an empty response");
      return parseAnalysis(text);
    } catch (err) {
      lastError = err;
      console.warn(`[gemini] ${model} failed:`, errMessage(err));

      if (isQuotaError(err)) {
        throw new Error(
          `Gemini 免費額度已用完（今日請求上限）。你嘅 dashboard 顯示大約 20 次／日；每次分析／重試／換 model 都會計入。請等額度重置，或升級 Google AI 計劃。`
        );
      }

      if (isBusyError(err)) {
        await sleep(500);
        continue;
      }

      // Non-retryable for this model (e.g. 404) — try next
      continue;
    }
  }

  if (isBusyError(lastError)) {
    throw new Error(
      `Gemini 暫時繁忙（已試 ${tried.join("、")}，各 1 次）。請等一分鐘再撳「重試分析」。`
    );
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini 分析失敗");
}
