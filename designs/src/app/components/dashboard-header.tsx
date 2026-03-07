interface DashboardHeaderProps {
  sessionId: string;
  isActive: boolean;
}

export function DashboardHeader({ sessionId, isActive }: DashboardHeaderProps) {
  return (
    <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="mb-1">Adaptive Scheduler</h1>
          <p className="text-sm text-muted-foreground">
            Real-time work/break scheduling
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Session ID
            </div>
            <div className="font-mono text-sm">{sessionId}</div>
          </div>
          <div>
            <span
              className={`inline-flex items-center px-4 py-2 rounded-full text-sm ${
                isActive
                  ? 'bg-[#BAD4AA]/20 border border-[#BAD4AA]/40'
                  : 'bg-muted text-muted-foreground border border-border'
              }`}
              style={isActive ? { color: '#BAD4AA' } : {}}
            >
              {isActive ? 'Session Active' : 'Session Inactive'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}