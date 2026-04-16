import { createBrowserRouter } from 'react-router';
import { Home } from './pages/Home';
import { Workspace } from './pages/Workspace';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Home,
  },
  {
    path: '/workspace/:id',
    Component: Workspace,
  },
]);
