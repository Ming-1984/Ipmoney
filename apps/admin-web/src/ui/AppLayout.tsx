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
  ReconciliationOutlined,
  RollbackOutlined,
  ScheduleOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Avatar, Badge, Button, Layout, Menu, Spin, Typography, message } from 'antd';
import type { MenuProps } from 'antd';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import logoPng from '../assets/brand/logo.png';
import { ADMIN_BADGES_REFRESH_EVENT, apiGet } from '../lib/api';
import { isSuperAdminSession, type AdminSessionInfo } from '../lib/adminSession';
import { clearAdminToken, hasAdminToken } from '../lib/auth';
import { displayUserName, normalizeUserFacingText } from '../lib/userFacingText';

const { Header, Sider, Content } = Layout;

type SessionInfo = AdminSessionInfo;

type AppMenuItem = {
  key: string;
  icon?: React.ReactNode;
  label: string;
  to: string;
  permission?: string;
  group: 'workbench' | 'content' | 'commerce' | 'admin';
};

type AdminBadgesResponse = {
  badges?: Record<string, number>;
  updatedAt?: string;
};

const menuConfig: AppMenuItem[] = [
  { key: 'dashboard', icon: <AppstoreOutlined />, label: '仪表盘', to: '/', group: 'workbench' },
  { key: 'alerts', icon: <BellOutlined />, label: '告警中心', to: '/alerts', permission: 'alert.manage', group: 'workbench' },
  { key: 'comments', icon: <MessageOutlined />, label: '留言管理', to: '/comments', permission: 'listing.read', group: 'workbench' },
  { key: 'platform-conversations', icon: <MessageOutlined />, label: '平台咨询会话', to: '/conversations/platform', permission: 'conversation.platform.manage', group: 'workbench' },
  { key: 'verifications', icon: <FileDoneOutlined />, label: '认证审核', to: '/verifications', permission: 'verification.read', group: 'content' },
  { key: 'listings', icon: <GiftOutlined />, label: '挂牌审核', to: '/listings', permission: 'listing.read', group: 'content' },
  { key: 'tech-managers', icon: <TeamOutlined />, label: '技术经理人', to: '/tech-managers', permission: 'listing.read', group: 'content' },
  { key: 'achievements', icon: <CameraOutlined />, label: '专利成果', to: '/achievements', permission: 'listing.read', group: 'content' },
  { key: 'patents', icon: <BookOutlined />, label: '专利主数据', to: '/patents', permission: 'listing.read', group: 'content' },
  { key: 'patent-claims', icon: <BookOutlined />, label: '专利认领审核', to: '/patents/claims', permission: 'patent.claim.review', group: 'content' },
  { key: 'patent-ops', icon: <BookOutlined />, label: '专利批量处理', to: '/patents/operations', permission: 'patent.import', group: 'content' },
  { key: 'bulk-import', icon: <BookOutlined />, label: '成果/经理人导入', to: '/imports/bulk', permission: 'patent.import', group: 'content' },
  { key: 'orders', icon: <ShoppingCartOutlined />, label: '订单管理', to: '/orders', permission: 'order.read', group: 'commerce' },
  { key: 'cases', icon: <SolutionOutlined />, label: '工单/争议', to: '/cases', permission: 'case.manage', group: 'commerce' },
  { key: 'maintenance', icon: <ScheduleOutlined />, label: '年费托管', to: '/maintenance', permission: 'maintenance.manage', group: 'commerce' },
  { key: 'refunds', icon: <RollbackOutlined />, label: '退款管理', to: '/refunds', permission: 'refund.read', group: 'commerce' },
  { key: 'settlements', icon: <WalletOutlined />, label: '放款/结算', to: '/settlements', permission: 'settlement.read', group: 'commerce' },
  { key: 'invoices', icon: <ReconciliationOutlined />, label: '发票管理', to: '/invoices', permission: 'invoice.manage', group: 'commerce' },
  { key: 'reports', icon: <FileTextOutlined />, label: '报表导出', to: '/reports', permission: 'report.read', group: 'commerce' },
  { key: 'home-landing-config', icon: <SettingOutlined />, label: '首页展示内容', to: '/config/home-landing', permission: 'config.manage', group: 'workbench' },
  { key: 'home-announcements', icon: <BellOutlined />, label: '首页公告', to: '/home-announcements', permission: 'config.manage', group: 'workbench' },
  { key: 'config', icon: <SettingOutlined />, label: '高级系统配置', to: '/config', permission: 'config.manage', group: 'admin' },
  { key: 'regions', icon: <EnvironmentOutlined />, label: '地区/行业标签', to: '/regions', permission: 'config.manage', group: 'admin' },
  { key: 'audit-logs', icon: <ProfileOutlined />, label: '审计日志', to: '/audit-logs', permission: 'auditLog.read', group: 'admin' },
  { key: 'rbac', icon: <LockOutlined />, label: '账号权限', to: '/rbac', permission: 'rbac.manage', group: 'admin' },
];

