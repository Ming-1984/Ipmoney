import type { ThemeConfig } from 'antd';
import { ConfigProvider, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { router } from './router';
import './styles.css';

const theme: ThemeConfig = {
  algorithm: antdTheme.defaultAlgorithm,
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
    controlItemBgActive: 'var(--ipm-primary-soft)',
    controlItemBgActiveHover: 'var(--ipm-primary-soft-strong)',
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
      itemSelectedBg: 'var(--ipm-primary-soft)',
      itemSelectedColor: 'var(--ipm-primary)',
      itemActiveBg: 'var(--ipm-primary-soft)',
      darkItemSelectedBg: 'var(--ipm-primary-soft)',
      darkItemSelectedColor: 'var(--ipm-primary)',
      activeBarBorderWidth: 0,
    },
    Button: {
      borderRadius: 999,
      primaryShadow: 'var(--ipm-shadow-primary)',
    },
    Table: {
      rowHoverBg: 'var(--ipm-primary-soft)',
      rowSelectedBg: 'var(--ipm-primary-soft)',
      rowSelectedHoverBg: 'var(--ipm-primary-soft-strong)',
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
