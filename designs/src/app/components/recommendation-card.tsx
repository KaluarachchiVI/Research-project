import { Lightbulb } from 'lucide-react';

interface RecommendationCardProps {
  workMinutes: number;
  breakMinutes: number;
  decision: string;
}

export function RecommendationCard({
  workMinutes,
  breakMinutes,
  decision,
}: RecommendationCardProps) {
  return (
    <div className="bg-card border border-border rounded-[1.25rem] p-8 shadow-lg h-full">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
          Current Recommendation
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="border rounded-xl p-4" style={{ 
            backgroundColor: 'rgba(143, 191, 224, 0.1)',
            borderColor: 'rgba(143, 191, 224, 0.3)'
          }}>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Work (min)
            </div>
            <div className="text-3xl font-mono" style={{ color: '#8FBFE0' }}>{workMinutes}</div>
          </div>
          <div className="border rounded-xl p-4" style={{ 
            backgroundColor: 'rgba(186, 212, 170, 0.1)',
            borderColor: 'rgba(186, 212, 170, 0.3)'
          }}>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Break (min)
            </div>
            <div className="text-3xl font-mono" style={{ color: '#BAD4AA' }}>{breakMinutes}</div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-4 h-4" style={{ color: '#8FBFE0' }} />
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Scheduler Decision
          </div>
        </div>
        <p className="text-sm text-foreground leading-relaxed">{decision}</p>
      </div>
    </div>
  );
}