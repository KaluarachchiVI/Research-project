"use client";
import { useState, useEffect } from "react";
import IntentLockOverlay from "../components/IntentLockOverlay";

const BACKEND_URL = "http://127.0.0.1:8000";

interface ExitLog {
  timestamp: string;
  prediction: string;
  frictionLevel: number;
  sessionMinutes: number;
  latentMean: number;
}

export default function Home() {
  const [sessionStartTime, setSessionStartTime] = useState<Date>(new Date());
  const [sessionMinutes, setSessionMinutes] = useState<number>(0);
  const [latentMean, setLatentMean] = useState<number>(0.5); // Default cognitive load
  const [loading, setLoading] = useState<boolean>(false);
  const [overlayOpen, setOverlayOpen] = useState<boolean>(false);
  const [frictionLevel, setFrictionLevel] = useState<number>(0);
  const [overlayMessage, setOverlayMessage] = useState<string>("");
  const [exitEventId, setExitEventId] = useState<number | null>(null);
  const [requiresFriction, setRequiresFriction] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string>(`session_${Date.now()}`);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(true);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [lastPrediction, setLastPrediction] = useState<string | null>(null);
  const [exitLogs, setExitLogs] = useState<ExitLog[]>([]);
  const [workDuration] = useState<number>(30); // 30 minutes work
  const [breakDuration] = useState<number>(5); // 5 minutes break

  // Reset session function
  const resetSession = () => {
    setSessionStartTime(new Date());
    setSessionMinutes(0);
    setTimerSeconds(0);
    setSessionId(`session_${Date.now()}`);
    setLastPrediction(null);
    setExitLogs([]);
    setIsPaused(false);
    setIsSessionActive(false);
    setFrictionLevel(0);
    setExitEventId(null);
  };

  // Start session function
  const startSession = () => {
    setSessionStartTime(new Date());
    setTimerSeconds(0);
    setSessionMinutes(0);
    setSessionId(`session_${Date.now()}`);
    setIsSessionActive(true);
    setIsPaused(false);
  };

  // Handle start/end button
  const handleStartEnd = async () => {
    if (isSessionActive) {
      // End session - trigger exit attempt
      await handleExitAttempt();
    } else {
      // Start new session
      startSession();
    }
  };

  // Timer countdown/up
  useEffect(() => {
    if (isPaused || !isSessionActive) return;

    const interval = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
      const elapsed =
        (new Date().getTime() - sessionStartTime.getTime()) / 1000;
      setSessionMinutes(Math.floor(elapsed / 60));
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, isSessionActive, sessionStartTime]);

  // Simulate cognitive load variation (in real app, this would come from another module)
  useEffect(() => {
    // Simulate varying cognitive load (0.3 to 0.8)
    const interval = setInterval(() => {
      setLatentMean(0.3 + Math.random() * 0.5);
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Format timer display (MM:SS)
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Calculate cognitive load percentage (0-1 to 0-200%)
  const cognitiveLoadPercent = Math.round(latentMean * 200);

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
      setRequiresFriction(data.requires_friction !== false);
      setLastPrediction(data.prediction);

      // Add to exit logs
      setExitLogs((prev) =>
        [
          {
            timestamp: new Date().toISOString(),
            prediction: data.prediction,
            frictionLevel: data.friction_level,
            sessionMinutes: sessionMinutes,
            latentMean: latentMean,
          },
          ...prev,
        ].slice(0, 10)
      ); // Keep last 10

      // If genuine exit (no friction required), allow immediate exit
      if (!data.requires_friction) {
        // Genuine exit - no overlay, just exit immediately
        alert(data.message || "Exit allowed. You've had a productive session.");
        // Reset session and timer
        resetSession();
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
    // Reset session and timer
    resetSession();
  };

  const handleReasonSubmitted = (reason: string, customText?: string) => {
    console.log("Reason submitted:", reason, customText);
    // Reason is already logged by the overlay component
  };

  const getCognitiveLoadStatus = () => {
    if (cognitiveLoadPercent > 140) {
      return `High cognitive load - Consider taking a break (${cognitiveLoadPercent}%)`;
    } else if (cognitiveLoadPercent > 100) {
      return `Moderate cognitive load - Stay focused (${cognitiveLoadPercent}%)`;
    } else {
      return `Low cognitive load - Good focus level (${cognitiveLoadPercent}%)`;
    }
  };

  const getRecommendation = () => {
    if (!lastPrediction) {
      return "Waiting for recommendation...";
    }
    if (lastPrediction === "genuine") {
      return "Exit allowed - Productive session detected";
    } else {
      return `Impulsive exit detected - Friction level ${frictionLevel} applied`;
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#0a0e27",
        color: "#ededed",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Header Section */}
      <div style={{ marginBottom: "30px" }}>
        <h1
          style={{
            fontSize: "14px",
            fontWeight: "normal",
            color: "#9ca3af",
            marginBottom: "5px",
          }}
        >
          ADAPTIVE SCHEDULER
        </h1>
        <h2
          style={{
            fontSize: "24px",
            fontWeight: "bold",
            color: "#ffffff",
            marginBottom: "20px",
          }}
        >
          Real-time work/break scheduling
        </h2>

        {/* Status Indicators */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "15px",
            marginBottom: "20px",
          }}
        >
          <span
            style={{
              backgroundColor: isSessionActive ? "#10b981" : "#6b7280",
              color: "#ffffff",
              padding: "4px 12px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: "500",
            }}
          >
            {isSessionActive ? "Session Active" : "Session Inactive"}
          </span>
          <span style={{ color: "#9ca3af", fontSize: "14px" }}>
            Session: {sessionId.substring(0, 12)}...
          </span>
        </div>
      </div>

      {/* Main Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "20px",
          marginBottom: "40px",
        }}
      >
        {/* Card 1: Current Timer */}
        <div
          style={{
            backgroundColor: "#1a1f3a",
            borderRadius: "12px",
            padding: "20px",
            border: "1px solid #2d3748",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "15px",
            }}
          >
            <span style={{ fontSize: "16px" }}>⏱️</span>
            <h3
              style={{ fontSize: "14px", fontWeight: "600", color: "#e2e8f0" }}
            >
              Current Timer
            </h3>
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "#9ca3af",
              marginBottom: "10px",
            }}
          >
            WORK SESSION
          </div>
          <div
            style={{
              fontSize: "48px",
              fontWeight: "bold",
              color: "#10b981",
              marginBottom: "15px",
              fontFamily: "monospace",
            }}
          >
            {formatTimer(timerSeconds)}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "#9ca3af",
              marginBottom: "20px",
            }}
          >
            {workDuration} WORK (MIN) | {breakDuration} BREAK (MIN)
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setIsPaused(!isPaused)}
              disabled={!isSessionActive}
              style={{
                backgroundColor: isPaused ? "#10b981" : "#4b5563",
                color: "#ffffff",
                border: "none",
                padding: "10px",
                borderRadius: "6px",
                cursor: isSessionActive ? "pointer" : "not-allowed",
                fontSize: "14px",
                flex: 1,
                opacity: isSessionActive ? 1 : 0.5,
              }}
            >
              {isPaused ? "Resume" : "Pause"}
            </button>
            <button
              onClick={handleStartEnd}
              disabled={loading}
              style={{
                backgroundColor: isSessionActive ? "#ef4444" : "#10b981",
                color: "#ffffff",
                border: "none",
                padding: "10px",
                borderRadius: "6px",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "14px",
                flex: 1,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading
                ? "Analyzing..."
                : isSessionActive
                ? "End Session"
                : "Start Session"}
            </button>
          </div>
        </div>

        {/* Card 2: Cognitive Load */}
        <div
          style={{
            backgroundColor: "#1a1f3a",
            borderRadius: "12px",
            padding: "20px",
            border: "1px solid #2d3748",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "15px",
            }}
          >
            <span style={{ fontSize: "16px" }}>🧠</span>
            <h3
              style={{ fontSize: "14px", fontWeight: "600", color: "#e2e8f0" }}
            >
              Cognitive Load (Praboth Real-time)
            </h3>
          </div>
          <div
            style={{
              fontSize: "48px",
              fontWeight: "bold",
              color: "#ec4899",
              marginBottom: "20px",
            }}
          >
            {cognitiveLoadPercent}%
          </div>
          <div
            style={{
              backgroundColor: "#0f172a",
              padding: "12px",
              borderRadius: "6px",
              fontSize: "13px",
              color: "#cbd5e1",
            }}
          >
            <div style={{ fontWeight: "600", marginBottom: "5px" }}>
              Current Status
            </div>
            <div>{getCognitiveLoadStatus()}</div>
          </div>
        </div>

        {/* Card 3: Current Recommendation */}
        <div
          style={{
            backgroundColor: "#1a1f3a",
            borderRadius: "12px",
            padding: "20px",
            border: "1px solid #2d3748",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "15px",
            }}
          >
            <span style={{ fontSize: "16px" }}>💡</span>
            <h3
              style={{ fontSize: "14px", fontWeight: "600", color: "#e2e8f0" }}
            >
              Current Recommendation
            </h3>
          </div>
          <div style={{ marginBottom: "15px" }}>
            <div
              style={{
                fontSize: "11px",
                color: "#9ca3af",
                marginBottom: "5px",
              }}
            >
              WORK (MIN)
            </div>
            <div style={{ fontSize: "18px", color: "#ffffff" }}>
              {lastPrediction === "genuine" ? "Continue" : "-"}
            </div>
          </div>
          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                fontSize: "11px",
                color: "#9ca3af",
                marginBottom: "5px",
              }}
            >
              BREAK (MIN)
            </div>
            <div style={{ fontSize: "18px", color: "#ffffff" }}>
              {lastPrediction === "impulsive" ? "Recommended" : "-"}
            </div>
          </div>
          <div
            style={{
              backgroundColor: "#0f172a",
              padding: "12px",
              borderRadius: "6px",
              fontSize: "13px",
              color: "#cbd5e1",
            }}
          >
            <div style={{ fontWeight: "600", marginBottom: "5px" }}>
              Algorithm Decision
            </div>
            <div>{getRecommendation()}</div>
          </div>
        </div>

        {/* Card 4: Session Metrics */}
        <div
          style={{
            backgroundColor: "#1a1f3a",
            borderRadius: "12px",
            padding: "20px",
            border: "1px solid #2d3748",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "15px",
            }}
          >
            <span style={{ fontSize: "16px" }}>📊</span>
            <h3
              style={{ fontSize: "14px", fontWeight: "600", color: "#e2e8f0" }}
            >
              Session Metrics
            </h3>
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <div>
              <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                CONFIDENCE
              </div>
              <div style={{ fontSize: "16px", color: "#ffffff" }}>
                {lastPrediction ? "75.6%" : "-"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                ALGORITHM
              </div>
              <div style={{ fontSize: "16px", color: "#ffffff" }}>
                {lastPrediction ? "Logistic Regression" : "-"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "#9ca3af" }}>EPOCH</div>
              <div style={{ fontSize: "16px", color: "#ffffff" }}>0</div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                PREDICTIONS
              </div>
              <div style={{ fontSize: "16px", color: "#ffffff" }}>
                {exitLogs.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Research Metrics Section */}
      <div style={{ marginTop: "40px" }}>
        <h2
          style={{
            fontSize: "18px",
            fontWeight: "600",
            color: "#ffffff",
            marginBottom: "20px",
          }}
        >
          Research Metrics (Exit Logs)
        </h2>
        <div
          style={{
            backgroundColor: "#1a1f3a",
            borderRadius: "12px",
            padding: "20px",
            border: "1px solid #2d3748",
            maxHeight: "300px",
            overflowY: "auto",
          }}
        >
          {exitLogs.length === 0 ? (
            <div style={{ color: "#9ca3af", fontSize: "14px" }}>
              No exit attempts logged yet. Exit attempts will appear here.
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {exitLogs.map((log, index) => (
                <div
                  key={index}
                  style={{
                    backgroundColor: "#0f172a",
                    padding: "12px",
                    borderRadius: "6px",
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                    gap: "15px",
                    fontSize: "13px",
                  }}
                >
                  <div>
                    <div style={{ color: "#9ca3af", fontSize: "11px" }}>
                      TIMESTAMP
                    </div>
                    <div style={{ color: "#ffffff" }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "#9ca3af", fontSize: "11px" }}>
                      PREDICTION
                    </div>
                    <div
                      style={{
                        color:
                          log.prediction === "impulsive"
                            ? "#ef4444"
                            : "#10b981",
                        fontWeight: "600",
                      }}
                    >
                      {log.prediction.toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "#9ca3af", fontSize: "11px" }}>
                      FRICTION
                    </div>
                    <div style={{ color: "#ffffff" }}>
                      Level {log.frictionLevel}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "#9ca3af", fontSize: "11px" }}>
                      SESSION
                    </div>
                    <div style={{ color: "#ffffff" }}>
                      {log.sessionMinutes.toFixed(1)}m
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "#9ca3af", fontSize: "11px" }}>
                      LOAD
                    </div>
                    <div style={{ color: "#ffffff" }}>
                      {Math.round(log.latentMean * 200)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Overlay Component (unchanged functionality) */}
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
