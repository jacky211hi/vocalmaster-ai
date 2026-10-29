import { Converter as ToSimplified } from "opencc-js/t2cn";
import { Converter as ToTraditional } from "opencc-js/cn2t";

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
const toSimplified = ToSimplified({ from: "t", to: "cn" });
/** Simplified → Traditional for display / Gemini quoting when user typed 繁體. */
const toTraditional = ToTraditional({ from: "cn", to: "t" });

function norm(value: string): string {
  return toSimplified(value)
    .toLowerCase()
    .replace(/[（(].*?[)）]/g, "")
    .replace(/[\s'’"“”·・,，.。!！?？\-—_]/g, "");
}

/** True when converting to simplified changes the string (has Traditional forms). */
export function looksTraditional(value: string): boolean {
  const s = value.trim();
  if (!s) return false;
  return toSimplified(s) !== s;
}

function hitKey(hit: LyricHit): string {
  if (hit.id != null) return `id:${hit.id}`;
  return `t:${hit.trackName ?? ""}|a:${hit.artistName ?? ""}|al:${hit.albumName ?? ""}`;
}

function hitLooksTraditional(hit: LyricHit): boolean {
  const sample = [
    hit.trackName ?? "",
    hit.artistName ?? "",
    (hit.syncedLyrics || hit.plainLyrics || "").slice(0, 240),
  ].join("");
  return looksTraditional(sample);
}

export function pickLyricHit(
  song: string,
  artist: string,
  hits: LyricHit[],
  opts?: { preferTraditional?: boolean }
): LyricHit | null {
  const songN = norm(song);
  const artistN = norm(artist);
  if (!songN) return null;
  const preferTraditional = Boolean(opts?.preferTraditional);

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
    if (preferTraditional) {
      score += hitLooksTraditional(hit) ? 2 : 0;
    }
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
  artist: string,
  opts?: { preferTraditional?: boolean }
): Promise<LyricMatch | null> {
  const trackName = song.trim();
  const artistName = artist.trim();
  if (!trackName) return null;

  const preferTraditional =
    opts?.preferTraditional ??
    looksTraditional(`${trackName}${artistName}`);
  const trackSimp = toSimplified(trackName);
  const artistSimp = toSimplified(artistName);

  // Prefer original script query first (usually Traditional for HK/TW users).
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
  // Prefer traditional query string first when user typed 繁體.
  const qTrad = [trackName, artistName].filter(Boolean).join(" ");
  const qSimp = [trackSimp || trackName, artistSimp || artistName]
    .filter(Boolean)
    .join(" ");
  if (preferTraditional && qTrad) {
    batches.push(await fetchLrclibSearch({ q: qTrad }));
    if (qSimp && qSimp !== qTrad) {
      batches.push(await fetchLrclibSearch({ q: qSimp }));
    }
  } else if (qSimp) {
    batches.push(await fetchLrclibSearch({ q: qSimp }));
  }

  const hits = mergeHits(...batches);
  const hit = pickLyricHit(trackName, artistName, hits, {
    preferTraditional,
  });
  if (!hit) return null;
  const synced = (hit.syncedLyrics ?? "").trim();
  const plain = (hit.plainLyrics ?? "").trim();
  let text = (synced || plain).slice(0, 6000);
  if (!text) return null;

  let track = hit.trackName?.trim() || trackName;
  let artistOut = hit.artistName?.trim() || artistName;

  // User typed Traditional → keep / convert lyrics to Traditional for Gemini quotes.
  if (preferTraditional) {
    text = toTraditional(text);
    track = toTraditional(track);
    artistOut = toTraditional(artistOut);
  }

  return {
    track,
    artist: artistOut,
    text,
    synced: Boolean(synced),
  };
}

export function lyricsPrompt(match: LyricMatch): string {
  return [
    "OFFICIAL_LYRICS (authoritative published lyrics — MUST use these; ASR from audio is unreliable):",
    `Track: ${match.track}`,
    `Artist: ${match.artist}`,
    match.synced
      ? "Lines may include [mm:ss] from the original studio recording. Those times are NOT the user's clip clock. The user's clip starts at 0:00."
      : "No studio timestamps. Align lines by listening, using the user's clip clock starting at 0:00.",
    "In timed-section analysis, each section title MUST be an exact copy from the text below (character-accurate).",
    "FORBIDDEN: inventing homophones, paraphrases, or speech-recognized fake lyrics, then coaching those fake words.",
    "If you cannot match a line confidently, write the unmatched placeholder — do not invent words.",
    match.text,
  ].join("\n");
}
