import type { PitchReport } from "@/lib/pitch/score";

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
  pitch_report?: PitchReport | null;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  username: string;
  avatar_url?: string | null;
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
};

export type LeaderboardEntry = {
  id: string;
  song_name: string;
  artist: string;
  total_score: number;
  created_at: string;
  username: string;
};
