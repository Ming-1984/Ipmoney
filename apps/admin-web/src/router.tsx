import { Suspense, lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';

import { LoginPage } from './views/LoginPage';

const fallback = <div style={{ padding: 16, color: 'rgba(0,0,0,0.45)' }}>Loading...</div>;

const AppLayout = lazy(async () => {
  const mod = await import('./ui/AppLayout');
  return { default: mod.AppLayout };
});

const DashboardPage = lazy(async () => {
  const mod = await import('./views/DashboardPage');
  return { default: mod.DashboardPage };
});
const VerificationsPage = lazy(async () => {
  const mod = await import('./views/VerificationsPage');
  return { default: mod.VerificationsPage };
});
const ListingsAuditPage = lazy(async () => {
  const mod = await import('./views/ListingsAuditPage');
  return { default: mod.ListingsAuditPage };
});
const DemandsAuditPage = lazy(async () => {
  const mod = await import('./views/DemandsAuditPage');
  return { default: mod.DemandsAuditPage };
});
const AchievementsAuditPage = lazy(async () => {
  const mod = await import('./views/AchievementsAuditPage');
  return { default: mod.AchievementsAuditPage };
});
const ArtworksAuditPage = lazy(async () => {
  const mod = await import('./views/ArtworksAuditPage');
  return { default: mod.ArtworksAuditPage };
});
const TechManagersPage = lazy(async () => {
  const mod = await import('./views/TechManagersPage');
  return { default: mod.TechManagersPage };
});
const OrdersPage = lazy(async () => {
  const mod = await import('./views/OrdersPage');
  return { default: mod.OrdersPage };
});
const OrderDetailPage = lazy(async () => {
  const mod = await import('./views/OrderDetailPage');
  return { default: mod.OrderDetailPage };
});
const CasesPage = lazy(async () => {
  const mod = await import('./views/CasesPage');
  return { default: mod.CasesPage };
});
const RefundsPage = lazy(async () => {
  const mod = await import('./views/RefundsPage');
  return { default: mod.RefundsPage };
});
const SettlementsPage = lazy(async () => {
  const mod = await import('./views/SettlementsPage');
  return { default: mod.SettlementsPage };
});
const InvoicesPage = lazy(async () => {
  const mod = await import('./views/InvoicesPage');
  return { default: mod.InvoicesPage };
});
const ReportsPage = lazy(async () => {
  const mod = await import('./views/ReportsPage');
  return { default: mod.ReportsPage };
});
const CommentsPage = lazy(async () => {
  const mod = await import('./views/CommentsPage');
  return { default: mod.CommentsPage };
});
const AnnouncementsPage = lazy(async () => {
  const mod = await import('./views/AnnouncementsPage');
  return { default: mod.AnnouncementsPage };
});
const AlertsPage = lazy(async () => {
  const mod = await import('./views/AlertsPage');
  return { default: mod.AlertsPage };
});
const AuditLogsPage = lazy(async () => {
  const mod = await import('./views/AuditLogsPage');
  return { default: mod.AuditLogsPage };
});
const RbacPage = lazy(async () => {
  const mod = await import('./views/RbacPage');
  return { default: mod.RbacPage };
});
const ConfigPage = lazy(async () => {
  const mod = await import('./views/ConfigPage');
  return { default: mod.ConfigPage };
});
const MaintenancePage = lazy(async () => {
  const mod = await import('./views/MaintenancePage');
  return { default: mod.MaintenancePage };
});
const RegionsPage = lazy(async () => {
  const mod = await import('./views/RegionsPage');
  return { default: mod.RegionsPage };
});
const PatentMapPage = lazy(async () => {
  const mod = await import('./views/PatentMapPage');
  return { default: mod.PatentMapPage };
});
const PatentsPage = lazy(async () => {
  const mod = await import('./views/PatentsPage');
  return { default: mod.PatentsPage };
});

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <Suspense fallback={fallback}>
        <AppLayout />
      </Suspense>
    ),
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
