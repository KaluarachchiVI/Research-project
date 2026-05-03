import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/Card';
import { Badge } from '../components/Badge';

interface TeamMember {
  id: string;
  name: string;
  studentId: string;
  role: string;
  contribution: string;
  expertise: string[];
  email: string;
}

const teamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'Student Member 1',
    studentId: 'IT21158704',
    role: 'Team Leader & ML Engineer',
    contribution: 'Cognitive Load Estimator',
    expertise: ['Machine Learning', 'Eye-tracking', 'Data Analysis', 'Python'],
    email: 'it21158704@my.sliit.lk'
  },
  {
    id: '2',
    name: 'Student Member 2',
    studentId: 'IT21158710',
    role: 'Backend Developer',
    contribution: 'Adaptive Break Scheduler',
    expertise: ['API Development', 'Algorithms', 'FastAPI', 'PostgreSQL'],
    email: 'it21158710@my.sliit.lk'
  },
  {
    id: '3',
    name: 'Student Member 3',
    studentId: 'IT21158725',
    role: 'Full-Stack Developer',
    contribution: 'Chronotype Recommender',
    expertise: ['React', 'TypeScript', 'UI/UX', 'Data Visualization'],
    email: 'it21158725@my.sliit.lk'
  },
  {
    id: '4',
    name: 'Student Member 4',
    studentId: 'IT21158735',
    role: 'Frontend Developer',
    contribution: 'Intent-Lock Overlay',
    expertise: ['Electron', 'React', 'System Integration', 'Testing'],
    email: 'it21158735@my.sliit.lk'
  }
];

export function About() {
  return (
    <div className="py-12 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-navy-900 mb-4">About Our Team</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A dedicated group of final-year students passionate about improving learning through technology
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {teamMembers.map((member) => (
            <Card key={member.id} hover className="text-center">
              <div className="pt-6 px-6">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  {member.name.split(' ').map(n => n[0]).join('')}
                </div>
              </div>
              <CardHeader>
                <CardTitle className="text-lg">{member.name}</CardTitle>
                <CardDescription>
                  <div className="text-xs font-mono mb-2">{member.studentId}</div>
                  <Badge variant="info" className="mt-1">{member.role}</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2">Main Contribution</h4>
                    <p className="text-sm text-foreground">{member.contribution}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2">Expertise</h4>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {member.expertise.map((skill, idx) => (
                        <Badge key={idx} variant="default" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="pt-3 border-t border-border">
                    <a
                      href={`mailto:${member.email}`}
                      className="text-xs text-primary hover:text-blue-700 transition-colors flex items-center justify-center"
                    >
                      <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Email
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50">
            <CardHeader>
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <CardTitle className="text-xl">Supervisor</CardTitle>
                  <CardDescription>Primary academic advisor</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-navy-900">Dr. Supervisor Name</h4>
                  <p className="text-sm text-muted-foreground">Senior Lecturer</p>
                  <p className="text-sm text-muted-foreground">Faculty of Computing, SLIIT</p>
                </div>
                <div>
                  <p className="text-sm text-foreground mb-2">Specialization:</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="violet">Machine Learning</Badge>
                    <Badge variant="violet">HCI</Badge>
                    <Badge variant="violet">Cognitive Science</Badge>
                  </div>
                </div>
                <div className="pt-3 border-t border-border">
                  <a
                    href="mailto:supervisor@sliit.lk"
                    className="text-sm text-primary hover:text-blue-700 transition-colors flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    supervisor@sliit.lk
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-violet-50 to-purple-50">
            <CardHeader>
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-purple-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div>
                  <CardTitle className="text-xl">Co-Supervisor</CardTitle>
                  <CardDescription>Technical advisor</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-navy-900">Ms. Co-Supervisor Name</h4>
                  <p className="text-sm text-muted-foreground">Lecturer</p>
                  <p className="text-sm text-muted-foreground">Faculty of Computing, SLIIT</p>
                </div>
                <div>
                  <p className="text-sm text-foreground mb-2">Specialization:</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="info">Software Engineering</Badge>
                    <Badge variant="info">AI Applications</Badge>
                  </div>
                </div>
                <div className="pt-3 border-t border-border">
                  <a
                    href="mailto:cosupervisor@sliit.lk"
                    className="text-sm text-primary hover:text-blue-700 transition-colors flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    cosupervisor@sliit.lk
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-to-br from-navy-900 to-navy-800 text-white">
          <CardContent className="py-12">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-4">Our Mission</h3>
              <p className="text-slate-300 text-lg max-w-3xl mx-auto mb-8">
                To bridge the gap between cognitive science research and practical productivity tools, creating technology that truly understands and adapts to individual learning needs.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                <div className="bg-white/10 rounded-lg p-6 backdrop-blur-sm">
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold mb-2">Innovation</h4>
                  <p className="text-sm text-slate-300">Pushing boundaries with ML and sensor fusion</p>
                </div>
                <div className="bg-white/10 rounded-lg p-6 backdrop-blur-sm">
                  <div className="w-12 h-12 bg-cyan-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold mb-2">Collaboration</h4>
                  <p className="text-sm text-slate-300">Teamwork across diverse expertise</p>
                </div>
                <div className="bg-white/10 rounded-lg p-6 backdrop-blur-sm">
                  <div className="w-12 h-12 bg-violet-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold mb-2">Impact</h4>
                  <p className="text-sm text-slate-300">Real solutions for student wellbeing</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
