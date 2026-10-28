/** Singing range used by the detector: about D2–C6. */
const MIN_HZ = 70;
const MAX_HZ = 1050;
const YIN_THRESHOLD = 0.15;
const RMS_GATE = 0.01;

export function frameRms(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

/**
 * YIN fundamental-frequency estimate.
 * Returns Hz, or null when the frame is silence or not periodic.
 */
export function detectPitch(
  frame: Float32Array,
  sampleRate: number
): number | null {
  if (frame.length < 64 || sampleRate < 4000) return null;
  if (frameRms(frame) < RMS_GATE) return null;

  const half = Math.floor(frame.length / 2);
  const tauMin = Math.max(2, Math.floor(sampleRate / MAX_HZ));
  const tauMax = Math.min(half - 2, Math.floor(sampleRate / MIN_HZ));
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

  const hz = sampleRate / better;
  if (!Number.isFinite(hz) || hz < MIN_HZ || hz > MAX_HZ) return null;
  return hz;
}
