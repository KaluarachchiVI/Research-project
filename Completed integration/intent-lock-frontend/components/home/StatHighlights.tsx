"use client";

import { HistoryPoint, useEstimatorContext } from "../providers/EstimatorProvider";
import { TelemetryResponse, EstimateResponse } from "../../lib/api";
import { TrendingUp, TrendingDown, Minus, Loader2, AlertCircle } from "lucide-react";
import styles from "./StatHighlights.module.css";

export type Tone = "rose" | "amber" | "emerald" | "cyan" | "indigo" | "slate";

export type StatCardView = {
  id: string;
  label: string;
  value: string;
  hint: string;
  tone: Tone;
  variant?: "compact";
  trend?: {
    direction: "up" | "down" | "neutral";
    value: string;
  };
};

const toneClassMap: Record<Tone, string> = {
  rose: styles.toneRose,
  amber: styles.toneAmber,
  emerald: styles.toneEmerald,
  cyan: styles.toneCyan,
  indigo: styles.toneIndigo,
  slate: styles.toneSlate,
};

const trendIconMap = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

function TrendIndicator({ direction, value }: { direction: "up" | "down" | "neutral"; value: string }) {
  const Icon = trendIconMap[direction];
  const trendClass = direction === "up" ? styles.trendUp : direction === "down" ? styles.trendDown : styles.trendNeutral;
  
  return (
    <div className={`${styles.trendIndicator} ${trendClass}`}>
      <Icon size={14} />
      <span>{value}</span>
    </div>
  );
}

function StatCard({ card }: { card: StatCardView }) {
  const toneClass = toneClassMap[card.tone] ?? styles.toneSlate;
  const variantClass = card.variant === "compact" ? styles.statCardCompact : "";
  
  return (
    <div className={`${styles.statCard} ${variantClass}`}>
      <div className={styles.statHeader}>
        <p className={styles.statLabel}>{card.label}</p>
        {card.trend && <TrendIndicator direction={card.trend.direction} value={card.trend.value} />}
      </div>
      <p className={`${styles.statValue} ${toneClass}`}>{card.value}</p>
      <p className={styles.statHint}>{card.hint}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className={styles.loadingState}>
      <Loader2 className={styles.spinner} size={24} />
      <p>Loading statistics...</p>
    </div>
  );
}

function ErrorState({ error }: { error: string | null }) {
  return (
    <div className={styles.errorState}>
      <AlertCircle className={styles.errorIcon} size={24} />
      <p>{error || "Unable to load statistics"}</p>
    </div>
  );
}

function getToneForLoadState(loadState: string | null | undefined): Tone {
  if (!loadState) return "slate";
  const normalized = loadState.toLowerCase();
  if (normalized.includes("high")) return "rose";
  if (normalized.includes("medium")) return "amber";
  if (normalized.includes("low")) return "emerald";
  return "slate";
}

function getToneForSchedulerState(schedulerState: string | null | undefined): Tone {
  if (!schedulerState) return "slate";
  const normalized = schedulerState.toLowerCase();
  if (normalized.includes("active") || normalized.includes("running")) return "emerald";
  if (normalized.includes("paused") || normalized.includes("suspended")) return "amber";
  if (normalized.includes("error") || normalized.includes("failed")) return "rose";
  return "cyan";
}

function formatNumber(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return "--";
  return value.toFixed(decimals);
}

function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--%";
  return `${Math.round(value * 100)}%`;
}

function formatSeconds(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--";
  const clamped = Math.max(0, Math.round(value));
  if (clamped <= 0) return "none";
  return `${clamped}s`;
}

interface StatHighlightsProps {
  cards?: StatCardView[];
  showLoading?: boolean;
  showError?: boolean;
  error?: string | null;
}

export function StatHighlights({ cards: propCards, showLoading, showError, error }: StatHighlightsProps) {
  const { telemetry, estimate, history, isConnected, error: contextError } = useEstimatorContext();
  
  // Use provided cards or generate from telemetry data
  const cards = propCards ?? generateCardsFromData(telemetry, estimate, history);
  
  const isLoading = showLoading ?? !isConnected;
  const displayError = showError ?? contextError;
  const errorMessage = error ?? contextError;
  
  if (isLoading) {
    return <LoadingState />;
  }
  
  if (displayError) {
    return <ErrorState error={errorMessage} />;
  }
  
  return (
    <div className={styles.statGrid}>
      {cards.map((card) => (
        <StatCard key={card.id} card={card} />
      ))}
    </div>
  );
}

