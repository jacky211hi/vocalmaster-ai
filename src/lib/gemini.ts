import { GoogleGenAI } from "@google/genai";
import type { VocalAnalysisResult } from "@/lib/types";

const SYSTEM_INSTRUCTION = `You are a strict but encouraging professional vocal coach for "VocalMaster AI (AI 聲樂教練)".

Evaluate the singing on FOUR dimensions (0–100 ints): Timbre, Mechanism, Breath, Pitch.
Give brief physiological feedback and 1–2 specific exercises (e.g. Twang/puppy sound, lip trill, "ma").
Write detailed_feedback and actionable_advice in Traditional Chinese Markdown.
Keep the report concise (under ~400 Chinese characters for detailed_feedback) so analysis stays fast.

Return ONLY JSON:
{"total_score":int,"timbre_score":int,"mechanism_score":int,"breath_score":int,"pitch_score":int,"detailed_feedback":"markdown","actionable_advice":"markdown"}`;

const FALLBACK_MODELS = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.5-flash"];

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

function isRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("503") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("high demand") ||
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("overloaded") ||
    msg.includes("DEADLINE") ||
    msg.includes("timeout")
  );
}

function modelCandidates(): string[] {
  const preferred = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
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

  let lastError: unknown;

  // Keep attempts low — Vercel Hobby times out around 60s (504)
  for (const model of modelCandidates()) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config,
        });

        const text = response.text;
        if (!text) {
          throw new Error("Gemini returned an empty response");
        }

        return parseAnalysis(text);
      } catch (err) {
        lastError = err;
        console.warn(
          `[gemini] ${model} attempt ${attempt} failed:`,
          err instanceof Error ? err.message : err
        );

        if (!isRetryableError(err)) break;
        if (attempt < 2) await sleep(800);
      }
    }
  }

  if (isRetryableError(lastError)) {
    throw new Error(
      "Gemini 目前繁忙或逾時。請稍後再試，或改用較短錄音（15–45 秒）。"
    );
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini 分析失敗");
}
