"use client";

import { useMemo } from "react";
import { Sparkline } from "../Sparkline";
import { HistoryPoint } from "../../hooks/useEstimatorStream";
import styles from "./VisualizationPanel.module.css";
import { TrendingUp, Activity } from "lucide-react";

type VisualizationPanelProps = {
  history: HistoryPoint[];
};

export function VisualizationPanel({ history }: VisualizationPanelProps) {
  const loadPoints = useMemo(() => {
    return [...history]
      .sort((a, b) => a.t - b.t)
      .map((p) => ({ x: p.t, y: p.load }));
  }, [history]);

  const residualPoints = useMemo(() => {
    return [...history]
      .sort((a, b) => a.t - b.t)
      .map((p) => ({ x: p.t, y: p.residual }));
  }, [history]);

  const latest = history[history.length - 1];

  return (
    <div className={styles.panel}>
      {history.length === 0 ? (
        <div className={styles.emptyState}>
          <Activity size={32} className="opacity-20 mb-4" />
          <p>Chart data will appear once sensor telemetry begins streaming.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          <div className={styles.chartWrapper}>
             <div className={styles.chartHeader}>
                <TrendingUp size={14} className="text-cyan-400" />
                <span>Workload Trend (Normalized)</span>
             </div>
             <Sparkline
                points={loadPoints}
                label="Cognitive Load"
                value={latest ? latest.load.toFixed(2) : "--"}
                color="#06b6d4"
                className={styles.sparkline}
            />
          </div>
          <div className={styles.chartWrapper}>
            <div className={styles.chartHeader}>
                <Activity size={14} className="text-orange-400" />
                <span>Innovation Residual (RMS)</span>
             </div>
            <Sparkline
                points={residualPoints}
                label="Model Error"
                value={latest ? latest.residual.toFixed(3) : "--"}
                color="#f97316"
                className={styles.sparkline}
            />
          </div>
        </div>
      )}
    </div>
  );
}
