import { isAnalyzingFeedback } from "@/lib/analysis-status";
import {
  SCORE_DIMENSIONS,
  type DimensionKey,
} from "@/lib/score-dimensions";
import type { Recording } from "@/lib/types";

const DIMENSIONS = SCORE_DIMENSIONS.map(({ key, label, short }) => ({
  key,
  label,
  short,
}));

export type VocalProfileInsight = {
  sampleCount: number;
  averages: Record<DimensionKey, number>;
  avgTotal: number;
  strongest: { key: DimensionKey; label: string; score: number };
  weakest: { key: DimensionKey; label: string; score: number };
  styleTitle: string;
  styleSummary: string;
  rangeHint: string;
  focusTips: string[];
  trendLabel: string;
  trendDelta: number | null;
};

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export function completedRecordings(list: Recording[]): Recording[] {
  return list.filter(
    (r) =>
      !isAnalyzingFeedback(r.ai_feedback_md) &&
      (r.total_score > 0 ||
        r.timbre_score > 0 ||
        r.phonation_score > 0 ||
        r.pitch_score > 0 ||
        r.breath_score > 0 ||
        r.rhythm_score > 0 ||
        r.dynamics_score > 0)
  );
}

export function buildVocalProfile(list: Recording[]): VocalProfileInsight | null {
  const done = completedRecordings(list);
  if (done.length === 0) return null;

  const averages = {
    timbre_score: avg(done.map((r) => r.timbre_score)),
    phonation_score: avg(done.map((r) => r.phonation_score)),
    pitch_score: avg(done.map((r) => r.pitch_score)),
    breath_score: avg(done.map((r) => r.breath_score)),
    rhythm_score: avg(done.map((r) => r.rhythm_score)),
    dynamics_score: avg(done.map((r) => r.dynamics_score)),
  };
  const avgTotal = avg(done.map((r) => r.total_score));

  const ranked = DIMENSIONS.map((d) => ({
    ...d,
    score: averages[d.key],
  })).sort((a, b) => b.score - a.score);

  const strongest = {
    key: ranked[0].key,
    label: ranked[0].label,
    score: ranked[0].score,
  };
  const weakest = {
    key: ranked[ranked.length - 1].key,
    label: ranked[ranked.length - 1].label,
    score: ranked[ranked.length - 1].score,
  };

  const { styleTitle, styleSummary, rangeHint } = describeStyle(averages);
  const focusTips = buildFocusTips(weakest.key, averages);

  const sorted = [...done].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  let trendLabel = "樣本尚少，繼續錄音可睇到進步趨勢";
  let trendDelta: number | null = null;
  if (sorted.length >= 3) {
    const recentN = Math.max(1, Math.ceil(sorted.length / 3));
    const recent = sorted.slice(0, recentN);
    const older = sorted.slice(recentN);
    if (older.length > 0) {
      const recentAvg = avg(recent.map((r) => r.total_score));
      const olderAvg = avg(older.map((r) => r.total_score));
      trendDelta = recentAvg - olderAvg;
      if (trendDelta >= 5) trendLabel = "近期總分明顯上升，狀態在變好";
      else if (trendDelta <= -5) trendLabel = "近期分數略為回落，可集中練弱項";
      else trendLabel = "近期表現穩定，繼續保持";
    }
  }

  return {
    sampleCount: done.length,
    averages,
    avgTotal,
    strongest,
    weakest,
    styleTitle,
    styleSummary,
    rangeHint,
    focusTips,
    trendLabel,
    trendDelta,
  };
}

