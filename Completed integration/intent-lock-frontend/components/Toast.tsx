"use client";

import { useEffect, useState } from "react";

export type ToastKind = "info" | "success" | "error" | "warning";

export type ToastMessage = {
  id: string;
  type: ToastKind;
  message: string;
  duration?: number;
};

const toneMap: Record<
  ToastKind,
  {
    bg: string;
    border: string;
    dot: string;
    icon: string;
    label: string;
    iconBg: string;
  }
> = {
  info: {
    bg: "bg-slate-800/90",
    border: "border-slate-700",
    dot: "bg-cyan-400",
    icon: "ℹ️",
    label: "Info",
    iconBg: "bg-cyan-400/20",
  },
  success: {
    bg: "bg-emerald-800/90",
    border: "border-emerald-600/60",
    dot: "bg-emerald-300",
    icon: "✓",
    label: "Success",
    iconBg: "bg-emerald-400/20",
  },
  error: {
    bg: "bg-rose-900/90",
    border: "border-rose-600/60",
    dot: "bg-rose-300",
    icon: "!",
    label: "Error",
    iconBg: "bg-rose-400/20",
  },
  warning: {
    bg: "bg-amber-800/90",
    border: "border-amber-600/60",
    dot: "bg-amber-300",
    icon: "⚠",
    label: "Warning",
    iconBg: "bg-amber-400/20",
  },
};

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
  index: number;
}

function Toast({ toast, onDismiss, index }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const tone = toneMap[toast.type];

  useEffect(() => {
    // Animate in
    const animationFrame = requestAnimationFrame(() => {
      setIsVisible(true);
    });

    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 150);
  };

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-2xl border shadow-xl backdrop-blur transition-all duration-150 ease-out ${tone.bg} ${tone.border}`}
      role="status"
      aria-label={`${tone.label} notification`}
      style={{
        padding: "clamp(0.75rem, 1.5vw, 1rem) clamp(1rem, 2vw, 1.25rem)",
        gap: "clamp(0.5rem, 1vw, 0.75rem)",
        borderRadius: "clamp(0.75rem, 1.5vw, 1rem)",
        fontSize: "clamp(0.875rem, 1vw, 0.9375rem)",
        lineHeight: "1.5",
        minWidth: "clamp(280px, 80vw, 320px)",
        maxWidth: "100%",
        opacity: isExiting ? 0 : isVisible ? 1 : 0,
        transform: isExiting
          ? "translateX(100%)"
          : isVisible
          ? "translateX(0)"
          : "translateX(100%)",
        transition: "opacity 150ms ease-out, transform 150ms ease-out",
      }}
    >
      <div
        className={`flex items-center justify-center rounded-full ${tone.iconBg}`}
        aria-hidden
        style={{
          width: "clamp(1.5rem, 2vw, 1.75rem)",
          height: "clamp(1.5rem, 2vw, 1.75rem)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "clamp(0.875rem, 1.25vw, 1rem)",
            lineHeight: "1",
          }}
        >
          {tone.icon}
        </span>
      </div>
      <div
        className="flex-1 leading-relaxed"
        style={{
          color: "#f8fafc",
          wordBreak: "break-word",
          overflowWrap: "break-word",
        }}
      >
        {toast.message}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleDismiss();
          }
        }}
        className="transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 rounded"
        aria-label="Close notification"
        style={{
          color: "#cbd5e1",
          fontSize: "clamp(1rem, 1.5vw, 1.25rem)",
          minWidth: "clamp(2rem, 3vw, 2.5rem)",
          minHeight: "clamp(2rem, 3vw, 2.5rem)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "0.375rem",
          flexShrink: 0,
          touchAction: "manipulation",
        }}
      >
        ×
      </button>
    </div>
  );
}

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (!toasts.length) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-md flex-col gap-3 sm:right-6 sm:top-6"
      role="region"
      aria-live="assertive"
      aria-label="Notifications"
      style={{
        right: "clamp(1rem, 2vw, 1.5rem)",
        top: "clamp(1rem, 2vw, 1.5rem)",
        maxWidth: "min(90vw, 28rem)",
        gap: "clamp(0.5rem, 1vw, 0.75rem)",
      }}
    >
      {toasts.map((toast, index) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} index={index} />
      ))}
    </div>
  );
}
