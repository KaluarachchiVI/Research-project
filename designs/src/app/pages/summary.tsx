import { useNavigate } from 'react-router';
import { BarChart3, ArrowRight } from 'lucide-react';

interface TimeBlockSession {
  id: string;
  startTime: string;
  cognitiveLoad: number;
  status: 'Active' | 'Paused';
}

export function Summary() {
  const navigate = useNavigate();

  const metrics = [
    { label: 'PG (Productivity Gain)', value: '0.87' },
    { label: 'RPH (Reward Per Hour)', value: '12.4' },
    { label: 'AHL (Average Hour Load)', value: '47.3%' },
    { label: 'EOI (Exit Opportunity Index)', value: '0.62' },
    { label: 'AUC-BUC (Area Under Curve)', value: '0.91' },
    { label: 'CTU (Cumulative Time Units)', value: '156' },
    { label: 'SPF Variance', value: '0.23' },
    { label: 'SVR (Session-to-Variance Ratio)', value: '4.12' },
  ];

  const sessions: TimeBlockSession[] = [
    { id: 'SES-1709876543210', startTime: '14:23:45', cognitiveLoad: 42, status: 'Active' },
    { id: 'SES-1709873211089', startTime: '13:15:22', cognitiveLoad: 68, status: 'Paused' },
    { id: 'SES-1709869834567', startTime: '12:05:11', cognitiveLoad: 35, status: 'Paused' },
  ];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="mb-1">Post-session summary</h1>
              <p className="text-sm text-muted-foreground mb-4">
                Adaptive scheduler metrics
              </p>
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">User ID: </span>
                  <span className="font-mono">USR-12345</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Session ID: </span>
                  <span className="font-mono">SES-1709876543210</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-6 py-3 rounded-full transition-opacity border"
              style={{ 
                backgroundColor: 'rgba(143, 191, 224, 0.2)',
                borderColor: 'rgba(143, 191, 224, 0.4)',
                color: '#8FBFE0'
              }}
            >
              Open full dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Research Metrics Grid */}
        <div>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-accent" />
              <h2>Research metrics</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Key performance indicators from your session
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((metric, index) => (
              <div
                key={index}
                className="bg-card border border-border rounded-[1.25rem] p-6 shadow-lg hover:border-accent/50 transition-colors"
              >
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                  {metric.label}
                </div>
                <div className="text-3xl font-mono text-primary">
                  {metric.value === 'N/A' ? (
                    <span className="text-muted-foreground">N/A</span>
                  ) : (
                    metric.value
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Time-block Sessions */}
        <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg">
          <div className="mb-6">
            <h3 className="mb-1">Time-block sessions (current run)</h3>
            <p className="text-sm text-muted-foreground">
              All sessions from the current study run
            </p>
          </div>

          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 bg-secondary/30 border border-border rounded-xl hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      Session ID
                    </div>
                    <div className="font-mono text-sm">{session.id}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      Start Time
                    </div>
                    <div className="font-mono text-sm">{session.startTime}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      Cognitive Load
                    </div>
                    <div className="font-mono text-sm text-accent">
                      {session.cognitiveLoad}%
                    </div>
                  </div>
                </div>
                <div>
                  <span
                    className={`inline-flex items-center px-4 py-2 rounded-full text-sm ${
                      session.status === 'Active'
                        ? 'bg-success/20 text-success border border-success/30'
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}
                  >
                    {session.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="flex justify-center">
          <button
            onClick={() => navigate('/planner')}
            className="flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity"
          >
            Plan next block
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}