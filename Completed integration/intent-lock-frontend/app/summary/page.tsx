"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BarChart3, ArrowRight } from "lucide-react";
import { useAuth } from "../../lib/authContext";
import { useNavigationTransition } from "../../lib/navigationTransitionContext";
import { AnimatedLink } from "../../components/AnimatedLink";

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
  start_time: string | null;
  end_time: string | null;
  effectiveness: number | null;
  interval_count: number;
}

interface TimeBlockSessionsResponse {
  sessions: TimeBlockSessionSummary[];
  count: number;
}

const SCHEDULER_API_BASE =
  process.env.NEXT_PUBLIC_SCHEDULER_API_BASE ?? "http://127.0.0.1:5000";

function SummaryContent() {
  const { user } = useAuth();
  const { exitingTo } = useNavigationTransition();
  const searchParams = useSearchParams();
  const querySessionId = searchParams.get("session_id") || undefined;

  const userId = user?.user_id ?? "";
  const [sessionId] = useState<string | undefined>(querySessionId);
  const [metrics, setMetrics] = useState<DetailedMetricsResponse | null>(null);
  const [sessions, setSessions] = useState<TimeBlockSessionSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setMetrics(null);
      setSessions([]);
      setError(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

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
          fetch(
            `${SCHEDULER_API_BASE}/api/time-block/user-sessions?user_id=${encodeURIComponent(userId)}&limit=20`,
            {
            cache: "no-store",
            }
          ),
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
        setSessions(sessionsJson?.sessions ?? []);
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

  const plannerHref = `/planner${
    metrics?.session_id
      ? `?from_session=${encodeURIComponent(metrics.session_id)}`
      : ""
  }`;

  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <div
        className={`mx-auto w-full max-w-[1800px] space-y-8 ${exitingTo ? "page-exit-right" : "page-enter-right"}`}
      >
        {/* Header */}
        <div className="rounded-[1.25rem] border border-border bg-card p-8 shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="mb-1 text-foreground">Post-session summary</h1>
              <p className="mb-4 text-sm text-muted-foreground">
                Adaptive scheduler metrics
              </p>
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">User ID: </span>
                  <span className="font-mono">{userId}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Session ID: </span>
                  <span className="font-mono">
                    {sessionId ?? metrics?.session_id ?? "—"}
                  </span>
                </div>
              </div>
            </div>
            <AnimatedLink
              href="/"
              className="btn-motion flex items-center gap-2 rounded-full border transition-opacity"
              style={{
                backgroundColor: "rgba(143, 191, 224, 0.2)",
                borderColor: "rgba(143, 191, 224, 0.4)",
                color: "#8FBFE0",
                padding: "0.55rem 1.1rem",
              }}
            >
              Open full dashboard
              <ArrowRight className="h-4 w-4" />
            </AnimatedLink>
          </div>
        </div>

        {loading && (
          <div className="text-sm text-muted-foreground">
            Loading metrics from scheduler…
          </div>
        )}

        {error && !loading && (
          <div className="rounded-[1.25rem] border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Failed to load summary from scheduler: {error}
          </div>
        )}

        {/* Research metrics */}
        {metrics && (
          <div>
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-accent" />
                <h2 className="text-foreground">Research metrics</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Key performance indicators from your session
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {metricOrder.map(({ key, label }, index) => {
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
                    className="page-enter-up rounded-[1.25rem] border border-border bg-card p-6 shadow-lg transition-colors hover:border-accent/50"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
                      {label}
                    </div>
                    <div className="font-mono text-3xl text-primary">
                      {displayValue === "N/A" ? (
                        <span className="text-muted-foreground">N/A</span>
                      ) : (
                        displayValue
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Time-block sessions */}
        <div className="rounded-[1.25rem] border border-border bg-card p-8 shadow-lg">
          <div className="mb-6">
            <h3 className="mb-1 text-foreground">
              Recent time-block sessions
            </h3>
            <p className="text-sm text-muted-foreground">
              Loaded from scheduler database for this user
            </p>
          </div>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No time-block sessions found in the scheduler database for this
              user.
            </p>
          ) : (
            <div className="space-y-3">
              {sessions.slice(0, 5).map((s) => (
                <div
                  key={s.session_id}
                  className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-4 transition-colors hover:bg-secondary/50"
                >
                  <div className="flex items-center gap-6">
                    <div>
                      <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                        Session ID
                      </div>
                      <div className="font-mono text-sm">{s.session_id}</div>
                    </div>
                    <div>
                      <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                        Start Time
                      </div>
                      <div className="font-mono text-sm">
                        {s.start_time
                          ? new Date(s.start_time).toLocaleString()
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                        Effectiveness
                      </div>
                      <div className="font-mono text-sm text-muted-foreground">
                        {s.effectiveness === null
                          ? "n/a"
                          : s.effectiveness.toFixed(3)}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span
                      className="inline-flex items-center rounded-full border border-border bg-secondary/30 px-4 py-2 text-sm text-muted-foreground"
                    >
                      {s.interval_count} intervals
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="flex justify-center">
          <AnimatedLink
            href={plannerHref}
            className="btn-motion flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-primary-foreground transition-opacity hover:opacity-90"
          >
            Plan next block
            <ArrowRight className="h-4 w-4" />
          </AnimatedLink>
        </div>
      </div>
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
