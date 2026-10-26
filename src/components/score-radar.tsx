"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

type Scores = {
  timbre_score: number;
  mechanism_score: number;
  breath_score: number;
  pitch_score: number;
};

export function ScoreRadar({ scores }: { scores: Scores }) {
  const data = [
    { subject: "音色", value: scores.timbre_score, fullMark: 100 },
    { subject: "機制", value: scores.mechanism_score, fullMark: 100 },
    { subject: "呼吸", value: scores.breath_score, fullMark: 100 },
    { subject: "音準", value: scores.pitch_score, fullMark: 100 },
  ];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="rgba(255,255,255,0.15)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Score"
            dataKey="value"
            stroke="#fbbf24"
            fill="#fbbf24"
            fillOpacity={0.35}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
