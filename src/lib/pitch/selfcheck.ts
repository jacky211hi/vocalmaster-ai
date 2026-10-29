import { midiToHz } from "./notes";
import { buildExercise } from "./exercises";
import { scoreExercise } from "./score";
import { decodeWav, encodeWav } from "./wav";
import { detectPitch } from "./yin";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

function sineWindow(
  sr: number,
  duration: number,
  hz: number,
  from: number,
  to: number,
  amp = 0.25
): Float32Array {
  const n = Math.round(duration * sr);
  const out = new Float32Array(n);
  for (let i = from; i < Math.min(to, n); i++) {
    out[i] = amp * Math.sin((2 * Math.PI * hz * i) / sr);
  }
  return out;
}

const sr = 44100;
const probe = new Float32Array(2048);
const hz = 440;
for (let i = 0; i < probe.length; i++) {
  probe[i] = 0.25 * Math.sin((2 * Math.PI * hz * i) / sr);
}
const found = detectPitch(probe, sr);
assert(found != null && Math.abs(found - 440) < 2, `YIN 440 expected, got ${found}`);

// Sub-85 Hz rumble must never count as sung F0 (was falsely reporting D#2).
const rumble = new Float32Array(4096);
const rumbleHz = 77; // ~D#2
for (let i = 0; i < rumble.length; i++) {
  rumble[i] = 0.3 * Math.sin((2 * Math.PI * rumbleHz * i) / sr);
}
assert(detectPitch(rumble, sr) == null, "reject sub-85Hz rumble");

const sustain = buildExercise("sustain", 69);
const w = sustain.windows[0];
const exact = sineWindow(
  sr,
  sustain.duration,
  midiToHz(69),
  Math.floor(w.singStart * sr),
  Math.floor(w.singEnd * sr)
);
const exactReport = scoreExercise(exact, sr, sustain);
assert(
  exactReport.pitchScore >= 85,
  `exact sustain pitch ${exactReport.pitchScore}`
);
assert(exactReport.rhythmScore === 100, `exact sustain rhythm ${exactReport.rhythmScore}`);
assert(
  exactReport.meanAbsCents != null && exactReport.meanAbsCents <= 15,
  `exact cents ${exactReport.meanAbsCents}`
);

const silent = scoreExercise(new Float32Array(Math.round(sustain.duration * sr)), sr, sustain);
assert(silent.pitchScore === 0, `silence pitch ${silent.pitchScore}`);
assert(silent.rhythmScore === 0, `silence rhythm ${silent.rhythmScore}`);

const sharpHz = midiToHz(69) * 2 ** (100 / 1200);
const sharp = sineWindow(
  sr,
  sustain.duration,
  sharpHz,
  Math.floor(w.singStart * sr),
  Math.floor(w.singEnd * sr)
);
const sharpReport = scoreExercise(sharp, sr, sustain);
assert(sharpReport.pitchScore <= 15, `100 cents sharp should miss, got ${sharpReport.pitchScore}`);
assert(
  sharpReport.meanAbsCents != null &&
    sharpReport.meanAbsCents >= 80 &&
    sharpReport.meanAbsCents <= 120,
  `sharp cents ${sharpReport.meanAbsCents}`
);

const lateFrom = Math.floor((w.singStart + 0.45) * sr);
const late = sineWindow(
  sr,
  sustain.duration,
  midiToHz(69),
  lateFrom,
  Math.floor(w.singEnd * sr)
);
const lateReport = scoreExercise(late, sr, sustain);
assert(lateReport.rhythmScore === 0, `late rhythm ${lateReport.rhythmScore}`);
assert(
  lateReport.notes[0].onsetLagMs != null && lateReport.notes[0].onsetLagMs > 200,
  `late onset ${lateReport.notes[0].onsetLagMs}`
);

const wav = encodeWav(exact, sr);
const decoded = decodeWav(wav);
const roundTrip = scoreExercise(decoded.samples, decoded.sampleRate, sustain);
assert(
  Math.abs(roundTrip.pitchScore - exactReport.pitchScore) <= 3,
  `wav roundtrip ${roundTrip.pitchScore} vs ${exactReport.pitchScore}`
);

const scale = buildExercise("scale", 60);
let scaleAudio = new Float32Array(Math.round(scale.duration * sr));
for (const note of scale.windows) {
  const piece = sineWindow(
    sr,
    scale.duration,
    midiToHz(note.midi),
    Math.floor(note.singStart * sr),
    Math.floor(note.singEnd * sr)
  );
  for (let i = 0; i < scaleAudio.length; i++) scaleAudio[i] += piece[i];
}
const scaleReport = scoreExercise(scaleAudio, sr, scale);
assert(scaleReport.pitchScore >= 80, `scale pitch ${scaleReport.pitchScore}`);
assert(scaleReport.rhythmScore >= 80, `scale rhythm ${scaleReport.rhythmScore}`);

console.log(
  JSON.stringify(
    {
      yin: found,
      sustain: exactReport.pitchScore,
      sharp: sharpReport.pitchScore,
      sharpCents: sharpReport.meanAbsCents,
      lateMs: lateReport.notes[0].onsetLagMs,
      scale: scaleReport.pitchScore,
      scaleRhythm: scaleReport.rhythmScore,
    },
    null,
    2
  )
);
