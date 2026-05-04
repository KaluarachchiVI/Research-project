import { useEffect, useRef } from "react";
import { useEstimatorContext } from "../components/providers/EstimatorProvider";

export { type HistoryPoint, type HydratedPrompt } from "../components/providers/EstimatorProvider";

type StreamHandlers = {
  onConnect?: () => void;
  onDisconnect?: () => void;
};

/**
 * Hook for accessing the EstimatorProvider context with optional connection event handlers
 * 
 * @param handlers - Optional handlers for connection/disconnection events
 * @returns The estimator context containing estimate, telemetry, history, status, error, etc.
 * 
 * @example
 * ```tsx
 * const { estimate, telemetry, history, status, isConnected } = useEstimatorStream({
 *   onConnect: () => console.log('Connected to estimator'),
 *   onDisconnect: () => console.log('Disconnected from estimator'),
 * });
 * ```
 */
export function useEstimatorStream(handlers?: StreamHandlers) {
  const context = useEstimatorContext();
  const handlersRef = useRef<StreamHandlers | undefined>(handlers);
  
  // Track previous status to detect edges
  const prevStatus = useRef(context.status);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    // Edge detection for connection events based on provider status
    // Note: Provider status includes "online", "offline", "connecting..."
    const current = context.status;
    const previous = prevStatus.current;
    
    if (current.startsWith("online") && !previous.startsWith("online")) {
      handlersRef.current?.onConnect?.();
    } else if (current === "offline" && previous !== "offline") {
      handlersRef.current?.onDisconnect?.();
    }
    
    prevStatus.current = current;
  }, [context.status]);

  return context;
}
