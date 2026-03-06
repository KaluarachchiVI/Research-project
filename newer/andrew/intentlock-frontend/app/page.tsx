"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import IntentLockOverlay from "../components/IntentLockOverlay";
import {
  startTimeBlockSession,
  endTimeBlockSession,
  getTimeBlockRecommendation,
  endTimeBlockInterval,
  type ExitPrediction,
} from "../lib/schedulerClient";

// Intent-Lock backend API base URL.
// In the integrated product this should normally be http://127.0.0.1:8001 and
// can be overridden via NEXT_PUBLIC_INTENTLOCK_API_BASE.
const BACKEND_URL =
  process.env.NEXT_PUBLIC_INTENTLOCK_API_BASE ?? "http://127.0.0.1:8001";

// CLE (cognitive load) base URL (cog-py-est). Defaults to local port 8000.
// Can be overridden via NEXT_PUBLIC_CLE_API_BASE.
const CLE_API_BASE =
  process.env.NEXT_PUBLIC_CLE_API_BASE ?? "http://127.0.0.1:8000";

// Optional scheduler base URL; if not set, scheduler integration is skipped.
const SCHEDULER_ENABLED =
  typeof process !== "undefined" &&
  typeof process.env.NEXT_PUBLIC_SCHEDULER_API_BASE === "string" &&
  process.env.NEXT_PUBLIC_SCHEDULER_API_BASE.length > 0;
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
  const [schedulerSessionId, setSchedulerSessionId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [lastPrediction, setLastPrediction] = useState<string | null>(null);
  const [exitLogs, setExitLogs] = useState<ExitLog[]>([]);
  const [workDuration, setWorkDuration] = useState<number>(30); // scheduler-recommended work minutes
  const [breakDuration, setBreakDuration] = useState<number>(5); // scheduler-recommended break minutes
  const [currentIntervalType, setCurrentIntervalType] = useState<"work" | "break">("work");
  const [simulatingActivity, setSimulatingActivity] = useState<boolean>(false);
  const [cleHopIndex, setCleHopIndex] = useState<number | null>(null);
  const [cleLastUpdated, setCleLastUpdated] = useState<number | null>(null);
  const [cleError, setCleError] = useState<string | null>(null);
  const [cleLoadRaw, setCleLoadRaw] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [lastIntentReason, setLastIntentReason] = useState<string | null>(null);
  const [lastIntentReasonCustom, setLastIntentReasonCustom] = useState<string | null>(null);
  const [cleLastEstimateRaw, setCleLastEstimateRaw] = useState<unknown | null>(null);
  const [lastSchedulerReward, setLastSchedulerReward] = useState<number | null>(null);
  const [lastSchedulerExplanation, setLastSchedulerExplanation] = useState<string | null>(null);
  const [schedulerEpoch, setSchedulerEpoch] = useState<number>(0);

  // Configuration for scheduler time-block session (matches dashboard semantics)
  const [configUserId, setConfigUserId] = useState<string>("demo_user");
  const [configTaskType, setConfigTaskType] = useState<string>("writing");
  const [configChronotype, setConfigChronotype] = useState<string>("neutral");
  const [configAlgorithm, setConfigAlgorithm] = useState<string>("LinUCB");
  const [configBlockMinutes, setConfigBlockMinutes] = useState<number>(60); // total time-block length
  const [schedulerStartError, setSchedulerStartError] = useState<string | null>(null);
  const [schedulerStarting, setSchedulerStarting] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Reset session function
  const resetSession = () => {
    setSessionStartTime(new Date());
    setSessionMinutes(0);
    setTimerSeconds(0);
    setSessionId(`session_${Date.now()}`);
    setLastPrediction(null);
    setSchedulerSessionId(null);
    setLastIntentReason(null);
    setLastIntentReasonCustom(null);
    setExitLogs([]);
    setIsPaused(false);
    setIsSessionActive(false);
    setFrictionLevel(0);
    setExitEventId(null);
    setWorkDuration(30);
    setBreakDuration(5);
    setCurrentIntervalType("work");
    setLastSchedulerReward(null);
    setLastSchedulerExplanation(null);
    setSchedulerEpoch(0);
    setSchedulerStartError(null);
  };

  // Start session function
  const startSession = () => {
    setSchedulerStartError(null);
    const start = new Date();
    setSessionStartTime(start);
    setTimerSeconds(0);
    setSessionMinutes(0);
    setSessionId(`session_${Date.now()}`);

    if (SCHEDULER_ENABLED) {
      setSchedulerStarting(true);
      const userId = configUserId.trim() || "demo_user";
      const startIso = start.toISOString();
      const endIso = new Date(
        start.getTime() + Math.max(5, configBlockMinutes) * 60 * 1000
      ).toISOString();
      startTimeBlockSession({
        user_id: userId,
        start_time: startIso,
        end_time: endIso,
        task_type: configTaskType,
        chronotype: configChronotype,
        algorithm: configAlgorithm,
        previous_metrics: null,
      })
        .then((res) => {
          setSchedulerSessionId(res.session_id);
          setIsSessionActive(true);
          setIsPaused(false);
          // If schedule is present, initialize work/break durations from first interval.
          const schedule = res.schedule as
            | {
                intervals?: {
                  interval_type: "work" | "break";
                  work_interval: number;
                  break_duration: number;
                  duration_minutes: number;
                }[];
              }
            | undefined;
          const firstInterval = schedule?.intervals?.[0];
          if (firstInterval) {
            setCurrentIntervalType(firstInterval.interval_type ?? "work");
            setWorkDuration(firstInterval.work_interval ?? 30);
            setBreakDuration(firstInterval.break_duration ?? 5);
          } else {
            setCurrentIntervalType("work");
            setWorkDuration(30);
            setBreakDuration(5);
          }
        })
        .catch((err) => {
          console.error("Failed to start scheduler time-block session:", err);
          setSchedulerSessionId(null);
          const message =
            err?.message === "Failed to fetch"
              ? "Cannot reach the scheduler. Ensure the scheduler backend is running (e.g. on port 5000) and that CORS allows this origin. Check NEXT_PUBLIC_SCHEDULER_API_BASE."
              : err instanceof Error
                ? err.message
                : "Failed to start scheduler session.";
          setSchedulerStartError(message);
        })
        .finally(() => {
          setSchedulerStarting(false);
        });
    } else {
      setIsSessionActive(true);
      setIsPaused(false);
    }
  };

  // Handle end-session button (IntentLock + scheduler)
  const handleEndSessionClick = async () => {
    if (!isSessionActive || !schedulerSessionId) return;
    await handleExitAttempt();
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
    // Always trust NEXT_PUBLIC_CLE_API_BASE (CLE_API_BASE) first; it already
    // defaults to http://127.0.0.1:8000, so we simply normalize it here.
    const cleBase = CLE_API_BASE.replace(/\/$/, "");
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
          setCleLastEstimateRaw(data);
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
          setCleLastEstimateRaw(null);
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

  // Cognitive load: 0–1 from CLE, display as 0–100% to match old dashboard semantics
  const cognitiveLoadPercent = Math.round(latentMean * 100);
  const cognitiveLoadDisplay = (latentMean * 100).toFixed(1);

  // Send a few synthetic events to the CLE so the next hop can produce a different estimate (demo).
  const handleSimulateActivity = async () => {
    if (simulatingActivity) return;
    setSimulatingActivity(true);
    const base = CLE_API_BASE.replace(/\/$/, "");
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
        // Notify scheduler (if configured) before resetting the session.
        if (schedulerSessionId && data.prediction) {
          const prediction = data.prediction as ExitPrediction;
          void endTimeBlockSession({
            session_id: schedulerSessionId,
            auto_sync: true,
            auto_compute_metrics: true,
            intent_prediction: prediction,
            friction_level: data.friction_level ?? null,
            intent_exit_event_id: data.exit_event_id ?? null,
            intent_reason: null,
            intent_reason_custom: null,
          }).catch((err) => {
            console.error("Failed to end scheduler session:", err);
          });
        }
        setToast({ message: data.message || "Exit allowed. You've had a productive session.", type: "success" });
        // Reset session and timer
        resetSession();
        return;
      }

      // Impulsive exit - show overlay with friction
      setOverlayOpen(true);
    } catch (error) {
      console.error("Error Calling Backend:", error);
      setToast({ message: "Error connecting to backend. Please ensure the server is running.", type: "error" });
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
    // User exits via overlay friction. Notify scheduler if configured.
    if (schedulerSessionId && lastPrediction) {
      const prediction = lastPrediction as ExitPrediction;
      void endTimeBlockSession({
        session_id: schedulerSessionId,
        auto_sync: true,
        auto_compute_metrics: true,
        intent_prediction: prediction,
        friction_level: frictionLevel,
        intent_exit_event_id: exitEventId ?? null,
        intent_reason: lastIntentReason,
        intent_reason_custom: lastIntentReasonCustom,
      }).catch((err) => {
        console.error("Failed to end scheduler session:", err);
      });
    }
    setToast({ message: "Study session ended.", type: "info" });
    // Reset session and timer
    resetSession();
  };

  const handleReasonSubmitted = (reason: string, customText?: string) => {
    console.log("Reason submitted:", reason, customText);
    setLastIntentReason(reason);
    setLastIntentReasonCustom(customText ?? null);
    // Reason is already logged by the overlay backend; here we keep
    // a copy so we can forward metadata to the scheduler when exiting.
  };

  const getCognitiveLoadStatus = () => {
    if (cognitiveLoadPercent > 70) {
      return `High cognitive load - Consider taking a break (${cognitiveLoadDisplay}%)`;
    } else if (cognitiveLoadPercent > 40) {
      return `Moderate cognitive load - Stay focused (${cognitiveLoadDisplay}%)`;
    } else {
      return `Low cognitive load - Good focus level (${cognitiveLoadDisplay}%)`;
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const getIntentLockRecommendationText = () => {
    if (!lastPrediction) {
      return "No IntentLock decision yet. Try ending the session to trigger a prediction.";
    }
    if (lastPrediction === "genuine") {
      return "Exit allowed - Productive session detected (IntentLock).";
    }
    return `Impulsive exit detected - Friction level ${frictionLevel} applied (IntentLock).`;
  };

  const handleSchedulerGetRecommendation = async () => {
    if (!schedulerSessionId || !SCHEDULER_ENABLED) return;
    try {
      const rec = await getTimeBlockRecommendation(schedulerSessionId);
      if (typeof rec.work_interval === "number") {
        setWorkDuration(rec.work_interval);
      }
      if (typeof rec.break_duration === "number") {
        setBreakDuration(rec.break_duration);
      }
      if (rec.explanation) {
        setLastSchedulerExplanation(rec.explanation);
      }
    } catch (e) {
      console.error("Failed to get scheduler recommendation:", e);
    }
  };

  const handleSchedulerEndInterval = async () => {
    if (!schedulerSessionId || !SCHEDULER_ENABLED) return;
    try {
      const res = await endTimeBlockInterval({
        session_id: schedulerSessionId,
        interval_type: currentIntervalType,
        metrics: {
          cognitive_load_post_break: latentMean,
        },
      });
      const reward = res.reward_computed?.immediate_reward;
      if (typeof reward === "number") {
        setLastSchedulerReward(reward);
      }
      const next =
        res.next_action ??
        (res as { next_recommendation?: { work_interval: number; break_duration: number } })
          .next_recommendation;
      if (next) {
        // After work, transition to break; after break, transition back to work.
        if (currentIntervalType === "work") {
          if (typeof next.break_duration === "number") {
            setBreakDuration(next.break_duration);
          }
          setCurrentIntervalType("break");
        } else {
          if (typeof next.work_interval === "number") {
            setWorkDuration(next.work_interval);
          }
          setCurrentIntervalType("work");
        }
        // Increment bandit epoch counter (matches old dashboard semantics).
        setSchedulerEpoch((prev) => prev + 1);
        // Reset interval timer for next interval.
        setSessionStartTime(new Date());
        setTimerSeconds(0);
      }
    } catch (e) {
      console.error("Failed to end scheduler interval:", e);
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
      {/* In-app toast banner (replaces alert()) */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "var(--space-md)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10000,
            maxWidth: "90%",
            width: "420px",
            padding: "var(--space-md) var(--space-lg)",
            borderRadius: "var(--radius-card)",
            border: "1px solid var(--color-border)",
            boxShadow: "0 25px 35px -20px rgba(15, 23, 42, 0.9)",
            background: toast.type === "error" ? "var(--color-error-bg)" : toast.type === "success" ? "var(--color-success-bg)" : "var(--color-surface)",
            color: toast.type === "error" ? "var(--color-error)" : toast.type === "success" ? "var(--color-success)" : "var(--color-text-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-md)",
          }}
        >
          <span style={{ fontSize: "var(--text-sm)", flex: 1 }}>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{
              padding: "var(--space-sm)",
              background: "transparent",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-card)",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
              fontSize: "var(--text-sm)",
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      {/* Configuration block — mirrors dashboard session form semantics */}
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
        <h2
          style={{
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            marginBottom: "var(--space-sm)",
            letterSpacing: "-0.025em",
          }}
        >
          Session configuration
        </h2>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-muted)",
            marginBottom: "var(--space-md)",
          }}
        >
          These settings are sent to the adaptive scheduler when you start a
          time‑block session.
        </p>
        {schedulerStartError && (
          <div
            role="alert"
            style={{
              marginBottom: "var(--space-md)",
              padding: "var(--space-md)",
              borderRadius: "var(--radius-card)",
              border: "1px solid var(--color-error)",
              background: "var(--color-error-bg)",
              fontSize: "var(--text-sm)",
              color: "var(--color-error)",
            }}
          >
            <strong>Scheduler error:</strong> {schedulerStartError}
          </div>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "var(--space-md)",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-muted)",
                marginBottom: "0.25rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
              }}
            >
              User ID
            </label>
            <input
              value={configUserId}
              onChange={(e) => setConfigUserId(e.target.value)}
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--color-border)",
                background: "var(--color-background)",
                color: "var(--color-text-primary)",
                fontSize: "var(--text-sm)",
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-muted)",
                marginBottom: "0.25rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
              }}
            >
              Task type
            </label>
            <select
              value={configTaskType}
              onChange={(e) => setConfigTaskType(e.target.value)}
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--color-border)",
                background: "var(--color-background)",
                color: "var(--color-text-primary)",
                fontSize: "var(--text-sm)",
              }}
            >
              <option value="writing">Writing</option>
              <option value="coding">Coding</option>
              <option value="reading">Reading</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-muted)",
                marginBottom: "0.25rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
              }}
            >
              Chronotype
            </label>
            <select
              value={configChronotype}
              onChange={(e) => setConfigChronotype(e.target.value)}
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--color-border)",
                background: "var(--color-background)",
                color: "var(--color-text-primary)",
                fontSize: "var(--text-sm)",
              }}
            >
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-muted)",
                marginBottom: "0.25rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
              }}
            >
              Bandit algorithm
            </label>
            <select
              value={configAlgorithm}
              onChange={(e) => setConfigAlgorithm(e.target.value)}
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--color-border)",
                background: "var(--color-background)",
                color: "var(--color-text-primary)",
                fontSize: "var(--text-sm)",
              }}
            >
              <option value="LinUCB">LinUCB</option>
              <option value="ThompsonSampling">Thompson Sampling</option>
            </select>
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-muted)",
                marginBottom: "0.25rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
              }}
            >
              Block length (minutes)
            </label>
            <input
              type="number"
              min={5}
              max={480}
              value={configBlockMinutes}
              onChange={(e) =>
                setConfigBlockMinutes(
                  Number.isNaN(Number(e.target.value))
                    ? 60
                    : Number(e.target.value)
                )
              }
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--color-border)",
                background: "var(--color-background)",
                color: "var(--color-text-primary)",
                fontSize: "var(--text-sm)",
              }}
            />
          </div>
        </div>
        <div
          style={{
            marginTop: "var(--space-md)",
            display: "flex",
            justifyContent: "flex-start",
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (!isSessionActive && !schedulerStarting) {
                startSession();
              }
            }}
            disabled={schedulerStarting}
            style={{
              background:
                "linear-gradient(120deg, #06b6d4, #0ea5e9)",
              color: "#0b1220",
              border: "none",
              padding: "0.55rem 1.1rem",
              borderRadius: "999px",
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              cursor: schedulerStarting ? "not-allowed" : "pointer",
              opacity: schedulerStarting ? 0.7 : 1,
            }}
          >
            {schedulerStarting ? "Starting…" : "Start Time Block Session"}
          </button>
        </div>
      </div>
      {/* Scheduler + IntentLock session UI: shown only after a scheduler session has started */}
      {schedulerSessionId && (
        <>
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

        {/* Status + navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-md)",
            flexWrap: "wrap",
          }}
        >
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
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/summary"
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: "999px",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text-primary)",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Summary
            </Link>
            <Link
              href="/planner"
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: "999px",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text-primary)",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Planner
            </Link>
          </div>
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
            Current Timer
          </h3>
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-muted)",
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
            }}
          >
            {formatTimer(timerSeconds)}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--space-md)",
              marginBottom: "var(--space-md)",
            }}
          >
            <div
              style={{
                background: "var(--color-background)",
                padding: "var(--space-md)",
                borderRadius: "1rem",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-muted)",
                  marginBottom: "var(--space-sm)",
                }}
              >
                Work (min)
              </div>
              <div
                style={{
                  fontSize: "var(--text-lg)",
                  color: "var(--color-text-primary)",
                }}
              >
                {workDuration}
              </div>
            </div>
            <div
              style={{
                background: "var(--color-background)",
                padding: "var(--space-md)",
                borderRadius: "1rem",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-muted)",
                  marginBottom: "var(--space-sm)",
                }}
              >
                Break (min)
              </div>
              <div
                style={{
                  fontSize: "var(--text-lg)",
                  color: "var(--color-text-primary)",
                }}
              >
                {breakDuration}
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              disabled={loading}
              style={{
                padding: "8px 14px",
                fontSize: "var(--text-xs)",
                background: "var(--color-surface)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-pill)",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {isPaused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              onClick={handleEndSessionClick}
              style={{
                padding: "8px 14px",
                fontSize: "var(--text-xs)",
                background: "var(--color-surface)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-pill)",
                cursor: "pointer",
              }}
            >
              End Session
            </button>
            {SCHEDULER_ENABLED && schedulerSessionId && (
              <>
                <button
                  type="button"
                  onClick={handleSchedulerEndInterval}
                  style={{
                    padding: "8px 14px",
                    fontSize: "var(--text-xs)",
                    background: "var(--color-surface)",
                    color: "var(--color-text-primary)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-pill)",
                    cursor: "pointer",
                  }}
                >
                  {currentIntervalType === "work"
                    ? "End Work Interval"
                    : "End Break Interval"}
                </button>
                <button
                  type="button"
                  onClick={handleSchedulerGetRecommendation}
                  style={{
                    padding: "8px 14px",
                    fontSize: "var(--text-xs)",
                    background: "var(--color-surface)",
                    color: "var(--color-text-primary)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-pill)",
                    cursor: "pointer",
                  }}
                >
                  Get Recommendation
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                if (!isSessionActive) {
                  startSession();
                } else {
                  handleEndSessionClick();
                }
              }}
              disabled={loading}
              style={{
                padding: "8px 14px",
                fontSize: "var(--text-xs)",
                background: "var(--color-success-bg)",
                color: "var(--color-success)",
                border: "1px solid var(--color-success)",
                borderRadius: "var(--radius-pill)",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {!isSessionActive ? "Start Session" : "End Work"}
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
              {workDuration}
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
              {breakDuration}
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
              Scheduler Decision
            </div>
            <div>
              {lastSchedulerExplanation ??
                "Scheduler recommendations will appear here after you start a session."}
            </div>
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
                REWARD (LAST INTERVAL)
              </div>
              <div style={{ fontSize: "var(--text-base)", color: "var(--color-text-primary)" }}>
                {lastSchedulerReward !== null ? lastSchedulerReward.toFixed(3) : "-"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                ALGORITHM
              </div>
              <div style={{ fontSize: "var(--text-base)", color: "var(--color-text-primary)" }}>
                {SCHEDULER_ENABLED ? "Contextual bandit (scheduler)" : "-"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>EPOCH</div>
              <div style={{ fontSize: "var(--text-base)", color: "var(--color-text-primary)" }}>
                {schedulerEpoch}
              </div>
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

      {/* CLE diagnostics — compact view of last /estimate and status */}
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px dashed var(--color-border)",
          borderRadius: "var(--radius-card)",
          padding: "var(--space-md)",
          marginBottom: "var(--space-lg)",
          fontSize: "var(--text-xs)",
          color: "var(--color-text-secondary)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "var(--space-sm)",
            marginBottom: "var(--space-sm)",
          }}
        >
          <span
            style={{
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--color-text-muted)",
            }}
          >
            CLE diagnostics
          </span>
          <span
            style={{
              padding: "0.15rem 0.6rem",
              borderRadius: "999px",
              border: "1px solid var(--color-border)",
              background:
                cleStatus === "connected"
                  ? "var(--color-success-bg)"
                  : cleStatus === "warming"
                  ? "var(--color-warning-bg)"
                  : "var(--color-error-bg)",
              color:
                cleStatus === "connected"
                  ? "var(--color-success)"
                  : cleStatus === "warming"
                  ? "var(--color-warning)"
                  : "var(--color-error)",
              fontWeight: 600,
            }}
          >
            {cleStatus === "connected"
              ? "online"
              : cleStatus === "warming"
              ? "warming"
              : "offline"}
          </span>
        </div>
        <div style={{ marginBottom: "0.35rem" }}>
          <span style={{ color: "var(--color-text-muted)" }}>Base URL: </span>
          <code>{CLE_API_BASE}</code>
        </div>
        <div style={{ marginBottom: "0.35rem" }}>
          <span style={{ color: "var(--color-text-muted)" }}>Last update: </span>
          {cleLastUpdated
            ? `${Math.round((now - cleLastUpdated) / 1000)}s ago`
            : "no data yet"}
        </div>
        {cleError && (
          <div style={{ marginBottom: "0.35rem", color: "var(--color-error)" }}>
            Error: {cleError}
          </div>
        )}
        <div>
          <span style={{ color: "var(--color-text-muted)" }}>
            Last /estimate payload:
          </span>
          <pre
            style={{
              marginTop: "0.25rem",
              maxHeight: 120,
              overflow: "auto",
              padding: "0.5rem 0.75rem",
              background: "var(--color-background)",
              borderRadius: "0.5rem",
              border: "1px solid var(--color-border)",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            }}
          >
            {cleLastEstimateRaw
              ? JSON.stringify(cleLastEstimateRaw, null, 2)
              : "— (no payload received yet)"}
          </pre>
        </div>
      </div>
        </>
      )}

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
                      {Math.round(log.latentMean * 100)}%
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
