"use client";

import { useState } from "react";

export type ClePendingPrompt = {
  prompt_id: number;
  reason: string;
};

type EmaPromptPanelProps = {
  prompt: ClePendingPrompt;
  busy: boolean;
  onRespond: (
    rating: number,
    disposition: "completed" | "dismissed" | "snoozed"
  ) => void | Promise<void>;
};

export function EmaPromptPanel({ prompt, busy, onRespond }: EmaPromptPanelProps) {
  const [rating, setRating] = useState(4);

  return (
    <div
      className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg ring-2 ring-[var(--cognitive-load)]/25"
      role="region"
      aria-labelledby="ema-prompt-title"
    >
      <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
        Cognitive load check-in
      </div>
      <h2 id="ema-prompt-title" className="mb-2 text-lg font-medium text-foreground">
        How demanding does this stretch of work feel?
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Trigger: <span className="font-mono text-foreground">{prompt.reason}</span>
        <span className="text-muted-foreground"> · prompt #{prompt.prompt_id}</span>
      </p>

      <div className="mb-4">
        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
          <span>Very light (1)</span>
          <span>Very heavy (7)</span>
        </div>
        <input
          type="range"
          min={1}
          max={7}
          step={1}
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="w-full accent-[var(--cognitive-load)]"
          disabled={busy}
        />
        <div className="mt-1 text-center font-mono text-2xl text-[var(--cognitive-load)]">
          {rating}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onRespond(rating, "snoozed")}
          className="rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground hover:bg-secondary/90 disabled:opacity-50"
        >
          Snooze
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onRespond(rating, "dismissed")}
          className="rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary/50 disabled:opacity-50"
        >
          Dismiss
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onRespond(rating, "completed")}
          className="rounded-xl border border-[var(--cognitive-load)] bg-[var(--cognitive-load)] px-3 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Submit"}
        </button>
      </div>
    </div>
  );
}
