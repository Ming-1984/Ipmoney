import type { ThemeConfig } from 'antd';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { router } from './router';
import './styles.css';

const theme: ThemeConfig = {
  token: {
    colorPrimary: 'var(--ipm-primary)',
    colorInfo: 'var(--ipm-primary)',
    borderRadius: 12,
    colorBgLayout: 'var(--ipm-bg)',
    colorBgContainer: 'var(--ipm-bg-container)',
    colorBgElevated: 'var(--ipm-bg-elevated)',
    colorSuccess: 'var(--ipm-success)',
    colorWarning: 'var(--ipm-warning)',
    colorError: 'var(--ipm-error)',
    boxShadowSecondary: 'var(--ipm-shadow-secondary)',
  },
  components: {
    Layout: {
      headerBg: 'var(--ipm-bg-container)',
      bodyBg: 'var(--ipm-bg)',
    },
    Card: {
      borderRadiusLG: 14,
    },
    Menu: {
      darkItemSelectedBg: 'var(--ipm-primary)',
    },
    Button: {
      borderRadius: 999,
    },
  },
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={theme}>
      <RouterProvider router={router} />
    </ConfigProvider>
  </React.StrictMode>,
);
