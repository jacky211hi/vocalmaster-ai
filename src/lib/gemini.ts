import { GoogleGenAI } from "@google/genai";
import type { VocalAnalysisResult } from "@/lib/types";

const SYSTEM_INSTRUCTION = `You are a strict but encouraging professional vocal coach for "VocalMaster AI (AI 聲樂教練)".

Evaluate the singing on FOUR dimensions (0–100 ints): Timbre, Mechanism, Breath, Pitch.
Give brief physiological feedback and 1–2 specific exercises (e.g. Twang/puppy sound, lip trill, "ma").
Write detailed_feedback and actionable_advice in Traditional Chinese Markdown.
Keep the report concise (under ~400 Chinese characters for detailed_feedback) so analysis stays fast.

Return ONLY JSON:
{"total_score":int,"timbre_score":int,"mechanism_score":int,"breath_score":int,"pitch_score":int,"detailed_feedback":"markdown","actionable_advice":"markdown"}`;

/** Prefer rotating models quickly on 503 rather than long sleeps (Vercel ~60s cap). */
const FALLBACK_MODELS = [
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
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

function isRetryableError(err: unknown): boolean {
  const msg = errMessage(err);
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
  return [preferred, ...FALLBACK_MODELS.filter((m) => m !== preferred)];
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
  const models = modelCandidates();

  // Strategy: try each model once quickly on busy errors (no long backoff).
  // If all busy, one short pause then retry preferred model once more.
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
      return parseAnalysis(text);
    } catch (err) {
      lastError = err;
      console.warn(`[gemini] ${model} failed:`, errMessage(err));
      if (!isRetryableError(err)) {
        // e.g. 404 model — skip to next candidate
        continue;
      }
      // brief gap only between models
      await sleep(400);
    }
  }

  // One last shot on preferred after a short cool-down
  const preferred = models[0];
  try {
    tried.push(`${preferred}#retry`);
    await sleep(1200);
    const response = await ai.models.generateContent({
      model: preferred,
      contents,
      config,
    });
    const text = response.text;
    if (!text) throw new Error("Gemini returned an empty response");
    return parseAnalysis(text);
  } catch (err) {
    lastError = err;
    console.warn(`[gemini] final retry failed:`, errMessage(err));
  }

  if (isRetryableError(lastError)) {
    throw new Error(
      `Gemini 目前繁忙（已試：${tried.join(" → ")}）。呢個係 Google 端暫時爆量，同你檔案長度無關；等一兩分鐘再撳「重試分析」通常得。`
    );
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini 分析失敗");
}
