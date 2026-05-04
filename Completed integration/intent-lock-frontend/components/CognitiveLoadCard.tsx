"use client";

import { useMemo } from "react";
import { Activity, TrendingUp } from "lucide-react";

type CLEStatus = "disconnected" | "warming" | "connected";

interface CognitiveLoadCardProps {
  /** Current load 0–100 (from CLE). */
  loadPercent: number;
  /** Rolling samples 0–100 from successful /estimate polls (oldest → newest). */
  loadHistoryPercent: number[];
  /** Poll period in ms (used only for the time-span label). */
  pollIntervalMs: number;
  status: CLEStatus;
  onSimulateActivity: () => void;
}

const VB_W = 400;
const VB_H = 168;
const PAD_L = 40;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 28;

function statusLabel(s: CLEStatus) {
  switch (s) {
    case "connected":
      return "Real-time monitoring active";
    case "warming":
      return "System warming up...";
    default:
      return "Monitoring offline";
  }
}

function statusDisplay(s: CLEStatus) {
  switch (s) {
    case "connected":
      return "online";
    case "warming":
      return "warming";
    default:
      return "offline";
  }
}

function getStatusColor(s: CLEStatus) {
  switch (s) {
    case "connected":
      return "var(--session-active)";
    case "warming":
      return "var(--warning)";
    default:
      return "var(--muted-foreground)";
  }
}

interface ChartScale {
  min: number;
  max: number;
  mid: number;
}

/** Dynamic y-axis from recent range so small changes are still visible. */
function computeChartScale(values: number[], fallbackPercent: number): ChartScale {
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const seq =
    values.length > 0 ? values.map(clamp) : [clamp(fallbackPercent)];
  const rawMin = Math.min(...seq);
  const rawMax = Math.max(...seq);
  const span = rawMax - rawMin;

  // Keep at least a 6-point band to avoid fake spikes from tiny noise.
  const minSpan = 6;
  const paddedSpan = Math.max(span, minSpan);
  const center = (rawMin + rawMax) / 2;
  let min = center - paddedSpan / 2;
  let max = center + paddedSpan / 2;

  // Clamp to [0,100] while preserving span as much as possible.
  if (min < 0) {
    max = Math.min(100, max - min);
    min = 0;
  }
  if (max > 100) {
    min = Math.max(0, min - (max - 100));
    max = 100;
  }
  return { min, max, mid: (min + max) / 2 };
}

/** Build [x,y] points in viewBox space using chartScale. */
function seriesToPoints(
  values: number[],
  fallbackPercent: number,
  chartScale: ChartScale
): { x: number; y: number }[] {
  const iw = VB_W - PAD_L - PAD_R;
  const ih = VB_H - PAD_T - PAD_B;
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const denom = Math.max(1e-6, chartScale.max - chartScale.min);

  let seq: number[];
  if (values.length >= 2) {
    seq = values.map(clamp);
  } else if (values.length === 1) {
    const v = clamp(values[0]);
    seq = [v, v];
  } else {
    const v = clamp(fallbackPercent);
    seq = [v, v];
  }

  const n = seq.length;
  return seq.map((v, i) => {
    const x =
      n <= 1
        ? PAD_L + iw / 2
        : PAD_L + (i / (n - 1)) * iw;
    const normalized = (v - chartScale.min) / denom;
    const y = PAD_T + (1 - normalized) * ih;
    return { x, y };
  });
}

function pointsToLinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");
}

function pointsToAreaPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  const line = pointsToLinePath(points);
  const last = points[points.length - 1];
  const first = points[0];
  const baseY = VB_H - PAD_B;
  return `${line} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
}

export function CognitiveLoadCard({
  loadPercent,
  loadHistoryPercent,
  pollIntervalMs,
  status,
  onSimulateActivity,
}: CognitiveLoadCardProps) {
  const color = getStatusColor(status);
  const loadLevel =
    loadPercent < 30 ? "Low" : loadPercent < 70 ? "Moderate" : "High";

  const historyMinutes =
    loadHistoryPercent.length > 1
      ? Math.max(
          0.1,
          ((loadHistoryPercent.length - 1) * pollIntervalMs) / 60_000
        )
      : 0;

  const { linePath, areaPath, lastPoint, scale } = useMemo(() => {
    const computedScale = computeChartScale(loadHistoryPercent, loadPercent);
    const pts = seriesToPoints(loadHistoryPercent, loadPercent, computedScale);
    return {
      linePath: pointsToLinePath(pts),
      areaPath: pointsToAreaPath(pts),
      lastPoint: pts[pts.length - 1] ?? null,
      scale: computedScale,
    };
  }, [loadHistoryPercent, loadPercent]);

  const gridYs = [0, 0.5, 1].map((t) => PAD_T + t * (VB_H - PAD_T - PAD_B));

  return (
    <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span>Cognitive Load (Praboth Real-time)</span>
        {loadHistoryPercent.length > 1 && (
          <span className="font-normal normal-case tracking-normal text-muted-foreground/90">
            ~{historyMinutes.toFixed(0)} min window
          </span>
        )}
      </div>

      <div className="mb-6 rounded-xl border border-border/60 bg-secondary/20 p-3">
        <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
          <span className="text-xs text-muted-foreground">Load over time</span>
          <div className="text-right">
            <span className="font-mono text-3xl tabular-nums text-[var(--cognitive-load)]">
              {loadPercent.toFixed(1)}
            </span>
            <span className="font-mono text-lg text-[var(--cognitive-load)]/80">
              %
            </span>
            <span className="ml-2 text-xs text-muted-foreground">{loadLevel}</span>
          </div>
        </div>

        <svg
          className="w-full"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Cognitive load chart, current ${Math.round(loadPercent)} percent`}
        >
          <defs>
            <linearGradient id="cle-area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--cognitive-load)"
                stopOpacity="0.22"
              />
              <stop
                offset="100%"
                stopColor="var(--cognitive-load)"
                stopOpacity="0.02"
              />
            </linearGradient>
          </defs>

          {gridYs.map((gy, i) => (
            <line
              key={i}
              x1={PAD_L}
              y1={gy}
              x2={VB_W - PAD_R}
              y2={gy}
              stroke="currentColor"
              className="text-border/80"
              strokeWidth="1"
              strokeDasharray={i === 1 ? "4 4" : "0"}
            />
          ))}

          <text
            x={PAD_L - 6}
            y={PAD_T + 4}
            textAnchor="end"
            className="fill-muted-foreground text-[10px]"
          >
            {scale.max.toFixed(1)}
          </text>
          <text
            x={PAD_L - 6}
            y={PAD_T + (VB_H - PAD_T - PAD_B) / 2 + 3}
            textAnchor="end"
            className="fill-muted-foreground text-[10px]"
          >
            {scale.mid.toFixed(1)}
          </text>
          <text
            x={PAD_L - 6}
            y={VB_H - PAD_B + 3}
            textAnchor="end"
            className="fill-muted-foreground text-[10px]"
          >
            {scale.min.toFixed(1)}
          </text>

          <text
            x={PAD_L}
            y={VB_H - 6}
            className="fill-muted-foreground text-[10px]"
          >
            earlier
          </text>
          <text
            x={VB_W - PAD_R}
            y={VB_H - 6}
            textAnchor="end"
            className="fill-muted-foreground text-[10px]"
          >
            now
          </text>

          {areaPath ? (
            <path d={areaPath} fill="url(#cle-area-fill)" stroke="none" />
          ) : null}
          {linePath ? (
            <path
              d={linePath}
              fill="none"
              stroke="var(--cognitive-load)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 4px rgba(125, 155, 138, 0.35))" }}
            />
          ) : null}
          {lastPoint ? (
            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r="5"
              fill="var(--cognitive-load)"
              stroke="var(--card)"
              strokeWidth="2"
            />
          ) : null}
        </svg>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-secondary/30 p-4">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5" style={{ color }} />
            <div>
              <div className="mb-1 text-xs text-muted-foreground">
                System Status
              </div>
              <div className="text-sm" style={{ color }}>
                {statusLabel(status)}
              </div>
            </div>
          </div>
          <div
            className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs uppercase tracking-wider"
            style={{
              backgroundColor: `${color}20`,
              borderColor: `${color}40`,
              color,
            }}
          >
            CLE {statusDisplay(status)}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Current level</span>
            <span>{loadLevel}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, loadPercent)}%`,
                backgroundColor: "var(--cognitive-load)",
                boxShadow: "0 0 6px rgba(125, 155, 138, 0.3)",
              }}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSimulateActivity}
        className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 transition-all"
        style={{
          backgroundColor: "var(--cognitive-load-bg)",
          borderColor: "var(--cognitive-load-border)",
          color: "var(--cognitive-load)",
        }}
      >
        <TrendingUp className="h-4 w-4" />
        Simulate activity
      </button>
    </div>
  );
}
