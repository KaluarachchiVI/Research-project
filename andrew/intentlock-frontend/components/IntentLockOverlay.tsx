"use client";
import { useState, useEffect } from "react";

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
  const [exitText, setExitText] = useState<string>("");

  // Reset state when overlay opens
  useEffect(() => {
    if (isOpen) {
      setSelectedReason("");
      setCustomText("");
      setExitText("");
      setCountdown(null);
    }
  }, [isOpen]);

  // Handle countdown for friction level 2 (Option A)
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
      return; // Can't exit without reason
    }
    onExit();
  };

  const startCountdown = () => {
    setCountdown(3);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          backgroundColor: "#1a1f3a",
          padding: "40px",
          borderRadius: "12px",
          maxWidth: "500px",
          width: "90%",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
          border: "1px solid #2d3748",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "20px", color: "#ffffff" }}>
          Intent-Lock
        </h2>
        <p style={{ marginBottom: "20px", fontSize: "16px", color: "#e2e8f0" }}>
          {message}
        </p>

        {/* Friction Level 0: Simple reminder */}
        {frictionLevel === 0 && (
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button
              onClick={onContinue}
              style={{
                padding: "10px 20px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              Continue Studying
            </button>
            <button
              onClick={handleExit}
              style={{
                padding: "10px 20px",
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              Exit Anyway
            </button>
          </div>
        )}

        {/* Friction Level 1: Reason prompt */}
        {frictionLevel === 1 && (
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "10px",
                fontWeight: "bold",
                color: "#e2e8f0",
              }}
            >
              Select a reason:
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                marginBottom: "15px",
                fontSize: "16px",
                border: "1px solid #2d3748",
                borderRadius: "6px",
                backgroundColor: "#0f172a",
                color: "#ffffff",
              }}
            >
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
                style={{
                  width: "100%",
                  padding: "10px",
                  marginBottom: "15px",
                  fontSize: "14px",
                  border: "1px solid #2d3748",
                  borderRadius: "6px",
                  minHeight: "80px",
                  backgroundColor: "#0f172a",
                  color: "#ffffff",
                }}
              />
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={onContinue}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "16px",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReasonSubmit}
                disabled={!selectedReason}
                style={{
                  padding: "10px 20px",
                  backgroundColor: selectedReason ? "#f44336" : "#ccc",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: selectedReason ? "pointer" : "not-allowed",
                  fontSize: "16px",
                }}
              >
                Save & Exit
              </button>
            </div>
          </div>
        )}

        {/* Friction Level 2: Strong confirmation (3-second countdown) */}
        {frictionLevel === 2 && (
          <div>
            {countdown === null ? (
              <div>
                <p style={{ marginBottom: "20px", color: "#9ca3af" }}>
                  Please confirm you want to exit. This will start a 3-second countdown.
                </p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button
                    onClick={onContinue}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: "#4CAF50",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "16px",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={startCountdown}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: "#f44336",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "16px",
                    }}
                  >
                    Confirm Exit
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center" }}>
                <p
                  style={{
                    fontSize: "48px",
                    fontWeight: "bold",
                    color: "#f44336",
                    margin: "20px 0",
                  }}
                >
                  {countdown}
                </p>
                <p style={{ marginBottom: "20px" }}>
                  Exiting in {countdown} second{countdown !== 1 ? "s" : ""}...
                </p>
                <button
                  onClick={() => {
                    setCountdown(null);
                    onContinue();
                  }}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "16px",
                  }}
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

