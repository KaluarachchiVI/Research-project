"use client";

import { Lightbulb } from "lucide-react";

interface RecommendationCardProps {
  workMinutes: number;
  breakMinutes: number;
  decision: string | null;
  /** When true, render content only (no card wrapper) for use inside a combined card */
  embedded?: boolean;
}

export function RecommendationCard({
  workMinutes,
  breakMinutes,
  decision,
  embedded,
}: RecommendationCardProps) {
  const explanation =
    decision ||
    "Request a recommendation using the Get Recommendation button, or end a work/break interval to receive the next suggestion from the scheduler.";

  const content = (
    <>
      <div className="mb-6">
        <div className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">
          Current Recommendation
        </div>
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-[var(--timer-active)]/30 bg-[var(--timer-active)]/10 p-4">
            <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              Work (min)
            </div>
            <div className="font-mono text-3xl text-[var(--timer-active)]">
              {workMinutes}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--session-active)]/30 bg-[var(--session-active)]/10 p-4">
            <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              Break (min)
            </div>
            <div className="font-mono text-3xl text-[var(--session-active)]">
              {breakMinutes}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-[var(--timer-active)]" />
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Scheduler Decision
          </div>
        </div>
        <p className="text-sm leading-relaxed text-foreground">{explanation}</p>
      </div>
    </>
  );

  if (embedded) return <div className="flex flex-col">{content}</div>;

  return (
    <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg h-full">
      {content}
    </div>
  );
}
