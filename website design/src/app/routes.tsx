import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Domain } from './pages/Domain';
import { Milestones } from './pages/Milestones';
import { Documents } from './pages/Documents';
import { Presentations } from './pages/Presentations';
import { About } from './pages/About';
import { Contact } from './pages/Contact';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: 'domain', Component: Domain },
      { path: 'milestones', Component: Milestones },
      { path: 'documents', Component: Documents },
      { path: 'presentations', Component: Presentations },
      { path: 'about', Component: About },
      { path: 'contact', Component: Contact },
    ],
  },
]);
