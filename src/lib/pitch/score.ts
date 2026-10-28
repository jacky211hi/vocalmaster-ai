import { buildExercise, type Exercise, type ExerciseId } from "@/lib/pitch/exercises";
import { centsBetween, hzToMidi } from "@/lib/pitch/notes";
import { detectPitch } from "@/lib/pitch/yin";

export const CENTS_TOLERANCE = 50;
export const ONSET_LATE_MS = 200;
export const ONSET_EARLY_MS = 80;
const ANALYSIS_SR = 16000;
const WINDOW = 1024;
const HOP = 320;
const TRACE_STEP = 0.05;

export type PitchPoint = { t: number; midi: number | null };

export type NoteScore = {
  midi: number;
  label: string;
  hitRatio: number;
  meanCents: number | null;
  onsetLagMs: number | null;
};

export type PitchReport = {
  version: 1;
  exerciseId: ExerciseId;
  exerciseName: string;
  tonicMidi: number;
  duration: number;
  pitchScore: number;
  rhythmScore: number;
  inTuneRatio: number;
  coverage: number;
  meanAbsCents: number | null;
  notesOnTime: number;
  noteCount: number;
  centsTolerance: number;
  onsetLateMs: number;
  notes: NoteScore[];
  trace: PitchPoint[];
  windows: {
    midi: number;
    label: string;
    start: number;
    singStart: number;
    singEnd: number;
  }[];
};

type Frame = { t: number; hz: number | null; midi: number | null };

export function downsample(
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
    const end = Math.min(input.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / (end - start);
  }
  return out;
}

/**
 * samples[0] is exercise time 0. Pads or trims so the buffer matches that clock.
 */
export function timelineFromChunks(
  chunks: Float32Array[],
  firstSampleTime: number,
  originTime: number,
  sampleRate: number,
  duration: number
): Float32Array {
  const total = Math.max(1, Math.round(duration * sampleRate));
  const out = new Float32Array(total);
  let combinedLen = 0;
  for (const c of chunks) combinedLen += c.length;
  const combined = new Float32Array(combinedLen);
  let offset = 0;
  for (const c of chunks) {
    combined.set(c, offset);
    offset += c.length;
  }
  const originIndex = Math.round((originTime - firstSampleTime) * sampleRate);
  for (let i = 0; i < total; i++) {
    const src = i + originIndex;
    if (src >= 0 && src < combined.length) out[i] = combined[src];
  }
  return out;
}

export function scoreExercise(
  samples: Float32Array,
  sampleRate: number,
  exercise: Exercise
): PitchReport {
  const audio =
    sampleRate > ANALYSIS_SR + 1
      ? downsample(samples, sampleRate, ANALYSIS_SR)
      : samples;
  const sr = sampleRate > ANALYSIS_SR + 1 ? ANALYSIS_SR : sampleRate;
  const frames = analyzeFrames(audio, sr, exercise.duration);
  return reportFromFrames(frames, exercise);
}

function analyzeFrames(
  samples: Float32Array,
  sampleRate: number,
  duration: number
): Frame[] {
  const frames: Frame[] = [];
  if (samples.length < WINDOW) return frames;
  const last = Math.min(samples.length - WINDOW, Math.floor(duration * sampleRate));
  for (let start = 0; start <= last; start += HOP) {
    const frame = samples.subarray(start, start + WINDOW);
    const t = (start + WINDOW / 2) / sampleRate;
    if (t > duration) break;
    const hz = detectPitch(frame, sampleRate);
    frames.push({
      t,
      hz,
      midi: hz ? hzToMidi(hz) : null,
    });
  }
  return frames;
}

function reportFromFrames(frames: Frame[], exercise: Exercise): PitchReport {
  let expected = 0;
  let hits = 0;
  let voiced = 0;
  let absSum = 0;
  let onTime = 0;
  const notes: NoteScore[] = [];

  for (const w of exercise.windows) {
    let noteExpected = 0;
    let noteHits = 0;
    let noteVoiced = 0;
    let noteAbs = 0;
    let noteSigned = 0;
    let onset: number | null = null;
    for (const frame of frames) {
      if (frame.t < w.singStart || frame.t >= w.singEnd) continue;
      noteExpected++;
      if (frame.hz == null) continue;
      noteVoiced++;
      const cents = centsBetween(frame.hz, w.midi);
      noteAbs += Math.abs(cents);
      noteSigned += cents;
      const inTune = Math.abs(cents) <= CENTS_TOLERANCE;
      if (inTune) {
        noteHits++;
        if (onset == null) onset = frame.t;
      }
    }
    expected += noteExpected;
    hits += noteHits;
    voiced += noteVoiced;
    absSum += noteAbs;
    const lagMs = onset == null ? null : Math.round((onset - w.singStart) * 1000);
    if (
      lagMs != null &&
      lagMs >= -ONSET_EARLY_MS &&
      lagMs <= ONSET_LATE_MS
    ) {
      onTime++;
    }
    notes.push({
      midi: w.midi,
      label: w.label,
      hitRatio: noteExpected ? noteHits / noteExpected : 0,
      meanCents: noteVoiced ? Math.round(noteSigned / noteVoiced) : null,
      onsetLagMs: lagMs,
    });
  }

  const trace: PitchPoint[] = [];
  for (let t = TRACE_STEP / 2; t < exercise.duration; t += TRACE_STEP) {
    let best: Frame | null = null;
    let bestDist = Infinity;
    for (const frame of frames) {
      const dist = Math.abs(frame.t - t);
      if (dist < bestDist) {
        bestDist = dist;
        best = frame;
      }
    }
    trace.push({
      t: Math.round(t * 1000) / 1000,
      midi:
        best && bestDist < TRACE_STEP && best.midi != null
          ? Math.round(best.midi * 100) / 100
          : null,
    });
  }

  const pitchScore = expected ? Math.round((100 * hits) / expected) : 0;
  const rhythmScore = exercise.windows.length
    ? Math.round((100 * onTime) / exercise.windows.length)
    : 0;

  return {
    version: 1,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    tonicMidi: exercise.tonicMidi,
    duration: exercise.duration,
    pitchScore: clamp(pitchScore),
    rhythmScore: clamp(rhythmScore),
    inTuneRatio: expected ? hits / expected : 0,
    coverage: expected ? voiced / expected : 0,
    meanAbsCents: voiced ? Math.round(absSum / voiced) : null,
    notesOnTime: onTime,
    noteCount: exercise.windows.length,
    centsTolerance: CENTS_TOLERANCE,
    onsetLateMs: ONSET_LATE_MS,
    notes,
    trace,
    windows: exercise.windows.map((w) => ({
      midi: w.midi,
      label: w.label,
      start: round3(w.start),
      singStart: round3(w.singStart),
      singEnd: round3(w.singEnd),
    })),
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function scoreExerciseById(
  samples: Float32Array,
  sampleRate: number,
  exerciseId: ExerciseId,
  tonicMidi: number
): PitchReport {
  return scoreExercise(samples, sampleRate, buildExercise(exerciseId, tonicMidi));
}
