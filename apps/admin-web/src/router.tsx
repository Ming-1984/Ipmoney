import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from './ui/AppLayout';
import { DashboardPage } from './views/DashboardPage';
import { DemandsAuditPage } from './views/DemandsAuditPage';
import { LoginPage } from './views/LoginPage';
import { AchievementsAuditPage } from './views/AchievementsAuditPage';
import { ArtworksAuditPage } from './views/ArtworksAuditPage';
import { CasesPage } from './views/CasesPage';
import { CommentsPage } from './views/CommentsPage';
import { AnnouncementsPage } from './views/AnnouncementsPage';
import { AlertsPage } from './views/AlertsPage';
import { AuditLogsPage } from './views/AuditLogsPage';
import { ListingsAuditPage } from './views/ListingsAuditPage';
import { ConfigPage } from './views/ConfigPage';
import { InvoicesPage } from './views/InvoicesPage';
import { OrdersPage } from './views/OrdersPage';
import { OrderDetailPage } from './views/OrderDetailPage';
import { MaintenancePage } from './views/MaintenancePage';
import { PatentMapPage } from './views/PatentMapPage';
import { PatentsPage } from './views/PatentsPage';
import { RegionsPage } from './views/RegionsPage';
import { RefundsPage } from './views/RefundsPage';
import { ReportsPage } from './views/ReportsPage';
import { RbacPage } from './views/RbacPage';
import { SettlementsPage } from './views/SettlementsPage';
import { TechManagersPage } from './views/TechManagersPage';
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
      { path: 'artworks', element: <ArtworksAuditPage /> },
      { path: 'tech-managers', element: <TechManagersPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'orders/:orderId', element: <OrderDetailPage /> },
      { path: 'cases', element: <CasesPage /> },
      { path: 'refunds', element: <RefundsPage /> },
      { path: 'settlements', element: <SettlementsPage /> },
      { path: 'invoices', element: <InvoicesPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'comments', element: <CommentsPage /> },
      { path: 'announcements', element: <AnnouncementsPage /> },
      { path: 'alerts', element: <AlertsPage /> },
      { path: 'audit-logs', element: <AuditLogsPage /> },
      { path: 'rbac', element: <RbacPage /> },
      { path: 'config', element: <ConfigPage /> },
      { path: 'maintenance', element: <MaintenancePage /> },
      { path: 'regions', element: <RegionsPage /> },
      { path: 'patent-map', element: <PatentMapPage /> },
      { path: 'patents', element: <PatentsPage /> },
    ],
  },
]);
