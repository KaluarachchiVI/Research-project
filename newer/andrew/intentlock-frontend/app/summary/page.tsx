"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface DetailedMetric {
  value: number | null;
  formula?: string;
  description?: string;
}

interface DetailedMetricsResponse {
  user_id: string;
  session_id?: string | null;
  metrics: Record<string, DetailedMetric>;
  timestamp: string;
}

interface TimeBlockSessionSummary {
  session_id: string;
  user_id: string;
  start_time: string;
  has_scheduler: boolean;
  has_extractor: boolean;
  has_praboth_client: boolean;
  cognitive_load: number | null;
  is_paused: boolean;
}

interface TimeBlockSessionsResponse {
  active_sessions: TimeBlockSessionSummary[];
  count: number;
}

const SCHEDULER_API_BASE =
  process.env.NEXT_PUBLIC_SCHEDULER_API_BASE ?? "http://127.0.0.1:5000";

function SummaryContent() {
  const searchParams = useSearchParams();
  const queryUserId = searchParams.get("user_id") || undefined;
  const querySessionId = searchParams.get("session_id") || undefined;

  const [userId] = useState<string>(queryUserId ?? "demo_user");
  const [sessionId] = useState<string | undefined>(querySessionId);
  const [metrics, setMetrics] = useState<DetailedMetricsResponse | null>(null);
  const [sessions, setSessions] = useState<TimeBlockSessionSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const metricsUrl = new URL("/api/metrics/detailed", SCHEDULER_API_BASE);
        metricsUrl.searchParams.set("user_id", userId);
        metricsUrl.searchParams.set("diagnostics", "true");
        if (sessionId) {
          metricsUrl.searchParams.set("session_id", sessionId);
        }

        const [metricsRes, sessionsRes] = await Promise.all([
          fetch(metricsUrl.toString(), { cache: "no-store" }),
          fetch(`${SCHEDULER_API_BASE}/api/time-block/sessions`, {
            cache: "no-store",
          }),
        ]);

        if (!metricsRes.ok) {
          const text = await metricsRes.text();
          throw new Error(
            `Metrics request failed (${metricsRes.status}): ${text.slice(
              0,
              200
            )}`
          );
        }
        const metricsJson =
          (await metricsRes.json()) as DetailedMetricsResponse;

        let sessionsJson: TimeBlockSessionsResponse | null = null;
        if (sessionsRes.ok) {
          sessionsJson =
            (await sessionsRes.json()) as TimeBlockSessionsResponse;
        }

        if (cancelled) return;
        setMetrics(metricsJson);
        setSessions(sessionsJson?.active_sessions ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load summary data"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchAll();

    return () => {
      cancelled = true;
    };
  }, [userId, sessionId]);

  const metricOrder: { key: string; label: string }[] = [
    { key: "PG", label: "PG (Personalization Gain)" },
    { key: "RPH", label: "RPH (Regret-per-Hour)" },
    { key: "AHL", label: "AHL (Adaptation Half-Life)" },
    { key: "EOI", label: "EOI (Exploration Overhead)" },
    { key: "AUC_BUC", label: "AUC-BUC" },
    { key: "CTU", label: "CTU (Counterfactual Uplift)" },
    { key: "SPF_variance", label: "SPF Variance" },
    { key: "SVR", label: "SVR (Safety-Violation Rate)" },
  ];

  const dashboardUrl = `${SCHEDULER_API_BASE.replace(
    /\/api$/,
    ""
  )}/dashboard?user_id=${encodeURIComponent(userId)}`;

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
            Post-session summary
          </h1>
          <h2
            style={{
              fontSize: "var(--text-3xl)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              marginBottom: "var(--space-xs)",
            }}
          >
            Adaptive scheduler metrics
          </h2>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
            }}
          >
            User <code>{userId}</code>
            {sessionId ? (
              <>
                {" · session "}
                <code>{sessionId}</code>
              </>
            ) : null}
          </p>
        </div>
        <a
          href={dashboardUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            textDecoration: "none",
          }}
        >
          <button
            type="button"
            style={{
              background: "linear-gradient(120deg, #06b6d4, #0ea5e9)",
              color: "#0b1220",
              border: "none",
              padding: "0.55rem 1.1rem",
              borderRadius: "999px",
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Open full dashboard
          </button>
        </a>
      </div>

      {loading && (
        <div
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-muted)",
            marginBottom: "var(--space-lg)",
          }}
        >
          Loading metrics from scheduler…
        </div>
      )}

      {error && !loading && (
        <div
          style={{
            marginBottom: "var(--space-lg)",
            padding: "var(--space-md)",
            borderRadius: "var(--radius-card)",
            border: "1px solid var(--color-error)",
            background: "var(--color-error-bg)",
            fontSize: "var(--text-sm)",
          }}
        >
          Failed to load summary from scheduler: {error}
        </div>
      )}

      {metrics && (
        <section
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-card)",
            padding: "var(--space-lg)",
            marginBottom: "var(--space-lg)",
            boxShadow: "0 25px 35px -20px rgba(15, 23, 42, 0.9)",
          }}
        >
          <h3
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: 700,
              marginBottom: "var(--space-md)",
            }}
          >
            Research metrics (all 8)
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "var(--space-md)",
            }}
          >
            {metricOrder.map(({ key, label }) => {
              const metric = metrics.metrics[key];
              const rawValue = metric?.value;
              const displayValue =
                rawValue === null || rawValue === undefined
                  ? "N/A"
                  : rawValue === Infinity ||
                    rawValue === Number.POSITIVE_INFINITY
                  ? "∞"
                  : typeof rawValue === "number"
                  ? rawValue.toFixed(4)
                  : String(rawValue);

              return (
                <div
                  key={key}
                  style={{
                    padding: "var(--space-md)",
                    borderRadius: "1rem",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-background)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: "0.35rem",
                      fontWeight: 600,
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xl)",
                      fontWeight: 800,
                      color: "var(--color-info)",
                      marginBottom: "0.25rem",
                    }}
                  >
                    {displayValue}
                  </div>
                  {metric?.description && (
                    <div
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {metric.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

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
            marginBottom: "var(--space-md)",
          }}
        >
          Time-block sessions (current run)
        </h3>
        {sessions.length === 0 ? (
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
            }}
          >
            No active time-block sessions are currently tracked by the scheduler
            service.
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-sm)",
              fontSize: "var(--text-sm)",
            }}
          >
            {sessions.slice(0, 5).map((s) => (
              <div
                key={s.session_id}
                style={{
                  padding: "var(--space-sm)",
                  borderRadius: "0.75rem",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-background)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "var(--space-md)",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-muted)",
                      marginBottom: "0.15rem",
                    }}
                  >
                    SESSION
                  </div>
                  <div
                    style={{
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                    }}
                  >
                    {s.session_id}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-muted)",
                      marginTop: "0.1rem",
                    }}
                  >
                    Started {new Date(s.start_time).toLocaleString()}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "0.15rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Cognitive load:{" "}
                    {s.cognitive_load === null
                      ? "n/a"
                      : `${Math.round(s.cognitive_load * 100)}%`}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: s.is_paused
                        ? "var(--color-warning)"
                        : "var(--color-success)",
                      fontWeight: 600,
                    }}
                  >
                    {s.is_paused ? "Paused" : "Active"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        style={{
          marginTop: "var(--space-lg)",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={() =>
            (window.location.href = `/planner${
              metrics?.session_id
                ? `?from_session=${encodeURIComponent(metrics.session_id)}`
                : ""
            }`)
          }
          style={{
            background: "linear-gradient(120deg, #34d399, #10b981)",
            color: "#0b1220",
            border: "none",
            padding: "0.55rem 1.1rem",
            borderRadius: "999px",
            fontSize: "var(--text-sm)",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Plan next block
        </button>
      </section>
    </main>
  );
}

export default function SummaryPage() {
  return (
    <Suspense fallback={<div style={{ padding: "var(--space-lg)", color: "var(--color-text-muted)" }}>Loading summary…</div>}>
      <SummaryContent />
    </Suspense>
  );
}
