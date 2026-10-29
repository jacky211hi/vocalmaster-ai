import type { Locale } from "./config";

/** Instruct Gemini which written language to use for coach reports. */
export function geminiLanguageInstruction(locale: Locale): string {
  if (locale === "en") {
    return [
      "LANGUAGE: Write detailed_feedback and actionable_advice in clear English only.",
      "Use a friendly coaching tone.",
      "Do NOT use Chinese anywhere in those two fields.",
      "Do NOT write bilingual labels (never「點做 / How」or Chinese+English side by side).",
      "Section headings and bullet labels must be English only.",
    ].join(" ");
  }
  if (locale === "tw") {
    return [
      "LANGUAGE: Write detailed_feedback and actionable_advice in Traditional Chinese 書面語 only",
      "suitable for Taiwan readers (Mandarin written style).",
      "Avoid Cantonese particles and colloquialisms (嘅／喺／唔／啲／啦／吓／睇／嚟 etc.).",
      "Use 的／在／不／這／那／看／來 instead.",
      "Do NOT mix English labels or bilingual headings (never write How / How long / Targets).",
      "Headings and bullet labels must be Traditional Chinese only.",
    ].join(" ");
  }
  return [
    "LANGUAGE: Write detailed_feedback and actionable_advice in Traditional Chinese only",
    "with Hong Kong Cantonese tone where natural (可用粵語助詞如嘅／喺／唔／啦).",
    "Do NOT mix English labels or bilingual headings (never write How / How long / Targets,",
    "never「點做 / How」).",
    "Headings and bullet labels must be Traditional Chinese only.",
  ].join(" ");
}

/** Locale-specific report / advice structure (no bilingual labels). */
export function geminiStructureInstruction(locale: Locale): string {
  if (locale === "en") {
    return `## detailed_feedback — THIS CLIP ONLY (scores + diagnosis; ignore history here)
Structure with these ## headings (English only):
1. **Overall impression**: 2–4 sentences about THIS take.
2. **Timed sections**: split the clip (verse / chorus / high notes / ending; times mm:ss–mm:ss on the user's recording). If OFFICIAL_LYRICS exist, section titles must copy one exact lyric line. If unmatched, write "Could not align lyrics". Each section:
   - time range (e.g. \`0:00–0:25\`)
   - strengths
   - improvements: ALWAYS write something useful and UNIQUE to this segment. For strong (80+) singing, give advanced micro-polishing (vowel shape, micro-timing/groove, consonants, vibrato tails, resonance consistency)—never blank, never copy-paste the same praise line across sections. For weaker singing, name concrete technical faults.
3. **Six dimensions**: brief note per dimension from THIS clip; strongest and weakest.
4. **Highlights & risks**: real highlights; risks when genuine.

Be specific. Aim ~600–1200 words. Avoid vague praise AND avoid forced amateur nitpicking of intentional style.

## actionable_advice — drills (+ history ONLY here)
The page already shows the advice card title — do not repeat it.
Grade/diagnose above WITHOUT history. Here only:
- If USER_COACH_HISTORY is present: 1–2 sentences comparing progress vs past, then drills. Never claim the singer is "still stuck" unless THIS clip clearly shows the same fault.
- If absent: do NOT mention past sessions.
Use level-3 headings for 2–4 drills:
### 1. Drill name
- **How:**
- **How long:**
- **Targets:**
Vary drills; escalate only when THIS clip shows the same weakness. English labels only.`;
  }

  if (locale === "tw") {
    return `## detailed_feedback — 只評本次錄音（分數與診斷；此處忽略歷史）
用以下 ## 標題（只寫繁體中文）：
1. **整體印象**：2–4 句，只談這一次。
2. **時間段分析**：分段（主歌／副歌／高音／結尾；時間用錄音 mm:ss–mm:ss）。有 OFFICIAL_LYRICS 時標題必須完整抄錄一句歌詞；對不上寫「未能對上歌詞」。每段：
   - 時間範圍
   - 優點
   - 改善點：每段都要寫、且內容互不重複。若該段已達 80+ 水準，給**進階細節雕琢**（母音調整、微節奏／groove、子音清晰度、顫音尾、共鳴穩定等），禁止空白或各段複製同一句空泛稱讚；若較弱，直接指出具體技術問題。
3. **六維細評**：只根據本次；標最強／最弱。
4. **亮點與風險**：真實亮點；風險僅限真實技術風險。

報告宜詳盡（約 600–1200 字當量）。避免空泛稱讚，也避免把刻意風格當成業餘錯誤。

## actionable_advice — 練習建議（歷史只能用在這裡）
頁面已有建議標題，正文不要重複。
上方診斷與分數不可受歷史影響。此處才可：
- 若有 USER_COACH_HISTORY：用 1–2 句對比進步／卡住，再列練習。除非本次錄音清楚重現同一問題，否則不要寫「仍然卡住」。
- 若無：不要提歷史。
用三級標題列 2–4 個練習：
### 1. 練習名稱
- **做法：**
- **練習多久：**
- **對應問題：**
依本次弱項選練習。標籤只用繁體中文。`;
  }

  return `## detailed_feedback — 只評今次錄音（分數同診斷；呢度唔好用歷史）
用以下 ## 標題（只寫繁體中文）：
1. **整體印象**：2–4 句，只講今次。
2. **時間段分析**：分段（主歌／副歌／高音／結尾；時間用錄音 mm:ss–mm:ss）。有 OFFICIAL_LYRICS 時標題必須完整抄錄一句歌詞；對唔上寫「未能對上歌詞」。每段：
   - 時間範圍
   - 優點
   - 改善點：每段都要寫、而且內容唔好重複。若該段已達 80+，俾**進階細節雕琢**（母音調整、微節奏／groove、子音清晰度、顫音尾、共鳴穩定等），禁止留空或每段複製同一句空泛稱讚；若較弱，直接講清楚技術問題。
3. **六維細評**：只根據今次；標最強／最弱。
4. **亮點與風險**：真實亮點；風險只限真實技術風險。

報告宜詳盡（約 600–1200 字當量）。避免空泛稱讚，亦避免把刻意風格當成業餘錯誤。

## actionable_advice — 練習建議（歷史只可以出現喺呢度）
頁面已有建議標題，正文唔好重複。
上面診斷同分數唔可以受歷史影響。呢度先至可以：
- 若有 USER_COACH_HISTORY：用 1–2 句對比進步／卡住，再列練習。除非今次錄音清楚重現同一問題，否則唔好寫「依然卡住」。
- 若冇：唔好提歷史。
用三級標題列 2–4 個練習：
### 1. 練習名稱
- **點做：**
- **練幾耐：**
- **對應問題：**
按今次弱項選練習。標籤只用繁體中文。`;
}
