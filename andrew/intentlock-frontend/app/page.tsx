"use client";
import { useState, useEffect } from "react";
import IntentLockOverlay from "../components/IntentLockOverlay";

// Backend: use 8001 when integrating (CLE uses 8000). Set in .env.local.
const BACKEND_URL =
  process.env.NEXT_PUBLIC_INTENTLOCK_API_BASE ?? "http://127.0.0.1:8000";
// CLE (cognitive load) — must be port 8000. Set NEXT_PUBLIC_CLE_API_BASE in .env.local if different.
const CLE_API_BASE =
  process.env.NEXT_PUBLIC_CLE_API_BASE ?? "http://127.0.0.1:8000";
const CLE_POLL_INTERVAL_MS = 5000; // poll every 5s so UI updates soon after CLE hop (15s)

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
  const [latentMean, setLatentMean] = useState<number>(0.5); // Cognitive load: from CLE or fallback
  const [cleConnected, setCleConnected] = useState<boolean>(false); // true when load comes from CLE
  const [cleStatus, setCleStatus] = useState<"disconnected" | "warming" | "connected">("disconnected");
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
  const [simulatingActivity, setSimulatingActivity] = useState<boolean>(false);
  const [cleHopIndex, setCleHopIndex] = useState<number | null>(null);
  const [cleLastUpdated, setCleLastUpdated] = useState<number | null>(null);
  const [cleError, setCleError] = useState<string | null>(null);
  const [cleLoadRaw, setCleLoadRaw] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

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

  // Tick every second so "Updated Xs ago" for CLE updates live
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Cognitive load from CLE (Praboth). Use same host as page for CLE (port 8000) so browser allows the request.
  useEffect(() => {
    let cancelled = false;
    const cleBase =
      typeof window !== "undefined"
        ? `${window.location.protocol}//${window.location.hostname}:8000`
        : CLE_API_BASE.replace(/\/$/, "");
    const cleUrl = `${cleBase}/estimate`;

    const fetchLoad = async () => {
      try {
        setCleError(null);
        const url = `${cleUrl}?t=${Date.now()}`;
        const res = await fetch(url, {
          method: "GET",
          mode: "cors",
          cache: "no-store",
          headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
        });
        if (cancelled) return;
        if (!res.ok) {
          setCleStatus("disconnected");
          setCleConnected(false);
          setCleError(`HTTP ${res.status}`);
          return;
        }
        let data: { load?: number | string; warming?: boolean; hop_index?: number; load_raw?: number | string };
        try {
          data = await res.json();
        } catch {
          setCleStatus("disconnected");
          setCleConnected(false);
          setCleError("Invalid JSON");
          return;
        }
        if (cancelled) return;
        const rawLoad =
          data?.load ??
          (typeof (data as { estimate?: { load?: unknown } })?.estimate?.load === "number"
            ? (data as { estimate: { load: number } }).estimate.load
            : undefined);
        const rawLoadRaw = data?.load_raw;
        const load =
          typeof rawLoad === "number"
            ? rawLoad
            : typeof rawLoad === "string"
              ? parseFloat(rawLoad)
              : null;
        const loadRaw =
          typeof rawLoadRaw === "number"
            ? rawLoadRaw
            : typeof rawLoadRaw === "string"
              ? parseFloat(rawLoadRaw)
              : null;
        const clampedLoad =
          load !== null && !Number.isNaN(load)
            ? Math.max(0, Math.min(1, Number(load)))
            : null;
        if (clampedLoad !== null) {
          setLatentMean(clampedLoad);
          setCleConnected(true);
          setCleStatus(data?.warming === true ? "warming" : "connected");
          const hop = data?.hop_index;
          setCleHopIndex(typeof hop === "number" ? hop : null);
          setCleLastUpdated(Date.now());
          setCleLoadRaw(loadRaw !== null && !Number.isNaN(loadRaw) ? loadRaw : null);
        }
      } catch (e) {
        if (!cancelled) {
          setCleConnected(false);
          setCleStatus("disconnected");
          setCleError(e instanceof Error ? e.message : "Request failed");
        }
      }
    };

    fetchLoad();
    const interval = setInterval(fetchLoad, CLE_POLL_INTERVAL_MS);
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") fetchLoad();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Format timer display (MM:SS)
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Cognitive load: 0–1 from CLE, display as 0–200% with one decimal so small changes are visible
  const cognitiveLoadPercent = Math.round(latentMean * 200);
  const cognitiveLoadDisplay = (latentMean * 200).toFixed(1);

  // Send a few synthetic events to the CLE so the next hop can produce a different estimate (demo).
  const handleSimulateActivity = async () => {
    if (simulatingActivity) return;
    setSimulatingActivity(true);
    const base =
      typeof window !== "undefined"
        ? `${window.location.protocol}//${window.location.hostname}:8000`
        : CLE_API_BASE.replace(/\/$/, "");
    try {
      for (let i = 0; i < 4; i++) {
        await fetch(`${base}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "keyboard",
            payload: { latency_ms: 80 + i * 20 },
          }),
        });
      }
    } finally {
      setSimulatingActivity(false);
    }
  };

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
      return `High cognitive load - Consider taking a break (${cognitiveLoadDisplay}%)`;
    } else if (cognitiveLoadPercent > 100) {
      return `Moderate cognitive load - Stay focused (${cognitiveLoadDisplay}%)`;
    } else {
      return `Low cognitive load - Good focus level (${cognitiveLoadDisplay}%)`;
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
        backgroundColor: "var(--background)",
        color: "var(--color-text-primary)",
        padding: "var(--space-lg)",
        fontFamily: "inherit",
      }}
    >
      {/* Header Section — matches dashboard */}
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-card)",
          padding: "var(--space-lg)",
          marginBottom: "var(--space-lg)",
          boxShadow: "0 25px 35px -20px rgba(15, 23, 42, 0.9)",
        }}
      >
        <h1
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: 600,
            color: "var(--color-text-muted)",
            marginBottom: "var(--space-sm)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Adaptive Scheduler
        </h1>
        <h2
          style={{
            fontSize: "var(--text-3xl)",
            fontWeight: 800,
            color: "var(--color-text-primary)",
            marginBottom: "var(--space-md)",
            letterSpacing: "-0.025em",
          }}
        >
          Real-time work/break scheduling
        </h2>

        {/* Status Indicators — matches dashboard status-badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-md)",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              background: isSessionActive
                ? "linear-gradient(120deg, #34d399, #0ea5e9)"
                : "linear-gradient(120deg, #fb7185, #f472b6)",
              color: "#0b1220",
              padding: "0.35rem 0.85rem",
              borderRadius: "var(--radius-pill)",
              fontSize: "var(--text-xs)",
              fontWeight: 700,
            }}
          >
            {isSessionActive ? "Session Active" : "Session Inactive"}
          </span>
          <span
            style={{
              color: "var(--color-text-muted)",
              fontSize: "var(--text-sm)",
            }}
          >
            Session: {sessionId.substring(0, 12)}...
          </span>
        </div>
      </div>

      {/* Main Cards Grid — matches dashboard card style */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "var(--space-lg)",
          marginBottom: "var(--space-lg)",
        }}
      >
        {/* Card 1: Current Timer */}
        <div
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-card)",
            padding: "var(--space-lg)",
            boxShadow: "0 25px 35px -20px rgba(15, 23, 42, 0.9)",
            transition: "all 0.2s ease",
          }}
        >
          <h3
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              marginBottom: "var(--space-md)",
              letterSpacing: "-0.025em",
            }}
          >
            ⏱️ Current Timer
          </h3>
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              fontWeight: 600,
              marginBottom: "var(--space-sm)",
            }}
          >
            WORK SESSION
          </div>
          <div
            style={{
              fontSize: "3rem",
              fontWeight: 800,
              color: "var(--color-info)",
              marginBottom: "var(--space-md)",
              letterSpacing: "-0.025em",
            }}
          >
            {formatTimer(timerSeconds)}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              gap: "var(--space-md)",
              marginBottom: "var(--space-lg)",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "var(--text-2xl)",
                  fontWeight: 800,
                  color: "var(--color-text-primary)",
                }}
              >
                {workDuration}
              </div>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginTop: "var(--space-sm)",
                }}
              >
                Work (min)
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "var(--text-2xl)",
                  fontWeight: 800,
                  color: "var(--color-text-primary)",
                }}
              >
                {breakDuration}
              </div>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginTop: "var(--space-sm)",
                }}
              >
                Break (min)
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
            <button
              onClick={() => setIsPaused(!isPaused)}
              disabled={!isSessionActive}
              style={{
                background: isPaused
                  ? "linear-gradient(120deg, #34d399, #10b981)"
                  : "var(--color-surface)",
                color: isPaused ? "#0b1220" : "var(--color-text-secondary)",
                border: isPaused ? "none" : "1px solid var(--color-border)",
                padding: "0.5rem 1.15rem",
                borderRadius: "var(--radius-pill)",
                cursor: isSessionActive ? "pointer" : "not-allowed",
                fontSize: "var(--text-sm)",
                fontWeight: 700,
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
                background: isSessionActive
                  ? "linear-gradient(120deg, #fb7185, #f43f5e)"
                  : "linear-gradient(120deg, #34d399, #10b981)",
                color: "#0b1220",
                border: "none",
                padding: "0.5rem 1.15rem",
                borderRadius: "var(--radius-pill)",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "var(--text-sm)",
                fontWeight: 700,
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
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-card)",
            padding: "var(--space-lg)",
            boxShadow: "0 25px 35px -20px rgba(15, 23, 42, 0.9)",
          }}
        >
          <h3
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              marginBottom: "var(--space-md)",
            }}
          >
            🧠 Cognitive Load (Praboth Real-time)
          </h3>
          <div
            style={{
              fontSize: "3rem",
              fontWeight: 800,
              color: "var(--color-info)",
              marginBottom: "var(--space-md)",
            }}
          >
            {cognitiveLoadDisplay}%
          </div>
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
              marginBottom: "var(--space-sm)",
            }}
          >
            Raw load: {latentMean.toFixed(2)} (0–1)
            {cleLoadRaw !== null && ` · load_raw: ${cleLoadRaw.toFixed(2)}`}
            {cleHopIndex !== null && ` · Hop: ${cleHopIndex}`}
            {cleLastUpdated !== null &&
              ` · Updated ${Math.round((now - cleLastUpdated) / 1000)}s ago`}
          </div>
          <div
            style={{
              background: "var(--color-background)",
              padding: "var(--space-md)",
              borderRadius: "1rem",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: "var(--space-sm)" }}>
              Current Status
            </div>
            <div>{getCognitiveLoadStatus()}</div>
            <div
              style={{
                marginTop: "var(--space-sm)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-muted)",
              }}
            >
              {cleStatus === "connected"
                ? "Cognitive load from CLE (Praboth)"
                : cleStatus === "warming"
                ? "CLE warming up (first estimate in ~15s)"
                : `Cognitive load: default (CLE not connected${cleError ? `: ${cleError}` : ""})`}
            </div>
            {cleStatus === "disconnected" && (
              <div
                style={{
                  marginTop: "var(--space-sm)",
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-muted)",
                }}
              >
                Fetching from {typeof window !== "undefined" ? `${window.location.hostname}:8000` : "port 8000"}. Open this app at http://localhost:3000 or http://127.0.0.1:3000 on the same machine as the CLE.
              </div>
            )}
            {cleStatus === "connected" && latentMean >= 0.48 && latentMean <= 0.52 && (
              <div
                style={{
                  marginTop: "var(--space-sm)",
                  fontSize: "var(--text-xs)",
                  color: "var(--color-warning)",
                }}
              >
                Estimate at 50%. If OS hooks are running but the value never changes, restart the CLE after renaming or removing <code>praboth-newfx/data/state.db</code> so the model starts fresh.
              </div>
            )}
            {cleStatus !== "disconnected" && (
              <button
                type="button"
                onClick={handleSimulateActivity}
                disabled={simulatingActivity}
                style={{
                  marginTop: "var(--space-md)",
                  padding: "8px 14px",
                  fontSize: "var(--text-xs)",
                  background: "var(--color-surface)",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-pill)",
                  cursor: simulatingActivity ? "not-allowed" : "pointer",
                }}
              >
                {simulatingActivity ? "Sending…" : "Simulate activity"}
              </button>
            )}
          </div>
        </div>

        {/* Card 3: Current Recommendation */}
        <div
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-card)",
            padding: "var(--space-lg)",
            boxShadow: "0 25px 35px -20px rgba(15, 23, 42, 0.9)",
          }}
        >
          <h3
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              marginBottom: "var(--space-md)",
            }}
          >
            💡 Current Recommendation
          </h3>
          <div style={{ marginBottom: "var(--space-md)" }}>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-muted)",
                marginBottom: "var(--space-sm)",
              }}
            >
              WORK (MIN)
            </div>
            <div style={{ fontSize: "var(--text-lg)", color: "var(--color-text-primary)" }}>
              {lastPrediction === "genuine" ? "Continue" : "-"}
            </div>
          </div>
          <div style={{ marginBottom: "var(--space-md)" }}>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-muted)",
                marginBottom: "var(--space-sm)",
              }}
            >
              BREAK (MIN)
            </div>
            <div style={{ fontSize: "var(--text-lg)", color: "var(--color-text-primary)" }}>
              {lastPrediction === "impulsive" ? "Recommended" : "-"}
            </div>
          </div>
          <div
            style={{
              background: "var(--color-background)",
              padding: "var(--space-md)",
              borderRadius: "1rem",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: "var(--space-sm)" }}>
              Algorithm Decision
            </div>
            <div>{getRecommendation()}</div>
          </div>
        </div>

        {/* Card 4: Session Metrics */}
        <div
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-card)",
            padding: "var(--space-lg)",
            boxShadow: "0 25px 35px -20px rgba(15, 23, 42, 0.9)",
          }}
        >
          <h3
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              marginBottom: "var(--space-md)",
            }}
          >
            📊 Session Metrics
          </h3>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}
          >
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                CONFIDENCE
              </div>
              <div style={{ fontSize: "var(--text-base)", color: "var(--color-text-primary)" }}>
                {lastPrediction ? "75.6%" : "-"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                ALGORITHM
              </div>
              <div style={{ fontSize: "var(--text-base)", color: "var(--color-text-primary)" }}>
                {lastPrediction ? "Logistic Regression" : "-"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>EPOCH</div>
              <div style={{ fontSize: "var(--text-base)", color: "var(--color-text-primary)" }}>0</div>
            </div>
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                PREDICTIONS
              </div>
              <div style={{ fontSize: "var(--text-base)", color: "var(--color-text-primary)" }}>
                {exitLogs.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Research Metrics Section */}
      <div style={{ marginTop: "var(--space-lg)" }}>
        <h2
          style={{
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            marginBottom: "var(--space-md)",
          }}
        >
          Research Metrics (Exit Logs)
        </h2>
        <div
          style={{
            background: "var(--color-surface)",
            borderRadius: "var(--radius-card)",
            padding: "var(--space-lg)",
            border: "1px solid var(--color-border)",
            maxHeight: "300px",
            overflowY: "auto",
            boxShadow: "0 25px 35px -20px rgba(15, 23, 42, 0.9)",
          }}
        >
          {exitLogs.length === 0 ? (
            <div style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
              No exit attempts logged yet. Exit attempts will appear here.
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}
            >
              {exitLogs.map((log, index) => (
                <div
                  key={index}
                  style={{
                    background: "var(--color-background)",
                    padding: "var(--space-md)",
                    borderRadius: "1rem",
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                    gap: "var(--space-md)",
                    fontSize: "var(--text-sm)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div>
                    <div style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
                      TIMESTAMP
                    </div>
                    <div style={{ color: "var(--color-text-primary)" }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
                      PREDICTION
                    </div>
                    <div
                      style={{
                        color:
                          log.prediction === "impulsive"
                            ? "var(--color-error)"
                            : "var(--color-success)",
                        fontWeight: 600,
                      }}
                    >
                      {log.prediction.toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
                      FRICTION
                    </div>
                    <div style={{ color: "var(--color-text-primary)" }}>
                      Level {log.frictionLevel}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
                      SESSION
                    </div>
                    <div style={{ color: "var(--color-text-primary)" }}>
                      {log.sessionMinutes.toFixed(1)}m
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
                      LOAD
                    </div>
                    <div style={{ color: "var(--color-text-primary)" }}>
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
