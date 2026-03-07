import { useState } from 'react';
import { useNavigate } from 'react-router';
import { BarChart3, Calendar } from 'lucide-react';
import { SessionConfig } from '../components/session-config';
import { DashboardHeader } from '../components/dashboard-header';
import { TimerCard } from '../components/timer-card';
import { CognitiveLoadCard } from '../components/cognitive-load-card';
import { RecommendationCard } from '../components/recommendation-card';
import { SessionMetricsCard } from '../components/session-metrics-card';
import { ExitLogsTable, ExitLog } from '../components/exit-logs-table';
import { IntentLockModal } from '../components/intent-lock-modal';

export function Home() {
  const navigate = useNavigate();
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionId] = useState(`SES-${Date.now()}`);
  const [isActive, setIsActive] = useState(true);
  const [cognitiveLoad, setCognitiveLoad] = useState(42);
  const [cleStatus, setCleStatus] = useState<'online' | 'warming' | 'offline'>('online');
  const [isWorkMode, setIsWorkMode] = useState(true);
  const [showIntentLock, setShowIntentLock] = useState(false);
  const [frictionLevel, setFrictionLevel] = useState<0 | 1 | 2>(0);
  const [exitLogs, setExitLogs] = useState<ExitLog[]>([]);
  const [sessionMetrics, setSessionMetrics] = useState({
    reward: 0.87,
    algorithm: 'Thompson Sampling',
    epoch: 42,
    predictionCount: 156,
  });

  const handleStartSession = (config: any) => {
    setSessionStarted(true);
    setIsActive(true);
    setSessionMetrics({
      ...sessionMetrics,
      algorithm: config.algorithm === 'thompson' ? 'Thompson Sampling' : 
                 config.algorithm === 'ucb' ? 'UCB' : 'Epsilon-Greedy',
    });
  };

  const handleEndSession = () => {
    // Randomly decide if exit is impulsive
    const isImpulsive = Math.random() > 0.5;
    if (isImpulsive) {
      // Randomly assign friction level
      setFrictionLevel(Math.floor(Math.random() * 3) as 0 | 1 | 2);
      setShowIntentLock(true);
    } else {
      confirmEndSession('GENUINE');
    }
  };

  const confirmEndSession = (type: 'IMPULSIVE' | 'GENUINE', reason?: string) => {
    setIsActive(false);
    setShowIntentLock(false);
    
    // Add exit log
    const newLog: ExitLog = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      type,
      friction: type === 'IMPULSIVE' ? frictionLevel : 0,
      sessionMinutes: 23,
      loadPercent: cognitiveLoad,
    };
    setExitLogs([newLog, ...exitLogs]);
  };

  const handleSimulateActivity = () => {
    setCognitiveLoad(Math.floor(Math.random() * 100));
    setSessionMetrics({
      ...sessionMetrics,
      predictionCount: sessionMetrics.predictionCount + 1,
      epoch: sessionMetrics.epoch + 1,
      reward: parseFloat((Math.random() * 1).toFixed(2)),
    });
  };

  const handleGetRecommendation = () => {
    setSessionMetrics({
      ...sessionMetrics,
      predictionCount: sessionMetrics.predictionCount + 1,
    });
  };

  if (!sessionStarted) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="mb-2">IntentLock | Adaptive Scheduler</h1>
            <p className="text-muted-foreground">
              Real-time work/break scheduling with IntentLock
            </p>
          </div>
          <SessionConfig onStartSession={handleStartSession} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Quick Actions */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <DashboardHeader sessionId={sessionId} isActive={isActive} />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/summary')}
              className="flex items-center gap-2 px-4 py-3 bg-secondary border border-border rounded-xl hover:bg-secondary/80 transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Summary</span>
            </button>
            <button
              onClick={() => navigate('/planner')}
              className="flex items-center gap-2 px-4 py-3 bg-secondary border border-border rounded-xl hover:bg-secondary/80 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Planner</span>
            </button>
          </div>
        </div>

        {/* Main Content - Reorganized for better UX */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Primary Focus: Timer & Load */}
          <div className="xl:col-span-2 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TimerCard
                onEndSession={handleEndSession}
                onEndWorkInterval={() => setIsWorkMode(!isWorkMode)}
                onGetRecommendation={handleGetRecommendation}
                isWorkMode={isWorkMode}
                onToggleWorkMode={() => setIsWorkMode(!isWorkMode)}
              />

              <CognitiveLoadCard
                load={cognitiveLoad}
                status={cleStatus}
                onSimulateActivity={handleSimulateActivity}
              />
            </div>

            {/* Exit Logs - Full Width Below */}
            <ExitLogsTable logs={exitLogs} />
          </div>

          {/* Right Column - Secondary Info: Metrics & Recommendations */}
          <div className="space-y-6">
            <RecommendationCard
              workMinutes={25}
              breakMinutes={5}
              decision="Based on current cognitive load (42%) and time of day analysis, the scheduler recommends a standard 25-minute work block followed by a 5-minute break to maintain optimal performance."
            />

            <SessionMetricsCard
              reward={sessionMetrics.reward}
              algorithm={sessionMetrics.algorithm}
              epoch={sessionMetrics.epoch}
              predictionCount={sessionMetrics.predictionCount}
            />
          </div>
        </div>
      </div>

      <IntentLockModal
        isOpen={showIntentLock}
        frictionLevel={frictionLevel}
        onContinue={() => setShowIntentLock(false)}
        onExit={(reason) => confirmEndSession('IMPULSIVE', reason)}
      />
    </div>
  );
}
