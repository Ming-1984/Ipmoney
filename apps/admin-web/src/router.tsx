import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from './ui/AppLayout';
import { LoginPage } from './views/LoginPage';
import { PlaceholderPage } from './views/PlaceholderPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <PlaceholderPage title="仪表盘" /> },
      { path: 'verifications', element: <PlaceholderPage title="认证审核" /> },
      { path: 'listings', element: <PlaceholderPage title="上架审核" /> },
      { path: 'orders', element: <PlaceholderPage title="订单管理" /> },
      { path: 'refunds', element: <PlaceholderPage title="退款管理" /> },
      { path: 'settlements', element: <PlaceholderPage title="放款/结算" /> },
      { path: 'invoices', element: <PlaceholderPage title="发票管理" /> },
      { path: 'config', element: <PlaceholderPage title="交易/推荐配置" /> },
      { path: 'patent-map', element: <PlaceholderPage title="专利地图 CMS" /> }
    ],
  },
]);

