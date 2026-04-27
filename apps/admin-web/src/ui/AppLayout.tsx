import {
  AppstoreOutlined,
  BellOutlined,
  BookOutlined,
  CameraOutlined,
  EnvironmentOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  GiftOutlined,
  LockOutlined,
  MessageOutlined,
  ProfileOutlined,
  ScheduleOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Layout, Menu, Spin, Typography, message } from 'antd';
import type { MenuProps } from 'antd';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import logoPng from '../assets/brand/logo.png';
import { apiGet } from '../lib/api';
import { clearAdminToken, hasAdminToken } from '../lib/auth';

const { Header, Sider, Content } = Layout;

type SessionInfo = {
  userId: string;
  isAdmin: boolean;
  role?: string;
  roleNames?: string[];
  permissions?: string[];
  nickname?: string;
};

type AppMenuItem = {
  key: string;
  icon?: React.ReactNode;
  label: string;
  to: string;
  permission?: string;
};

const menuConfig: AppMenuItem[] = [
  { key: 'dashboard', icon: <AppstoreOutlined />, label: '仪表盘', to: '/' },
  { key: 'verifications', icon: <FileDoneOutlined />, label: '认证审核', to: '/verifications', permission: 'verification.read' },
  { key: 'listings', icon: <GiftOutlined />, label: '挂牌审核', to: '/listings', permission: 'listing.read' },
  { key: 'tech-managers', icon: <TeamOutlined />, label: '技术经理人', to: '/tech-managers', permission: 'listing.read' },
  { key: 'achievements', icon: <CameraOutlined />, label: '专利成果', to: '/achievements', permission: 'listing.read' },
  { key: 'comments', icon: <MessageOutlined />, label: '留言管理', to: '/comments', permission: 'listing.read' },
  { key: 'alerts', icon: <BellOutlined />, label: '告警中心', to: '/alerts', permission: 'alert.manage' },
  { key: 'audit-logs', icon: <ProfileOutlined />, label: '审计日志', to: '/audit-logs', permission: 'auditLog.read' },
  { key: 'orders', label: '订单管理', to: '/orders', permission: 'order.read' },
  { key: 'cases', icon: <SolutionOutlined />, label: '工单/争议', to: '/cases', permission: 'case.manage' },
  { key: 'maintenance', icon: <ScheduleOutlined />, label: '年费托管', to: '/maintenance', permission: 'maintenance.manage' },
  { key: 'refunds', label: '退款管理', to: '/refunds', permission: 'refund.read' },
  { key: 'settlements', label: '放款/结算', to: '/settlements', permission: 'settlement.read' },
  { key: 'invoices', label: '发票管理', to: '/invoices', permission: 'invoice.manage' },
  { key: 'reports', icon: <FileTextOutlined />, label: '报表导出', to: '/reports', permission: 'report.read' },
  { key: 'config', icon: <SettingOutlined />, label: '交易/推荐配置', to: '/config', permission: 'config.manage' },
  { key: 'home-landing-config', icon: <SettingOutlined />, label: '首页运营配置', to: '/config/home-landing', permission: 'config.manage' },
  { key: 'home-announcements', icon: <BellOutlined />, label: '首页公告', to: '/home-announcements', permission: 'config.manage' },
  { key: 'regions', icon: <EnvironmentOutlined />, label: '地区/行业标签', to: '/regions', permission: 'config.manage' },
  { key: 'patents', icon: <BookOutlined />, label: '专利主数据', to: '/patents', permission: 'listing.read' },
  { key: 'patent-ops', icon: <BookOutlined />, label: '专利批量运营', to: '/patents/operations', permission: 'patent.import' },
  { key: 'bulk-import', icon: <BookOutlined />, label: '统一批量导入', to: '/imports/bulk', permission: 'patent.import' },
  { key: 'patent-claims', icon: <BookOutlined />, label: '专利认领审核', to: '/patents/claims', permission: 'patent.claim.review' },
  { key: 'platform-conversations', icon: <MessageOutlined />, label: '平台咨询会话', to: '/conversations/platform', permission: 'conversation.platform.manage' },
  { key: 'rbac', icon: <LockOutlined />, label: '账号权限', to: '/rbac', permission: 'rbac.manage' },
];

