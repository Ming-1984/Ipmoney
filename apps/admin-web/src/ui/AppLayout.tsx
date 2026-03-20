import {
  AppstoreOutlined,
  EnvironmentOutlined,
  FileDoneOutlined,
  GiftOutlined,
  MessageOutlined,
  TeamOutlined,
  SettingOutlined,
  FileTextOutlined,
  LockOutlined,
  SolutionOutlined,
  BookOutlined,
  ProfileOutlined,
  BellOutlined,
  ScheduleOutlined,
} from '@ant-design/icons';
import { Button, Layout, Menu, Typography } from 'antd';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import logoPng from '../assets/brand/logo.png';

const { Header, Sider, Content } = Layout;

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  useEffect(() => {
    const token = String(localStorage.getItem('ipmoney.adminToken') || '').trim();
    if (!token) {
      setHasToken(false);
      navigate('/login', { replace: true });
      return;
    }
    setHasToken(true);
  }, [location.pathname, navigate]);

  const selectedKeys = useMemo(() => {
    const path = location.pathname.replace(/^\//, '');
    if (!path) return ['dashboard'];
    return [path];
  }, [location.pathname]);

  if (hasToken === false) return null;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        className="ipm-sider"
        theme="light"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={240}
      >
        <div className="ipm-logo">
          <div className="ipm-logo-mark" aria-hidden="true">
            <img src={logoPng} alt="" />
          </div>
          <div className="ipm-logo-text">
            <span style={{ color: '#fff', fontWeight: 800 }}>Ipmoney 鍚庡彴</span>
            <span className="ipm-logo-subtitle" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Ipmoney
            </span>
          </div>
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={selectedKeys}
          items={[
            {
              key: 'dashboard',
              icon: <AppstoreOutlined />,
              label: <Link to="/">浠〃鐩?/Link>,
            },
            {
              key: 'verifications',
              icon: <FileDoneOutlined />,
              label: <Link to="/verifications">璁よ瘉瀹℃牳</Link>,
            },
            {
              key: 'listings',
              icon: <GiftOutlined />,
              label: <Link to="/listings">涓婃灦瀹℃牳</Link>,
            },
            {
              key: 'tech-managers',
              icon: <TeamOutlined />,
              label: <Link to="/tech-managers">鎶€鏈粡鐞嗕汉</Link>,
            },
            {
              key: 'comments',
              icon: <MessageOutlined />,
              label: <Link to="/comments">鐣欒█绠＄悊</Link>,
            },
            {
              key: 'alerts',
              icon: <BellOutlined />,
              label: <Link to="/alerts">鍛婅涓績</Link>,
            },
            {
              key: 'audit-logs',
              icon: <ProfileOutlined />,
              label: <Link to="/audit-logs">瀹¤鏃ュ織</Link>,
            },

            {
              key: 'orders',
              label: <Link to="/orders">璁㈠崟绠＄悊</Link>,
            },
            {
              key: 'cases',
              icon: <SolutionOutlined />,
              label: <Link to="/cases">宸ュ崟/浜夎</Link>,
            },
            {
              key: 'maintenance',
              icon: <ScheduleOutlined />,
              label: <Link to="/maintenance">骞磋垂鎵樼</Link>,
            },
            {
              key: 'refunds',
              label: <Link to="/refunds">閫€娆剧鐞?/Link>,
            },
            {
              key: 'settlements',
              label: <Link to="/settlements">鏀炬/缁撶畻</Link>,
            },
            {
              key: 'invoices',
              label: <Link to="/invoices">鍙戠エ绠＄悊</Link>,
            },
            {
              key: 'reports',
              icon: <FileTextOutlined />,
              label: <Link to="/reports">鎶ヨ〃瀵煎嚭</Link>,
            },
            {
              key: 'config',
              icon: <SettingOutlined />,
              label: <Link to="/config">浜ゆ槗/鎺ㄨ崘閰嶇疆</Link>,
            },
            {
              key: 'regions',
              icon: <EnvironmentOutlined />,
              label: <Link to="/regions">鍦板尯/琛屼笟鏍囩</Link>,
            },
            {
              key: 'patents',
              icon: <BookOutlined />,
              label: <Link to="/patents">涓撳埄涓绘暟鎹?/Link>,
            },
            {
              key: 'rbac',
              icon: <LockOutlined />,
              label: <Link to="/rbac">璐﹀彿鏉冮檺</Link>,
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header className="ipm-app-header" style={{ padding: '0 16px' }}>
          <div className="ipm-header-inner">
            <Typography.Text type="secondary">Ipmoney 杩愯惀鍚庡彴</Typography.Text>
            <Button
              size="small"
              onClick={() => {
                try {
                  localStorage.removeItem('ipmoney.adminToken');
                } catch {
                  // ignore storage failures
                }
                navigate('/login', { replace: true });
              }}
            >
              閫€鍑虹櫥褰?            </Button>
          </div>
        </Header>
        <Content className="ipm-content">
          <div className="ipm-content-inner">
            <Suspense fallback={<div style={{ padding: 16, color: 'rgba(0,0,0,0.45)' }}>Loading...</div>}>
              <Outlet />
            </Suspense>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

