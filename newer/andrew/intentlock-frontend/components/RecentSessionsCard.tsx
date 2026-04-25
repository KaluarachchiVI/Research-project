"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";

const SCHEDULER_API_BASE =
  process.env.NEXT_PUBLIC_SCHEDULER_API_BASE ?? "http://127.0.0.1:5000";

interface SessionWithReward {
  session_id: string;
  user_id: string;
  start_time: string | null;
  end_time: string | null;
  effectiveness: number | null;
  interval_count: number;
}

interface Props {
  userId: string;
  token: string | null;
  /** When true, render content only (no card wrapper) for use inside a combined card */
  embedded?: boolean;
}

export function RecentSessionsCard({ userId, token, embedded }: Props) {
  const [sessions, setSessions] = useState<SessionWithReward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch(
      `${SCHEDULER_API_BASE}/api/time-block/user-sessions?user_id=${encodeURIComponent(userId)}&limit=20`,
      { cache: "no-store", headers }
    )
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((data) => {
        setSessions(data.sessions ?? []);
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [userId, token]);

  if (loading || sessions.length === 0) return null;

  const content = (
    <>
      <div className={`flex items-center gap-2 ${embedded ? "mb-3" : "mb-4"}`}>
        <BarChart3 className="h-5 w-5 text-[var(--timer-active)]" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Recent session effectiveness
        </span>
      </div>
      <div
        className="recent-session-list max-h-[220px] overflow-y-auto overflow-x-hidden pr-1 scroll-smooth"
        role="list"
      >
        <ul className="space-y-2">
          {sessions.map((s, index) => (
            <li
              key={s.session_id}
              className="recent-session-item flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm transition-colors duration-200 hover:border-[rgba(143,191,224,0.35)] hover:bg-secondary/40"
              style={{ animationDelay: `${index * 45}ms` }}
            >
              <span className="font-mono text-muted-foreground truncate max-w-[180px]">
                {s.session_id.slice(0, 24)}…
              </span>
              <span className="font-mono tabular-nums shrink-0 text-[var(--timer-active)]">
                {s.effectiveness != null ? s.effectiveness.toFixed(2) : "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );

  if (embedded) return <div className="border-t border-border pt-6">{content}</div>;

  return (
    <div className="bg-card border border-border rounded-[1.25rem] p-6 shadow-lg">
      {content}
    </div>
  );
}
