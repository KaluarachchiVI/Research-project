import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/Card';
import { Badge } from '../components/Badge';

interface Milestone {
  id: string;
  title: string;
  date: string;
  status: 'completed' | 'ongoing' | 'upcoming';
  marks: string;
  description: string;
  deliverables: string[];
}

const milestones: Milestone[] = [
  {
    id: '1',
    title: 'Project Proposal',
    date: 'September 2025',
    status: 'completed',
    marks: '10%',
    description: 'Initial research proposal with problem definition, literature review, and methodology',
    deliverables: [
      'Research proposal document',
      'Literature review summary',
      'Preliminary system architecture',
      'Project timeline and Gantt chart'
    ]
  },
  {
    id: '2',
    title: 'Progress Presentation I',
    date: 'November 2025',
    status: 'completed',
    marks: '15%',
    description: 'First progress checkpoint presenting initial findings and prototype development',
    deliverables: [
      'PP1 presentation slides',
      'Cognitive load model prototype',
      'Initial dataset collection',
      'Technical feasibility report'
    ]
  },
  {
    id: '3',
    title: 'Progress Presentation II',
    date: 'February 2026',
    status: 'completed',
    marks: '15%',
    description: 'Second progress checkpoint with integrated subsystems and preliminary testing results',
    deliverables: [
      'PP2 presentation slides',
      'Integrated system prototype',
      'User testing results (pilot study)',
      'ML model performance metrics'
    ]
  },
  {
    id: '4',
    title: 'Final Report & Dissertation',
    date: 'April 2026',
    status: 'ongoing',
    marks: '40%',
    description: 'Complete thesis documentation with comprehensive evaluation and future work',
    deliverables: [
      'Final dissertation document',
      'Complete source code repository',
      'User evaluation study results',
      'System documentation and manual'
    ]
  },
  {
    id: '5',
    title: 'Final Viva Voce',
    date: 'May 2026',
    status: 'upcoming',
    marks: '20%',
    description: 'Oral examination and system demonstration before the evaluation panel',
    deliverables: [
      'Final presentation slides',
      'Live system demonstration',
      'Defense Q&A preparation',
      'Poster presentation'
    ]
  }
];

export function Milestones() {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'ongoing': return 'info';
      case 'upcoming': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <div className="w-10 h-10 bg-success rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case 'ongoing':
        return (
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 bg-slate-300 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const completedCount = milestones.filter(m => m.status === 'completed').length;
  const totalMarks = milestones.filter(m => m.status === 'completed').reduce((sum, m) => sum + parseInt(m.marks), 0);

  return (
    <div className="py-12 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-navy-900 mb-4">Project Milestones</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Track our progress through the research project timeline
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">{completedCount}/5</div>
                <div className="text-sm text-muted-foreground">Milestones Completed</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-emerald-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-success mb-2">{totalMarks}%</div>
                <div className="text-sm text-muted-foreground">Marks Achieved</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-violet-50 to-purple-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-violet-600 mb-2">Apr 2026</div>
                <div className="text-sm text-muted-foreground">Current Focus</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="relative">
          {milestones.map((milestone, index) => (
            <div key={milestone.id} className="relative pb-12 last:pb-0">
              {index < milestones.length - 1 && (
                <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-border"></div>
              )}

              <div className="flex items-start space-x-6">
                <div className="flex-shrink-0 relative z-10">
                  {getStatusIcon(milestone.status)}
                </div>

                <Card className="flex-1" hover={milestone.status === 'ongoing'}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <CardTitle className="text-xl">{milestone.title}</CardTitle>
                          <Badge variant={getStatusColor(milestone.status) as any}>
                            {milestone.status.charAt(0).toUpperCase() + milestone.status.slice(1)}
                          </Badge>
                        </div>
                        <CardDescription>{milestone.description}</CardDescription>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-medium text-foreground">{milestone.date}</div>
                        <div className="text-xs text-muted-foreground mt-1">Weight: {milestone.marks}</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <h4 className="font-medium text-sm mb-3 text-foreground">Deliverables:</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {milestone.deliverables.map((deliverable, idx) => (
                        <div key={idx} className="flex items-start space-x-2">
                          <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-foreground">{deliverable}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ))}
        </div>

        <Card className="mt-12 bg-gradient-to-br from-navy-900 to-navy-800 text-white">
          <CardContent className="py-8">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-3">Timeline Overview</h3>
              <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
                The project follows a structured timeline from September 2025 to May 2026, with regular evaluation checkpoints to ensure quality and progress.
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-success rounded-full"></div>
                  <span className="text-slate-300">Completed</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-slate-300">Ongoing</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-slate-400 rounded-full"></div>
                  <span className="text-slate-300">Upcoming</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
