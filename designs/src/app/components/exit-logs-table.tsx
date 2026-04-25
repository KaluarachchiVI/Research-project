import { AlertCircle, CheckCircle } from 'lucide-react';

export interface ExitLog {
  id: string;
  timestamp: string;
  type: 'IMPULSIVE' | 'GENUINE';
  friction: number;
  sessionMinutes: number;
  loadPercent: number;
}

interface ExitLogsTableProps {
  logs: ExitLog[];
}

export function ExitLogsTable({ logs }: ExitLogsTableProps) {
  return (
    <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Research Metrics
        </div>
        <h3>Exit Logs</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground">
                Timestamp
              </th>
              <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground">
                Type
              </th>
              <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground">
                Friction
              </th>
              <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground">
                Session (min)
              </th>
              <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground">
                Load %
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted-foreground">
                  No exit logs recorded yet
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-secondary/20">
                  <td className="py-3 px-4 font-mono text-sm">{log.timestamp}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {log.type === 'IMPULSIVE' ? (
                        <>
                          <AlertCircle className="w-4 h-4" style={{ color: '#EF6461' }} />
                          <span className="text-sm font-mono" style={{ color: '#EF6461' }}>
                            IMPULSIVE
                          </span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" style={{ color: '#BAD4AA' }} />
                          <span className="text-sm font-mono" style={{ color: '#BAD4AA' }}>GENUINE</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-sm">{log.friction}</td>
                  <td className="py-3 px-4 font-mono text-sm">{log.sessionMinutes}</td>
                  <td className="py-3 px-4 font-mono text-sm" style={{ color: '#D0FFD6' }}>{log.loadPercent}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}