"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../../lib/authContext";
import { useNavigationTransition } from "../../lib/navigationTransitionContext";
import { AnimatedLink } from "../../components/AnimatedLink";

const YUVIDU_PLANNER_URL =
  process.env.NEXT_PUBLIC_YUVIDU_PLANNER_URL ?? "http://localhost:5123";

function PlannerContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { exitingTo } = useNavigationTransition();
  const fromSessionId = searchParams.get("from_session") || undefined;

  const base = YUVIDU_PLANNER_URL.replace(/\/$/, "");
  const params = new URLSearchParams();
  if (user?.user_id) params.set("user_id", user.user_id);
  if (fromSessionId) params.set("from_session", fromSessionId);
  const plannerSrc = params.toString() ? `${base}/?${params.toString()}` : `${base}/`;

  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <div
        className={`mx-auto w-full max-w-[1800px] space-y-8 ${exitingTo ? "page-exit-right" : "page-enter-right"}`}
      >
        {/* Header */}
        <div className="rounded-[1.25rem] border border-border bg-card p-8 shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="mb-1 text-foreground">Planning</h1>
              <p className="mb-2 text-sm text-muted-foreground">
                Bandit-informed next study block
              </p>
              {fromSessionId && (
                <p className="text-xs text-muted-foreground">
                  Planned after session{" "}
                  <span className="font-mono">{fromSessionId}</span>
                </p>
              )}
            </div>
            <AnimatedLink
              href="/"
              className="btn-motion flex items-center gap-2 rounded-full border border-border bg-secondary px-6 py-3 text-foreground transition-colors hover:bg-secondary/80"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to session
            </AnimatedLink>
          </div>
        </div>

        {/* Yuvidu iframe only */}
        <section className="rounded-[1.25rem] border border-border bg-card p-8 shadow-lg">
          <h3 className="mb-2 text-xl font-semibold text-foreground">
            Yuvidu planner
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            This view embeds the Yuvidu planner so you can explore
            bandit-informed study windows without leaving the Intent-Lock
            dashboard.
          </p>
          <div className="overflow-hidden rounded-2xl border border-border bg-background">
            <iframe
              src={plannerSrc}
              title="Yuvidu planner"
              className="h-[900px] w-full border-0"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

export default function PlannerPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-muted-foreground">
          Loading planner…
        </div>
      }
    >
      <PlannerContent />
    </Suspense>
  );
}
