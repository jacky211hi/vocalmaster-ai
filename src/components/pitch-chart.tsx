import type { PitchPoint } from "@/lib/pitch/score";
import { noteName } from "@/lib/pitch/notes";

type WindowMark = {
  midi: number;
  label: string;
  start: number;
  singStart: number;
  singEnd: number;
};

export function PitchChart({
  duration,
  windows,
  trace,
  playhead = null,
}: {
  duration: number;
  windows: WindowMark[];
  trace: PitchPoint[];
  playhead?: number | null;
}) {
  const width = 640;
  const height = 220;
  const padL = 46;
  const padR = 10;
  const padT = 12;
  const padB = 22;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const span = Math.max(duration, 0.1);

  let midiMin = 60;
  let midiMax = 72;
  if (windows.length) {
    midiMin = Math.min(...windows.map((w) => w.midi)) - 3;
    midiMax = Math.max(...windows.map((w) => w.midi)) + 3;
  }
  for (const point of trace) {
    if (point.midi == null) continue;
    if (point.midi < midiMin && point.midi > midiMin - 6) midiMin = Math.floor(point.midi) - 1;
    if (point.midi > midiMax && point.midi < midiMax + 6) midiMax = Math.ceil(point.midi) + 1;
  }
  if (midiMax - midiMin < 6) {
    midiMin -= 1;
    midiMax += 1;
  }
  const midiSpan = midiMax - midiMin;

  const x = (t: number) => padL + (t / span) * plotW;
  const y = (midi: number) => padT + ((midiMax - midi) / midiSpan) * plotH;

  const lines: number[] = [];
  for (let m = Math.ceil(midiMin); m <= Math.floor(midiMax); m++) lines.push(m);

  const groups: { t: number; midi: number }[][] = [];
  let current: { t: number; midi: number }[] = [];
  for (const point of trace) {
    if (point.midi == null) {
      if (current.length) groups.push(current);
      current = [];
      continue;
    }
    current.push({ t: point.t, midi: point.midi });
  }
  if (current.length) groups.push(current);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label="音高對比"
    >
      {lines.map((m) => (
        <g key={m}>
          <line
            x1={padL}
            x2={width - padR}
            y1={y(m)}
            y2={y(m)}
            stroke="rgba(255,255,255,0.08)"
          />
          <text
            x={padL - 6}
            y={y(m) + 3}
            textAnchor="end"
            fill="rgba(255,255,255,0.38)"
            fontSize="10"
          >
            {noteName(m)}
          </text>
        </g>
      ))}

      {windows.map((w, i) => (
        <g key={`${w.label}-${i}`}>
          <rect
            x={x(w.start)}
            y={y(w.midi)}
            width={Math.max(1, x(w.singStart) - x(w.start))}
            height={2}
            fill="rgba(255,255,255,0.35)"
          />
          <rect
            x={x(w.singStart)}
            y={y(w.midi + 0.5)}
            width={Math.max(2, x(w.singEnd) - x(w.singStart))}
            height={Math.max(2, y(w.midi - 0.5) - y(w.midi + 0.5))}
            rx={3}
            fill="rgba(52,211,153,0.18)"
            stroke="rgba(52,211,153,0.55)"
          />
        </g>
      ))}

      {groups.map((group, i) =>
        group.length === 1 ? (
          <circle
            key={i}
            cx={x(group[0].t)}
            cy={y(group[0].midi)}
            r={2.5}
            fill="#fbbf24"
          />
        ) : (
          <polyline
            key={i}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={group.map((p) => `${x(p.t)},${y(p.midi)}`).join(" ")}
          />
        )
      )}

      {playhead != null && playhead >= 0 && playhead <= duration && (
        <line
          x1={x(playhead)}
          x2={x(playhead)}
          y1={padT}
          y2={height - padB}
          stroke="rgba(251,191,36,0.85)"
          strokeDasharray="3 3"
        />
      )}
    </svg>
  );
}
