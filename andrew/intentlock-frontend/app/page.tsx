"use client";
import { useState, useEffect } from "react";
import IntentLockOverlay from "../components/IntentLockOverlay";

const BACKEND_URL = "http://127.0.0.1:8000";

export default function Home() {
  const [sessionStartTime] = useState<Date>(new Date());
  const [sessionMinutes, setSessionMinutes] = useState<number>(0);
  const [latentMean, setLatentMean] = useState<number>(0.5); // Default cognitive load
  const [loading, setLoading] = useState<boolean>(false);
  const [overlayOpen, setOverlayOpen] = useState<boolean>(false);
  const [frictionLevel, setFrictionLevel] = useState<number>(0);
  const [overlayMessage, setOverlayMessage] = useState<string>("");
  const [exitEventId, setExitEventId] = useState<number | null>(null);
  const [requiresFriction, setRequiresFriction] = useState<boolean>(false);
  const [sessionId] = useState<string>(`session_${Date.now()}`);

  // Update session minutes every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed =
        (new Date().getTime() - sessionStartTime.getTime()) / 1000 / 60;
      setSessionMinutes(Math.floor(elapsed));
    }, 60000); // Update every minute

    // Initial calculation
    const elapsed =
      (new Date().getTime() - sessionStartTime.getTime()) / 1000 / 60;
    setSessionMinutes(Math.floor(elapsed));

    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // Simulate cognitive load variation (in real app, this would come from another module)
  useEffect(() => {
    // Simulate varying cognitive load (0.3 to 0.8)
    const interval = setInterval(() => {
      setLatentMean(0.3 + Math.random() * 0.5);
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const handleExitAttempt = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/predict-exit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_minutes: sessionMinutes || 1, // At least 1 minute
          latent_mean: latentMean,
          session_id: sessionId,
        }),
      });

      const data = await response.json();

      setFrictionLevel(data.friction_level);
      setOverlayMessage(data.message);
      setExitEventId(data.exit_event_id);
      setRequiresFriction(data.requires_friction !== false); // Default to true if not specified

      // If genuine exit (no friction required), allow immediate exit
      if (!data.requires_friction) {
        // Genuine exit - no overlay, just exit immediately
        alert(data.message || "Exit allowed. You've had a productive session.");
        // In a real app, this would close the study session
        return;
      }

      // Impulsive exit - show overlay with friction
      setOverlayOpen(true);
    } catch (error) {
      console.error("Error Calling Backend:", error);
      alert(
        "Error connecting to backend. Please ensure the server is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayContinue = () => {
    setOverlayOpen(false);
    // User continues studying
  };

  const handleOverlayExit = () => {
    setOverlayOpen(false);
    // User exits - in a real app, this would close the study session
    alert("Study session ended.");
  };

  const handleReasonSubmitted = (reason: string, customText?: string) => {
    console.log("Reason submitted:", reason, customText);
    // Reason is already logged by the overlay component
  };

  return (
    <main style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>Intent-Lock Detection</h1>
      <p>Simulated study session in progress...</p>

      <div
        style={{
          marginTop: "20px",
          padding: "15px",
          backgroundColor: "#f5f5f5",
          borderRadius: "8px",
        }}
      >
        <p>
          <strong>Session Duration:</strong> {sessionMinutes} minutes
        </p>
        <p>
          <strong>Cognitive Load (latent_mean):</strong> {latentMean.toFixed(2)}
        </p>
        <p style={{ fontSize: "12px", color: "#666", marginTop: "10px" }}>
          Note: In a real implementation, cognitive load would come from another
          module tracking user behavior.
        </p>
      </div>

      <button
        onClick={handleExitAttempt}
        disabled={loading}
        style={{
          padding: "10px 20px",
          backgroundColor: loading ? "#ccc" : "blue",
          color: "white",
          fontSize: "16px",
          cursor: loading ? "not-allowed" : "pointer",
          marginTop: "20px",
          border: "none",
          borderRadius: "6px",
        }}
      >
        {loading ? "Analyzing Intent..." : "Exit Study Session"}
      </button>

      <IntentLockOverlay
        isOpen={overlayOpen}
        frictionLevel={frictionLevel}
        message={overlayMessage}
        exitEventId={exitEventId}
        onContinue={handleOverlayContinue}
        onExit={handleOverlayExit}
        onReasonSubmitted={handleReasonSubmitted}
        backendUrl={BACKEND_URL}
      />
    </main>
  );
}
