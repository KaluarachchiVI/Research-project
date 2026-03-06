"use client";

import styles from "./AlertBanner.module.css";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";

type AlertTone = "error" | "warning" | "info";

type AlertBannerProps = {
  title: string;
  message: string;
  tone?: AlertTone;
};

export function AlertBanner({ title, message, tone = "info" }: AlertBannerProps) {
  const icon = 
    tone === "error" ? <AlertCircle size={20} /> :
    tone === "warning" ? <AlertTriangle size={20} /> :
    <Info size={20} />;

  return (
    <div className={`${styles.alert} ${styles[tone]}`}>
      <div className={styles.iconWrapper}>
        {icon}
      </div>
      <div className={styles.content}>
        <div className={styles.title}>{title}</div>
        <div className={styles.message}>{message}</div>
      </div>
    </div>
  );
}
