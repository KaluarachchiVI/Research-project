"use client";

import { useState } from "react";
import { EstimateResponse, submitEmaResponse } from "../lib/api";
import { useEstimatorContext } from "./providers/EstimatorProvider";
import styles from "./PromptPanel.module.css";
import { MessageSquare, Send, XCircle, Clock, AlertTriangle } from "lucide-react";

type Props = {
  className?: string;
};

export function PromptPanel({ className = "" }: Props) {
  const { estimate, setHydratedPrompt } = useEstimatorContext();
  const prompt = estimate?.pending_prompt ?? null;
  const [rating, setRating] = useState(4);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!prompt) {
    return (
      <div className={`${styles.panel} ${className}`}>
        <div className={styles.placeholder}>
          <MessageSquare className={styles.placeholderIcon} size={32} />
          <p>No pending EMA prompt. You'll be notified when a new one arrives.</p>
        </div>
      </div>
    );
  }

  const submit = async (disposition: "completed" | "dismissed" | "timeout" | "snoozed") => {
    setBusy(true);
    setError(null);
    try {
      await submitEmaResponse(prompt.prompt_id, rating, disposition, note || undefined);
      setHydratedPrompt(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit response");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${styles.panel} ${className}`}>
      <div className={styles.header}>
        <div className={styles.promptIconWrapper}>
          <MessageSquare size={20} className="text-cyan-400" />
        </div>
        <div>
          <div className={styles.promptLabel}>Active Probe #{prompt.prompt_id}</div>
          <div className={styles.promptReason}>
            Reason: <strong>{prompt.reason}</strong>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.field}>
          <label className={styles.label}>Self-Reported Cognitive Load</label>
          <div className={styles.likertContainer}>
            {[1, 2, 3, 4, 5, 6, 7].map((num) => (
              <button
                key={num}
                className={`${styles.likertButton} ${rating === num ? styles.active : ""}`}
                onClick={() => setRating(num)}
                disabled={busy}
                aria-label={`Rate cognitive load as ${num}`}
                aria-pressed={rating === num}
              >
                {num}
              </button>
            ))}
          </div>
          <div className={styles.likertLabels}>
            <span>Low Load</span>
            <span>Neutral</span>
            <span>High Load</span>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            Contextual Notes <span className={styles.optional}>(Optional)</span>
          </label>
          <div className={styles.textareaWrapper}>
            <textarea
              value={note}
              disabled={busy}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className={styles.textarea}
              placeholder="Briefly describe your current activity..."
              aria-label="Contextual notes for EMA response"
            />
          </div>
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <button
          className={`${styles.btn} ${styles.primary}`}
          disabled={busy}
          onClick={() => submit("completed")}
          aria-busy={busy}
        >
          {busy ? "Sending..." : "Confirm Response"}
          <Send size={16} aria-hidden="true" />
        </button>

        <div className={styles.secondaryActions}>
          <button
            className={styles.secondaryBtn}
            disabled={busy}
            title="Snooze for 5 minutes"
            onClick={() => submit("snoozed")}
            aria-label="Snooze prompt for 5 minutes"
          >
            <Clock size={16} aria-hidden="true" />
            <span>Snooze</span>
          </button>
          <button
            className={styles.secondaryBtn}
            disabled={busy}
            title="Dismiss prompt"
            onClick={() => submit("dismissed")}
            aria-label="Dismiss this prompt"
          >
            <XCircle size={16} aria-hidden="true" />
            <span>Dismiss</span>
          </button>
        </div>
      </div>
    </div>
  );
}
