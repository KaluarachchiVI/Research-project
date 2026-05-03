import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';

const navItems = [
  { path: '/', label: 'Home' },
  { path: '/domain', label: 'Domain' },
  { path: '/milestones', label: 'Milestones' },
  { path: '/documents', label: 'Documents' },
  { path: '/presentations', label: 'Presentations' },
  { path: '/about', label: 'About Us' },
  { path: '/contact', label: 'Contact' },
];

export function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                <span className="text-white font-bold text-lg">AC</span>
              </div>
              <div className="hidden sm:block">
                <div className="font-semibold text-navy-900">Adaptive Cognitive-Load Timer</div>
                <div className="text-xs text-muted-foreground">25-26J-458 • SLIIT Research</div>
              </div>
            </Link>

            <div className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-border">
              <div className="flex flex-col space-y-2">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive(item.path)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-secondary'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="bg-navy-900 text-slate-100 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">AC</span>
                </div>
                <span className="font-semibold">ACL Study Timer</span>
              </div>
              <p className="text-sm text-slate-400">
                Final year research project at SLIIT, exploring adaptive break scheduling using cognitive load estimation.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Quick Links</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link to="/domain" className="hover:text-cyan-400 transition-colors">Research Domain</Link></li>
                <li><Link to="/milestones" className="hover:text-cyan-400 transition-colors">Project Milestones</Link></li>
                <li><Link to="/documents" className="hover:text-cyan-400 transition-colors">Documentation</Link></li>
                <li><Link to="/about" className="hover:text-cyan-400 transition-colors">Team</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Institution</h4>
              <p className="text-sm text-slate-400">
                Sri Lanka Institute of Information Technology<br />
                B.Sc. in Information Technology (Hons)<br />
                CDAP Programme 2025/26
              </p>
            </div>
          </div>

          <div className="border-t border-navy-700 mt-8 pt-8 text-center text-sm text-slate-400">
            <p>© 2026 Group 25-26J-458. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
