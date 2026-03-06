"use client";

import { ReactNode } from "react";
import styles from "./Surface.module.css";

type SurfaceProps = {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  element?: keyof JSX.IntrinsicElements;
};

import { motion } from "framer-motion";

export function Surface({
  children,
  className = "",
  padding = "md",
  element: Element = "section",
}: SurfaceProps) {
  const paddingClass =
    padding === "none"
      ? styles.paddingNone
      : padding === "sm"
      ? styles.paddingSm
      : padding === "lg"
      ? styles.paddingLg
      : styles.paddingMd;

  const classes = [styles.surface, paddingClass, className].filter(Boolean).join(" ");

  const MotionElement = motion(Element as any);

  return (
    <MotionElement
      className={classes}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {children}
    </MotionElement>
  );
}
