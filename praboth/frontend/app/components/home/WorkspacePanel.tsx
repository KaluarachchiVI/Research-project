"use client";

import { Tone } from "../../../lib/format";
import styles from "./WorkspacePanel.module.css";
import { Shield, ShieldOff, UserCheck, UserX, Brain, ListRestart } from "lucide-react";

type WorkspacePanelProps = {
  privacyPause?: boolean | null;
  consentGranted?: boolean | null;
  loadState: string;
  loadTone: Tone;
  contextFlags: string[];
};

export function WorkspacePanel({
  privacyPause,
  consentGranted,
  loadState,
  loadTone,
  contextFlags,
}: WorkspacePanelProps) {
  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>System Posture</h3>
      
      <div className={styles.statusGrid}>
        <div className={`${styles.statusCard} ${privacyPause ? styles.active : ""}`}>
          <div className={styles.iconBox}>
            {privacyPause ? <ShieldOff size={18} className="text-rose-400" /> : <Shield size={18} className="text-emerald-400" />}
          </div>
          <div className={styles.cardContent}>
            <span className={styles.cardLabel}>Privacy Pause</span>
            <span className={styles.cardValue}>{privacyPause ? "Active" : "Disabled"}</span>
          </div>
        </div>

        <div className={`${styles.statusCard} ${consentGranted ? styles.active : styles.warn}`}>
          <div className={styles.iconBox}>
            {consentGranted ? <UserCheck size={18} className="text-cyan-400" /> : <UserX size={18} className="text-amber-400" />}
          </div>
          <div className={styles.cardContent}>
            <span className={styles.cardLabel}>Data Consent</span>
            <span className={styles.cardValue}>{consentGranted ? "Granted" : "Restricted"}</span>
          </div>
        </div>
      </div>

      <div className={styles.contextSection}>
        <div className={styles.sectionHeader}>
            <ListRestart size={14} className="text-slate-400" />
            <span>Active Contextual Signals</span>
        </div>
        <div className={styles.contextTags}>
          {contextFlags.length ? (
            contextFlags.map((flag, i) => (
              <span key={i} className={styles.tag}>{flag}</span>
            ))
          ) : (
            <span className={styles.emptyTag}>Monitoring ambient signals...</span>
          )}
        </div>
      </div>
    </div>
  );
}
