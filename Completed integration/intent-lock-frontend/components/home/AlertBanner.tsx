"use client";

import { useState } from "react";
import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { useEstimatorContext } from "../providers/EstimatorProvider";
import type { TelemetryResponse } from "../../lib/api";

type AlertTone = "error" | "warning" | "info";

type AlertData = {
  id: string;
  title: string;
  message: string;
  tone: AlertTone;
};

export function AlertBanner() {
  const { status, error, telemetry, isConnected } = useEstimatorContext();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const alerts = generateAlerts(status, error, telemetry, isConnected);
  const visibleAlerts = alerts.filter((alert) => !dismissedAlerts.has(alert.id));

  if (visibleAlerts.length === 0) {
    return null;
  }

  return (
    <div className="alert-banner">
      {visibleAlerts.map((alert) => (
        <AlertItem
          key={alert.id}
          alert={alert}
          onDismiss={() => {
            setDismissedAlerts((prev) => new Set(prev).add(alert.id));
          }}
        />
      ))}
    </div>
  );
}

function AlertItem({ alert, onDismiss }: { alert: AlertData; onDismiss: () => void }) {
  const icon =
    alert.tone === "error" ? (
      <AlertCircle size={20} />
    ) : alert.tone === "warning" ? (
      <AlertTriangle size={20} />
    ) : (
      <Info size={20} />
    );

  return (
    <div className={`alert-banner__alert alert-banner__alert--${alert.tone}`}>
      <div className="alert-banner__icon-wrapper">{icon}</div>
      <div className="alert-banner__content">
        <div className="alert-banner__title">{alert.title}</div>
        <div className="alert-banner__message">{alert.message}</div>
      </div>
      <button
        className="alert-banner__dismiss"
        onClick={onDismiss}
        aria-label="Dismiss alert"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function generateAlerts(
  status: string,
  error: string | null,
  telemetry: TelemetryResponse | null,
  isConnected: boolean
): AlertData[] {
  const alerts: AlertData[] = [];

  // Connection status alerts
  if (!isConnected) {
    alerts.push({
      id: "connection-lost",
      title: "Connection Lost",
      message: "Unable to connect to the cognitive load estimator. Retrying...",
      tone: "error",
    });
  }

  // Error alerts
  if (error) {
    alerts.push({
      id: "error-alert",
      title: "Error",
      message: error,
      tone: "error",
    });
  }

  // Calibration progress alerts
  if (telemetry?.onboarding_percent !== null && telemetry?.onboarding_percent !== undefined) {
    const percent = telemetry.onboarding_percent;
    if (percent < 100) {
      alerts.push({
        id: "calibration-progress",
        title: "Calibration in Progress",
        message: `System is calibrating: ${percent}% complete. ${telemetry.onboarding_message || ""}`,
        tone: "info",
      });
    }
  }

  // Privacy pause warning
  if (telemetry?.privacy_pause) {
    alerts.push({
      id: "privacy-pause-active",
      title: "Privacy Pause Active",
      message: "Data collection is paused. Some features may be limited.",
      tone: "warning",
    });
  }

  // Consent warning
  if (telemetry?.consent_granted === false) {
    alerts.push({
      id: "consent-restricted",
      title: "Data Consent Restricted",
      message: "Data collection is restricted. Please grant consent for full functionality.",
      tone: "warning",
    });
  }

  return alerts;
}
