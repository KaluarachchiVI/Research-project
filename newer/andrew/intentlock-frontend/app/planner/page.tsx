"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

const YUVIDU_PLANNER_URL =
  process.env.NEXT_PUBLIC_YUVIDU_PLANNER_URL ?? "http://localhost:3001";

function PlannerContent() {
  const searchParams = useSearchParams();
  const fromSessionId = searchParams.get("from_session") || undefined;

  const base = YUVIDU_PLANNER_URL.replace(/\/$/, "");
  const plannerSrc = fromSessionId
    ? `${base}/?from_session=${encodeURIComponent(fromSessionId)}`
    : `${base}/`;

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--background)",
        color: "var(--color-text-primary)",
        padding: "var(--space-lg)",
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--space-md)",
          marginBottom: "var(--space-lg)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              color: "var(--color-text-muted)",
              marginBottom: "var(--space-sm)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Planning
          </h1>
          <h2
            style={{
              fontSize: "var(--text-3xl)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              marginBottom: "var(--space-sm)",
            }}
          >
            Bandit-informed next study block
          </h2>
          {fromSessionId && (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-muted)",
              }}
            >
              Planned after session <code>{fromSessionId}</code>
            </p>
          )}
        </div>

        <a
          href="/"
          style={{
            textDecoration: "none",
          }}
        >
          <button
            type="button"
            style={{
              background: "var(--color-surface)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border)",
              padding: "0.55rem 1.1rem",
              borderRadius: "999px",
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Back to session
          </button>
        </a>
      </div>

      <section
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-card)",
          padding: "var(--space-lg)",
          boxShadow: "0 25px 35px -20px rgba(15, 23, 42, 0.9)",
        }}
      >
        <h3
          style={{
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            marginBottom: "var(--space-sm)",
          }}
        >
          Yuvidu planner
        </h3>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-muted)",
            marginBottom: "var(--space-md)",
          }}
        >
          This view embeds the Yuvidu planner so you can explore bandit-informed
          study windows without leaving the Intent-Lock dashboard.
        </p>
        <div
          style={{
            borderRadius: "1rem",
            overflow: "hidden",
            border: "1px solid var(--color-border)",
            background: "var(--color-background)",
          }}
        >
          <iframe
            src={plannerSrc}
            title="Yuvidu planner"
            style={{
              width: "100%",
              height: "900px",
              border: "none",
            }}
          />
        </div>
      </section>
    </main>
  );
}

export default function PlannerPage() {
  return (
    <Suspense fallback={<div style={{ padding: "var(--space-lg)", color: "var(--color-text-muted)" }}>Loading planner…</div>}>
      <PlannerContent />
    </Suspense>
  );
}

