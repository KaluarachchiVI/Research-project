import { BarChart3 } from 'lucide-react';

interface SessionMetricsCardProps {
  reward: number;
  algorithm: string;
  epoch: number;
  predictionCount: number;
}

export function SessionMetricsCard({
  reward,
  algorithm,
  epoch,
  predictionCount,
}: SessionMetricsCardProps) {
  return (
    <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg h-full">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5" style={{ color: '#8FBFE0' }} />
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Session Metrics
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center py-3 border-b border-border">
          <span className="text-sm text-muted-foreground">Reward</span>
          <span className="font-mono" style={{ color: '#8FBFE0' }}>{reward.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center py-3 border-b border-border">
          <span className="text-sm text-muted-foreground">Algorithm</span>
          <span className="font-mono text-foreground">{algorithm}</span>
        </div>
        <div className="flex justify-between items-center py-3 border-b border-border">
          <span className="text-sm text-muted-foreground">Epoch</span>
          <span className="font-mono text-foreground">{epoch}</span>
        </div>
        <div className="flex justify-between items-center py-3">
          <span className="text-sm text-muted-foreground">Prediction Count</span>
          <span className="font-mono text-foreground">{predictionCount}</span>
        </div>
      </div>
    </div>
  );
}