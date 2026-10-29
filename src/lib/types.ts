import type { PitchReport } from "@/lib/pitch/score";
import type { VocalRangeReport } from "@/lib/pitch/vocal-range";

export type Recording = {
  id: string;
  user_id: string;
  song_name: string;
  artist: string;
  audio_url: string;
  storage_path?: string | null;
  share_audio?: boolean;
  share_audio_friends?: boolean;
  total_score: number;
  timbre_score: number;
  phonation_score: number;
  pitch_score: number;
  breath_score: number;
  rhythm_score: number;
  dynamics_score: number;
  ai_feedback_md: string;
  actionable_advice: string;
  coach_summary?: string | null;
  pitch_report?: PitchReport | null;
  vocal_range?: VocalRangeReport | null;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  username: string;
  avatar_url?: string | null;
  coach_summary?: string | null;
  created_at: string;
};

export type DimensionScores = {
  timbre_score: number;
  phonation_score: number;
  pitch_score: number;
  breath_score: number;
  rhythm_score: number;
  dynamics_score: number;
};

export type VocalAnalysisResult = DimensionScores & {
  total_score: number;
  detailed_feedback: string;
  actionable_advice: string;
  /** AI-only rolling memory for the next session; not shown in the UI. */
  coach_summary: string;
  vocal_range?: VocalRangeReport | null;
};

export type LeaderboardEntry = {
  id: string;
  song_name: string;
  artist: string;
  total_score: number;
  created_at: string;
  username: string;
};
