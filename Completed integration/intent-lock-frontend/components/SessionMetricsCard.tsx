"use client";

import { BarChart3 } from "lucide-react";

interface SessionMetricsCardProps {
  reward: number | null;
  algorithm: string;
  epoch: number;
  predictionCount: number;
  /** When true, render content only (no card wrapper) for use inside a combined card */
  embedded?: boolean;
}

export function SessionMetricsCard({
  reward,
  algorithm,
  epoch,
  predictionCount,
  embedded,
}: SessionMetricsCardProps) {
  const content = (
    <>
      <div className={embedded ? "mb-4" : "mb-6"}>
        <div className={`flex items-center gap-2 ${embedded ? "mb-3" : "mb-4"}`}>
          <BarChart3 className="h-5 w-5" style={{ color: "#8FBFE0" }} />
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Session Metrics
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border py-3">
          <span className="text-sm text-muted-foreground">Reward</span>
          <span
            className="font-mono"
            style={{ color: "#8FBFE0" }}
          >
            {reward != null ? reward.toFixed(2) : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-border py-3">
          <span className="text-sm text-muted-foreground">Algorithm</span>
          <span className="font-mono text-foreground">{algorithm}</span>
        </div>
        <div className="flex items-center justify-between border-b border-border py-3">
          <span className="text-sm text-muted-foreground">Epoch</span>
          <span className="font-mono text-foreground">{epoch}</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-muted-foreground">Prediction Count</span>
          <span className="font-mono text-foreground">{predictionCount}</span>
        </div>
      </div>
    </>
  );

  if (embedded) return <div className="border-t border-border pt-6">{content}</div>;

  return (
    <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg h-full">
      {content}
    </div>
  );
}
