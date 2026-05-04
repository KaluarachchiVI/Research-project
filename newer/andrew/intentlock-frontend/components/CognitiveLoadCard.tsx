"use client";

import { Activity, TrendingUp } from "lucide-react";

type CLEStatus = "disconnected" | "warming" | "connected";

interface CognitiveLoadCardProps {
  loadPercent: number;
  status: CLEStatus;
  onSimulateActivity: () => void;
}

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

export function CognitiveLoadCard({
  loadPercent,
  status,
  onSimulateActivity,
}: CognitiveLoadCardProps) {
  const color = getStatusColor(status);
  const loadLevel =
    loadPercent < 30 ? "Low" : loadPercent < 70 ? "Moderate" : "High";

  return (
    <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg">
      <div className="mb-6 text-xs uppercase tracking-wider text-muted-foreground">
        Cognitive Load (Praboth Real-time)
      </div>

      <div className="mb-8 flex items-center justify-center">
        <div className="relative inline-block">
          <svg className="h-48 w-48 -rotate-90" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r="85"
              fill="none"
              stroke="rgba(148, 163, 184, 0.1)"
              strokeWidth="12"
            />
            <circle
              cx="100"
              cy="100"
              r="85"
              fill="none"
              stroke="var(--cognitive-load)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 85}
              strokeDashoffset={2 * Math.PI * 85 * (1 - loadPercent / 100)}
              className="transition-all duration-500"
              style={{ filter: "drop-shadow(0 0 6px rgba(125, 155, 138, 0.25))" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-mono text-6xl text-[var(--cognitive-load)]">
              {Math.round(loadPercent)}
            </div>
            <div className="font-mono text-3xl text-[var(--cognitive-load)]">
              %
            </div>
          </div>
        </div>
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
            <span>Load Level</span>
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
