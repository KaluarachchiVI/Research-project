"use client";

import { motion } from "framer-motion";
import styles from "./Sparkline.module.css";

type SparklineProps = {
  points: { x: number; y: number }[];
  width?: number;
  height?: number;
  color?: string;
  label: string;
  value: string;
  className?: string;
};

export function Sparkline({
  points,
  width,
  height,
  color = "#22d3ee",
  label,
  value,
  className = "",
}: SparklineProps) {
  if (!points.length) {
    return (
      <div className={styles.sparkline}>
        <div className={styles.header}>
          <span className={styles.label}>{label}</span>
          <span className={styles.value}>{value}</span>
        </div>
        <div className={styles.empty}>Waiting for telemetry...</div>
      </div>
    );
  }

  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const spanY = Math.max(1e-6, maxY - minY);
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const spanX = Math.max(1, maxX - minX);

  const gradientId = `grad-${label.replace(/\s+/g, "-")}`;
  const calcWidth = width ?? 480;
  const calcHeight = height ?? 160;
  
  const path = points
    .map((p, idx) => {
      const x = ((p.x - minX) / spanX) * (calcWidth - 20) + 10;
      const y = calcHeight - (((p.y - minY) / spanY) * (calcHeight - 20) + 10);
      return `${idx === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");

  const fillPath = `${path} L ${calcWidth - 10} ${calcHeight} L 10 ${calcHeight} Z`;

  return (
    <div className={`${styles.sparkline} ${className}`}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{value}</span>
      </div>
      <div className={styles.svgContainer}>
        <svg
          width="100%"
          height="100%"
          role="presentation"
          viewBox={`0 0 ${calcWidth} ${calcHeight}`}
          preserveAspectRatio="none"
          className={styles.svg}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.4" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path
            d={fillPath}
            fill={`url(#${gradientId})`}
            initial={false}
            animate={{ d: fillPath }}
            transition={{ duration: 0.5, ease: "linear" }}
          />
          <motion.path
            d={path}
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            initial={false}
            animate={{ d: path }}
            transition={{ duration: 0.5, ease: "linear" }}
          />
        </svg>
      </div>
    </div>
  );
}
