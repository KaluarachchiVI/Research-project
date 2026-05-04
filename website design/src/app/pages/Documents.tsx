import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';

interface Document {
  id: string;
  title: string;
  type: 'proposal' | 'report' | 'ethics' | 'checklist' | 'thesis';
  date: string;
  author: string;
  size: string;
  description: string;
}

const documents: Document[] = [
  {
    id: '1',
    title: 'Project Proposal',
    type: 'proposal',
    date: 'Sep 15, 2025',
    author: 'Group 25-26J-458',
    size: '2.4 MB',
    description: 'Initial research proposal with problem definition and methodology'
  },
  {
    id: '2',
    title: 'Literature Review',
    type: 'report',
    date: 'Sep 28, 2025',
    author: 'IT21158704',
    size: '1.8 MB',
    description: 'Comprehensive review of cognitive load theory and break scheduling research'
  },
  {
    id: '3',
    title: 'Ethics Approval Form',
    type: 'ethics',
    date: 'Oct 10, 2025',
    author: 'Group 25-26J-458',
    size: '452 KB',
    description: 'IRB approval for user study involving eye-tracking data collection'
  },
  {
    id: '4',
    title: 'Progress Report I',
    type: 'report',
    date: 'Nov 5, 2025',
    author: 'Group 25-26J-458',
    size: '3.1 MB',
    description: 'First progress report with cognitive load model prototype results'
  },
  {
    id: '5',
    title: 'PP1 Status Document',
    type: 'checklist',
    date: 'Nov 8, 2025',
    author: 'Group 25-26J-458',
    size: '186 KB',
    description: 'Progress Presentation 1 checklist and deliverables status'
  },
  {
    id: '6',
    title: 'System Architecture Document',
    type: 'report',
    date: 'Dec 12, 2025',
    author: 'IT21158710',
    size: '2.2 MB',
    description: 'Detailed technical architecture and component design specifications'
  },
  {
    id: '7',
    title: 'User Study Protocol',
    type: 'ethics',
    date: 'Jan 15, 2026',
    author: 'IT21158725',
    size: '890 KB',
    description: 'Participant consent forms and data collection procedures'
  },
  {
    id: '8',
    title: 'Progress Report II',
    type: 'report',
    date: 'Feb 10, 2026',
    author: 'Group 25-26J-458',
    size: '4.3 MB',
    description: 'Second progress report with integrated system evaluation'
  },
  {
    id: '9',
    title: 'PP2 Status Document',
    type: 'checklist',
    date: 'Feb 12, 2026',
    author: 'Group 25-26J-458',
    size: '215 KB',
    description: 'Progress Presentation 2 checklist and milestone completion'
  },
  {
    id: '10',
    title: 'ML Model Performance Report',
    type: 'report',
    date: 'Mar 5, 2026',
    author: 'IT21158735',
    size: '1.5 MB',
    description: 'Cognitive load estimation model training and validation results'
  },
  {
    id: '11',
    title: 'Final Thesis Draft',
    type: 'thesis',
    date: 'Apr 18, 2026',
    author: 'Group 25-26J-458',
    size: '8.7 MB',
    description: 'Complete dissertation with all chapters and appendices'
  },
  {
    id: '12',
    title: 'Final Status Document',
    type: 'checklist',
    date: 'Apr 20, 2026',
    author: 'Group 25-26J-458',
    size: '302 KB',
    description: 'Final submission checklist and requirements verification'
  }
];

const typeLabels = {
  proposal: 'Proposal',
  report: 'Report',
  ethics: 'Ethics',
  checklist: 'Checklist',
  thesis: 'Thesis'
};

const typeBadgeVariants = {
  proposal: 'violet' as const,
  report: 'info' as const,
  ethics: 'warning' as const,
  checklist: 'success' as const,
  thesis: 'default' as const
};

export function Documents() {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDocuments = documents.filter(doc => {
    const matchesType = filterType === 'all' || doc.type === filterType;
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="py-12 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-navy-900 mb-4">Project Documents</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Access all project documentation, reports, and submissions
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2.5 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filterType === 'all' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterType('all')}
                >
                  All
                </Button>
                {Object.entries(typeLabels).map(([type, label]) => (
                  <Button
                    key={type}
                    variant={filterType === type ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setFilterType(type)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {filteredDocuments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-foreground mb-2">No documents found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your search or filter criteria</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredDocuments.map((doc) => (
              <Card key={doc.id} hover>
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <CardTitle className="mb-2">{doc.title}</CardTitle>
                      <CardDescription>{doc.description}</CardDescription>
                    </div>
                    <Badge variant={typeBadgeVariants[doc.type]}>
                      {typeLabels[doc.type]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center text-muted-foreground">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>{doc.author}</span>
                      </div>
                      <div className="flex items-center text-muted-foreground">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{doc.date}</span>
                      </div>
                      <div className="flex items-center text-muted-foreground">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span>{doc.size}</span>
                      </div>
                    </div>
                    <Button variant="primary" size="sm">
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
        )}

        <Card className="mt-12 bg-gradient-to-br from-blue-50 to-cyan-50">
          <CardContent className="py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-navy-900 mb-2">Need a specific document?</h3>
                <p className="text-muted-foreground">
                  Contact the team if you can't find what you're looking for
                </p>
              </div>
              <Button variant="primary" size="lg">
                Contact Us
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
