import {
  aggregateVocalRanges,
  estimateKeyFromMidi,
  formatKeyShift,
  mergeVocalRange,
  parseKey,
  parseNoteToMidi,
  parseVocalRange,
} from "./vocal-range";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

assert(parseNoteToMidi("A4") === 69, "A4 midi");
assert(parseNoteToMidi("C4") === 60, "C4 midi");
assert(parseNoteToMidi("C#4") === 61, "C#4 midi");

assert(parseKey("Am")?.label === "A minor", "Am");
assert(parseKey("G major")?.label === "G major", "G major");
assert(parseKey("F#m")?.label === "F# minor", "F#m");

assert(formatKeyShift(-2) === "低咗 2 個半音", "shift down");
assert(formatKeyShift(0) === "同原曲 key", "shift zero");

const C_majorish = [
  60, 62, 64, 65, 67, 69, 71, 72, 60, 64, 67, 72, 60, 62, 64, 67,
];
const key = estimateKeyFromMidi(C_majorish);
assert(key?.startsWith("C"), `expected C* got ${key}`);

const merged = mergeVocalRange(
  {
    version: 1,
    lowest_midi: 57,
    highest_midi: 76,
    lowest_note: "A3",
    highest_note: "E5",
    song_key: null,
    user_key: "F major",
    key_shift_semitones: null,
    source: "measured",
  },
  {
    version: 1,
    lowest_midi: null,
    highest_midi: null,
    lowest_note: "G3",
    highest_note: "F5",
    song_key: "G major",
    user_key: "F major",
    key_shift_semitones: -2,
    source: "gemini",
  }
);
assert(merged?.lowest_note === "A3", "prefer measured low");
assert(merged?.song_key === "G major", "gemini song key");
assert(merged?.key_shift_semitones === -2, "shift");
assert(merged?.source === "measured+gemini", "source");

const agg = aggregateVocalRanges([
  parseVocalRange({
    version: 1,
    lowest_note: "A3",
    highest_note: "D5",
    song_key: "C major",
    user_key: "C major",
    source: "gemini",
  }),
  parseVocalRange({
    version: 1,
    lowest_note: "G3",
    highest_note: "E5",
    song_key: "G major",
    user_key: "F major",
    source: "gemini",
  }),
]);
assert(agg?.lowest_note === "G3", "agg low");
assert(agg?.highest_note === "E5", "agg high");

console.log("vocal-range ok");