function hasPermission(perms: Set<string>, permission?: string): boolean {
  if (!permission) return true;
  if (perms.has('*')) return true;
  return perms.has(permission);
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [session, setSession] = useState<SessionInfo | null>(null);

  const loadSession = async () => {
    if (!hasAdminToken()) {
      clearAdminToken();
      navigate('/login', { replace: true });
      return;
    }
    try {
      const data = await apiGet<SessionInfo>('/auth/session');
      if (!data?.isAdmin) {
        throw new Error('当前账号未开通后台权限');
      }
      setSession(data);
    } catch (e: any) {
      setSession(null);
      clearAdminToken();
      message.error(e?.message || '登录态失效，请重新登录');
      navigate('/login', { replace: true });
    } finally {
      setLoadingSession(false);
    }
  };

  useEffect(() => {
    void loadSession();
  }, []);

  const permissionSet = useMemo(() => new Set(session?.permissions || []), [session?.permissions]);

  const menuItems = useMemo<MenuProps['items']>(
    () =>
      menuConfig
        .filter((item) => hasPermission(permissionSet, item.permission))
        .map((item) => ({
          key: item.key,
          icon: item.icon,
          label: <Link to={item.to}>{item.label}</Link>,
        })),
    [permissionSet],
  );

  useEffect(() => {
    if (loadingSession || !session) return;
    const availableKeys = new Set((menuItems || []).map((item: any) => String(item?.key || '')));
    const currentKey = location.pathname.replace(/^\//, '') || 'dashboard';
    const normalizedCurrentKey =
      currentKey.startsWith('orders/')
        ? 'orders'
        : currentKey.startsWith('config/home-landing')
          ? 'home-landing-config'
          : currentKey.startsWith('patents/operations')
            ? 'patent-ops'
            : currentKey.startsWith('imports/bulk')
              ? 'bulk-import'
            : currentKey.startsWith('patents/claims')
              ? 'patent-claims'
              : currentKey.startsWith('patents/')
                ? 'patents'
                : currentKey.startsWith('conversations/platform')
                  ? 'platform-conversations'
                  : currentKey;
    if (normalizedCurrentKey === 'login') return;
    if (availableKeys.has(normalizedCurrentKey)) return;
    const firstItem = menuConfig.find((item) => hasPermission(permissionSet, item.permission));
    if (firstItem) {
      navigate(firstItem.to, { replace: true });
    }
  }, [loadingSession, location.pathname, menuItems, navigate, permissionSet, session]);

  const selectedKeys = useMemo(() => {
    const path = location.pathname.replace(/^\//, '');
    if (!path) return ['dashboard'];
    if (path.startsWith('orders/')) return ['orders'];
    if (path.startsWith('config/home-landing')) return ['home-landing-config'];
    if (path.startsWith('patents/operations')) return ['patent-ops'];
    if (path.startsWith('imports/bulk')) return ['bulk-import'];
    if (path.startsWith('patents/claims')) return ['patent-claims'];
    if (path.startsWith('patents/')) return ['patents'];
    if (path.startsWith('conversations/platform')) return ['platform-conversations'];
    return [path];
  }, [location.pathname]);

  if (loadingSession) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider className="ipm-sider" theme="light" collapsible collapsed={collapsed} onCollapse={setCollapsed} width={240}>
        <div className="ipm-logo">
          <div className="ipm-logo-mark" aria-hidden="true">
            <img src={logoPng} alt="" />
          </div>
          <div className="ipm-logo-text">
            <span style={{ color: '#fff', fontWeight: 800 }}>IPMONEY 后台</span>
            <span className="ipm-logo-subtitle" style={{ color: 'rgba(255,255,255,0.85)' }}>
              IPMONEY
            </span>
          </div>
        </div>
        <Menu theme="light" mode="inline" selectedKeys={selectedKeys} items={menuItems} />
      </Sider>
      <Layout>
        <Header className="ipm-app-header" style={{ padding: '0 16px' }}>
          <div className="ipm-header-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar size={30} icon={<UserOutlined />} />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <Typography.Text>{session.nickname || session.userId}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  角色：{(session.roleNames || []).join(' / ') || session.role || 'unknown'}
                </Typography.Text>
              </div>
            </div>
            <Button
              size="small"
              onClick={() => {
                clearAdminToken();
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
