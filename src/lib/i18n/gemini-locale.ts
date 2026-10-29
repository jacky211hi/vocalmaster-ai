import type { Locale } from "./config";

/** Instruct Gemini which written language to use for coach reports. */
export function geminiLanguageInstruction(locale: Locale): string {
  if (locale === "en") {
    return [
      "LANGUAGE: Write detailed_feedback and actionable_advice in clear English.",
      "Use friendly coaching tone. Do not use Chinese in those two fields.",
    ].join(" ");
  }
  if (locale === "tw") {
    return [
      "LANGUAGE: Write detailed_feedback and actionable_advice in Traditional Chinese 書面語",
      "suitable for Taiwan readers (Mandarin written style).",
      "Avoid Cantonese particles and colloquialisms (嘅／喺／唔／啲／啦／吓／睇／嚟 etc.).",
      "Use 的／在／不／這／那／看／來 instead.",
    ].join(" ");
  }
  return [
    "LANGUAGE: Write detailed_feedback and actionable_advice in Traditional Chinese",
    "with Hong Kong Cantonese tone where natural (可用粵語助詞如嘅／喺／唔／啦).",
    "Keep section headings in Traditional Chinese as specified.",
  ].join(" ");
}
