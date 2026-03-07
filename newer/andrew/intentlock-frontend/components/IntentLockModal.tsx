"use client";

import { useState, useEffect } from "react";

interface IntentLockModalProps {
  isOpen: boolean;
  frictionLevel: 0 | 1 | 2;
  message: string;
  exitEventId: number | null;
  onContinue: () => void;
  onExit: () => void;
  onReasonSubmitted: (reason: string, customText?: string) => void;
  backendUrl: string;
}

export function IntentLockModal({
  isOpen,
  frictionLevel,
  message,
  exitEventId,
  onContinue,
  onExit,
  onReasonSubmitted,
  backendUrl,
}: IntentLockModalProps) {
  const [selectedReason, setSelectedReason] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showCountdown, setShowCountdown] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setSelectedReason("");
      setReasonText("");
      setCountdown(null);
      setShowCountdown(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (
      frictionLevel === 2 &&
      isOpen &&
      showCountdown &&
      countdown !== null &&
      countdown > 0
    ) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (showCountdown && countdown === 0) {
      onExit();
    }
  }, [frictionLevel, isOpen, showCountdown, countdown, onExit]);

  const handleFriction2Confirm = () => {
    setShowCountdown(true);
    setCountdown(3);
  };

  const handleCancelCountdown = () => {
    setShowCountdown(false);
    setCountdown(null);
    setIsClosing(true);
    setTimeout(() => {
      onContinue();
      setIsClosing(false);
    }, 200);
  };

  const handleReasonSubmit = async () => {
    if (frictionLevel === 1 && !selectedReason) return;
    if (exitEventId) {
      try {
        await fetch(`${backendUrl}/log-reason`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exit_event_id: exitEventId,
            reason: selectedReason,
            custom_text: reasonText || undefined,
          }),
        });
        onReasonSubmitted(selectedReason, reasonText || undefined);
      } catch (err) {
        console.error("Error logging reason:", err);
      }
    }
    setIsClosing(true);
    setTimeout(() => {
      onExit();
      setIsClosing(false);
    }, 200);
  };

  const handleExitAnyway = () => {
    setIsClosing(true);
    setTimeout(() => {
      onExit();
      setIsClosing(false);
    }, 200);
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isClosing ? "modal-exit" : "modal-enter"}`}
    >
      <div className="modal-backdrop absolute inset-0 bg-black/80" aria-hidden />
      <div className="modal-panel relative z-10 w-full max-w-lg bg-card border border-border rounded-[1.25rem] p-8 shadow-2xl">
        <div className="mb-6">
          <h2 className="mb-2 text-foreground">Intent-Lock</h2>
          <p className="text-sm text-muted-foreground">
            {message ||
              "Our system detected this exit may be impulsive. Please confirm your intention."}
          </p>
        </div>

        {frictionLevel === 0 && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setIsClosing(true);
                setTimeout(() => {
                  onContinue();
                  setIsClosing(false);
                }, 200);
              }}
              className="btn-motion w-full rounded-full border px-6 py-4 transition-opacity"
              style={{
                backgroundColor: "rgba(186, 212, 170, 0.2)",
                borderColor: "rgba(186, 212, 170, 0.4)",
                color: "#BAD4AA",
              }}
            >
              Continue Studying
            </button>
            <button
              type="button"
              onClick={handleExitAnyway}
              className="btn-motion w-full rounded-full border px-6 py-4 transition-colors"
              style={{
                backgroundColor: "rgba(239, 100, 97, 0.15)",
                borderColor: "rgba(239, 100, 97, 0.4)",
                color: "#EF6461",
              }}
            >
              Exit Anyway
            </button>
          </div>
        )}

        {frictionLevel === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-wider text-muted-foreground">
                Select a reason
              </label>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full rounded-xl border border-input bg-input-background px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Choose a reason...</option>
                <option value="fatigue">Fatigue</option>
                <option value="distraction">Distraction</option>
                <option value="boredom">Boredom</option>
                <option value="task_completed">Task Completed</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-wider text-muted-foreground">
                Additional notes (optional)
              </label>
              <textarea
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                className="w-full resize-none rounded-xl border border-input bg-input-background px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-ring"
                rows={3}
                placeholder="Provide additional details..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={onContinue}
                className="rounded-full border border-border bg-secondary px-6 py-3 transition-colors hover:bg-secondary/80 text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReasonSubmit}
                disabled={!selectedReason}
                className="btn-motion rounded-full border border-destructive/30 bg-destructive/20 px-6 py-3 text-destructive transition-colors hover:bg-destructive/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save & Exit
              </button>
            </div>
          </div>
        )}

        {frictionLevel === 2 && (
          <div className="space-y-4">
            {!showCountdown ? (
              <>
                <p className="mb-4 text-center text-foreground">
                  Are you sure you want to exit your session? This will start a
                  3-second countdown.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsClosing(true);
                      setTimeout(() => {
                        onContinue();
                        setIsClosing(false);
                      }, 200);
                    }}
                    className="btn-motion rounded-full border border-border bg-secondary px-6 py-3 text-foreground transition-colors hover:bg-secondary/80"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleFriction2Confirm}
                    className="btn-motion rounded-full border border-destructive/30 bg-destructive/20 px-6 py-3 text-destructive transition-colors hover:bg-destructive/30"
                  >
                    Confirm Exit
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-6 text-center">
                <div className="font-mono text-6xl text-destructive">
                  {countdown}
                </div>
                <p className="text-muted-foreground">
                  Exiting in {countdown} second{countdown !== 1 ? "s" : ""}...
                </p>
                <button
                  type="button"
                  onClick={handleCancelCountdown}
                  className="btn-motion rounded-full border border-border bg-secondary px-8 py-3 text-foreground transition-colors hover:bg-secondary/80"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
