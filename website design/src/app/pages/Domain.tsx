import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/Card';
import { Badge } from '../components/Badge';

export function Domain() {
  return (
    <div className="py-12 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-navy-900 mb-4">Research Domain</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Exploring the intersection of cognitive science, machine learning, and productivity tools
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-2xl">Problem Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-foreground">
                <p>
                  Modern students face significant challenges in managing their study sessions effectively. Traditional timer applications like Pomodoro use fixed intervals (e.g., 25 minutes work, 5 minutes break) that ignore individual differences in cognitive capacity, task difficulty, and mental state.
                </p>
                <p>
                  This one-size-fits-all approach leads to several critical issues:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Students may push through mental fatigue when they need rest, reducing retention</li>
                  <li>Unnecessary breaks interrupt flow states when users are performing optimally</li>
                  <li>Ignoring circadian rhythms results in ineffective study scheduling</li>
                  <li>Lack of enforcement mechanisms allows users to ignore beneficial break recommendations</li>
                </ul>
                <p>
                  These limitations result in decreased learning efficiency, increased mental exhaustion, and suboptimal academic performance.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50">
            <CardHeader>
              <CardTitle className="text-xl">Research Impact</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-sm mb-1">Enhanced Learning</div>
                    <div className="text-xs text-muted-foreground">Improved retention through optimized break timing</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-sm mb-1">Reduced Burnout</div>
                    <div className="text-xs text-muted-foreground">Preventing mental fatigue with adaptive rest</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-violet-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-sm mb-1">Personalization</div>
                    <div className="text-xs text-muted-foreground">Tailored to individual rhythms and capacity</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="text-2xl">Research Gap</CardTitle>
            <CardDescription>What existing solutions are missing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-navy-900 mb-3">Current Limitations</h4>
                <ul className="space-y-2">
                  <li className="flex items-start space-x-2">
                    <span className="text-error mt-1">✗</span>
                    <span className="text-sm">No real-time cognitive load assessment</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-error mt-1">✗</span>
                    <span className="text-sm">Fixed break intervals regardless of individual needs</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-error mt-1">✗</span>
                    <span className="text-sm">Ignores circadian rhythm variations</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-error mt-1">✗</span>
                    <span className="text-sm">Weak enforcement of recommended breaks</span>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-navy-900 mb-3">Our Innovation</h4>
                <ul className="space-y-2">
                  <li className="flex items-start space-x-2">
                    <span className="text-success mt-1">✓</span>
                    <span className="text-sm">Multimodal cognitive load estimation</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-success mt-1">✓</span>
                    <span className="text-sm">Dynamic, adaptive break scheduling</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-success mt-1">✓</span>
                    <span className="text-sm">Chronotype-aware time recommendations</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-success mt-1">✓</span>
                    <span className="text-sm">Intent-lock commitment mechanism</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="text-2xl">Research Objectives</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <h4 className="font-semibold text-navy-900 mb-3 flex items-center">
                <span className="w-2 h-2 bg-blue-600 rounded-full mr-2"></span>
                Main Objective
              </h4>
              <p className="text-foreground ml-4">
                To develop an intelligent study timer system that dynamically adjusts break intervals based on real-time cognitive load estimation, chronotype analysis, and adaptive learning algorithms to optimize study performance and reduce mental fatigue.
              </p>
            </div>

            <h4 className="font-semibold text-navy-900 mb-3 flex items-center">
              <span className="w-2 h-2 bg-cyan-500 rounded-full mr-2"></span>
              Specific Objectives
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-4">
              <div className="flex items-start space-x-3">
                <Badge variant="info">SO1</Badge>
                <p className="text-sm text-foreground">
                  Design and implement a cognitive load estimation model using eye-tracking and task metrics
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <Badge variant="info">SO2</Badge>
                <p className="text-sm text-foreground">
                  Develop an adaptive break scheduling algorithm that responds to cognitive state changes
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <Badge variant="violet">SO3</Badge>
                <p className="text-sm text-foreground">
                  Create a chronotype assessment module for personalized study time recommendations
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <Badge variant="violet">SO4</Badge>
                <p className="text-sm text-foreground">
                  Implement an intent-lock overlay to enforce break compliance and prevent procrastination
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Methodology</CardTitle>
              <CardDescription>Research approach and design</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Badge>Phase 1</Badge>
                    <span className="font-medium">Literature Review</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Systematic analysis of cognitive load theory, break scheduling research, and existing timer applications
                  </p>
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Badge>Phase 2</Badge>
                    <span className="font-medium">System Design</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Architecture design for the four integrated subsystems with ML model selection
                  </p>
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Badge>Phase 3</Badge>
                    <span className="font-medium">Development & Training</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Implementation of components, ML model training, and system integration
                  </p>
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Badge>Phase 4</Badge>
                    <span className="font-medium">Evaluation</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    User testing with students, performance metrics collection, and iterative refinement
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Technologies</CardTitle>
              <CardDescription>Stack and tools</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h5 className="font-medium mb-2 text-sm">Machine Learning</h5>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="info">TensorFlow</Badge>
                    <Badge variant="info">scikit-learn</Badge>
                    <Badge variant="info">PyTorch</Badge>
                  </div>
                </div>
                <div>
                  <h5 className="font-medium mb-2 text-sm">Eye-Tracking & Sensors</h5>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="violet">Tobii SDK</Badge>
                    <Badge variant="violet">OpenCV</Badge>
                    <Badge variant="violet">MediaPipe</Badge>
                  </div>
                </div>
                <div>
                  <h5 className="font-medium mb-2 text-sm">Backend & API</h5>
                  <div className="flex flex-wrap gap-2">
                    <Badge>Python</Badge>
                    <Badge>FastAPI</Badge>
                    <Badge>PostgreSQL</Badge>
                  </div>
                </div>
                <div>
                  <h5 className="font-medium mb-2 text-sm">Frontend</h5>
                  <div className="flex flex-wrap gap-2">
                    <Badge>React</Badge>
                    <Badge>TypeScript</Badge>
                    <Badge>Electron</Badge>
                  </div>
                </div>
                <div>
                  <h5 className="font-medium mb-2 text-sm">Data Analysis</h5>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="success">pandas</Badge>
                    <Badge variant="success">NumPy</Badge>
                    <Badge variant="success">Matplotlib</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-to-br from-navy-900 to-navy-800 text-white">
          <CardContent className="py-8">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-3">Expected Outcomes</h3>
              <p className="text-slate-300 mb-6 max-w-3xl mx-auto">
                This research aims to deliver a functional prototype that demonstrates measurable improvements in study efficiency, user wellbeing, and academic performance through intelligent, personalized break scheduling.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                  <div className="text-3xl font-bold text-cyan-400 mb-2">30%</div>
                  <div className="text-sm text-slate-300">Improvement in retention rates</div>
                </div>
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                  <div className="text-3xl font-bold text-blue-400 mb-2">40%</div>
                  <div className="text-sm text-slate-300">Reduction in reported fatigue</div>
                </div>
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                  <div className="text-3xl font-bold text-violet-400 mb-2">25%</div>
                  <div className="text-sm text-slate-300">Increase in study efficiency</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
