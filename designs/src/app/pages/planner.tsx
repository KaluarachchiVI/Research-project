import { useNavigate } from 'react-router';
import { ArrowLeft, Clock, TrendingUp, Calendar, BarChart } from 'lucide-react';

export function Planner() {
  const navigate = useNavigate();

  const bestTimeOfDay = [
    { time: '9:00 AM', score: 87, label: 'Morning Peak' },
    { time: '2:00 PM', score: 92, label: 'Afternoon Peak' },
    { time: '7:00 PM', score: 78, label: 'Evening Focus' },
  ];

  const armPreference = [
    { arm: 'Work 25 / Break 5', preference: 45, color: 'bg-chart-1' },
    { arm: 'Work 50 / Break 10', preference: 30, color: 'bg-chart-2' },
    { arm: 'Work 15 / Break 3', preference: 25, color: 'bg-chart-3' },
  ];

  const weeklyPattern = [
    { day: 'Mon', sessions: 8, avgLoad: 52 },
    { day: 'Tue', sessions: 10, avgLoad: 68 },
    { day: 'Wed', sessions: 6, avgLoad: 45 },
    { day: 'Thu', sessions: 9, avgLoad: 61 },
    { day: 'Fri', sessions: 7, avgLoad: 48 },
    { day: 'Sat', sessions: 4, avgLoad: 35 },
    { day: 'Sun', sessions: 3, avgLoad: 28 },
  ];

  const hourlyIntensity = [
    { hour: '6 AM', intensity: 15 },
    { hour: '9 AM', intensity: 75 },
    { hour: '12 PM', intensity: 60 },
    { hour: '3 PM', intensity: 85 },
    { hour: '6 PM', intensity: 70 },
    { hour: '9 PM', intensity: 40 },
  ];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="mb-1">Planning</h1>
              <p className="text-sm text-muted-foreground mb-2">
                Bandit-informed next study block
              </p>
              <p className="text-xs text-muted-foreground">
                Planned after session <span className="font-mono">SES-1709876543210</span>
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-6 py-3 bg-secondary border border-border rounded-full hover:bg-secondary/80 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to session
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Best Time of Day */}
          <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5 text-accent" />
              <h3>Best time of day</h3>
            </div>
            <div className="space-y-4">
              {bestTimeOfDay.map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm">{item.time}</div>
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                    </div>
                    <div className="text-2xl font-mono text-primary">{item.score}</div>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-accent h-full rounded-full transition-all"
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Arm Preference Breakdown */}
          <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-accent" />
              <h3>Arm preference breakdown</h3>
            </div>
            <div className="space-y-4">
              {armPreference.map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">{item.arm}</div>
                    <div className="text-xl font-mono text-primary">{item.preference}%</div>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                    <div
                      className={`${item.color} h-full rounded-full transition-all`}
                      style={{ width: `${item.preference}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Pattern */}
          <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg">
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="w-5 h-5 text-accent" />
              <h3>Weekly pattern</h3>
            </div>
            <div className="space-y-3">
              {weeklyPattern.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 text-sm font-medium">{item.day}</div>
                    <div className="flex-1">
                      <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-success h-full rounded-full"
                          style={{ width: `${item.avgLoad}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Sessions</div>
                      <div className="font-mono text-sm">{item.sessions}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Avg Load</div>
                      <div className="font-mono text-sm text-success">{item.avgLoad}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hour-of-day Intensity */}
          <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg">
            <div className="flex items-center gap-2 mb-6">
              <BarChart className="w-5 h-5 text-accent" />
              <h3>Hour-of-day intensity</h3>
            </div>
            <div className="space-y-3">
              {hourlyIntensity.map((item, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-16 text-sm text-muted-foreground">{item.hour}</div>
                  <div className="flex-1">
                    <div className="w-full bg-secondary rounded-full h-8 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-chart-1 to-chart-2 h-full rounded-full flex items-center justify-end pr-3 transition-all"
                        style={{ width: `${item.intensity}%` }}
                      >
                        {item.intensity > 30 && (
                          <span className="text-xs text-white font-mono">
                            {item.intensity}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {item.intensity <= 30 && (
                    <div className="w-12 text-xs font-mono text-muted-foreground text-right">
                      {item.intensity}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <button
            onClick={() => navigate('/summary')}
            className="px-8 py-4 bg-secondary border border-border rounded-full hover:bg-secondary/80 transition-colors"
          >
            View Summary
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-8 py-4 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity"
          >
            Start New Session
          </button>
        </div>
      </div>
    </div>
  );
}