function generateCardsFromData(
  telemetry: TelemetryResponse | null,
  estimate: EstimateResponse | null,
  history: HistoryPoint[]
): StatCardView[] {
  const cards: StatCardView[] = [];
  
  // Cognitive Load Card
  if (estimate) {
    const loadPercentage = formatPercentage(estimate.load);
    const loadState = estimate.load_state ?? telemetry?.load_state;
    const tone = getToneForLoadState(loadState);
    
    // Calculate trend from history
    let trend: StatCardView["trend"] | undefined;
    if (history.length >= 2) {
      const recent = history.slice(-2);
      const diff = recent[1].load - recent[0].load;
      const diffPercent = Math.round(diff * 100);
      if (Math.abs(diffPercent) > 1) {
        trend = {
          direction: diff > 0 ? "up" : "down",
          value: `${Math.abs(diffPercent)}%`,
        };
      }
    }
    
    cards.push({
      id: "cognitive-load",
      label: "Cognitive Load",
      value: loadPercentage,
      hint: loadState ?? "Current cognitive load level",
      tone,
      trend,
    });
  }
  
  // Residual Load Card
  if (estimate) {
    const residualPercentage = formatPercentage(estimate.residual);
    const tone = estimate.residual > 0.5 ? "amber" : estimate.residual > 0.3 ? "cyan" : "emerald";
    
    cards.push({
      id: "residual-load",
      label: "Residual Load",
      value: residualPercentage,
      hint: "Accumulated cognitive fatigue",
      tone,
    });
  }
  
  // Scheduler State Card
  const schedulerState = telemetry?.scheduler_state ?? estimate?.scheduler_state;
  if (schedulerState) {
    const tone = getToneForSchedulerState(schedulerState);
    
    cards.push({
      id: "scheduler-state",
      label: "Scheduler",
      value: schedulerState,
      hint: "Current policy scheduler state",
      tone,
    });
  }
  
  // Events Processed Card
  if (telemetry?.events_processed !== undefined) {
    const tone = telemetry.events_processed > 0 ? "emerald" : "slate";
    
    cards.push({
      id: "events-processed",
      label: "Events",
      value: telemetry.events_processed.toString(),
      hint: "Total events processed",
      tone,
    });
  }
  
  // Uptime Card
  if (telemetry?.uptime_seconds !== undefined) {
    const uptimeMinutes = Math.round(telemetry.uptime_seconds / 60);
    const tone = uptimeMinutes > 0 ? "cyan" : "slate";
    
    cards.push({
      id: "uptime",
      label: "Uptime",
      value: `${uptimeMinutes}m`,
      hint: "Session duration",
      tone,
    });
  }
  
  // Cooldown Card
  if (telemetry?.cooldown_seconds !== undefined || telemetry?.snooze_seconds !== undefined) {
    const cooldown = formatSeconds(telemetry?.cooldown_seconds);
    const snooze = formatSeconds(telemetry?.snooze_seconds);
    const tone = telemetry?.cooldown_seconds && telemetry.cooldown_seconds > 0 ? "amber" : "emerald";
    
    cards.push({
      id: "cooldown",
      label: "Cooldown",
      value: cooldown,
      hint: `Snooze: ${snooze}`,
      tone,
    });
  }
  
  // Policy Counters Card
  if (telemetry?.policy_prompted !== undefined || telemetry?.policy_suppressed !== undefined) {
    const prompted = telemetry.policy_prompted ?? 0;
    const suppressed = telemetry.policy_suppressed ?? 0;
    const total = prompted + suppressed;
    const suppressionRate = total > 0 ? Math.round((suppressed / total) * 100) : 0;
    const tone = suppressionRate > 50 ? "emerald" : suppressionRate > 25 ? "cyan" : "amber";
    
    cards.push({
      id: "policy-counters",
      label: "Policy Actions",
      value: `${prompted}/${suppressed}`,
      hint: `${suppressionRate}% suppression rate`,
      tone,
    });
  }
  
  // Quality Score Card
  if (estimate?.quality !== undefined) {
    const quality = formatNumber(estimate.quality, 2);
    const tone = estimate.quality > 0.8 ? "emerald" : estimate.quality > 0.5 ? "cyan" : "amber";
    
    cards.push({
      id: "quality",
      label: "Quality",
      value: quality,
      hint: "Estimation confidence score",
      tone,
    });
  }
  
  // Variance Card
  if (estimate?.variance !== undefined) {
    const variance = formatNumber(estimate.variance, 3);
    const tone = estimate.variance < 0.1 ? "emerald" : estimate.variance < 0.2 ? "cyan" : "amber";
    
    cards.push({
      id: "variance",
      label: "Variance",
      value: variance,
      hint: "Load estimation variance",
      tone,
    });
  }
  
  return cards;
}
