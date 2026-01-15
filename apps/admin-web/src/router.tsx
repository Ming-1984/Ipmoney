import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from './ui/AppLayout';
import { DashboardPage } from './views/DashboardPage';
import { DemandsAuditPage } from './views/DemandsAuditPage';
import { LoginPage } from './views/LoginPage';
import { AchievementsAuditPage } from './views/AchievementsAuditPage';
import { CommentsPage } from './views/CommentsPage';
import { ListingsAuditPage } from './views/ListingsAuditPage';
import { ConfigPage } from './views/ConfigPage';
import { InvoicesPage } from './views/InvoicesPage';
import { OrdersPage } from './views/OrdersPage';
import { PatentMapPage } from './views/PatentMapPage';
import { RegionsPage } from './views/RegionsPage';
import { RefundsPage } from './views/RefundsPage';
import { SettlementsPage } from './views/SettlementsPage';
import { VerificationsPage } from './views/VerificationsPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'verifications', element: <VerificationsPage /> },
      { path: 'listings', element: <ListingsAuditPage /> },
      { path: 'demands', element: <DemandsAuditPage /> },
      { path: 'achievements', element: <AchievementsAuditPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'refunds', element: <RefundsPage /> },
      { path: 'settlements', element: <SettlementsPage /> },
      { path: 'invoices', element: <InvoicesPage /> },
      { path: 'comments', element: <CommentsPage /> },
      { path: 'config', element: <ConfigPage /> },
      { path: 'regions', element: <RegionsPage /> },
      { path: 'patent-map', element: <PatentMapPage /> },
    ],
  },
]);
