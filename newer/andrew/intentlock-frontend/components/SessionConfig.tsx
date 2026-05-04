"use client";

import { AppSelect } from "./AppSelect";

export interface SessionConfigForm {
  userId: string;
  taskType: string;
  chronotype: string;
  algorithm: string;
  blockMinutes: number;
}

interface SessionConfigProps {
  /** Set from authenticated user; not editable (Phase 3). */
  userId: string;
  taskType: string;
  chronotype: string;
  algorithm: string;
  blockMinutes: number;
  onTaskTypeChange: (v: string) => void;
  onChronotypeChange: (v: string) => void;
  onAlgorithmChange: (v: string) => void;
  onBlockMinutesChange: (v: number) => void;
  onStartSession: () => void;
  schedulerStartError: string | null;
  schedulerStarting: boolean;
}

export function SessionConfig({
  userId: _userId,
  taskType,
  chronotype,
  algorithm,
  blockMinutes,
  onTaskTypeChange,
  onChronotypeChange,
  onAlgorithmChange,
  onBlockMinutesChange,
  onStartSession,
  schedulerStartError,
  schedulerStarting,
}: SessionConfigProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartSession();
  };

  return (
    <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg">
      <div className="mb-6">
        <h2 className="mb-2 text-foreground">Session configuration</h2>
        <p className="text-sm text-muted-foreground">
          Configure your time-block session parameters and start monitoring
        </p>
      </div>

      {schedulerStartError && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <strong>Scheduler error:</strong> {schedulerStartError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label id="task-type-label" className="block text-xs uppercase tracking-wider text-muted-foreground">
              Task type
            </label>
            <AppSelect
              id="task-type"
              aria-label="Task type"
              value={taskType}
              onChange={onTaskTypeChange}
              options={[
                { value: "writing", label: "Writing" },
                { value: "coding", label: "Coding" },
                { value: "reading", label: "Reading" },
                { value: "other", label: "Other" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <label id="chronotype-label" className="block text-xs uppercase tracking-wider text-muted-foreground">
              Chronotype
            </label>
            <AppSelect
              id="chronotype"
              aria-label="Chronotype"
              value={chronotype}
              onChange={onChronotypeChange}
              options={[
                { value: "morning", label: "Morning" },
                { value: "evening", label: "Evening" },
                { value: "neutral", label: "Neutral" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <label id="algorithm-label" className="block text-xs uppercase tracking-wider text-muted-foreground">
              Algorithm
            </label>
            <AppSelect
              id="algorithm"
              aria-label="Algorithm"
              value={algorithm}
              onChange={onAlgorithmChange}
              options={[
                { value: "LinUCB", label: "LinUCB" },
                { value: "ThompsonSampling", label: "Thompson Sampling" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs uppercase tracking-wider text-muted-foreground">
              Block length (min)
            </label>
            <input
              type="number"
              value={blockMinutes}
              onChange={(e) =>
                onBlockMinutesChange(
                  Number.isNaN(Number(e.target.value)) ? 60 : Number(e.target.value)
                )
              }
              className="w-full rounded-xl border border-border bg-input-background px-4 py-3 text-foreground outline-none transition-[box-shadow,border-color] focus:border-[var(--cognitive-load)] focus:ring-2 focus:ring-[var(--cognitive-load)] focus:ring-opacity-40"
              min={5}
              max={480}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={schedulerStarting}
          className="btn-soft w-full rounded-full border border-[var(--cognitive-load)] bg-[var(--cognitive-load)] px-8 py-4 text-white hover:opacity-90 hover:shadow-md disabled:opacity-70"
        >
          {schedulerStarting ? "Starting…" : "Start Time Block Session"}
        </button>
      </form>
    </div>
  );
}
