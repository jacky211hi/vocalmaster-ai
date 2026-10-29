import { Converter } from "opencc-js/t2cn";

export type LyricMatch = {
  track: string;
  artist: string;
  text: string;
  synced: boolean;
};

type LyricHit = {
  id?: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
};

/** Canonicalize Traditional → Simplified so LRCLIB metadata matches HK/TW input. */
const toSimplified = Converter({ from: "t", to: "cn" });

function norm(value: string): string {
  return toSimplified(value)
    .toLowerCase()
    .replace(/[（(].*?[)）]/g, "")
    .replace(/[\s'’"“”·・,，.。!！?？\-—_]/g, "");
}

function hitKey(hit: LyricHit): string {
  if (hit.id != null) return `id:${hit.id}`;
  return `t:${hit.trackName ?? ""}|a:${hit.artistName ?? ""}|al:${hit.albumName ?? ""}`;
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

async function fetchLrclibSearch(params: {
  trackName?: string;
  artistName?: string;
  q?: string;
}): Promise<LyricHit[]> {
  const url = new URL("https://lrclib.net/api/search");
  if (params.q) {
    url.searchParams.set("q", params.q);
  } else {
    if (params.trackName) url.searchParams.set("track_name", params.trackName);
    if (params.artistName) url.searchParams.set("artist_name", params.artistName);
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "VocalMasterAI/1.0 (vocal coaching lyric alignment)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) return [];
    const hits = (await response.json()) as LyricHit[];
    return Array.isArray(hits) ? hits : [];
  } catch {
    return [];
  }
}

function mergeHits(...batches: LyricHit[][]): LyricHit[] {
  const seen = new Set<string>();
  const out: LyricHit[] = [];
  for (const batch of batches) {
    for (const hit of batch) {
      const key = hitKey(hit);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(hit);
    }
  }
  return out;
}

export async function lookupLyrics(
  song: string,
  artist: string
): Promise<LyricMatch | null> {
  const trackName = song.trim();
  const artistName = artist.trim();
  if (!trackName) return null;

  const trackSimp = toSimplified(trackName);
  const artistSimp = toSimplified(artistName);

  const batches: LyricHit[][] = [];
  batches.push(
    await fetchLrclibSearch({ trackName, artistName: artistName || undefined })
  );

  if (trackSimp !== trackName || artistSimp !== artistName) {
    batches.push(
      await fetchLrclibSearch({
        trackName: trackSimp,
        artistName: artistSimp || undefined,
      })
    );
  }

  // Fuzzy q= helps when metadata is Live-tagged or script-mixed.
  const qParts = [trackSimp || trackName, artistSimp || artistName].filter(
    Boolean
  );
  if (qParts.length > 0) {
    batches.push(await fetchLrclibSearch({ q: qParts.join(" ") }));
  }

  const hits = mergeHits(...batches);
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
