const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SOLFEGE = ["Do", "Di", "Re", "Ri", "Mi", "Fa", "Fi", "Sol", "Si", "La", "Li", "Ti"];

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

export function noteName(midi: number): string {
  const rounded = Math.round(midi);
  const n = ((rounded % 12) + 12) % 12;
  const oct = Math.floor(rounded / 12) - 1;
  return `${NAMES[n]}${oct}`;
}

export function solfege(midi: number, tonicMidi: number): string {
  const semi = ((Math.round(midi) - Math.round(tonicMidi)) % 12 + 12) % 12;
  return SOLFEGE[semi];
}

export function noteLabel(midi: number, tonicMidi: number): string {
  return `${solfege(midi, tonicMidi)} · ${noteName(midi)}`;
}

/** Positive = sharp. */
export function centsBetween(hz: number, targetMidi: number): number {
  return (hzToMidi(hz) - targetMidi) * 100;
}

export function formatCents(cents: number): string {
  const n = Math.round(cents);
  if (Math.abs(n) <= 8) return "準";
  if (n > 0) return `偏高 ${n} 音分`;
  return `偏低 ${-n} 音分`;
}
