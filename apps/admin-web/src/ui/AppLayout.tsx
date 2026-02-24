import {
  AppstoreOutlined,
  EnvironmentOutlined,
  FileDoneOutlined,
  GiftOutlined,
  MessageOutlined,
  PictureOutlined,
  TeamOutlined,
  TrophyOutlined,
  BulbOutlined,
  SettingOutlined,
  FileTextOutlined,
  LockOutlined,
  SolutionOutlined,
  NotificationOutlined,
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
            <span style={{ color: '#fff', fontWeight: 800 }}>Ipmoney 后台</span>
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
              label: <Link to="/">仪表盘</Link>,
            },
            {
              key: 'verifications',
              icon: <FileDoneOutlined />,
              label: <Link to="/verifications">认证审核</Link>,
            },
            {
              key: 'listings',
              icon: <GiftOutlined />,
              label: <Link to="/listings">上架审核</Link>,
            },
            {
              key: 'demands',
              icon: <BulbOutlined />,
              label: <Link to="/demands">需求审核</Link>,
            },
            {
              key: 'achievements',
              icon: <TrophyOutlined />,
              label: <Link to="/achievements">成果审核</Link>,
            },
            {
              key: 'artworks',
              icon: <PictureOutlined />,
              label: <Link to="/artworks">书画审核</Link>,
            },
            {
              key: 'tech-managers',
              icon: <TeamOutlined />,
              label: <Link to="/tech-managers">技术经理人</Link>,
            },
            {
              key: 'comments',
              icon: <MessageOutlined />,
              label: <Link to="/comments">留言管理</Link>,
            },
            {
              key: 'announcements',
              icon: <NotificationOutlined />,
              label: <Link to="/announcements">公告管理</Link>,
            },
            {
              key: 'alerts',
              icon: <BellOutlined />,
              label: <Link to="/alerts">告警中心</Link>,
            },
            {
              key: 'audit-logs',
              icon: <ProfileOutlined />,
              label: <Link to="/audit-logs">审计日志</Link>,
            },

            {
              key: 'orders',
              label: <Link to="/orders">订单管理</Link>,
            },
            {
              key: 'cases',
              icon: <SolutionOutlined />,
              label: <Link to="/cases">工单/争议</Link>,
            },
            {
              key: 'maintenance',
              icon: <ScheduleOutlined />,
              label: <Link to="/maintenance">年费托管</Link>,
            },
            {
              key: 'refunds',
              label: <Link to="/refunds">退款管理</Link>,
            },
            {
              key: 'settlements',
              label: <Link to="/settlements">放款/结算</Link>,
            },
            {
              key: 'invoices',
              label: <Link to="/invoices">发票管理</Link>,
            },
            {
              key: 'reports',
              icon: <FileTextOutlined />,
              label: <Link to="/reports">报表导出</Link>,
            },
            {
              key: 'config',
              icon: <SettingOutlined />,
              label: <Link to="/config">交易/推荐配置</Link>,
            },
            {
              key: 'regions',
              icon: <EnvironmentOutlined />,
              label: <Link to="/regions">地区/行业标签</Link>,
            },
            {
              key: 'patent-map',
              label: <Link to="/patent-map">专利地图 CMS</Link>,
            },
            {
              key: 'patents',
              icon: <BookOutlined />,
              label: <Link to="/patents">专利主数据</Link>,
            },
            {
              key: 'rbac',
              icon: <LockOutlined />,
              label: <Link to="/rbac">账号权限</Link>,
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header className="ipm-app-header" style={{ padding: '0 16px' }}>
          <div className="ipm-header-inner">
            <Typography.Text type="secondary">Ipmoney 运营后台</Typography.Text>
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
              退出登录
            </Button>
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
