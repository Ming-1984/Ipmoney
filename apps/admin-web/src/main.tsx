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
    colorPrimary: '#FF6A00',
    colorInfo: '#FF6A00',
    borderRadius: 12,
    colorBgLayout: '#FFF3E6',
    colorBgContainer: 'rgba(255,255,255,0.92)',
    colorBgElevated: 'rgba(255,255,255,0.98)',
    colorSuccess: '#16a34a',
    colorWarning: '#f59e0b',
    colorError: '#dc2626',
    boxShadowSecondary: '0 18px 40px rgba(15,23,42,0.08)',
  },
  components: {
    Layout: {
      headerBg: 'rgba(255,255,255,0.92)',
      bodyBg: '#FFF3E6',
    },
    Card: {
      borderRadiusLG: 14,
    },
    Menu: {
      darkItemSelectedBg: '#FF6A00',
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
