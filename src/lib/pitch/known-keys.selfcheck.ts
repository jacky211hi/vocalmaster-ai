import {
  applyKnownSongKey,
  lookupKnownSongKey,
  lookupKnownSongKeyHit,
  resolveVocalRangeForDisplay,
} from "@/lib/pitch/known-keys";
import { parseVocalRange } from "@/lib/pitch/vocal-range";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(
  lookupKnownSongKey("像風一樣", "單依純") === "A major",
  "shan yichun A"
);
assert(lookupKnownSongKey("像风一样", "单依纯") === "A major", "simp A");
assert(
  lookupKnownSongKey("葡萄成熟時", "陳奕迅") === "G major",
  "eason G"
);
assert(
  lookupKnownSongKey("十面埋伏", "陳奕迅") === "C major",
  "ambush C"
);
// Empty artist still resolves unique catalog song
assert(lookupKnownSongKey("十面埋伏", "") === "C major", "ambush no artist");
assert(
  lookupKnownSongKey("十面埋伏 (Live)", null) === "C major",
  "ambush live suffix"
);
assert(
  lookupKnownSongKeyHit("十面埋伏", "")?.verified === true,
  "verified hit"
);

const fixed = applyKnownSongKey(
  parseVocalRange({
    version: 1,
    lowest_note: "A3",
    highest_note: "D5",
    song_key: "F major",
    user_key: "F major",
    key_shift_semitones: 0,
    source: "gemini",
  }),
  "A major"
);
assert(fixed?.song_key === "A major", `song ${fixed?.song_key}`);
assert(fixed?.user_key === "F major", `user kept ${fixed?.user_key}`);
assert(fixed?.key_shift_semitones === -4, `shift ${fixed?.key_shift_semitones}`);

const display = resolveVocalRangeForDisplay(
  parseVocalRange({
    version: 1,
    lowest_note: "B2",
    highest_note: "F#4",
    song_key: "D major",
    user_key: "D# minor",
    key_shift_semitones: 1,
    source: "gemini",
  }),
  "十面埋伏",
  ""
);
assert(display.songKeyVerified, "display verified");
assert(display.report?.song_key === "C major", "display corrects D→C");
assert(display.report?.user_key === "D# minor", "keep sung key");

console.log("known-keys ok");
