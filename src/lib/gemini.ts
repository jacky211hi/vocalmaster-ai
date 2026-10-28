import { GoogleGenAI } from "@google/genai";
import { lyricsPrompt, type LyricMatch } from "@/lib/lyrics";
import { coachPitchBrief } from "@/lib/pitch/report";
import type { PitchReport } from "@/lib/pitch/score";
import type { VocalAnalysisResult } from "@/lib/types";

const SYSTEM_INSTRUCTION = `You are a strict but encouraging professional vocal coach for "VocalMaster AI (AI 聲樂教練)".

Evaluate the singing on SIX dimensions (0–100 ints):
- timbre_score：音色 Timbre（聲線質感、個性）
- phonation_score：發聲 Phonation（換聲、共鳴、喉位、擠壓等）
- pitch_score：音準 Pitch
- breath_score：呼吸 Breath（氣息支持）
- rhythm_score：節奏 Rhythm（拍子、進出拍、groove）
- dynamics_score：力度 Dynamics（強弱起伏、對比、情感張力）

Write BOTH fields in Traditional Chinese Markdown.

## detailed_feedback（AI 診斷報告）— 要仔細、有時間軸
Structure with these sections (use ## headings):
1. **整體印象**：2–4 句總結整體表現。
2. **時間段分析**：把整段錄音分成多個時間段（主歌、副歌、高音段、結尾；時間用錄音本身嘅 mm:ss–mm:ss）。如果提供咗 OFFICIAL_LYRICS，每個時段標題必須抄該歌詞入面嘅正確一句，禁止靠聽寫廣東話歌詞，禁止改字。對唔上就寫「未能對上歌詞」，唔好估詞。冇提供歌詞時，標題只用段落名，唔好加引號歌詞。每個時段寫：
   - 時間範圍（估計即可，例如 \`0:00–0:25\`）
   - 做得好的地方（具體：音準、氣息、音色、發聲、節奏、力度）
   - 需改善的地方（具體指出問題，例如擠壓、走音、氣短、換聲斷裂、拖拍、力度平坦）
3. **六維細評**：分別簡述音色／發聲／音準／呼吸／節奏／力度嘅觀察，指出最強同最弱。
4. **亮點與風險**：1–2 個最突出優點；1–2 個最需要優先處理嘅問題。

Be specific and concrete — quote approximate moments, phrase shapes, vowels, register shifts, beat placement, or volume arcs when possible. Aim for a thorough coach report (約 600–1200 字)，唔好空泛。

## actionable_advice（改善建議）— 可執行練習
頁面已經有「改善建議」標題，正文不要再寫「改善建議」做標題。
直接用三級標題列出 2–4 個練習，格式固定：
### 1. 練習名
- **點做**：
- **練幾耐**：
- **對應問題**：
練習可以係唇震音、歎氣式 Ma、半聲滑音、節拍器、強弱對比等。保持精簡可執行。

Return ONLY JSON:
{"total_score":int,"timbre_score":int,"phonation_score":int,"pitch_score":int,"breath_score":int,"rhythm_score":int,"dynamics_score":int,"detailed_feedback":"markdown","actionable_advice":"markdown"}`;

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
}): Promise<VocalAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey });
  const measured = params.pitchReport
    ? `\n${coachPitchBrief(params.pitchReport)}\n`
    : "";
  const lyrics = params.lyrics ? `\n${lyricsPrompt(params.lyrics)}\n` : "";
  const userPrompt = `Song: ${params.songName}
Artist: ${params.artist || "Unknown"}
${lyrics}${measured}
Listen carefully to the full clip. Section times are on the user's recording, starting at 0:00.
In detailed_feedback, mark which time ranges went well vs poorly.
If OFFICIAL_LYRICS are present, quote those lines exactly in the section titles. Do not transcribe Cantonese lyrics from the audio.
Then give actionable_advice exercises tied to those weak moments.
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
