import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';

interface Presentation {
  id: string;
  title: string;
  date: string;
  event: string;
  presenter: string;
  duration: string;
  slides: number;
  description: string;
  status: 'completed' | 'upcoming';
}

const presentations: Presentation[] = [
  {
    id: '1',
    title: 'Project Proposal Presentation',
    date: 'September 20, 2025',
    event: 'Proposal Defense',
    presenter: 'Full Team',
    duration: '20 min',
    slides: 18,
    description: 'Initial pitch presenting the research problem, objectives, methodology, and expected outcomes to the evaluation panel.',
    status: 'completed'
  },
  {
    id: '2',
    title: 'Progress Presentation I',
    date: 'November 12, 2025',
    event: 'PP1 Checkpoint',
    presenter: 'IT21158704 & IT21158710',
    duration: '25 min',
    slides: 32,
    description: 'First progress checkpoint showcasing the cognitive load estimation prototype, initial dataset, and technical architecture.',
    status: 'completed'
  },
  {
    id: '3',
    title: 'Progress Presentation II',
    date: 'February 15, 2026',
    event: 'PP2 Checkpoint',
    presenter: 'IT21158725 & IT21158735',
    duration: '30 min',
    slides: 42,
    description: 'Second progress update with integrated subsystems demonstration, user testing results, and ML model performance metrics.',
    status: 'completed'
  },
  {
    id: '4',
    title: 'Final Project Presentation',
    date: 'May 8, 2026',
    event: 'Viva Voce',
    presenter: 'Full Team',
    duration: '35 min',
    slides: 48,
    description: 'Comprehensive final presentation with complete system demonstration, evaluation results, and future research directions.',
    status: 'upcoming'
  }
];

export function Presentations() {
  return (
    <div className="py-12 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-navy-900 mb-4">Presentations</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            View all project presentations and defense materials
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {presentations.map((presentation, index) => (
            <Card key={presentation.id} hover className="flex flex-col">
              <div className="h-48 bg-gradient-to-br from-navy-900 via-navy-800 to-slate-800 rounded-t-xl flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                  <div className="grid grid-cols-8 gap-2 p-4">
                    {[...Array(40)].map((_, i) => (
                      <div key={i} className="bg-white h-8 rounded"></div>
                    ))}
                  </div>
                </div>
                <div className="relative z-10 text-center text-white">
                  <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4 mx-auto">
                    <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="text-sm font-medium">{presentation.slides} Slides</div>
                </div>
                <div className="absolute top-4 right-4">
                  <Badge variant={presentation.status === 'completed' ? 'success' : 'info'}>
                    {presentation.status === 'completed' ? 'Completed' : 'Upcoming'}
                  </Badge>
                </div>
              </div>

              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                        {index + 1}
                      </div>
                      <CardTitle>{presentation.title}</CardTitle>
                    </div>
                    <CardDescription>{presentation.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1">
                <div className="space-y-3">
                  <div className="flex items-center text-sm">
                    <svg className="w-4 h-4 mr-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-foreground">{presentation.date}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <svg className="w-4 h-4 mr-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-foreground">{presentation.event}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <svg className="w-4 h-4 mr-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-foreground">{presentation.presenter}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <svg className="w-4 h-4 mr-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-foreground">{presentation.duration}</span>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button variant="primary" size="sm" className="flex-1">
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View Slides
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-gradient-to-br from-navy-900 to-navy-800 text-white">
          <CardContent className="py-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-3">Presentation Guidelines</h3>
              <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
                All presentations follow SLIIT research guidelines with clear structure, technical depth, and visual clarity.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                  <div className="font-bold text-blue-400 mb-2">Structure</div>
                  <div className="text-sm text-slate-300">Intro, Methods, Results, Conclusion</div>
                </div>
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                  <div className="font-bold text-cyan-400 mb-2">Visuals</div>
                  <div className="text-sm text-slate-300">Diagrams, charts, and demos</div>
                </div>
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                  <div className="font-bold text-violet-400 mb-2">Q&A</div>
                  <div className="text-sm text-slate-300">Interactive defense session</div>
                </div>
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                  <div className="font-bold text-blue-300 mb-2">Time Limit</div>
                  <div className="text-sm text-slate-300">20-35 minutes + questions</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
