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
    lowest_midi: 39, // false D#2 from DSP rumble
    highest_midi: 70,
    lowest_note: "D#2",
    highest_note: "A#3",
    song_key: null,
    user_key: "A# major",
    key_shift_semitones: null,
    source: "measured",
  },
  {
    version: 1,
    lowest_midi: null,
    highest_midi: null,
    lowest_note: "B2",
    highest_note: "A4",
    song_key: "G major",
    user_key: "G major",
    key_shift_semitones: 0,
    source: "gemini",
  }
);
assert(merged?.lowest_note === "B2", "gemini overrides false DSP low");
assert(merged?.highest_note === "A4", "gemini overrides false DSP high");
assert(merged?.song_key === "G major", "gemini song key");
// Gemini mirrored song→user; prefer measured sung-key instead of forcing equal.
assert(merged?.user_key === "A# major", "measured sung key when gemini mirrored");
assert(merged?.key_shift_semitones === 3, "G→A# shift from measured user");
assert(merged?.source === "measured+gemini", "source");

const shiftFix = mergeVocalRange(
  {
    version: 1,
    lowest_midi: 45,
    highest_midi: 69,
    lowest_note: "A2",
    highest_note: "A4",
    song_key: null,
    user_key: "A# major", // noisy chroma — must be ignored
    key_shift_semitones: null,
    source: "measured",
  },
  {
    version: 1,
    lowest_midi: null,
    highest_midi: null,
    lowest_note: "B2",
    highest_note: "A4",
    song_key: "G major",
    user_key: "A# major",
    key_shift_semitones: 1, // wrong model math — must recompute to +3
    source: "gemini",
  }
);
assert(shiftFix?.key_shift_semitones === 3, "G→A# is +3 not Gemini's +1");
assert(shiftFix?.user_key === "A# major", "keep gemini sung key");
assert(
  mergeVocalRange(null, {
    version: 1,
    lowest_note: "B2",
    highest_note: "A4",
    song_key: "G major",
    user_key: "G major",
    key_shift_semitones: 99,
    source: "gemini",
  })?.key_shift_semitones === 0,
  "recompute 0 when keys match"
);

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
