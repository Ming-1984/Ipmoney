import { Suspense, lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';

import { RouteErrorPage } from './ui/RouteErrorPage';
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
const TechManagersPage = lazy(async () => {
  const mod = await import('./views/TechManagersPage');
  return { default: mod.TechManagersPage };
});
const AchievementsPage = lazy(async () => {
  const mod = await import('./views/AchievementsPage');
  return { default: mod.AchievementsPage };
});
const OrdersPage = lazy(async () => {
  const mod = await import('./views/OrdersPage');
  return { default: mod.OrdersPage };
});
const AssignedOrdersPage = lazy(async () => {
  const mod = await import('./views/AssignedOrdersPage');
  return { default: mod.AssignedOrdersPage };
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
const HomeLandingConfigPage = lazy(async () => {
  const mod = await import('./views/HomeLandingConfigPage');
  return { default: mod.HomeLandingConfigPage };
});
const HomeBannersPage = lazy(async () => {
  const mod = await import('./views/HomeBannersPage');
  return { default: mod.HomeBannersPage };
});
const HomeAnnouncementsPage = lazy(async () => {
  const mod = await import('./views/HomeAnnouncementsPage');
  return { default: mod.HomeAnnouncementsPage };
});
const MaintenancePage = lazy(async () => {
  const mod = await import('./views/MaintenancePage');
  return { default: mod.MaintenancePage };
});
const RegionsPage = lazy(async () => {
  const mod = await import('./views/RegionsPage');
  return { default: mod.RegionsPage };
});
const PatentsPage = lazy(async () => {
  const mod = await import('./views/PatentsPage');
  return { default: mod.PatentsPage };
});
const PatentOperationsPage = lazy(async () => {
  const mod = await import('./views/PatentOperationsPage');
  return { default: mod.PatentOperationsPage };
});
const BulkImportPage = lazy(async () => {
  const mod = await import('./views/BulkImportPage');
  return { default: mod.BulkImportPage };
});
const PatentClaimsPage = lazy(async () => {
  const mod = await import('./views/PatentClaimsPage');
  return { default: mod.PatentClaimsPage };
});
const PlatformConversationsPage = lazy(async () => {
  const mod = await import('./views/PlatformConversationsPage');
  return { default: mod.PlatformConversationsPage };
});

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/',
    element: (
      <Suspense fallback={fallback}>
        <AppLayout />
      </Suspense>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'verifications', element: <VerificationsPage /> },
      { path: 'listings', element: <ListingsAuditPage /> },
      { path: 'tech-managers', element: <TechManagersPage /> },
      { path: 'achievements', element: <AchievementsPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'orders/assigned', element: <AssignedOrdersPage /> },
      { path: 'orders/:orderId', element: <OrderDetailPage /> },
      { path: 'cases', element: <CasesPage /> },
      { path: 'refunds', element: <RefundsPage /> },
      { path: 'settlements', element: <SettlementsPage /> },
      { path: 'invoices', element: <InvoicesPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'comments', element: <CommentsPage /> },
      { path: 'alerts', element: <AlertsPage /> },
      { path: 'audit-logs', element: <AuditLogsPage /> },
      { path: 'rbac', element: <RbacPage /> },
      { path: 'config', element: <ConfigPage /> },
      { path: 'config/home-landing', element: <HomeLandingConfigPage /> },
      { path: 'home-banners', element: <HomeBannersPage /> },
      { path: 'home-announcements', element: <HomeAnnouncementsPage /> },
      { path: 'maintenance', element: <MaintenancePage /> },
      { path: 'regions', element: <RegionsPage /> },
      { path: 'patents', element: <PatentsPage /> },
      { path: 'patents/operations', element: <PatentOperationsPage /> },
      { path: 'imports/bulk', element: <BulkImportPage /> },
      { path: 'patents/claims', element: <PatentClaimsPage /> },
      { path: 'conversations/platform', element: <PlatformConversationsPage /> },
    ],
  },
]);
