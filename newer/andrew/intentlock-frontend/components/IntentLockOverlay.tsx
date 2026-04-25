"use client";
import { useState, useEffect, type CSSProperties } from "react";

interface IntentLockOverlayProps {
  isOpen: boolean;
  frictionLevel: number;
  message: string;
  exitEventId: number | null;
  onContinue: () => void;
  onExit: () => void;
  onReasonSubmitted: (reason: string, customText?: string) => void;
  backendUrl: string;
}

export default function IntentLockOverlay({
  isOpen,
  frictionLevel,
  message,
  exitEventId,
  onContinue,
  onExit,
  onReasonSubmitted,
  backendUrl,
}: IntentLockOverlayProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customText, setCustomText] = useState<string>("");
  const [countdown, setCountdown] = useState<number | null>(null);

  // Reset state when overlay opens
  useEffect(() => {
    if (isOpen) {
      setSelectedReason("");
      setCustomText("");
      setCountdown(null);
    }
  }, [isOpen]);

  // Handle countdown for friction level 2
  useEffect(() => {
    if (frictionLevel === 2 && isOpen && countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      handleExit();
    }
  }, [countdown, frictionLevel, isOpen]);

  const handleReasonSubmit = async () => {
    if (!selectedReason) return;

    if (exitEventId) {
      try {
        await fetch(`${backendUrl}/log-reason`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            exit_event_id: exitEventId,
            reason: selectedReason,
            custom_text: customText || undefined,
          }),
        });
        onReasonSubmitted(selectedReason, customText);
        onExit();
      } catch (error) {
        console.error("Error logging reason:", error);
      }
    }
  };

  const handleExit = () => {
    if (frictionLevel === 1 && !selectedReason) {
      return;
    }
    onExit();
  };

  const startCountdown = () => {
    setCountdown(3);
  };

  if (!isOpen) return null;

  const cardStyle: CSSProperties = {
    background: "var(--color-surface)",
    padding: "var(--space-lg)",
    borderRadius: "var(--radius-card)",
    maxWidth: "500px",
    width: "90%",
    boxShadow: "0 25px 35px -20px rgba(15, 23, 42, 0.9)",
    border: "1px solid var(--color-border)",
  };
  const btnContinueStyle: CSSProperties = {
    padding: "var(--space-sm) var(--space-md)",
    backgroundColor: "var(--color-success)",
    color: "white",
    border: "none",
    borderRadius: "var(--radius-card)",
    cursor: "pointer",
    fontSize: "var(--text-base)",
  };
  const btnExitStyle: CSSProperties = {
    padding: "var(--space-sm) var(--space-md)",
    backgroundColor: "var(--color-error)",
    color: "white",
    border: "none",
    borderRadius: "var(--radius-card)",
    cursor: "pointer",
    fontSize: "var(--text-base)",
  };
  const btnExitDisabledStyle: CSSProperties = {
    ...btnExitStyle,
    backgroundColor: "var(--color-border)",
    cursor: "not-allowed",
  };
  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "var(--space-sm)",
    marginBottom: "var(--space-md)",
    fontSize: "var(--text-base)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    backgroundColor: "var(--color-background)",
    color: "var(--color-text-primary)",
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(2, 6, 23, 0.88)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
      }}
    >
      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, marginBottom: "var(--space-md)", color: "var(--color-text-primary)", fontSize: "var(--text-2xl)" }}>
          Intent-Lock
        </h2>
        <p style={{ marginBottom: "var(--space-md)", fontSize: "var(--text-base)", color: "var(--color-text-secondary)" }}>
          {message}
        </p>

        {frictionLevel === 0 && (
          <div style={{ display: "flex", gap: "var(--space-sm)", justifyContent: "flex-end" }}>
            <button onClick={onContinue} style={btnContinueStyle}>
              Continue Studying
            </button>
            <button onClick={handleExit} style={btnExitStyle}>
              Exit Anyway
            </button>
          </div>
        )}

        {frictionLevel === 1 && (
          <div>
            <label style={{ display: "block", marginBottom: "var(--space-sm)", fontWeight: "bold", color: "var(--color-text-secondary)" }}>
              Select a reason:
            </label>
            <select value={selectedReason} onChange={(e) => setSelectedReason(e.target.value)} style={inputStyle}>
              <option value="">Select a reason</option>
              <option value="fatigue">Fatigue</option>
              <option value="distraction">Distraction</option>
              <option value="boredom">Boredom</option>
              <option value="task_completed">Task Completed</option>
              <option value="other">Other</option>
            </select>

            {selectedReason === "other" && (
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Please describe..."
                style={{ ...inputStyle, minHeight: "80px", fontSize: "var(--text-sm)" }}
              />
            )}

            <div style={{ display: "flex", gap: "var(--space-sm)", justifyContent: "flex-end" }}>
              <button onClick={onContinue} style={btnContinueStyle}>Cancel</button>
              <button onClick={handleReasonSubmit} disabled={!selectedReason} style={selectedReason ? btnExitStyle : btnExitDisabledStyle}>
                Save & Exit
              </button>
            </div>
          </div>
        )}

        {frictionLevel === 2 && (
          <div>
            {countdown === null ? (
              <div>
                <p style={{ marginBottom: "var(--space-md)", color: "var(--color-text-muted)" }}>
                  Please confirm you want to exit. This will start a 3-second countdown.
                </p>
                <div style={{ display: "flex", gap: "var(--space-sm)", justifyContent: "flex-end" }}>
                  <button onClick={onContinue} style={btnContinueStyle}>Cancel</button>
                  <button onClick={startCountdown} style={btnExitStyle}>Confirm Exit</button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "var(--text-3xl)", fontWeight: "bold", color: "var(--color-error)", margin: "var(--space-md) 0" }}>
                  {countdown}
                </p>
                <p style={{ marginBottom: "var(--space-md)", color: "var(--color-text-secondary)" }}>
                  Exiting in {countdown} second{countdown !== 1 ? "s" : ""}...
                </p>
                <button
                  onClick={() => { setCountdown(null); onContinue(); }}
                  style={btnContinueStyle}
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
