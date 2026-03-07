"use client";
import { useState, useEffect } from "react";
import { BarChart3, Calendar } from "lucide-react";
import { useAuth } from "../lib/authContext";
import { useNavigationTransition } from "../lib/navigationTransitionContext";
import { AnimatedLink } from "../components/AnimatedLink";
import { SessionConfig } from "../components/SessionConfig";
import { DashboardHeader } from "../components/DashboardHeader";
import { TimerCard } from "../components/TimerCard";
import { CognitiveLoadCard } from "../components/CognitiveLoadCard";
import { RecommendationCard } from "../components/RecommendationCard";
import { SessionMetricsCard } from "../components/SessionMetricsCard";
import { RecentSessionsCard } from "../components/RecentSessionsCard";
import { ExitLogsTable } from "../components/ExitLogsTable";
import { IntentLockModal } from "../components/IntentLockModal";
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
  const { user, token } = useAuth();
  const { exitingTo } = useNavigationTransition();
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

  // Configuration for scheduler time-block session (user_id from auth)
  const [configTaskType, setConfigTaskType] = useState<string>("writing");
  const [configChronotype, setConfigChronotype] = useState<string>("neutral");
  const [configAlgorithm, setConfigAlgorithm] = useState<string>("LinUCB");
  const [configBlockMinutes, setConfigBlockMinutes] = useState<number>(60); // total time-block length
  const [schedulerStartError, setSchedulerStartError] = useState<string | null>(null);
  const [schedulerStarting, setSchedulerStarting] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [configModalState, setConfigModalState] = useState<"closed" | "open" | "closing">("closed");
  const [hasEnteredSession, setHasEnteredSession] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasEnteredSession(sessionStorage.getItem("hasEnteredSession") === "1");
  }, []);

  useEffect(() => {
    if (configModalState !== "closing") return;
    const t = setTimeout(() => setConfigModalState("closed"), 200);
    return () => clearTimeout(t);
  }, [configModalState]);

  // Reset session function (keeps user on dashboard and keeps exit logs visible)
  const resetSession = () => {
    setSessionStartTime(new Date());
    setSessionMinutes(0);
    setTimerSeconds(0);
    setSessionId(`session_${Date.now()}`);
    setLastPrediction(null);
    setSchedulerSessionId(null);
    setLastIntentReason(null);
    setLastIntentReasonCustom(null);
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
    setConfigModalState("closed");
    if (typeof window !== "undefined") {
      sessionStorage.setItem("hasEnteredSession", "1");
    }
    setHasEnteredSession(true);
    const start = new Date();
    setSessionStartTime(start);
    setTimerSeconds(0);
    setSessionMinutes(0);
    setSessionId(`session_${Date.now()}`);

    if (SCHEDULER_ENABLED) {
      setSchedulerStarting(true);
      const userId = user?.user_id ?? "";
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
          setSessionId(res.session_id);
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

  // Handle end-session button (IntentLock; scheduler optional)
  const handleEndSessionClick = async () => {
    if (!isSessionActive) return;
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

  // Cognitive load: 0â€“1 from CLE, display as 0â€“100% to match old dashboard semantics
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

  const showDashboard = hasEnteredSession;

  const handleSchedulerEndInterval = async () => {
    if (!schedulerSessionId || !SCHEDULER_ENABLED) return;
    try {
      const res = await endTimeBlockInterval({
        session_id: schedulerSessionId,
        interval_type: currentIntervalType,
        metrics:
          currentIntervalType === "work"
            ? {
                cognitive_load_pre_break: latentMean,
                cognitive_load_post_break: latentMean,
              }
            : { cognitive_load_post_break: latentMean },
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
    <main className="min-h-screen bg-background p-8 text-foreground">
      {toast && (
        <div
          className="toast-enter fixed left-1/2 top-4 z-[10000] flex max-w-[90%] w-[420px] -translate-x-1/2 items-center justify-between gap-4 rounded-[1.25rem] border border-border p-4 shadow-lg"
          style={{
            background:
              toast.type === "error"
                ? "var(--color-error-bg)"
                : toast.type === "success"
                  ? "var(--color-success-bg)"
                  : "var(--color-surface)",
            color:
              toast.type === "error"
                ? "var(--color-error)"
                : toast.type === "success"
                  ? "var(--color-success)"
                  : "var(--color-text-primary)",
          }}
        >
          <span className="flex-1 text-sm">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded-[1.25rem] border border-border bg-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/50"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="page-enter-left">
      {!showDashboard && (
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-2xl font-medium text-foreground">
              IntentLock | Adaptive Scheduler
            </h1>
            <p className="text-muted-foreground">
              Real-time work/break scheduling with IntentLock
            </p>
          </div>
          <SessionConfig
            userId={user?.user_id ?? ""}
            taskType={configTaskType}
            chronotype={configChronotype}
            algorithm={configAlgorithm}
            blockMinutes={configBlockMinutes}
            onTaskTypeChange={setConfigTaskType}
            onChronotypeChange={setConfigChronotype}
            onAlgorithmChange={setConfigAlgorithm}
            onBlockMinutesChange={setConfigBlockMinutes}
            onStartSession={startSession}
            schedulerStartError={schedulerStartError}
            schedulerStarting={schedulerStarting}
          />
        </div>
      )}
      {showDashboard && (
        <div className={`mx-auto w-full max-w-[1800px] space-y-6 ${exitingTo ? "overflow-hidden" : ""}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1">
              <DashboardHeader
                sessionId={sessionId}
                isActive={isSessionActive}
              />
            </div>
            <div className="flex gap-3">
              <AnimatedLink
                href="/summary"
                className="btn-motion flex items-center gap-2 rounded-xl border border-border bg-secondary px-4 py-3 text-foreground transition-colors hover:bg-secondary/80"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Summary</span>
              </AnimatedLink>
              <AnimatedLink
                href="/planner"
                className="btn-motion flex items-center gap-2 rounded-xl border border-border bg-secondary px-4 py-3 text-foreground transition-colors hover:bg-secondary/80"
              >
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Planner</span>
              </AnimatedLink>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
            <div className="space-y-8 xl:col-span-2">
              <div
                className={`grid grid-cols-1 gap-8 lg:grid-cols-2 ${exitingTo ? "page-exit-left" : ""}`}
              >
                <TimerCard
                  timerSeconds={timerSeconds}
                  workMinutes={workDuration}
                  breakMinutes={breakDuration}
                  isWorkMode={currentIntervalType === "work"}
                  isPaused={isPaused}
                  isSessionActive={isSessionActive}
                  onNewSession={() => setConfigModalState("open")}
                  onWorkMinutesChange={setWorkDuration}
                  onBreakMinutesChange={setBreakDuration}
                  onTogglePause={() => setIsPaused((p) => !p)}
                  onEndSession={handleEndSessionClick}
                  onEndInterval={handleSchedulerEndInterval}
                  onGetRecommendation={handleSchedulerGetRecommendation}
                  onToggleWorkMode={() =>
                    setCurrentIntervalType((t) =>
                      t === "work" ? "break" : "work"
                    )
                  }
                />
                <CognitiveLoadCard
                  loadPercent={cognitiveLoadPercent}
                  status={
                    cleStatus === "connected"
                      ? "connected"
                      : cleStatus === "warming"
                        ? "warming"
                        : "disconnected"
                  }
                  onSimulateActivity={handleSimulateActivity}
                />
              </div>
              <div className={exitingTo ? "page-exit-down" : ""}>
                <ExitLogsTable logs={exitLogs} />
              </div>
            </div>
            <div
              className={`bg-card border border-border rounded-[1.25rem] p-8 shadow-lg space-y-8 ${exitingTo ? "page-exit-right" : ""}`}
            >
              <RecommendationCard
                workMinutes={workDuration}
                breakMinutes={breakDuration}
                decision={lastSchedulerExplanation}
                embedded
              />
              <SessionMetricsCard
                reward={lastSchedulerReward}
                algorithm={configAlgorithm}
                epoch={schedulerEpoch}
                predictionCount={exitLogs.length}
                embedded
              />
              <RecentSessionsCard userId={user?.user_id ?? ""} token={token} embedded />
            </div>
          </div>
        </div>
      )}
      </div>
      {configModalState !== "closed" && (
        <div
          className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 ${configModalState === "open" ? "modal-enter" : "modal-exit"}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="config-modal-title"
        >
          <div className="modal-backdrop absolute inset-0 bg-black/50" aria-hidden />
          <div className="modal-panel relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[1.25rem] bg-background p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="config-modal-title" className="text-lg font-medium text-foreground">
                New session
              </h2>
              <button
                type="button"
                onClick={() => setConfigModalState("closing")}
                className="btn-motion rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary"
              >
                Cancel
              </button>
            </div>
            <SessionConfig
              userId={user?.user_id ?? ""}
              taskType={configTaskType}
              chronotype={configChronotype}
              algorithm={configAlgorithm}
              blockMinutes={configBlockMinutes}
              onTaskTypeChange={setConfigTaskType}
              onChronotypeChange={setConfigChronotype}
              onAlgorithmChange={setConfigAlgorithm}
              onBlockMinutesChange={setConfigBlockMinutes}
              onStartSession={() => {
                setConfigModalState("closing");
                setTimeout(startSession, 200);
              }}
              schedulerStartError={schedulerStartError}
              schedulerStarting={schedulerStarting}
            />
          </div>
        </div>
      )}
      <IntentLockModal
        isOpen={overlayOpen}
        frictionLevel={frictionLevel as 0 | 1 | 2}
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
