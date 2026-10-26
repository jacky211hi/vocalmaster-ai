import { Progress } from "@/components/ui/progress";

const DIMENSIONS = [
  { key: "timbre_score", label: "Timbre 音色", color: "from-amber-400 to-yellow-300" },
  { key: "mechanism_score", label: "Mechanism 發聲機制", color: "from-orange-400 to-amber-300" },
  { key: "breath_score", label: "Breath 呼吸", color: "from-sky-400 to-cyan-300" },
  { key: "pitch_score", label: "Pitch 音準", color: "from-emerald-400 to-teal-300" },
] as const;

type Scores = {
  timbre_score: number;
  mechanism_score: number;
  breath_score: number;
  pitch_score: number;
};

export function ScoreBars({ scores }: { scores: Scores }) {
  return (
    <div className="space-y-5">
      {DIMENSIONS.map(({ key, label, color }) => (
        <div key={key} className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/75">{label}</span>
            <span className="font-semibold tabular-nums text-white">
              {scores[key]}
            </span>
          </div>
          <Progress
            value={scores[key]}
            indicatorClassName={`bg-gradient-to-r ${color}`}
          />
        </div>
      ))}
    </div>
  );
}
