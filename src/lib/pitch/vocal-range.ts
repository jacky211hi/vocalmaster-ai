import { hzToMidi, noteName } from "@/lib/pitch/notes";
import {
  detectPitchDetailed,
  SINGING_MAX_HZ,
  SINGING_MIN_HZ,
} from "@/lib/pitch/yin";

const ANALYSIS_SR = 16000;
const WINDOW = 2048;
const HOP = 320;
/** ~F2–C6 in MIDI (matches SINGING_MIN/MAX_HZ). */
const MIN_MIDI = hzToMidi(SINGING_MIN_HZ);
const MAX_MIDI = hzToMidi(SINGING_MAX_HZ);
const MIN_CLARITY = 0.85;

function downsample(
  input: Float32Array,
  fromSr: number,
  toSr: number
): Float32Array {
  if (fromSr <= toSr + 1) return input;
  const ratio = fromSr / toSr;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(
      input.length,
      Math.max(start + 1, Math.floor((i + 1) * ratio))
    );
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / (end - start);
  }
  return out;
}

/** Scientific pitch + common key labels for coaching UI. */
export type VocalRangeReport = {
  version: 1;
  lowest_midi: number | null;
  highest_midi: number | null;
  lowest_note: string | null;
  highest_note: string | null;
  /** Estimated original / published key of the song (e.g. "G major"). */
  song_key: string | null;
  /** Estimated key the user sang in. */
  user_key: string | null;
  /** user − song, in semitones (negative = sung lower). */
  key_shift_semitones: number | null;
  source: "measured" | "gemini" | "measured+gemini";
};

