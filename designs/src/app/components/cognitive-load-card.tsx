import { Activity, TrendingUp } from 'lucide-react';

interface CognitiveLoadCardProps {
  load: number;
  status: 'online' | 'warming' | 'offline';
  onSimulateActivity: () => void;
}

export function CognitiveLoadCard({
  load,
  status,
  onSimulateActivity,
}: CognitiveLoadCardProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return '#BAD4AA';
      case 'warming':
        return '#f59e0b';
      case 'offline':
        return '#94a3b8';
    }
  };

  const getStatusBadge = () => {
    const color = getStatusColor();
    return {
      backgroundColor: `${color}20`,
      borderColor: `${color}40`,
      color: color,
    };
  };

  return (
    <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-6">
        Cognitive Load (Praboth Real-time)
      </div>

      {/* Load Display with Circular Progress */}
      <div className="flex items-center justify-center mb-8">
        <div className="relative inline-block">
          {/* Background Circle */}
          <svg className="w-48 h-48 -rotate-90" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r="85"
              stroke="rgba(148, 163, 184, 0.1)"
              strokeWidth="12"
              fill="none"
            />
            {/* Progress Circle */}
            <circle
              cx="100"
              cy="100"
              r="85"
              stroke="#D0FFD6"
              strokeWidth="12"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 85}`}
              strokeDashoffset={`${2 * Math.PI * 85 * (1 - load / 100)}`}
              strokeLinecap="round"
              className="transition-all duration-500"
              style={{ 
                filter: 'drop-shadow(0 0 8px rgba(208, 255, 214, 0.4))'
              }}
            />
          </svg>
          
          {/* Percentage Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-6xl font-mono" style={{ color: '#D0FFD6' }}>
              {load}
            </div>
            <div className="text-3xl font-mono" style={{ color: '#D0FFD6' }}>
              %
            </div>
          </div>
        </div>
      </div>

      {/* Status Info */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5" style={{ color: getStatusColor() }} />
            <div>
              <div className="text-xs text-muted-foreground mb-1">System Status</div>
              <div className="text-sm" style={{ color: getStatusColor() }}>
                {status === 'online' && 'Real-time monitoring active'}
                {status === 'warming' && 'System warming up...'}
                {status === 'offline' && 'Monitoring offline'}
              </div>
            </div>
          </div>
          <div
            className="inline-flex items-center px-3 py-1.5 rounded-full text-xs border uppercase tracking-wider"
            style={getStatusBadge()}
          >
            CLE {status}
          </div>
        </div>

        {/* Load Indicator Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Load Level</span>
            <span>{load < 30 ? 'Low' : load < 70 ? 'Moderate' : 'High'}</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${load}%`,
                backgroundColor: '#D0FFD6',
                boxShadow: '0 0 10px rgba(208, 255, 214, 0.5)'
              }}
            />
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={onSimulateActivity}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 border rounded-xl transition-all"
        style={{ 
          backgroundColor: 'rgba(208, 255, 214, 0.1)',
          borderColor: 'rgba(208, 255, 214, 0.3)',
          color: '#D0FFD6'
        }}
      >
        <TrendingUp className="w-4 h-4" />
        Simulate activity
      </button>
    </div>
  );
}