function describeStyle(avgScores: Record<DimensionKey, number>): {
  styleTitle: string;
  styleSummary: string;
  rangeHint: string;
} {
  const {
    timbre_score: t,
    phonation_score: ph,
    pitch_score: p,
    breath_score: b,
    rhythm_score: r,
    dynamics_score: d,
  } = avgScores;
  const values = [t, ph, p, b, r, d];
  const max = Math.max(...values);
  const spread = max - Math.min(...values);

  let styleTitle = "均衡型歌手";
  let styleSummary =
    "六維分數相對平均，整體唱腔同音樂感平衡，適合多元曲風慢慢擴展。";
  let rangeHint =
    "目前較適合中段音域、情感型流行曲；高音段可先用半聲／混聲練習再挑戰。";

  if (spread < 8) {
    styleTitle = "均衡型歌手";
    styleSummary =
      "音色、發聲、音準、呼吸、節奏、力度差距細，屬於穩定均衡型。可以挑戰不同風格而不易偏科。";
    rangeHint =
      "音域發展方向：先鞏固換聲點附近，再逐步向上下擴展；曲風上流行／抒情都適合。";
  } else if (p === max) {
    styleTitle = "音準導向型";
    styleSummary =
      "你的強項是音準穩定，旋律線清晰。適合旋律線強、和聲要求高嘅作品。";
    rangeHint =
      "音域上你可以更放膽試跳進／高音，因為準度夠；重點係配合成長音色同氣息。";
  } else if (b === max) {
    styleTitle = "氣息支持型";
    styleSummary =
      "呼吸支持較突出，長句同力度變化有本錢。適合抒情、敘事型長樂句歌曲。";
    rangeHint =
      "音域上中低音會較穩；向高音延伸時記得保持下腹支持，避免用喉嚨硬頂。";
  } else if (t === max) {
    styleTitle = "音色個性型";
    styleSummary =
      "音色辨識度較高，聽感有特色。適合強調個人味道嘅流行／R&B／抒情曲。";
    rangeHint =
      "保持你的音色特色同時，用發聲練習打開更高／更柔嘅音域，避免只用一種聲線硬撐。";
  } else if (ph === max) {
    styleTitle = "發聲技巧型";
    styleSummary =
      "發聲分數較高，換聲、共鳴運用相對成熟。適合需要控制力嘅高難度段落。";
    rangeHint =
      "你可以嘗試更闊嘅音域跨度；同時用氣息同音準練習，令技巧更貼近情感表達。";
  } else if (r === max) {
    styleTitle = "節奏感型";
    styleSummary =
      "節奏穩定、進出拍乾淨。適合 groove 明顯嘅流行、R&B、跳舞曲。";
    rangeHint =
      "可挑戰切分同快歌；同時留意長音同換氣位，避免只顧拍子而忽略音質。";
  } else {
    styleTitle = "力度表現型";
    styleSummary =
      "強弱起伏同情感動態較突出。適合需要戲劇張力、 crescendo 明顯嘅歌。";
    rangeHint =
      "用力度講故事係你嘅優勢；高音段記得配氣息，避免用力過度導致擠壓。";
  }

  return { styleTitle, styleSummary, rangeHint };
}

function buildFocusTips(
  weakest: DimensionKey,
  averages: Record<DimensionKey, number>
): string[] {
  const tips: string[] = [];
  switch (weakest) {
    case "pitch_score":
      tips.push("用鋼琴或 App 做慢速音階，每粒音先對準再加快。");
      tips.push("錄副歌時先哼鳴（hum）一輪，再開口唱，減少跑音。");
      break;
    case "breath_score":
      tips.push("練習 4 拍吸、8 拍吐，保持肋骨打開，避免聳肩換氣。");
      tips.push("長句分手練習：每句只練氣息走到尾，再加歌詞。");
      break;
    case "timbre_score":
      tips.push("用「ma / mi」在舒適音區找共鳴，感覺聲音更靠前、更亮。");
      tips.push("錄同一句用暗／亮兩種音色對比，建立音色選擇意識。");
      break;
    case "rhythm_score":
      tips.push("用節拍器慢速唱主歌，每句對準拍點再恢復原速。");
      tips.push("錄一段只拍手／數拍，再疊歌聲，檢查進出拍。");
      break;
    case "dynamics_score":
      tips.push("同一句用 p → mf → f 三段力度唱，感受氣息同共鳴變化。");
      tips.push("副歌前刻意留細聲，進入副歌再放開，練習對比。");
      break;
    case "phonation_score":
    default:
      tips.push("換聲點附近用 lip trill 或「ng」滑音，減少擠壓。");
      tips.push("高音先帶少少 Twang（鳴鳴聲），再過渡到正常歌詞。");
      break;
  }

  const secondWeak = DIMENSIONS.map((d) => d.key)
    .filter((k) => k !== weakest)
    .sort((a, b) => averages[a] - averages[b])[0];

  if (secondWeak === "pitch_score") {
    tips.push("次要弱項是音準：可選音域較窄嘅歌先穩準度。");
  } else if (secondWeak === "breath_score") {
    tips.push("次要弱項是呼吸：唱歌前做 1 分鐘腹式呼吸熱身。");
  } else if (secondWeak === "rhythm_score") {
    tips.push("次要弱項是節奏：練習時開節拍器，先準再加情感。");
  } else if (secondWeak === "dynamics_score") {
    tips.push("次要弱項是力度：標記樂譜強弱，刻意做出對比。");
  }

  return tips.slice(0, 3);
}

export { DIMENSIONS };
export type { DimensionKey };
