import {
  AppstoreOutlined,
  EnvironmentOutlined,
  FileDoneOutlined,
  GiftOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Layout, Menu, Select, Space, Typography } from 'antd';
import React, { useMemo, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

import { getMockScenario, setMockScenario } from '../lib/api';
import logoPng from '../assets/brand/logo.png';

const { Header, Sider, Content } = Layout;

const ENABLE_MOCK_TOOLS =
  import.meta.env.VITE_ENABLE_MOCK_TOOLS === '1' || import.meta.env.VITE_ENABLE_MOCK_TOOLS === 'true';

export function AppLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [scenario, setScenario] = useState(getMockScenario());

  const selectedKeys = useMemo(() => {
    const path = location.pathname.replace(/^\//, '');
    if (!path) return ['dashboard'];
    return [path];
  }, [location.pathname]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} width={240}>
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
          theme="dark"
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
              key: 'orders',
              label: <Link to="/orders">订单管理</Link>,
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
          ]}
        />
      </Sider>
      <Layout>
        <Header className="ipm-app-header" style={{ padding: '0 16px' }}>
          <div className="ipm-header-inner">
            <Typography.Text type="secondary">Ipmoney 运营后台</Typography.Text>
            {ENABLE_MOCK_TOOLS ? (
              <Space size={8}>
                <Typography.Text type="secondary">场景</Typography.Text>
                <Select
                  size="small"
                  value={scenario}
                  style={{ width: 180 }}
                  options={[
                    { value: 'happy', label: 'happy' },
                    { value: 'empty', label: 'empty' },
                    { value: 'error', label: 'error' },
                    { value: 'edge', label: 'edge' },
                    { value: 'payment_callback_replay', label: 'payment_callback_replay' },
                    { value: 'refund_failed', label: 'refund_failed' },
                    { value: 'order_conflict', label: 'order_conflict' },
                  ]}
                  onChange={(v) => {
                    setScenario(v);
                    setMockScenario(v);
                  }}
                />
              </Space>
            ) : null}
          </div>
        </Header>
        <Content className="ipm-content">
          <div className="ipm-content-inner">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