const NOTE_RE = /^([A-Ga-g])([#b]?)(-?\d+)$/;
const KEY_RE =
  /^([A-Ga-g])([#b]?)\s*(major|minor|maj|min|M|m)?$/i;

const MAJOR_PROFILE = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
];
const MINOR_PROFILE = [
  6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
];

export function parseNoteToMidi(note: string | null | undefined): number | null {
  if (!note) return null;
  const m = String(note).trim().match(NOTE_RE);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  const accidental = m[2];
  const oct = Number(m[3]);
  if (!Number.isFinite(oct)) return null;
  const base: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  let pc = base[letter];
  if (pc == null) return null;
  if (accidental === "#") pc += 1;
  if (accidental === "b") pc -= 1;
  pc = ((pc % 12) + 12) % 12;
  return (oct + 1) * 12 + pc;
}

/** Parse "G major", "Am", "F#m", "Bb maj" → pitch-class + mode. */
export function parseKey(
  key: string | null | undefined
): { pc: number; minor: boolean; label: string } | null {
  if (!key) return null;
  let raw = String(key).trim().replace(/♮/g, "");
  raw = raw.replace(/大調/g, " major").replace(/小調/g, " minor");
  // Am / F#m shorthand (before expanding maj/min tokens)
  const short = raw.match(/^([A-Ga-g])([#b]?)m$/i);
  if (short) {
    raw = `${short[1]}${short[2]} minor`;
  } else {
    raw = raw
      .replace(/\bmaj(?:or)?\b/gi, "major")
      .replace(/\bmin(?:or)?\b/gi, "minor");
  }
  const m = raw.match(KEY_RE);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  const accidental = m[2] || "";
  const mode = (m[3] || "major").toLowerCase();
  const minor =
    mode === "minor" || mode === "min" || mode === "m";
  const base: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  let pc = base[letter];
  if (pc == null) return null;
  if (accidental === "#") pc += 1;
  if (accidental === "b") pc -= 1;
  pc = ((pc % 12) + 12) % 12;
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const root = names[pc];
  const label = minor ? `${root} minor` : `${root} major`;
  return { pc, minor, label };
}

export function formatKeyShift(semitones: number | null): string | null {
  if (semitones == null || !Number.isFinite(semitones)) return null;
  const n = Math.round(semitones);
  if (n === 0) return "同原曲 key";
  if (n > 0) return `高咗 ${n} 個半音`;
  return `低咗 ${-n} 個半音`;
}

function correlate(a: number[], b: number[]): number {
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < 12; i++) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= 12;
  meanB /= 12;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < 12; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den > 0 ? num / den : 0;
}

function rotate(profile: number[], shift: number): number[] {
  const out = new Array(12).fill(0);
  for (let i = 0; i < 12; i++) out[(i + shift) % 12] = profile[i];
  return out;
}

/** Krumhansl–Schmuckler key estimate from MIDI samples. */
export function estimateKeyFromMidi(midis: number[]): string | null {
  if (midis.length < 8) return null;
  const chroma = new Array(12).fill(0);
  for (const m of midis) {
    const pc = ((Math.round(m) % 12) + 12) % 12;
    chroma[pc] += 1;
  }
  let best = -Infinity;
  let bestLabel: string | null = null;
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  for (let root = 0; root < 12; root++) {
    const maj = correlate(chroma, rotate(MAJOR_PROFILE, root));
    const min = correlate(chroma, rotate(MINOR_PROFILE, root));
    if (maj > best) {
      best = maj;
      bestLabel = `${names[root]} major`;
    }
    if (min > best) {
      best = min;
      bestLabel = `${names[root]} minor`;
    }
  }
  return bestLabel;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Measure sung range from PCM.
 * Keeps only confident YIN frames (clarity ≥ 0.85), clamps F0 to 85–1050 Hz,
 * then takes 5th / 98.5th percentile so climax peaks (G4–B4) are not clipped.
 */
export function measureVocalRangeFromSamples(
  samples: Float32Array,
  sampleRate: number
): Pick<
  VocalRangeReport,
  | "lowest_midi"
  | "highest_midi"
  | "lowest_note"
  | "highest_note"
  | "user_key"
  | "source"
> | null {
  const audio =
    sampleRate > ANALYSIS_SR + 1
      ? downsample(samples, sampleRate, ANALYSIS_SR)
      : samples;
  const sr = sampleRate > ANALYSIS_SR + 1 ? ANALYSIS_SR : sampleRate;
  const duration = audio.length / sr;
  if (duration < 0.4) return null;

  const midis: number[] = [];
  const last = Math.min(audio.length - WINDOW, Math.floor(duration * sr));
  for (let start = 0; start <= last; start += HOP) {
    const frame = audio.subarray(start, start + WINDOW);
    const est = detectPitchDetailed(frame, sr);
    if (!est || est.clarity < MIN_CLARITY) continue;
    if (est.hz < SINGING_MIN_HZ || est.hz > SINGING_MAX_HZ) continue;
    const midi = hzToMidi(est.hz);
    if (midi < MIN_MIDI || midi > MAX_MIDI) continue;
    midis.push(midi);
  }
  if (midis.length < 16) return null;

  const sorted = [...midis].sort((a, b) => a - b);
  const low = percentile(sorted, 0.05);
  const high = percentile(sorted, 0.985);
  if (high - low < 1) return null;

  const lowest_midi = Math.round(low * 10) / 10;
  const highest_midi = Math.round(high * 10) / 10;
  return {
    lowest_midi,
    highest_midi,
    lowest_note: noteName(lowest_midi),
    highest_note: noteName(highest_midi),
    user_key: estimateKeyFromMidi(midis),
    source: "measured",
  };
}

export async function measureVocalRangeFromFile(
  file: File
): Promise<ReturnType<typeof measureVocalRangeFromSamples>> {
  try {
    const ctx = new AudioContext();
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const ch0 = buf.getChannelData(0);
    // mono mix if stereo
    let samples = ch0;
    if (buf.numberOfChannels > 1) {
      const ch1 = buf.getChannelData(1);
      samples = new Float32Array(ch0.length);
      for (let i = 0; i < ch0.length; i++) {
        samples[i] = (ch0[i] + ch1[i]) * 0.5;
      }
    }
    const result = measureVocalRangeFromSamples(samples, buf.sampleRate);
    await ctx.close().catch(() => undefined);
    return result;
  } catch {
    return null;
  }
}

function keyShiftSemitones(
  songKey: string | null,
  userKey: string | null
): number | null {
  const a = parseKey(songKey);
  const b = parseKey(userKey);
  if (!a || !b) return null;
  let diff = b.pc - a.pc;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return diff;
}

export function parseVocalRange(value: unknown): VocalRangeReport | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Partial<VocalRangeReport>;
  const lowest_note = r.lowest_note ? String(r.lowest_note) : null;
  const highest_note = r.highest_note ? String(r.highest_note) : null;
  let lowest_midi =
    typeof r.lowest_midi === "number" ? r.lowest_midi : parseNoteToMidi(lowest_note);
  let highest_midi =
    typeof r.highest_midi === "number"
      ? r.highest_midi
      : parseNoteToMidi(highest_note);
  const song_key = r.song_key ? String(r.song_key).trim() || null : null;
  const user_key = r.user_key ? String(r.user_key).trim() || null : null;
  if (
    !lowest_note &&
    !highest_note &&
    lowest_midi == null &&
    highest_midi == null &&
    !song_key &&
    !user_key
  ) {
    return null;
  }
  const songLabel = parseKey(song_key)?.label ?? song_key;
  const userLabel = parseKey(user_key)?.label ?? user_key;
  // Prefer recomputed shift from keys (fixes bad model math like G→A# = +1).
  const shift =
    keyShiftSemitones(songLabel, userLabel) ??
    (typeof r.key_shift_semitones === "number" ? r.key_shift_semitones : null);
  return {
    version: 1,
    lowest_midi,
    highest_midi,
    lowest_note: lowest_note ?? (lowest_midi != null ? noteName(lowest_midi) : null),
    highest_note:
      highest_note ?? (highest_midi != null ? noteName(highest_midi) : null),
    song_key: songLabel,
    user_key: userLabel,
    key_shift_semitones: shift,
    source:
      r.source === "measured" ||
      r.source === "gemini" ||
      r.source === "measured+gemini"
        ? r.source
        : "gemini",
  };
}

/**
 * Merge DSP hint with Gemini. Gemini wins for song_key / user_key / range
 * whenever it returns values — local YIN is only a soft fallback.
 */
export function mergeVocalRange(
  measured: Partial<VocalRangeReport> | null | undefined,
  fromGemini: Partial<VocalRangeReport> | null | undefined
): VocalRangeReport | null {
  if (!measured && !fromGemini) return null;
  const m = measured ?? {};
  const g = fromGemini ?? {};

  const gLow =
    parseNoteToMidi(g.lowest_note) ??
    (typeof g.lowest_midi === "number" ? g.lowest_midi : null);
  const gHigh =
    parseNoteToMidi(g.highest_note) ??
    (typeof g.highest_midi === "number" ? g.highest_midi : null);
  const mLow =
    typeof m.lowest_midi === "number"
      ? m.lowest_midi
      : parseNoteToMidi(m.lowest_note);
  const mHigh =
    typeof m.highest_midi === "number"
      ? m.highest_midi
      : parseNoteToMidi(m.highest_note);

  // Prefer Gemini range; fall back to measured only when Gemini omitted notes.
  const lowest_midi = gLow ?? mLow;
  const highest_midi = gHigh ?? mHigh;
  const lowest_note =
    g.lowest_note ||
    (lowest_midi != null ? noteName(lowest_midi) : null) ||
    m.lowest_note ||
    null;
  const highest_note =
    g.highest_note ||
    (highest_midi != null ? noteName(highest_midi) : null) ||
    m.highest_note ||
    null;

  // song_key: Gemini / known catalog only (never DSP).
  const song_key =
    parseKey(g.song_key)?.label ?? g.song_key ?? null;
  const gUser = parseKey(g.user_key)?.label ?? g.user_key ?? null;
  const mUser = parseKey(m.user_key)?.label ?? m.user_key ?? null;
  // user_key must be independent of song_key. Gemini often mirrors song→user;
  // when it does (or omits user), prefer measured sung-key estimate.
  const user_key =
    gUser && song_key && gUser !== song_key
      ? gUser
      : mUser ?? gUser ?? null;
  // Always recompute shift from parsed keys so UI never shows "G→A# = +1".
  const shift = keyShiftSemitones(song_key, user_key);

  const hasMeasured =
    typeof m.lowest_midi === "number" || typeof m.highest_midi === "number";
  const hasGemini = Boolean(
    g.song_key || g.user_key || g.lowest_note || g.highest_note
  );
  const source: VocalRangeReport["source"] =
    hasMeasured && hasGemini
      ? "measured+gemini"
      : hasMeasured
        ? "measured"
        : "gemini";
  return parseVocalRange({
    version: 1,
    lowest_midi,
    highest_midi,
    lowest_note,
    highest_note,
    song_key,
    user_key,
    key_shift_semitones: shift,
    source,
  });
}

export type AggregateVocalRange = {
  lowest_note: string;
  highest_note: string;
  lowest_midi: number;
  highest_midi: number;
  span_semitones: number;
  sampleCount: number;
  typical_user_key: string | null;
};

export function aggregateVocalRanges(
  reports: (VocalRangeReport | null | undefined)[]
): AggregateVocalRange | null {
  const lows: number[] = [];
  const highs: number[] = [];
  const keys = new Map<string, number>();
  for (const r of reports) {
    if (!r) continue;
    const lo = r.lowest_midi ?? parseNoteToMidi(r.lowest_note);
    const hi = r.highest_midi ?? parseNoteToMidi(r.highest_note);
    if (lo != null) lows.push(lo);
    if (hi != null) highs.push(hi);
    const k = parseKey(r.user_key)?.label;
    if (k) keys.set(k, (keys.get(k) ?? 0) + 1);
  }
  if (lows.length === 0 || highs.length === 0) return null;
  const lowest_midi = Math.min(...lows);
  const highest_midi = Math.max(...highs);
  let typical_user_key: string | null = null;
  let best = 0;
  for (const [k, n] of keys) {
    if (n > best) {
      best = n;
      typical_user_key = k;
    }
  }
  return {
    lowest_midi,
    highest_midi,
    lowest_note: noteName(lowest_midi),
    highest_note: noteName(highest_midi),
    span_semitones: Math.round(highest_midi - lowest_midi),
    sampleCount: Math.min(lows.length, highs.length),
    typical_user_key,
  };
}