const menuGroups: Array<{ key: AppMenuItem['group']; label: string }> = [
  { key: 'workbench', label: '运营工作台' },
  { key: 'content', label: '内容与审核' },
  { key: 'commerce', label: '交易与履约' },
  { key: 'admin', label: '管理员工具' },
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
  const [badges, setBadges] = useState<Record<string, number>>({});

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

  useEffect(() => {
    if (!session) {
      setBadges({});
      return;
    }
    let alive = true;
    const loadBadges = async () => {
      try {
        const data = await apiGet<AdminBadgesResponse>('/admin/notifications/badges');
        if (!alive) return;
        setBadges(data?.badges || {});
      } catch {
        if (alive) setBadges({});
      }
    };
    const refreshBadges = () => {
      void loadBadges();
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshBadges();
    };
    const refreshWhenFocused = () => {
      refreshBadges();
    };

    refreshBadges();
    const timer = window.setInterval(() => {
      refreshBadges();
    }, 15000);
    window.addEventListener(ADMIN_BADGES_REFRESH_EVENT, refreshBadges);
    window.addEventListener('focus', refreshWhenFocused);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener(ADMIN_BADGES_REFRESH_EVENT, refreshBadges);
      window.removeEventListener('focus', refreshWhenFocused);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [session, location.pathname]);

  const permissionSet = useMemo(() => {
    const next = new Set(session?.permissions || []);
    if (isSuperAdminSession(session)) next.add('*');
    return next;
  }, [session]);
  const sessionDisplayName = useMemo(
    () => displayUserName(session, '平台成员'),
    [session?.displayName, session?.nickname],
  );
  const sessionRoleLabel = useMemo(() => {
    const roleNames = (session?.roleNames || []).map((item) => normalizeUserFacingText(item)).filter(Boolean);
    if (roleNames.length > 0) return roleNames.join(' / ');
    return normalizeUserFacingText(session?.role) || '待配置角色';
  }, [session?.role, session?.roleNames]);

  const menuItems = useMemo<MenuProps['items']>(
    () => {
      const permittedItems = menuConfig.filter((item) => hasPermission(permissionSet, item.permission));
      return menuGroups
        .map((group) => {
          const groupItems = permittedItems
            .filter((item) => item.group === group.key)
            .map((item) => {
              const badgeCount = Math.max(0, Number(badges[item.key] || 0));
              return {
                key: item.key,
                icon: item.icon,
                label: (
                  <Link to={item.to} className="ipm-menu-link-with-badge">
                    <span className="ipm-menu-link-label">{item.label}</span>
                    {badgeCount > 0 ? <Badge count={badgeCount > 99 ? '99+' : badgeCount} size="small" /> : null}
                  </Link>
                ),
              };
            });
          if (groupItems.length === 0) return null;
          return {
            type: 'group' as const,
            key: `group-${group.key}`,
            label: group.label,
            children: groupItems,
          };
        })
        .filter(Boolean);
    },
    [badges, permissionSet],
  );

  useEffect(() => {
    if (loadingSession || !session) return;
    const availableKeys = new Set(
      menuConfig.filter((item) => hasPermission(permissionSet, item.permission)).map((item) => item.key),
    );
    const currentKey = location.pathname.replace(/^\//, '') || 'dashboard';
    const normalizedCurrentKey =
      currentKey.startsWith('orders/')
        ? 'orders'
        : currentKey.startsWith('config/home-landing')
        ? 'home-landing-config'
        : currentKey.startsWith('home-banners')
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
    if (path.startsWith('home-banners')) return ['home-landing-config'];
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
                <Typography.Text>{sessionDisplayName}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  角色：{sessionRoleLabel}
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
