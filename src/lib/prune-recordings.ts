import type { SupabaseClient } from "@supabase/supabase-js";

export const PERSONAL_TOP_N = 10;

type RecordingRow = {
  id: string;
  total_score: number;
  created_at: string;
  storage_path: string | null;
  audio_url: string | null;
};

/**
 * Keep audio files only for this user's top N by score (newer wins ties).
 * Rows outside top N keep scores + AI analysis; only Storage audio is removed.
 * Optionally protect `protectId` so the just-analyzed take can keep audio once.
 */
export async function pruneUserRecordingsToTopN(
  supabase: SupabaseClient,
  userId: string,
  options?: { protectId?: string; topN?: number }
) {
  const topN = options?.topN ?? PERSONAL_TOP_N;
  const protectId = options?.protectId;

  const { data, error } = await supabase
    .from("recordings")
    .select("id, total_score, created_at, storage_path, audio_url")
    .eq("user_id", userId);

  if (error || !data) {
    console.error("prune: fetch failed", error);
    return;
  }

  const rows = data as RecordingRow[];

  const sorted = [...rows].sort((a, b) => {
    if (b.total_score !== a.total_score) return b.total_score - a.total_score;
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

  const keepAudio = new Set(sorted.slice(0, topN).map((r) => r.id));
  if (protectId) keepAudio.add(protectId);

  const toStrip = rows.filter(
    (r) =>
      !keepAudio.has(r.id) &&
      (Boolean(r.storage_path) || Boolean(r.audio_url))
  );

  if (toStrip.length === 0) return;

  const paths = toStrip
    .map((r) => r.storage_path)
    .filter((p): p is string => Boolean(p));

  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("recordings")
      .remove(paths);
    if (storageError) {
      console.error("prune: storage remove failed", storageError);
    }
  }

  const { error: updateError } = await supabase
    .from("recordings")
    .update({ audio_url: "", storage_path: null, share_audio: false })
    .in(
      "id",
      toStrip.map((r) => r.id)
    );

  if (updateError) {
    console.error("prune: clear audio fields failed", updateError);
  }
}

/** Whether a new score would enter (or stay in) this user's personal top N. */
export function scoreQualifiesForTopN(
  existingScores: number[],
  newScore: number,
  topN = PERSONAL_TOP_N
): boolean {
  if (existingScores.length < topN) return true;
  const sorted = [...existingScores].sort((a, b) => b - a);
  return newScore >= sorted[topN - 1];
}
