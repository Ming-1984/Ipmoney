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
    colorPrimary: '#ff6a00',
    colorInfo: '#ff6a00',
    borderRadius: 12,
    colorBgLayout: '#fff3e6',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorSuccess: '#16a34a',
    colorWarning: '#f59e0b',
    colorError: '#dc2626',
    controlItemBgActive: '#ffe4cc',
    controlItemBgActiveHover: '#ffd7b3',
    boxShadowSecondary: '0 18px 40px rgba(255, 122, 0, 0.12)',
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      bodyBg: '#fff3e6',
    },
    Card: {
      borderRadiusLG: 14,
    },
    Menu: {
      itemHoverBg: 'rgba(255, 122, 0, 0.08)',
      itemHoverColor: '#ff6a00',
      itemSelectedBg: 'rgba(255, 122, 0, 0.12)',
      itemSelectedColor: '#ff6a00',
      itemActiveBg: 'rgba(255, 122, 0, 0.12)',
      darkItemHoverBg: 'rgba(255, 122, 0, 0.08)',
      darkItemHoverColor: '#ff6a00',
      darkItemSelectedBg: 'rgba(255, 122, 0, 0.12)',
      darkItemSelectedColor: '#ff6a00',
      activeBarBorderWidth: 0,
    },
    Button: {
      borderRadius: 999,
      primaryShadow: '0 6px 16px rgba(255, 122, 0, 0.14)',
    },
    Table: {
      rowHoverBg: 'rgba(255, 122, 0, 0.08)',
      rowSelectedBg: 'rgba(255, 122, 0, 0.12)',
      rowSelectedHoverBg: 'rgba(255, 122, 0, 0.2)',
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
