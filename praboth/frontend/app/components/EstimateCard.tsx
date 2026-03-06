import { EstimateResponse } from "../../lib/api";
import styles from "./EstimateCard.module.css";
import { Target, Activity, Zap, Cpu, Clock, Layers } from "lucide-react";

function formatNumber(value: number, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : "--";
}

export function EstimateCard({ estimate }: { estimate: EstimateResponse }) {
  const contextValues = Object.values(estimate.context_flags ?? {});
  const loadState = estimate.load_state ?? "unknown cognitive load";
  const loadStateClasses = getLoadStateClasses(loadState);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.mainInfo}>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}><Layers size={14} /> Hop #{estimate.hop_index}</span>
            <span className={styles.modePill}>
              {estimate.baseline_active ? "Calibrating" : "Active Tracking"}
            </span>
          </div>
          <div className={styles.loadValue}>
            <Target className={styles.icon} size={24} />
            <span>Load Factor: <strong>{formatNumber(estimate.load, 2)}</strong></span>
          </div>
          <div className={styles.stateRow}>
            <span className={`${styles.loadChip} ${loadStateClasses}`}>{loadState}</span>
          </div>
        </div>
      </div>

      <div className={styles.metricsGrid}>
        <MetricItem 
          icon={<Activity size={16} />} 
          label="Variance" 
          value={formatNumber(estimate.variance, 4)} 
          hint="Model uncertainty"
        />
        <MetricItem 
          icon={<Zap size={16} />} 
          label="Residual" 
          value={formatNumber(estimate.residual, 3)} 
          hint="Innovation error"
        />
        <MetricItem 
          icon={<Cpu size={16} />} 
          label="Quality" 
          value={formatNumber(estimate.quality, 2)} 
          hint="Signal coverage"
        />
      </div>

      <div className={styles.footer}>
        <div className={styles.footerItem}>
          <Clock size={14} />
          <span>{new Date(estimate.timestamp).toLocaleTimeString()}</span>
        </div>
        <div className={styles.footerItem}>
          <strong>Context:</strong> {contextValues.length ? contextValues.join(", ") : "None Detected"}
        </div>
      </div>
    </div>
  );
}

function MetricItem({ icon, label, value, hint }: { icon: React.ReactNode, label: string, value: string, hint: string }) {
  return (
    <div className={styles.metricItem} title={hint}>
      <div className={styles.metricHeader}>
        {icon}
        <span className={styles.metricLabel}>{label}</span>
      </div>
      <div className={styles.metricData}>{value}</div>
    </div>
  );
}

function getLoadStateClasses(state: string) {
  const normalized = state.toLowerCase();
  if (normalized.includes("high")) return styles.loadHigh;
  if (normalized.includes("medium")) return styles.loadMedium;
  if (normalized.includes("low")) return styles.loadLow;
  return styles.loadNeutral;
}
