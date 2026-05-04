import { useState } from 'react';

interface SessionConfigProps {
  onStartSession: (config: SessionConfig) => void;
}

export interface SessionConfig {
  userId: string;
  taskType: string;
  chronotype: string;
  algorithm: string;
  blockLength: number;
}

export function SessionConfig({ onStartSession }: SessionConfigProps) {
  const [config, setConfig] = useState<SessionConfig>({
    userId: '',
    taskType: 'focus',
    chronotype: 'evening',
    algorithm: 'thompson',
    blockLength: 25,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartSession(config);
  };

  return (
    <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg">
      <div className="mb-6">
        <h2 className="mb-2">Session configuration</h2>
        <p className="text-sm text-muted-foreground">
          Configure your time-block session parameters and start monitoring
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block uppercase tracking-wider text-xs text-muted-foreground">
              User ID
            </label>
            <input
              type="text"
              value={config.userId}
              onChange={(e) => setConfig({ ...config, userId: e.target.value })}
              className="w-full px-4 py-3 bg-input-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
              placeholder="Enter user ID"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block uppercase tracking-wider text-xs text-muted-foreground">
              Task Type
            </label>
            <select
              value={config.taskType}
              onChange={(e) => setConfig({ ...config, taskType: e.target.value })}
              className="w-full px-4 py-3 bg-input-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
            >
              <option value="focus">Focus Work</option>
              <option value="creative">Creative Work</option>
              <option value="learning">Learning</option>
              <option value="review">Review</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block uppercase tracking-wider text-xs text-muted-foreground">
              Chronotype
            </label>
            <select
              value={config.chronotype}
              onChange={(e) => setConfig({ ...config, chronotype: e.target.value })}
              className="w-full px-4 py-3 bg-input-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
            >
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
              <option value="intermediate">Intermediate</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block uppercase tracking-wider text-xs text-muted-foreground">
              Algorithm
            </label>
            <select
              value={config.algorithm}
              onChange={(e) => setConfig({ ...config, algorithm: e.target.value })}
              className="w-full px-4 py-3 bg-input-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
            >
              <option value="thompson">Thompson Sampling</option>
              <option value="ucb">UCB</option>
              <option value="epsilon">Epsilon-Greedy</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block uppercase tracking-wider text-xs text-muted-foreground">
              Block Length (min)
            </label>
            <input
              type="number"
              value={config.blockLength}
              onChange={(e) => setConfig({ ...config, blockLength: parseInt(e.target.value) })}
              className="w-full px-4 py-3 bg-input-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
              min="5"
              max="120"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full px-8 py-4 rounded-full transition-opacity border"
          style={{ 
            backgroundColor: 'rgba(143, 191, 224, 0.2)',
            borderColor: 'rgba(143, 191, 224, 0.4)',
            color: '#8FBFE0'
          }}
        >
          Start Time Block Session
        </button>
      </form>
    </div>
  );
}