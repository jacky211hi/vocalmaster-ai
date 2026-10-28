"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ADVICE_SAMPLE_RATE,
  demoForSection,
  splitAdvice,
  type AdviceDemo,
} from "@/lib/advice-demos";

type Props = {
  markdown: string;
};

export function AdviceBlock({ markdown }: Props) {
  const sections = splitAdvice(markdown);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      stopRef.current?.();
      void ctxRef.current?.close();
    };
  }, []);

  function stop() {
    stopRef.current?.();
    stopRef.current = null;
    setPlayingId(null);
  }

  async function play(demo: AdviceDemo) {
    if (playingId === demo.id) {
      stop();
      return;
    }
    stopRef.current?.();
    const Ctx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = ctxRef.current ?? new Ctx();
    ctxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    const samples = demo.samples();
    const buffer = ctx.createBuffer(1, samples.length, ADVICE_SAMPLE_RATE);
    buffer.getChannelData(0).set(samples);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.onended = () => {
      setPlayingId((current) => (current === demo.id ? null : current));
    };
    src.start();
    stopRef.current = () => {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    };
    setPlayingId(demo.id);
  }

  if (sections.length === 0) {
    return <p className="text-white/60">暫無具體練習建議。</p>;
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const demo = demoForSection(section);
        return (
          <section key={section.slice(0, 48)} className="advice-section prose-vocal">
            <ReactMarkdown>{section}</ReactMarkdown>
            {demo && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void play(demo)}
                >
                  {playingId === demo.id ? (
                    <Square className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                  {playingId === demo.id ? "停止" : "聽示範"}
                </Button>
                <p className="text-xs text-white/45">{demo.label}</p>
              </div>
            )}
          </section>
        );
      })}
      <p className="text-xs text-white/35">示範係合成男聲，用嚟聽音高同節奏，唔係真人錄音。</p>
    </div>
  );
}
