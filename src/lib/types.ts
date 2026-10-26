export type Recording = {
  id: string;
  user_id: string;
  song_name: string;
  artist: string;
  audio_url: string;
  storage_path?: string | null;
  total_score: number;
  timbre_score: number;
  mechanism_score: number;
  breath_score: number;
  pitch_score: number;
  ai_feedback_md: string;
  actionable_advice: string;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  username: string;
  avatar_url?: string | null;
  created_at: string;
};

export type VocalAnalysisResult = {
  total_score: number;
  timbre_score: number;
  mechanism_score: number;
  breath_score: number;
  pitch_score: number;
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
