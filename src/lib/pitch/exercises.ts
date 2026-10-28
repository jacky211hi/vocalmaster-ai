import { midiToHz, noteLabel } from "@/lib/pitch/notes";

export type ExerciseId = "sustain" | "scale" | "intervals";

export type ScoreWindow = {
  midi: number;
  label: string;
  /** Cue tone plays [start, singStart). Scoring uses [singStart, singEnd). */
  start: number;
  singStart: number;
  singEnd: number;
};

export type Exercise = {
  id: ExerciseId;
  name: string;
  description: string;
  tonicMidi: number;
  duration: number;
  countIn: number;
  clicks: number[];
  windows: ScoreWindow[];
};

export const TONIC_PRESETS = [
  { midi: 55, label: "低音", hint: "G3" },
  { midi: 60, label: "中音", hint: "C4" },
  { midi: 65, label: "高音", hint: "F4" },
] as const;

export const EXERCISE_META: {
  id: ExerciseId;
  name: string;
  description: string;
}[] = [
  {
    id: "sustain",
    name: "長音",
    description: "聽完提示音，穩穩唱同一個音約 6 秒。",
  },
  {
    id: "scale",
    name: "大調音階",
    description: "Do Re Mi Fa Sol，再落返 Do。每粒音跟提示音唱。",
  },
  {
    id: "intervals",
    name: "三度與五度",
    description: "主音走到高三度、高五度，再回到主音。",
  },
];

const COUNT_IN = 2;

export function isExerciseId(value: string): value is ExerciseId {
  return value === "sustain" || value === "scale" || value === "intervals";
}

export function buildExercise(id: ExerciseId, tonicMidi: number): Exercise {
  const tonic = Math.round(tonicMidi);
  if (id === "sustain") {
    return finish(id, tonic, [{ semi: 0, cue: 0.55, sing: 6, gap: 0 }]);
  }
  if (id === "scale") {
    return finish(
      id,
      tonic,
      [0, 2, 4, 5, 7, 5, 4, 2, 0].map((semi) => ({
        semi,
        cue: 0.32,
        sing: 0.95,
        gap: 0.12,
      }))
    );
  }
  return finish(
    id,
    tonic,
    [0, 4, 0, 7, 0].map((semi) => ({
      semi,
      cue: 0.38,
      sing: 1.05,
      gap: 0.16,
    }))
  );
}

function finish(
  id: ExerciseId,
  tonic: number,
  notes: { semi: number; cue: number; sing: number; gap: number }[]
): Exercise {
  const meta = EXERCISE_META.find((e) => e.id === id)!;
  const clicks = [0, 0.5, 1, 1.5];
  let t = COUNT_IN;
  const windows: ScoreWindow[] = notes.map((note) => {
    const start = t;
    const singStart = t + note.cue;
    const singEnd = singStart + note.sing;
    t = singEnd + note.gap;
    const midi = tonic + note.semi;
    return {
      midi,
      label: noteLabel(midi, tonic),
      start,
      singStart,
      singEnd,
    };
  });
  const duration = windows[windows.length - 1].singEnd + 0.25;
  return {
    id,
    name: meta.name,
    description: meta.description,
    tonicMidi: tonic,
    duration,
    countIn: COUNT_IN,
    clicks,
    windows,
  };
}

export function cueHz(midi: number): number {
  return midiToHz(midi);
}

export type PlayRegion =
  | { kind: "count-in"; label: string }
  | { kind: "cue" | "sing"; label: string; midi: number }
  | { kind: "gap"; label: string };

export function regionAt(exercise: Exercise, time: number): PlayRegion {
  if (time < exercise.countIn) return { kind: "count-in", label: "預備" };
  for (const w of exercise.windows) {
    if (time >= w.start && time < w.singStart) {
      return { kind: "cue", label: `聽 ${w.label}`, midi: w.midi };
    }
    if (time >= w.singStart && time < w.singEnd) {
      return { kind: "sing", label: w.label, midi: w.midi };
    }
  }
  return { kind: "gap", label: "換氣" };
}
