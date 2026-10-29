import {
  parseKey,
  parseVocalRange,
  type VocalRangeReport,
} from "@/lib/pitch/vocal-range";

/**
 * Curated sounding concert keys (not guitar fingerings / Capo shapes).
 * Used to correct Gemini when it confuses Capo charts with concert pitch.
 */
const KNOWN: Array<{ song: string; artist?: string; key: string }> = [
  { song: "像風一樣", artist: "單依純", key: "A major" },
  { song: "像风一样", artist: "单依纯", key: "A major" },
  { song: "葡萄成熟時", artist: "陳奕迅", key: "G major" },
  { song: "葡萄成熟时", artist: "陈奕迅", key: "G major" },
];

function norm(s: string): string {
  return s
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s\-_/·．.]+/g, "");
}

/** Look up published concert key for song (+ optional artist). */
export function lookupKnownSongKey(
  songName: string,
  artist?: string | null
): string | null {
  const song = norm(songName);
  if (!song) return null;
  const art = artist ? norm(artist) : "";
  const withArtist = art
    ? KNOWN.find((k) => norm(k.song) === song && k.artist && norm(k.artist) === art)
    : null;
  if (withArtist) return parseKey(withArtist.key)?.label ?? withArtist.key;
  const bySong = KNOWN.find((k) => norm(k.song) === song);
  return bySong ? parseKey(bySong.key)?.label ?? bySong.key : null;
}

function transposeKeyLabel(key: string, semitones: number): string | null {
  const parsed = parseKey(key);
  if (!parsed) return null;
  const pc = ((parsed.pc + semitones) % 12 + 12) % 12;
  const names = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  return parsed.minor ? `${names[pc]} minor` : `${names[pc]} major`;
}

/**
 * Force song_key from curated catalog. Preserve Gemini's relative
 * transposition (if it said same-as-original → keep 0; else keep shift).
 */
export function applyKnownSongKey(
  range: VocalRangeReport | null,
  knownSongKey: string | null
): VocalRangeReport | null {
  if (!range || !knownSongKey) return range;
  const known = parseKey(knownSongKey)?.label ?? knownSongKey;
  const gSong = parseKey(range.song_key);
  const gUser = parseKey(range.user_key);

  let user_key = range.user_key;
  if (gSong && gUser) {
    const relative = gUser.pc - gSong.pc;
    // Same key reported (even if both wrong) → align user to known original.
    if (((relative % 12) + 12) % 12 === 0) {
      user_key = known;
    } else {
      user_key = transposeKeyLabel(known, relative) ?? range.user_key;
    }
  } else if (!range.user_key) {
    user_key = known;
  }

  return parseVocalRange({
    ...range,
    song_key: known,
    user_key,
  });
}
