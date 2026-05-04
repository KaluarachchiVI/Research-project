"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  EstimateResponse,
  fetchEstimate,
  fetchPendingPrompt,
  fetchTelemetry,
  subscribeStateStream,
  TelemetryResponse,
} from "../../../lib/api";

export type HistoryPoint = { t: number; load: number; residual: number };
export type HydratedPrompt = { prompt_id: number; reason: string } | null;

type EstimatorContextType = {
  estimate: EstimateResponse | null;
  telemetry: TelemetryResponse | null;
  history: HistoryPoint[];
  status: string;
  error: string | null;
  hydratedPrompt: HydratedPrompt;
  setHydratedPrompt: (p: HydratedPrompt) => void;
};

const EstimatorContext = createContext<EstimatorContextType | null>(null);

export function useEstimatorContext() {
  const ctx = useContext(EstimatorContext);
  if (!ctx) {
    throw new Error("useEstimatorContext must be used within an EstimatorProvider");
  }
  return ctx;
}

export function EstimatorProvider({ children }: { children: ReactNode }) {
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [status, setStatus] = useState<string>("connecting...");
  const [error, setError] = useState<string | null>(null);
  const [hydratedPrompt, setHydratedPrompt] = useState<HydratedPrompt>(null);

  const pendingFetch = useRef(false);
  const hydratedPromptRef = useRef<HydratedPrompt>(null);

  // Sync ref for effect closure
  useEffect(() => {
    hydratedPromptRef.current = hydratedPrompt;
  }, [hydratedPrompt]);

  useEffect(() => {
    console.log("EstimatorProvider: Mounting and connecting stream...");

    // Fallback bootstrap so UI has data even before first SSE frame.
    Promise.allSettled([fetchTelemetry(), fetchEstimate()]).then((results) => {
      const telemetryResult = results[0];
      const estimateResult = results[1];

      if (telemetryResult.status === "fulfilled") {
        setTelemetry(telemetryResult.value);
      }

      if (estimateResult.status === "fulfilled") {
        setEstimate(estimateResult.value);
        setStatus(
          `online (${estimateResult.value.scheduler_state ?? "unknown"}) | hop ${
            estimateResult.value.hop_index
          } | baseline ${estimateResult.value.baseline_active ? "on" : "off"}`
        );
      }
    });
    
    const disconnect = subscribeStateStream(
      (payload) => {
        const nextTelemetry = payload.telemetry;
        const nextEstimate = payload.estimate;
        setTelemetry(nextTelemetry);

        const scheduler =
          nextTelemetry.scheduler_state ?? nextEstimate?.scheduler_state ?? "unknown";
        const promptFromEstimate = nextEstimate?.pending_prompt ?? null;

        if (promptFromEstimate) {
          setHydratedPrompt(null);
        } else if (
          scheduler === "awaiting_response" &&
          !pendingFetch.current &&
          !hydratedPromptRef.current
        ) {
          pendingFetch.current = true;
          fetchPendingPrompt()
            .then((res) => {
              if (res.prompt) {
                setHydratedPrompt({
                  prompt_id: res.prompt.prompt_id,
                  reason: res.prompt.reason,
                });
              }
            })
            .catch(() => undefined)
            .finally(() => {
              pendingFetch.current = false;
            });
        } else if (scheduler !== "awaiting_response") {
          setHydratedPrompt(null);
        }

        const mergedEstimate = nextEstimate
          ? {
              ...nextEstimate,
              pending_prompt:
                nextEstimate.pending_prompt ?? hydratedPromptRef.current ?? undefined,
            }
          : null;

        if (mergedEstimate) {
          setEstimate(mergedEstimate);
          setHistory((prev) => {
            const receiveTime = Date.now();
            // Anchor history to receive time, enforce monotonicity
            const lastT = prev[prev.length - 1]?.t ?? receiveTime;
            const t = Math.max(receiveTime, lastT + 1);

            const updated = [
              ...prev,
              {
                t,
                load: mergedEstimate.load,
                residual: mergedEstimate.residual,
              },
            ];
            return updated.slice(-300); // Keep more history (5 mins @ 1Hz)
          });
          setStatus(
            `online (${scheduler}) | hop ${mergedEstimate.hop_index} | baseline ${
              mergedEstimate.baseline_active ? "on" : "off"
            }`
          );
        } else {
          setStatus(`online (${scheduler}) | waiting for estimate`);
        }
        setError(null);
      },
      () => {
        setStatus("offline");
        setError("Stream disconnected");
      },
      () => {
        setStatus((prev) => (prev === "connecting..." ? "online (stream connected)" : prev));
      }
    );

    return () => {
      console.log("EstimatorProvider: Unmounting and disconnecting stream...");
      disconnect();
    };
  }, []);

  return (
    <EstimatorContext.Provider
      value={{
        estimate,
        telemetry,
        history,
        status,
        error,
        hydratedPrompt,
        setHydratedPrompt,
      }}
    >
      {children}
    </EstimatorContext.Provider>
  );
}
