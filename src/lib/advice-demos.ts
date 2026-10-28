export const ADVICE_SAMPLE_RATE = 44100;

export type AdviceDemo = {
  id: string;
  test: RegExp;
  label: string;
  samples: () => Float32Array;
};

const cache = new Map<string, Float32Array>();

function once(id: string, render: () => Float32Array): () => Float32Array {
  return () => {
    const hit = cache.get(id);
    if (hit) return hit;
    const samples = render();
    cache.set(id, samples);
    return samples;
  };
}

function fade(samples: Float32Array, ms: number) {
  const n = Math.min(samples.length, Math.floor((ms / 1000) * ADVICE_SAMPLE_RATE));
  for (let i = 0; i < n; i++) {
    const g = i / n;
    samples[i] *= g;
    samples[samples.length - 1 - i] *= g;
  }
}

function normalize(samples: Float32Array, peak: number) {
  let max = 0;
  for (let i = 0; i < samples.length; i++) max = Math.max(max, Math.abs(samples[i]));
  if (max < 1e-6) return;
  const gain = peak / max;
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
}

function smooth(u: number) {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
}

/** Steady male practice tone, about C3–G3. Dry and even, not a voiced impression. */
function createTone() {
  let phase = 0;
  let low = 0;
  return (f0: number, brightness: number) => {
    phase += (2 * Math.PI * f0) / ADVICE_SAMPLE_RATE;
    let y = Math.sin(phase);
    const weights = [0.58, 0.26, 0.1];
    for (let k = 0; k < weights.length; k++) {
      y += Math.sin(phase * (k + 2)) * weights[k] * (0.3 + 0.7 * brightness);
    }
    const a = Math.exp((-2 * Math.PI * 1400) / ADVICE_SAMPLE_RATE);
    low = low * a + y * (1 - a);
    return low;
  };
}

function renderLipTrill(): Float32Array {
  const seconds = 3.2;
  const n = Math.floor(ADVICE_SAMPLE_RATE * seconds);
  const out = new Float32Array(n);
  const tone = createTone();
  for (let i = 0; i < n; i++) {
    const t = i / ADVICE_SAMPLE_RATE;
    const climb = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / seconds);
    const f0 = 130.81 * 2 ** ((7 / 12) * climb);
    const flap = (0.5 + 0.5 * Math.sin(2 * Math.PI * 6 * t)) ** 1.8;
    out[i] = tone(f0, 0.55) * flap;
  }
  fade(out, 30);
  normalize(out, 0.62);
  return out;
}

function renderMaSigh(): Float32Array {
  const phrase = 0.95;
  const gap = 0.28;
  const n = Math.floor(ADVICE_SAMPLE_RATE * (phrase * 2 + gap));
  const out = new Float32Array(n);
  const tone = createTone();
  const starts = [196, 174.61];
  for (let i = 0; i < n; i++) {
    const t = i / ADVICE_SAMPLE_RATE;
    const which = t < phrase ? 0 : t < phrase + gap ? -1 : 1;
    if (which < 0) continue;
    const u = (which === 0 ? t : t - phrase - gap) / phrase;
    if (u < 0 || u > 1) continue;
    const f0 = starts[which] * 2 ** ((-3 / 12) * smooth(u));
    const vowel = smooth((u - 0.05) / 0.14);
    let amp = 1;
    if (u < 0.1) amp = smooth(u / 0.1);
    else if (u > 0.72) amp = 1 - smooth((u - 0.72) / 0.28);
    out[i] = tone(f0, vowel) * amp;
  }
  fade(out, 20);
  normalize(out, 0.58);
  return out;
}

function renderDynamics(): Float32Array {
  const seconds = 3.4;
  const n = Math.floor(ADVICE_SAMPLE_RATE * seconds);
  const out = new Float32Array(n);
  const tone = createTone();
  const attack = 1.2;
  const hold = 0.6;
  for (let i = 0; i < n; i++) {
    const t = i / ADVICE_SAMPLE_RATE;
    let loud = 1;
    if (t < attack) loud = smooth(t / attack);
    else if (t > attack + hold) {
      loud = 1 - smooth((t - attack - hold) / (seconds - attack - hold));
    }
    const amp = 0.16 + 0.84 * loud;
    out[i] = tone(164.81, 0.45 + 0.55 * loud) * amp;
  }
  fade(out, 25);
  normalize(out, 0.62);
  return out;
}

export const ADVICE_DEMOS: AdviceDemo[] = [
  {
    id: "lip-trill",
    test: /唇震|lip\s*trill|嘴唇震|彈唇|弹唇|打嘟/i,
    label: "唇震由低滑到高再落返，氣流大約每秒斷六下。",
    samples: once("lip-trill-male", renderLipTrill),
  },
  {
    id: "ma-sigh",
    test: /歎氣|嘆氣|「\s*Ma\s*」|降喉|哼鳴/i,
    label: "先哼一哼，再開到「a」，音高輕輕落一個小三度。",
    samples: once("ma-sigh-male", renderMaSigh),
  },
  {
    id: "dynamics",
    test: /強弱|漸強|漸弱|crescendo|decrescendo/i,
    label: "同一粒音由弱到強，再弱返。",
    samples: once("dynamics-male", renderDynamics),
  },
];

export function stripAdviceTitle(markdown: string): string {
  return markdown
    .replace(/^\s*#{1,6}[ \t]*改善建議[ \t]*\n+/, "")
    .replace(/^\s*(?:\*\*|__)改善建議(?:\*\*|__)[ \t]*\n+/, "")
    .trim();
}

export function splitAdvice(markdown: string): string[] {
  const text = stripAdviceTitle(markdown);
  if (!text) return [];
  return text
    .split(/\n(?=#{1,6}[ \t])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function demoForSection(markdown: string): AdviceDemo | null {
  return ADVICE_DEMOS.find((demo) => demo.test.test(markdown)) ?? null;
}
