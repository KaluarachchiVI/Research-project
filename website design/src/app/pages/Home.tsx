import { Link } from 'react-router';
import { Button } from '../components/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/Card';

export function Home() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy-900 via-navy-800 to-slate-800 text-white py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-sm mb-6">
              <span className="w-2 h-2 bg-cyan-400 rounded-full mr-2 animate-pulse"></span>
              SLIIT Research Project 25-26J-458
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Adaptive Cognitive-Load Study Timer
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 mb-8 leading-relaxed">
              Personalized break scheduling powered by real-time cognitive load estimation, chronotype analysis, and adaptive AI algorithms to optimize your study performance.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/domain">
                <Button variant="primary" size="lg">
                  Explore Research
                </Button>
              </Link>
              <Link to="/documents">
                <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10">
                  View Documentation
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-navy-900 mb-3">Integrated Subsystems</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Four intelligent components working together to personalize your study experience
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card hover>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <CardHeader>
                <CardTitle>Cognitive Load Estimator</CardTitle>
                <CardDescription>
                  Real-time assessment using eye-tracking, task complexity, and performance metrics
                </CardDescription>
              </CardHeader>
            </Card>

            <Card hover>
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <CardHeader>
                <CardTitle>Adaptive Break Scheduler</CardTitle>
                <CardDescription>
                  Dynamic scheduling adjusts to your cognitive state and learning patterns
                </CardDescription>
              </CardHeader>
            </Card>

            <Card hover>
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </div>
              <CardHeader>
                <CardTitle>Chronotype Recommender</CardTitle>
                <CardDescription>
                  Personalized study time recommendations based on your circadian rhythm
                </CardDescription>
              </CardHeader>
            </Card>

            <Card hover>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <CardHeader>
                <CardTitle>Intent-Lock Overlay</CardTitle>
                <CardDescription>
                  Commitment mechanism to ensure break compliance and prevent procrastination
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-navy-900 mb-6">Research Abstract</h2>
              <div className="space-y-4 text-foreground">
                <p>
                  Current study timer applications fail to account for individual cognitive states, leading to suboptimal break scheduling and reduced productivity. Students often experience mental fatigue without realizing they need rest, or take breaks when they're still at peak performance.
                </p>
                <p>
                  Our research addresses this gap by developing an intelligent study timer that estimates cognitive load in real-time using multimodal indicators including eye-tracking data, task complexity analysis, and performance patterns. The system dynamically adjusts break intervals based on the user's current mental state.
                </p>
                <p>
                  By integrating chronotype analysis and intent-lock mechanisms, we ensure that break recommendations are both scientifically grounded and practically enforceable, leading to sustainable study habits and improved learning outcomes.
                </p>
              </div>
              <Link to="/domain" className="inline-block mt-6">
                <Button variant="primary">
                  Learn More About Our Research
                </Button>
              </Link>
            </div>

            <Card className="bg-gradient-to-br from-slate-50 to-blue-50">
              <CardHeader>
                <CardTitle className="text-2xl">System Architecture</CardTitle>
                <CardDescription>Data flow and component interaction</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-blue-200">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">1</div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">Data Collection</div>
                      <div className="text-xs text-muted-foreground">Eye-tracking, task metrics, user input</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="w-px h-6 bg-border"></div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-cyan-200">
                    <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center text-white text-sm font-bold">2</div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">Cognitive Load Analysis</div>
                      <div className="text-xs text-muted-foreground">ML model processes indicators</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="w-px h-6 bg-border"></div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-violet-200">
                    <div className="w-8 h-8 bg-violet-500 rounded-full flex items-center justify-center text-white text-sm font-bold">3</div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">Adaptive Scheduling</div>
                      <div className="text-xs text-muted-foreground">Break recommendation engine</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="w-px h-6 bg-border"></div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-blue-200">
                    <div className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center text-white text-sm font-bold">4</div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">User Interface & Enforcement</div>
                      <div className="text-xs text-muted-foreground">Intent-lock and notifications</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-br from-blue-600 to-cyan-500 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to explore our research?</h2>
          <p className="text-lg text-blue-50 mb-8 max-w-2xl mx-auto">
            Discover the methodology, milestones, and documentation behind this innovative project
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/milestones">
              <Button variant="secondary" size="lg">
                View Milestones
              </Button>
            </Link>
            <Link to="/about">
              <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10">
                Meet the Team
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
