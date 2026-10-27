import type { DimensionScores } from "@/lib/types";

export type DimensionKey = keyof DimensionScores;

export const SCORE_DIMENSIONS: {
  key: DimensionKey;
  label: string;
  short: string;
  color: string;
}[] = [
  {
    key: "timbre_score",
    label: "Timbre 音色",
    short: "音色",
    color: "from-amber-400 to-yellow-300",
  },
  {
    key: "phonation_score",
    label: "Phonation 發聲",
    short: "發聲",
    color: "from-orange-400 to-amber-300",
  },
  {
    key: "pitch_score",
    label: "Pitch 音準",
    short: "音準",
    color: "from-emerald-400 to-teal-300",
  },
  {
    key: "breath_score",
    label: "Breath 呼吸",
    short: "呼吸",
    color: "from-sky-400 to-cyan-300",
  },
  {
    key: "rhythm_score",
    label: "Rhythm 節奏",
    short: "節奏",
    color: "from-violet-400 to-fuchsia-300",
  },
  {
    key: "dynamics_score",
    label: "Dynamics 力度",
    short: "力度",
    color: "from-rose-400 to-orange-300",
  },
];
