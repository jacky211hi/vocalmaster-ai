import {
  applyKnownSongKey,
  lookupKnownSongKey,
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
assert(fixed?.user_key === "A major", `user ${fixed?.user_key}`);
assert(fixed?.key_shift_semitones === 0, `shift ${fixed?.key_shift_semitones}`);

const shifted = applyKnownSongKey(
  parseVocalRange({
    version: 1,
    lowest_note: "G3",
    highest_note: "C5",
    song_key: "F major",
    user_key: "G major", // +2 relative to wrong F
    key_shift_semitones: 2,
    source: "gemini",
  }),
  "A major"
);
assert(shifted?.song_key === "A major", "shifted song");
assert(shifted?.user_key === "B major", `shifted user ${shifted?.user_key}`);
assert(shifted?.key_shift_semitones === 2, "keep relative +2");

console.log("known-keys ok");
