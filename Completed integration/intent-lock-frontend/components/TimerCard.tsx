"use client";

import { Play, Pause, Square, PlayCircle } from "lucide-react";

interface TimerCardProps {
  timerSeconds: number;
  workMinutes: number;
  breakMinutes: number;
  isWorkMode: boolean;
  isPaused: boolean;
  /** When false, session has ended and we show "New session" CTA instead of timer controls */
  isSessionActive: boolean;
  /** Called when user clicks "New session" (only shown when session ended) */
  onNewSession?: () => void;
  onWorkMinutesChange: (v: number) => void;
  onBreakMinutesChange: (v: number) => void;
  onTogglePause: () => void;
  onEndSession: () => void;
  onEndInterval: () => void;
  onGetRecommendation: () => void;
  onToggleWorkMode: () => void;
}

function formatTimer(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function TimerCard({
  timerSeconds,
  workMinutes,
  breakMinutes,
  isWorkMode,
  isPaused,
  isSessionActive,
  onNewSession,
  onWorkMinutesChange,
  onBreakMinutesChange,
  onTogglePause,
  onEndSession,
  onEndInterval,
  onGetRecommendation,
  onToggleWorkMode,
}: TimerCardProps) {
  const totalIntervalSeconds = isWorkMode ? workMinutes * 60 : breakMinutes * 60;
  const progress =
    totalIntervalSeconds > 0
      ? Math.min(100, (timerSeconds / totalIntervalSeconds) * 100)
      : 0;

  if (!isSessionActive && onNewSession) {
    return (
      <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg">
        <div className="mb-6 text-xs uppercase tracking-wider text-muted-foreground">
          Current Timer
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="mb-2 text-muted-foreground">Session ended</p>
          <p className="mb-6 text-sm text-muted-foreground">
            Start a new time-block session to continue.
          </p>
          <button
            type="button"
            onClick={onNewSession}
            className="btn-soft flex items-center gap-2 rounded-xl border border-[var(--cognitive-load)] bg-[var(--cognitive-load)] px-6 py-3 text-white hover:opacity-90 hover:shadow-md"
          >
            <PlayCircle className="h-5 w-5" />
            New session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg">
      <div className="mb-6 text-xs uppercase tracking-wider text-muted-foreground">
        Current Timer
      </div>

      <div className="mb-8 text-center">
        <div className="relative inline-block">
          <svg className="h-64 w-64 -rotate-90" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="var(--muted)"
              strokeWidth="8"
            />
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="var(--timer-active)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 90}
              strokeDashoffset={2 * Math.PI * 90 * (1 - progress / 100)}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-mono text-7xl tracking-tight text-[var(--timer-active)]">
              {formatTimer(timerSeconds)}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {isWorkMode ? "Work Session" : "Break Time"}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wider text-muted-foreground">
            Work (min)
          </label>
          <input
            type="number"
            value={workMinutes}
            onChange={(e) =>
              onWorkMinutesChange(parseInt(e.target.value, 10) || 0)
            }
            className="w-full rounded-lg border border-input bg-input-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring"
            min={1}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wider text-muted-foreground">
            Break (min)
          </label>
          <input
            type="number"
            value={breakMinutes}
            onChange={(e) =>
              onBreakMinutesChange(parseInt(e.target.value, 10) || 0)
            }
            className="w-full rounded-lg border border-input bg-input-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring"
            min={1}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onTogglePause}
            className="btn-soft flex items-center justify-center gap-2 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/15 px-4 py-3 text-[var(--warning)] hover:bg-[var(--warning)]/25 hover:border-[var(--warning)]/55"
          >
            {isPaused ? (
              <>
                <Play className="h-4 w-4" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-4 w-4" />
                Pause
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onEndSession}
            className="btn-soft flex items-center justify-center gap-2 rounded-xl border border-[var(--end-session)]/40 bg-[var(--end-session)]/15 px-4 py-3 text-[var(--end-session)] hover:bg-[var(--end-session)]/25 hover:border-[var(--end-session)]/55"
          >
            <Square className="h-4 w-4" />
            End Session
          </button>
        </div>

        <button
          type="button"
          onClick={onEndInterval}
          className="btn-soft w-full rounded-xl border border-border bg-secondary px-4 py-3 text-secondary-foreground hover:bg-secondary/90 hover:shadow-md"
        >
          {isWorkMode ? "End Work Interval" : "End Break Interval"}
        </button>

        <button
          type="button"
          onClick={onGetRecommendation}
          className="btn-soft w-full rounded-xl border border-[var(--timer-active)]/40 bg-[var(--timer-active)]/15 px-4 py-3 text-[var(--timer-active)] hover:bg-[var(--timer-active)]/25 hover:border-[var(--timer-active)]/55"
        >
          Get Recommendation
        </button>

        {/* Only show work/break toggle when in break mode ("End Work"); hide "Start Session" during active session to avoid confusion with End Session */}
        {!isWorkMode && (
          <button
            type="button"
            onClick={onToggleWorkMode}
            className="btn-soft w-full rounded-xl border border-[var(--session-active)]/40 bg-[var(--session-active)]/15 px-4 py-3 text-[var(--session-active)] hover:bg-[var(--session-active)]/25 hover:border-[var(--session-active)]/55"
          >
            End Work
          </button>
        )}
      </div>
    </div>
  );
}
