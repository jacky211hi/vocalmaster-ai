"use client";

import { useEffect, useRef, useState } from "react";
import { Headphones, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PitchChart } from "@/components/pitch-chart";
import { PitchReportPanel } from "@/components/pitch-report-panel";
import {
  buildExercise,
  cueHz,
  EXERCISE_META,
  regionAt,
  TONIC_PRESETS,
  type Exercise,
  type ExerciseId,
} from "@/lib/pitch/exercises";
import { formatCents, hzToMidi } from "@/lib/pitch/notes";
import {
  scoreExercise,
  timelineFromChunks,
  type PitchPoint,
  type PitchReport,
} from "@/lib/pitch/score";
import { detectPitch } from "@/lib/pitch/yin";
import { cn } from "@/lib/utils";

type Props = {
  disabled?: boolean;
};

type Phase = "idle" | "running" | "review";

export function ExerciseSession({ disabled }: Props) {
  const [exerciseId, setExerciseId] = useState<ExerciseId>("sustain");
  const [tonicMidi, setTonicMidi] = useState<number>(60);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [trace, setTrace] = useState<PitchPoint[]>([]);
  const [hud, setHud] = useState("撳開始，聽四下預備拍");
  const [centsLabel, setCentsLabel] = useState("");
  const [report, setReport] = useState<PitchReport | null>(null);
  const [liveExercise, setLiveExercise] = useState<Exercise | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => stopRef.current?.();
  }, []);

  const preview = liveExercise ?? buildExercise(exerciseId, tonicMidi);
  const picking = phase !== "idle" || Boolean(disabled);

  async function start() {
    setError(null);
    setReport(null);
    setTrace([]);
    setPlayhead(0);
    const exercise = buildExercise(exerciseId, tonicMidi);
    setLiveExercise(exercise);

    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
      await ctx.resume();
    } catch {
      setLiveExercise(null);
      setError("無法開啟音訊，請用電腦或手機瀏覽器再試。");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch {
      setLiveExercise(null);
      await ctx.close();
      setError("無法使用麥克風，請檢查瀏覽器權限。");
      return;
    }

    const source = ctx.createMediaStreamSource(stream);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    const capture = await connectCapture(ctx, source, mute);

    const origin = ctx.currentTime + 0.25;
    for (const click of exercise.clicks) {
      scheduleTone(ctx, origin + click, 1400, 0.045, 0.07);
    }
    for (const window of exercise.windows) {
      scheduleTone(
        ctx,
        origin + window.start,
        cueHz(window.midi),
        Math.max(0.08, window.singStart - window.start),
        0.06
      );
    }

    const chunks: Float32Array[] = [];
    const live: PitchPoint[] = [];
    let firstSampleTime: number | null = null;
    let carry = new Float32Array(0);
    let carryStart = 0;
    let finished = false;
    let raf = 0;
    let lastDraw = 0;

    const teardown = () => {
      cancelAnimationFrame(raf);
      capture.stop();
      try {
        source.disconnect();
        mute.disconnect();
      } catch {
        // already stopped
      }
      stream.getTracks().forEach((track) => track.stop());
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      stopRef.current = null;
      teardown();
      const sampleRate = ctx.sampleRate;
      const started = firstSampleTime ?? origin;
      const samples = timelineFromChunks(
        chunks,
        started,
        origin,
        sampleRate,
        exercise.duration
      );
      setHud("計分中…");
      setCentsLabel("");
      window.setTimeout(() => {
        try {
          const scored = scoreExercise(samples, sampleRate, exercise);
          setReport(scored);
          setTrace(scored.trace);
          setPlayhead(exercise.duration);
          setPhase("review");
          setHud(
            scored.coverage < 0.15
              ? "幾乎聽唔到歌聲。可以再練一次，唱大聲少少。"
              : "跟譜計分完成"
          );
        } catch (err) {
          setPhase("idle");
          setError(err instanceof Error ? err.message : "計分失敗");
        } finally {
          void ctx.close();
        }
      }, 30);
    };

    stopRef.current = finish;
    capture.listen((samples, time) => {
      if (finished) return;
      chunks.push(samples);
      if (firstSampleTime == null) firstSampleTime = time;
      const merged = new Float32Array(carry.length + samples.length);
      merged.set(carry, 0);
      merged.set(samples, carry.length);
      if (carry.length === 0) carryStart = time;
      carry = merged;
      const hop = 1024;
      const window = 2048;
      while (carry.length >= window) {
        const hz = detectPitch(carry.subarray(0, window), ctx.sampleRate);
        const mid = carryStart + window / 2 / ctx.sampleRate;
        const rel = mid - origin;
        if (rel >= 0 && rel <= exercise.duration) {
          live.push({
            t: Math.round(rel * 1000) / 1000,
            midi: hz == null ? null : Math.round(hzToMidi(hz) * 100) / 100,
          });
        }
        const next = new Float32Array(carry.length - hop);
        next.set(carry.subarray(hop));
        carry = next;
        carryStart += hop / ctx.sampleRate;
      }
      if (time + samples.length / ctx.sampleRate >= origin + exercise.duration) {
        finish();
      }
    });

    const draw = (now: number) => {
      if (finished) return;
      raf = requestAnimationFrame(draw);
      if (now - lastDraw < 50) return;
      lastDraw = now;
      const t = ctx.currentTime - origin;
      setPlayhead(Math.max(0, t));
      setTrace(live.slice(-800));
      const region = regionAt(exercise, t);
      setHud(region.label);
      const last = live[live.length - 1];
      if ((region.kind === "sing" || region.kind === "cue") && last) {
        if (last.midi == null || Math.abs(last.t - t) > 0.3) {
          setCentsLabel("聽唔到");
        } else {
          setCentsLabel(formatCents((last.midi - region.midi) * 100));
        }
      } else {
        setCentsLabel("");
      }
    };

    setPhase("running");
    setHud("預備");
    raf = requestAnimationFrame(draw);
  }

  function retry() {
    stopRef.current?.();
    setReport(null);
    setLiveExercise(null);
    setTrace([]);
    setPlayhead(0);
    setCentsLabel("");
    setHud("撳開始，聽四下預備拍");
    setPhase("idle");
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
        <Headphones className="mt-0.5 h-4 w-4 shrink-0" />
        <p>請戴耳機。提示音一收入麥克風，音準分就會偏。</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {EXERCISE_META.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={picking}
            onClick={() => setExerciseId(item.id)}
            className={cn(
              "rounded-2xl border px-3 py-3 text-left transition",
              exerciseId === item.id
                ? "border-amber-400/60 bg-amber-400/10"
                : "border-white/10 bg-white/[0.03] hover:border-white/20"
            )}
          >
            <p className="font-medium text-white">{item.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/50">
              {item.description}
            </p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {TONIC_PRESETS.map((preset) => (
          <button
            key={preset.midi}
            type="button"
            disabled={picking}
            onClick={() => setTonicMidi(preset.midi)}
            className={cn(
              "rounded-xl border px-3 py-2 text-sm",
              tonicMidi === preset.midi
                ? "border-amber-400/60 bg-amber-400/15 text-amber-100"
                : "border-white/10 text-white/70"
            )}
          >
            {preset.label}
            <span className="ml-1 text-white/40">{preset.hint}</span>
          </button>
        ))}
        <span className="self-center text-xs text-white/40">
          約 {Math.round(preview.duration)} 秒
        </span>
      </div>

      {phase !== "review" && (
        <div className="space-y-3 rounded-3xl border border-white/10 bg-black/30 p-3">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-xs text-white/40">而家</p>
              <p className="text-lg text-white">{hud}</p>
            </div>
            <p className="font-[family-name:var(--font-display)] text-3xl text-amber-200">
              {centsLabel}
            </p>
          </div>
          <PitchChart
            duration={preview.duration}
            windows={preview.windows}
            trace={trace}
            playhead={phase === "running" ? playhead : null}
          />
        </div>
      )}

      {phase === "review" && report && (
        <div className="space-y-4">
          <p className="text-sm text-white/50">
            跟譜只係基礎訓練。錄音唔會儲存，亦唔會計入排行榜或六維報告。
          </p>
          <PitchReportPanel report={report} />
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {phase === "running" ? (
          <Button type="button" className="flex-1" onClick={() => stopRef.current?.()}>
            <Square className="h-4 w-4" />
            結束並計分
          </Button>
        ) : phase === "review" ? (
          <>
            <Button type="button" variant="secondary" onClick={retry}>
              再練一次
            </Button>
          </>
        ) : (
          <Button type="button" size="lg" className="w-full" disabled={disabled} onClick={() => void start()}>
            <Mic className="h-4 w-4" />
            開始跟譜
          </Button>
        )}
      </div>
    </div>
  );
}

const CAPTURE_WORKLET = `
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length) {
      const copy = new Float32Array(channel.length);
      copy.set(channel);
      this.port.postMessage({ samples: copy, time: currentTime });
    }
    return true;
  }
}
registerProcessor("capture-processor", CaptureProcessor);
`;

async function connectCapture(
  ctx: AudioContext,
  source: MediaStreamAudioSourceNode,
  mute: GainNode
): Promise<{
  listen: (onFrame: (samples: Float32Array, time: number) => void) => void;
  stop: () => void;
}> {
  try {
    const url = URL.createObjectURL(
      new Blob([CAPTURE_WORKLET], { type: "text/javascript" })
    );
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const node = new AudioWorkletNode(ctx, "capture-processor");
    source.connect(node);
    node.connect(mute);
    mute.connect(ctx.destination);
    return {
      listen(onFrame) {
        node.port.onmessage = (event: MessageEvent<{ samples: Float32Array; time: number }>) => {
          onFrame(event.data.samples, event.data.time);
        };
      },
      stop() {
        node.port.onmessage = null;
        node.disconnect();
      },
    };
  } catch {
    const processor = ctx.createScriptProcessor(2048, 1, 1);
    source.connect(processor);
    processor.connect(mute);
    mute.connect(ctx.destination);
    return {
      listen(onFrame) {
        processor.onaudioprocess = (event) => {
          const input = event.inputBuffer.getChannelData(0);
          const copy = new Float32Array(input.length);
          copy.set(input);
          const time = ctx.currentTime - event.inputBuffer.duration;
          onFrame(copy, time);
        };
      },
      stop() {
        processor.onaudioprocess = null;
        processor.disconnect();
      },
    };
  }
}

function scheduleTone(
  ctx: AudioContext,
  when: number,
  hz: number,
  duration: number,
  peak: number
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = hz;
  const end = when + duration;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + 0.015);
  gain.gain.setValueAtTime(peak, Math.max(when + 0.02, end - 0.03));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(end + 0.02);
}
