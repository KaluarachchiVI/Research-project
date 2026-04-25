import { useState, useEffect } from 'react';
import { Play, Pause, Square } from 'lucide-react';

interface TimerCardProps {
  onEndSession: () => void;
  onEndWorkInterval: () => void;
  onGetRecommendation: () => void;
  isWorkMode: boolean;
  onToggleWorkMode: () => void;
}

export function TimerCard({
  onEndSession,
  onEndWorkInterval,
  onGetRecommendation,
  isWorkMode,
  onToggleWorkMode,
}: TimerCardProps) {
  const [time, setTime] = useState(25 * 60); // 25 minutes in seconds
  const [isPaused, setIsPaused] = useState(false);
  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);

  useEffect(() => {
    if (!isPaused) {
      const interval = setInterval(() => {
        setTime((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isPaused]);

  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  const totalSeconds = workMinutes * 60;
  const progress = ((totalSeconds - time) / totalSeconds) * 100;

  return (
    <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-6">
        Current Timer
      </div>

      {/* Large Timer Display */}
      <div className="text-center mb-8">
        <div className="relative inline-block">
          {/* Progress Ring */}
          <svg className="w-64 h-64 -rotate-90" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r="90"
              stroke="rgba(148, 163, 184, 0.1)"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="100"
              cy="100"
              r="90"
              stroke="#8FBFE0"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 90}`}
              strokeDashoffset={`${2 * Math.PI * 90 * (1 - progress / 100)}`}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          
          {/* Timer Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-7xl font-mono tracking-tight" style={{ color: '#8FBFE0' }}>
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {isWorkMode ? 'Work Session' : 'Break Time'}
            </div>
          </div>
        </div>
      </div>

      {/* Session Parameters */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wider text-muted-foreground">
            Work (min)
          </label>
          <input
            type="number"
            value={workMinutes}
            onChange={(e) => setWorkMinutes(parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-input-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
            min="1"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wider text-muted-foreground">
            Break (min)
          </label>
          <input
            type="number"
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-input-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
            min="1"
          />
        </div>
      </div>

      {/* Control Buttons */}
      <div className="space-y-3">
        {/* Primary Controls */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="flex items-center justify-center gap-2 px-4 py-3 border rounded-xl transition-all"
            style={{ 
              backgroundColor: 'rgba(226, 128, 116, 0.15)',
              borderColor: 'rgba(226, 128, 116, 0.4)',
              color: '#E28074'
            }}
          >
            {isPaused ? (
              <>
                <Play className="w-4 h-4" />
                Resume
              </>
            ) : (
              <>
                <Pause className="w-4 h-4" />
                Pause
              </>
            )}
          </button>
          <button
            onClick={onEndSession}
            className="flex items-center justify-center gap-2 px-4 py-3 border rounded-xl transition-all"
            style={{ 
              backgroundColor: 'rgba(239, 100, 97, 0.15)',
              borderColor: 'rgba(239, 100, 97, 0.4)',
              color: '#EF6461'
            }}
          >
            <Square className="w-4 h-4" />
            End Session
          </button>
        </div>

        {/* Secondary Actions */}
        <button
          onClick={onEndWorkInterval}
          className="w-full px-4 py-3 bg-secondary border border-border rounded-xl hover:bg-secondary/80 transition-colors text-foreground"
        >
          {isWorkMode ? 'End Work Interval' : 'End Break Interval'}
        </button>

        <button
          onClick={onGetRecommendation}
          className="w-full px-4 py-3 border rounded-xl transition-all"
          style={{ 
            backgroundColor: 'rgba(143, 191, 224, 0.15)',
            borderColor: 'rgba(143, 191, 224, 0.4)',
            color: '#8FBFE0'
          }}
        >
          Get Recommendation
        </button>

        <button
          onClick={onToggleWorkMode}
          className="w-full px-4 py-3 border rounded-xl transition-all"
          style={{ 
            backgroundColor: 'rgba(186, 212, 170, 0.15)',
            borderColor: 'rgba(186, 212, 170, 0.4)',
            color: '#BAD4AA'
          }}
        >
          {isWorkMode ? 'Start Session' : 'End Work'}
        </button>
      </div>
    </div>
  );
}
