export type LyricMatch = {
  track: string;
  artist: string;
  text: string;
  synced: boolean;
};

type LyricHit = {
  trackName?: string;
  artistName?: string;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
};

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[（(].*?[)）]/g, "")
    .replace(/[\s'’"“”·・,，.。!！?？\-—_]/g, "");
}

export function pickLyricHit(
  song: string,
  artist: string,
  hits: LyricHit[]
): LyricHit | null {
  const songN = norm(song);
  const artistN = norm(artist);
  if (!songN) return null;

  let best: { hit: LyricHit; score: number } | null = null;
  for (const hit of hits) {
    const track = hit.trackName ?? "";
    const trackN = norm(track);
    if (!trackN || trackN !== songN) continue;
    const artN = norm(hit.artistName ?? "");
    let score = 6;
    if (artistN) {
      if (artN === artistN) score += 4;
      else if (artN.includes(artistN) || artistN.includes(artN)) score += 2;
      else score -= 3;
    }
    const body = (hit.syncedLyrics || hit.plainLyrics || "").trim();
    if (!body) score -= 5;
    if (hit.syncedLyrics) score += 1;
    if (!best || score > best.score) best = { hit, score };
  }
  if (!best || best.score < 6) return null;
  return best.hit;
}

export async function lookupLyrics(
  song: string,
  artist: string
): Promise<LyricMatch | null> {
  const trackName = song.trim();
  const artistName = artist.trim();
  if (!trackName) return null;

  const url = new URL("https://lrclib.net/api/search");
  url.searchParams.set("track_name", trackName);
  if (artistName) url.searchParams.set("artist_name", artistName);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "VocalMasterAI/1.0 (vocal coaching lyric alignment)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const hits = (await response.json()) as LyricHit[];
  if (!Array.isArray(hits)) return null;
  const hit = pickLyricHit(trackName, artistName, hits);
  if (!hit) return null;
  const synced = (hit.syncedLyrics ?? "").trim();
  const plain = (hit.plainLyrics ?? "").trim();
  const text = (synced || plain).slice(0, 6000);
  if (!text) return null;
  return {
    track: hit.trackName?.trim() || trackName,
    artist: hit.artistName?.trim() || artistName,
    text,
    synced: Boolean(synced),
  };
}

export function lyricsPrompt(match: LyricMatch): string {
  return [
    "OFFICIAL_LYRICS (correct published lyrics; Cantonese audio transcription is NOT reliable):",
    `Track: ${match.track}`,
    `Artist: ${match.artist}`,
    match.synced
      ? "Lines may include [mm:ss] from the original studio recording. Those times are NOT the user's clip clock. The user's clip starts at 0:00."
      : "No studio timestamps. Align lines by listening, using the user's clip clock starting at 0:00.",
    "In 時間段分析, name each sung section with an exact line copied from the text below.",
    "Do not invent, paraphrase, or speech-recognize lyric words. If you cannot tell which line is being sung, write 未能對上歌詞 and do not quote made-up words.",
    match.text,
  ].join("\n");
}
