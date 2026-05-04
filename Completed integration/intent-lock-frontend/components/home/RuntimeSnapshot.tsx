"use client";

import { useEstimatorContext } from "../providers/EstimatorProvider";
import type { TelemetryResponse, EstimateResponse } from "../../lib/api";

export function RuntimeSnapshot() {
  const { telemetry, estimate } = useEstimatorContext();

  const schedulerState = telemetry?.scheduler_state ?? estimate?.scheduler_state ?? "unknown";
  const loadState = estimate?.load_state ?? "unknown";
  const cooldownSeconds = telemetry?.cooldown_seconds ?? null;
  const snoozeSeconds = telemetry?.snooze_seconds ?? null;
  const nextPromptSeconds = telemetry?.next_prompt_seconds ?? null;
  const policyPrompted = telemetry?.policy_prompted ?? null;
  const policySuppressed = telemetry?.policy_suppressed ?? null;
  const contextFlags = getContextFlags(telemetry, estimate);

  const contextPreview = contextFlags.slice(0, 3);
  const extraContexts = Math.max(0, contextFlags.length - contextPreview.length);

  return (
    <div className="runtime-snapshot">
      <div className="runtime-snapshot__header">
        <div>
          <h2 className="runtime-snapshot__title">Runtime snapshot</h2>
          <p className="runtime-snapshot__hint">Live context, cooldowns, and policy counters.</p>
        </div>
        <div className="runtime-snapshot__chip-row">
          <StatusChip label={schedulerState} tone="cyan" />
          <StatusChip label={loadState} tone={getToneForLoadState(loadState)} />
        </div>
      </div>

      <div className="runtime-snapshot__grid">
        <div className="runtime-snapshot__item">
          <p className="runtime-snapshot__overline">Cooldown</p>
          <p className="runtime-snapshot__value">{formatSeconds(cooldownSeconds)}</p>
          <p className="runtime-snapshot__helper">Snooze {formatSeconds(snoozeSeconds)}</p>
        </div>
        <div className="runtime-snapshot__item">
          <p className="runtime-snapshot__overline">Next prompt</p>
          <p className="runtime-snapshot__value">{formatSeconds(nextPromptSeconds)}</p>
          <p className="runtime-snapshot__helper">
            Policy counters: {policyPrompted ?? "--"} prompted - {policySuppressed ?? "--"} suppressed
          </p>
        </div>
      </div>

      <div className="runtime-snapshot__context-panel">
        <p className="runtime-snapshot__overline">Active contexts</p>
        <div className="runtime-snapshot__context-list">
          {contextPreview.length ? (
            contextPreview.map((flag) => (
              <span key={flag} className="runtime-snapshot__context-chip">
                {flag}
              </span>
            ))
          ) : (
            <span className="runtime-snapshot__helper">No suppressors detected</span>
          )}
          {extraContexts > 0 && (
            <span className="runtime-snapshot__context-chip">+{extraContexts} more</span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusChip({ label, tone }: { label: string; tone: "rose" | "amber" | "emerald" | "cyan" | "indigo" | "slate" }) {
  const toneClassMap: Record<typeof tone, string> = {
    rose: "runtime-snapshot__chip--rose",
    amber: "runtime-snapshot__chip--amber",
    emerald: "runtime-snapshot__chip--emerald",
    cyan: "runtime-snapshot__chip--cyan",
    indigo: "runtime-snapshot__chip--indigo",
    slate: "runtime-snapshot__chip--slate",
  };

  const toneClass = toneClassMap[tone] ?? "";
  return <span className={`runtime-snapshot__chip ${toneClass}`}>{label}</span>;
}

function formatSeconds(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "none";
  }
  const clamped = Math.max(0, Math.round(value));
  if (clamped <= 0) return "none";
  return `${clamped}s`;
}

function getToneForLoadState(loadState: string): "rose" | "amber" | "emerald" | "cyan" | "indigo" | "slate" {
  const normalized = loadState.toLowerCase();
  if (normalized.includes("high")) return "rose";
  if (normalized.includes("medium")) return "amber";
  if (normalized.includes("low")) return "emerald";
  return "slate";
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
