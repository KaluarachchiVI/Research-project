"use client";

interface DashboardHeaderProps {
  sessionId: string;
  isActive: boolean;
}

export function DashboardHeader({ sessionId, isActive }: DashboardHeaderProps) {
  return (
    <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-foreground">Adaptive Scheduler</h1>
          <p className="text-sm text-muted-foreground">
            Real-time work/break scheduling
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
              Session ID
            </div>
            <div className="font-mono text-sm text-foreground">{sessionId}</div>
          </div>
          <div>
            <span
              className={`inline-flex items-center rounded-full border px-4 py-2 text-sm ${
                isActive
                  ? "border-[var(--session-active)]/40 bg-[var(--session-active)]/20 text-[var(--session-active)]"
                  : "border-border bg-muted text-muted-foreground"
              }`}
            >
              {isActive ? "Session Active" : "Session Inactive"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
