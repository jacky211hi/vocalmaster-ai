import { GoogleGenAI } from "@google/genai";
import type { VocalAnalysisResult } from "@/lib/types";

const SYSTEM_INSTRUCTION = `You are a strict but encouraging professional vocal coach for the app "VocalMaster AI (AI 聲樂教練)".

Listen carefully to the native audio recording and evaluate the singer on FOUR dimensions (each 0–100 integers):
1. Timbre (音色) — tone color, resonance, brightness/darkness balance
2. Mechanism (發聲機制) — registration (chest/mix/head), laryngeal position, soft palate, twang/edge phonation, jaw/tongue freedom
3. Breath (呼吸) — support, phrasing, air management, onset control
4. Pitch (音準) — intonation accuracy, stability, intentional stylistic bends

Provide physiological feedback (e.g. laryngeal tension, soft palate lift, thyroid tilt, breath anchoring).

Actionable Training Generator: output 1–2 highly specific vocal exercises tailored to the detected flaws. Examples of the style expected:
- Sing the bridge with a crying puppy "Twang / 咽音" (鳴鳴) to improve edge phonation
- Use a lip trill or "ma" consonant to release jaw tension / lower larynx before the chorus

Write detailed_feedback and actionable_advice in Traditional Chinese (繁體中文), using Markdown.
total_score should be a thoughtful weighted overall (not a naive average if one dimension is critically weak).

Return ONLY valid JSON matching this schema (no markdown fences):
{
  "total_score": int,
  "timbre_score": int,
  "mechanism_score": int,
  "breath_score": int,
  "pitch_score": int,
  "detailed_feedback": "markdown string",
  "actionable_advice": "markdown string"
}`;

const FALLBACK_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash",
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

function isRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("503") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("high demand") ||
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("overloaded")
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

Please analyze this singing recording and return the structured JSON evaluation.`;

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
    temperature: 0.4,
  };

  let lastError: unknown;

  for (const model of modelCandidates()) {
    for (let attempt = 1; attempt <= 3; attempt++) {
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

        if (!isRetryableError(err)) {
          // Non-retryable for this model (e.g. 404) — try next model
          break;
        }

        if (attempt < 3) {
          await sleep(1000 * attempt * attempt); // 1s, 4s
        }
      }
    }
  }

  if (isRetryableError(lastError)) {
    throw new Error(
      "Gemini 目前繁忙（高用量），已自動重試多次仍失敗。請稍後再試，或改 .env.local 的 GEMINI_MODEL。"
    );
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini 分析失敗");
}
