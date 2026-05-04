"use client";

import { Shield, ShieldOff, UserCheck, UserX, ListRestart } from "lucide-react";
import { useEstimatorContext } from "../providers/EstimatorProvider";
import type { TelemetryResponse, EstimateResponse } from "../../lib/api";

export function WorkspacePanel() {
  const { telemetry, estimate } = useEstimatorContext();

  const privacyPause = telemetry?.privacy_pause ?? null;
  const consentGranted = telemetry?.consent_granted ?? null;
  const loadState = estimate?.load_state ?? "unknown";
  const contextFlags = getContextFlags(telemetry, estimate);

  return (
    <div className="workspace-panel">
      <h3 className="workspace-panel__title">System Posture</h3>
      
      <div className="workspace-panel__status-grid">
        <div className={`workspace-panel__status-card ${privacyPause ? "workspace-panel__status-card--active" : ""}`}>
          <div className="workspace-panel__icon-box">
            {privacyPause ? (
              <ShieldOff size={18} className="text-rose-400" />
            ) : (
              <Shield size={18} className="text-emerald-400" />
            )}
          </div>
          <div className="workspace-panel__card-content">
            <span className="workspace-panel__card-label">Privacy Pause</span>
            <span className="workspace-panel__card-value">
              {privacyPause ? "Active" : "Disabled"}
            </span>
          </div>
        </div>

        <div className={`workspace-panel__status-card ${consentGranted ? "workspace-panel__status-card--active" : "workspace-panel__status-card--warn"}`}>
          <div className="workspace-panel__icon-box">
            {consentGranted ? (
              <UserCheck size={18} className="text-cyan-400" />
            ) : (
              <UserX size={18} className="text-amber-400" />
            )}
          </div>
          <div className="workspace-panel__card-content">
            <span className="workspace-panel__card-label">Data Consent</span>
            <span className="workspace-panel__card-value">
              {consentGranted ? "Granted" : "Restricted"}
            </span>
          </div>
        </div>
      </div>

      <div className="workspace-panel__context-section">
        <div className="workspace-panel__section-header">
          <ListRestart size={14} className="text-slate-400" />
          <span>Active Contextual Signals</span>
        </div>
        <div className="workspace-panel__context-tags">
          {contextFlags.length ? (
            contextFlags.map((flag, i) => (
              <span key={i} className="workspace-panel__tag">{flag}</span>
            ))
          ) : (
            <span className="workspace-panel__empty-tag">Monitoring ambient signals...</span>
          )}
        </div>
      </div>
    </div>
  );
}

function getContextFlags(
  telemetry: TelemetryResponse | null,
  estimate: EstimateResponse | null
): string[] {
  const flags: string[] = [];

  // Get context flags from telemetry
  if (telemetry?.context_flags) {
    if (Array.isArray(telemetry.context_flags)) {
      flags.push(...telemetry.context_flags);
    } else if (typeof telemetry.context_flags === "object") {
      Object.entries(telemetry.context_flags)
        .filter(([_, value]) => value === true)
        .forEach(([key]) => flags.push(key));
    }
  }

  // Get context flags from estimate
  if (estimate?.context_flags) {
    if (Array.isArray(estimate.context_flags)) {
      estimate.context_flags.forEach((flag: string) => {
        if (!flags.includes(flag)) {
          flags.push(flag);
        }
      });
    } else if (typeof estimate.context_flags === "object") {
      Object.entries(estimate.context_flags)
        .filter(([_, value]) => value === true)
        .forEach(([key]) => {
          if (!flags.includes(key)) {
            flags.push(key);
          }
        });
    }
  }

  return flags;
}
