"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ToastMessage, ToastKind, Toasts } from "./Toast";

type ToastContextValue = {
  addToast: (message: string, type?: ToastKind, duration?: number) => void;
  dismissToast: (id: string) => void;
  toast: (message: string, type?: ToastKind, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const DEFAULT_DURATION = 5000;
const MAX_TOASTS = 5;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismissToast = useCallback((id: string) => {
    // Clear any existing timer for this toast
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }

    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastKind = "info", duration?: number) => {
      const id = `${Date.now()}-${Math.random()}`;
      const toastDuration = duration ?? DEFAULT_DURATION;

      setToasts((prev) => {
        const newToasts = [...prev, { id, type, message, duration: toastDuration }];
        // Keep only the most recent MAX_TOASTS toasts
        return newToasts.slice(-MAX_TOASTS);
      });

      // Set up auto-dismiss timer
      const timer = setTimeout(() => {
        dismissToast(id);
      }, toastDuration);

      timersRef.current.set(id, timer);

      return id;
    },
    [dismissToast],
  );

  // Convenience methods for different toast types
  const toast = useCallback(
    (message: string, type?: ToastKind, duration?: number) => {
      addToast(message, type, duration);
    },
    [addToast],
  );

  const info = useCallback(
    (message: string, duration?: number) => {
      addToast(message, "info", duration);
    },
    [addToast],
  );

  const success = useCallback(
    (message: string, duration?: number) => {
      addToast(message, "success", duration);
    },
    [addToast],
  );

  const error = useCallback(
    (message: string, duration?: number) => {
      addToast(message, "error", duration);
    },
    [addToast],
  );

  const warning = useCallback(
    (message: string, duration?: number) => {
      addToast(message, "warning", duration);
    },
    [addToast],
  );

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      addToast,
      dismissToast,
      toast,
      info,
      success,
      error,
      warning,
    }),
    [addToast, dismissToast, toast, info, success, error, warning],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToasts() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToasts must be used within a ToastProvider");
  }
  return ctx;
}
