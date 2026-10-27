import { Progress } from "@/components/ui/progress";
import { SCORE_DIMENSIONS } from "@/lib/score-dimensions";
import type { DimensionScores } from "@/lib/types";

export function ScoreBars({ scores }: { scores: DimensionScores }) {
  return (
    <div className="space-y-5">
      {SCORE_DIMENSIONS.map(({ key, label, color }) => (
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
