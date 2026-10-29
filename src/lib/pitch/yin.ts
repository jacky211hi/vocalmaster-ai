/**
 * Singing F0 band: ~F2 (85 Hz) – C6 (1050 Hz).
 * Below 85 Hz is rumble / subharmonic bleed — never treat as sung pitch.
 */
export const SINGING_MIN_HZ = 85;
export const SINGING_MAX_HZ = 1050;
/** CMNDF must be this low → clarity = 1 - cmndf ≥ 0.85 */
const YIN_THRESHOLD = 0.15;
const MIN_CLARITY = 0.85;
const RMS_GATE = 0.01;

export type PitchEstimate = {
  hz: number;
  /** 1 − YIN CMNDF at chosen lag; higher = more periodic. */
  clarity: number;
};

export function frameRms(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

function parabolicRefine(yin: Float32Array, tau: number, tauMax: number): number {
  let better = tau;
  if (tau > 0 && tau < tauMax) {
    const s0 = yin[tau - 1];
    const s1 = yin[tau];
    const s2 = yin[tau + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (denom !== 0) {
      const adj = (s2 - s0) / denom;
      if (Number.isFinite(adj)) better = tau + adj;
    }
  }
  return better;
}

/**
 * YIN F0 with clarity. Rejects sub-85 Hz rumble and prefers the higher
 * octave when a half-period dip is also strong (blocks common octave-halving).
 */
export function detectPitchDetailed(
  frame: Float32Array,
  sampleRate: number
): PitchEstimate | null {
  if (frame.length < 64 || sampleRate < 4000) return null;
  if (frameRms(frame) < RMS_GATE) return null;

  const half = Math.floor(frame.length / 2);
  const tauMin = Math.max(2, Math.floor(sampleRate / SINGING_MAX_HZ));
  const tauMax = Math.min(half - 2, Math.floor(sampleRate / SINGING_MIN_HZ));
  if (tauMax <= tauMin) return null;

  const diff = new Float32Array(tauMax + 1);
  for (let tau = tauMin; tau <= tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i < half; i++) {
      const d = frame[i] - frame[i + tau];
      sum += d * d;
    }
    diff[tau] = sum;
  }

  const yin = new Float32Array(tauMax + 1);
  yin[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += diff[tau];
    yin[tau] = running > 0 ? (diff[tau] * tau) / running : 1;
  }

  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (yin[t] < YIN_THRESHOLD) {
      while (t + 1 <= tauMax && yin[t + 1] < yin[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;

  // Octave-halving guard: if τ/2 also has a strong dip, prefer the shorter
  // period (higher F0) — classic YIN lock onto 2× period / half frequency.
  let chosen = tau;
  const halfTau = Math.round(tau / 2);
  if (
    halfTau >= tauMin &&
    halfTau < tau &&
    yin[halfTau] < YIN_THRESHOLD * 1.25
  ) {
    let local = halfTau;
    while (local + 1 <= tauMax && yin[local + 1] < yin[local]) local++;
    while (local - 1 >= tauMin && yin[local - 1] < yin[local]) local--;
    if (yin[local] < YIN_THRESHOLD * 1.25) chosen = local;
  }

  const clarity = Math.max(0, Math.min(1, 1 - yin[Math.round(chosen)]));
  if (clarity < MIN_CLARITY) return null;

  const refined = parabolicRefine(yin, chosen, tauMax);
  const hz = sampleRate / refined;
  if (!Number.isFinite(hz) || hz < SINGING_MIN_HZ || hz > SINGING_MAX_HZ) {
    return null;
  }
  return { hz, clarity };
}

/**
 * YIN fundamental-frequency estimate.
 * Returns Hz, or null when the frame is silence / not confidently periodic.
 */
export function detectPitch(
  frame: Float32Array,
  sampleRate: number
): number | null {
  return detectPitchDetailed(frame, sampleRate)?.hz ?? null;
}
