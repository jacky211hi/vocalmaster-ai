import {
  parseKey,
  parseVocalRange,
  type VocalRangeReport,
} from "@/lib/pitch/vocal-range";

/**
 * Curated sounding concert keys (not guitar fingerings / Capo shapes).
 * Used as the authoritative original key when song (+ optional artist) matches.
 */
const KNOWN: Array<{ song: string; artist?: string; key: string }> = [
  { song: "像風一樣", artist: "單依純", key: "A major" },
  { song: "像风一样", artist: "单依纯", key: "A major" },
  { song: "葡萄成熟時", artist: "陳奕迅", key: "G major" },
  { song: "葡萄成熟时", artist: "陈奕迅", key: "G major" },
  { song: "十面埋伏", artist: "陳奕迅", key: "C major" },
  { song: "十面埋伏", artist: "陈奕迅", key: "C major" },
];

function norm(s: string): string {
  return s
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[（(][^）)]*[）)]/g, "") // drop (Live) / （現場）
    .replace(/[\s\-_/·．.]+/g, "");
}

export type KnownSongKeyHit = {
  key: string;
  /** Canonical artist from catalog when matched. */
  artist: string | null;
  verified: true;
};

/** Look up published concert key for song (+ optional artist). */
export function lookupKnownSongKey(
  songName: string,
  artist?: string | null
): string | null {
  return lookupKnownSongKeyHit(songName, artist)?.key ?? null;
}

export function lookupKnownSongKeyHit(
  songName: string,
  artist?: string | null
): KnownSongKeyHit | null {
  const song = norm(songName);
  if (!song) return null;
  const art = artist ? norm(artist) : "";

  if (art) {
    const withArtist = KNOWN.find(
      (k) => norm(k.song) === song && k.artist && norm(k.artist) === art
    );
    if (withArtist) {
      return {
        key: parseKey(withArtist.key)?.label ?? withArtist.key,
        artist: withArtist.artist ?? null,
        verified: true,
      };
    }
  }

  // Artist missing / mismatched — still trust unique song title in catalog.
  const bySong = KNOWN.filter((k) => norm(k.song) === song);
  if (bySong.length === 0) return null;
  const keys = new Set(
    bySong.map((k) => parseKey(k.key)?.label ?? k.key)
  );
  if (keys.size !== 1) return null;
  const hit = bySong[0];
  return {
    key: parseKey(hit.key)?.label ?? hit.key,
    artist: hit.artist ?? null,
    verified: true,
  };
}

/**
 * Force song_key from curated catalog only.
 * Never rewrite user_key — sung key must stay an independent estimate.
 */
export function applyKnownSongKey(
  range: VocalRangeReport | null,
  knownSongKey: string | null
): VocalRangeReport | null {
  if (!knownSongKey) return range;
  const known = parseKey(knownSongKey)?.label ?? knownSongKey;
  if (!range) {
    return parseVocalRange({
      version: 1,
      lowest_note: null,
      highest_note: null,
      song_key: known,
      user_key: null,
      key_shift_semitones: null,
      source: "gemini",
    });
  }
  return parseVocalRange({
    ...range,
    song_key: known,
  });
}

/** Display-time correction: catalog song_key wins; recompute shift vs user_key. */
export function resolveVocalRangeForDisplay(
  report: VocalRangeReport | null,
  songName: string,
  artist?: string | null
): { report: VocalRangeReport | null; songKeyVerified: boolean } {
  if (!report) return { report: null, songKeyVerified: false };
  const hit = lookupKnownSongKeyHit(songName, artist);
  if (!hit) return { report, songKeyVerified: false };
  return {
    report: applyKnownSongKey(report, hit.key),
    songKeyVerified: true,
  };
}
