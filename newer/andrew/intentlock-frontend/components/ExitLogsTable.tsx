"use client";

import { AlertCircle, CheckCircle } from "lucide-react";

export interface ExitLogRow {
  timestamp: string;
  prediction: string;
  frictionLevel: number;
  sessionMinutes: number;
  latentMean: number;
}

interface ExitLogsTableProps {
  logs: ExitLogRow[];
}

function formatLogTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString();
  } catch {
    return iso;
  }
}

function deriveType(log: ExitLogRow): "IMPULSIVE" | "GENUINE" {
  const p = String(log.prediction || "").toLowerCase();
  if (p.includes("impulsive")) return "IMPULSIVE";
  return "GENUINE";
}

export function ExitLogsTable({ logs }: ExitLogsTableProps) {
  return (
    <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg">
      <div className="mb-6">
        <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
          Research Metrics
        </div>
        <h3 className="text-foreground">Exit Logs</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">
                Timestamp
              </th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">
                Friction
              </th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">
                Session (min)
              </th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">
                Load %
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  No exit logs recorded yet
                </td>
              </tr>
            ) : (
              logs.map((log, index) => {
                const type = deriveType(log);
                const loadPct = Math.round((log.latentMean ?? 0) * 100);
                return (
                  <tr
                    key={`${log.timestamp}-${index}`}
                    className="border-b border-border/50 hover:bg-secondary/20"
                  >
                    <td className="px-4 py-3 font-mono text-sm text-foreground">
                      {formatLogTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {type === "IMPULSIVE" ? (
                          <>
                            <AlertCircle className="h-4 w-4 text-destructive" />
                            <span className="font-mono text-sm text-destructive">
                              IMPULSIVE
                            </span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 text-[var(--session-active)]" />
                            <span className="font-mono text-sm text-[var(--session-active)]">
                              GENUINE
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-foreground">
                      {log.frictionLevel}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-foreground">
                      {log.sessionMinutes}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-[var(--cognitive-load)]">
                      {loadPct}%
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
