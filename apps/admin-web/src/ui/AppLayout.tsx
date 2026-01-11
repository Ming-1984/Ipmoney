import { AppstoreOutlined, FileDoneOutlined, GiftOutlined, SettingOutlined } from '@ant-design/icons';
import { Layout, Menu, Select, Space, Typography } from 'antd';
import React, { useMemo, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

import { getMockScenario, setMockScenario } from '../lib/api';

const { Header, Sider, Content } = Layout;

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
        <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 16px' }}>
          <Typography.Text style={{ color: '#fff', fontWeight: 700 }}>Ipmoney 后台</Typography.Text>
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
              key: 'patent-map',
              label: <Link to="/patent-map">专利地图 CMS</Link>,
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 16px' }}>
          <Space size={16}>
            <Typography.Text type="secondary">P0 骨架演示（Mock 驱动）</Typography.Text>
            <Space size={8}>
              <Typography.Text type="secondary">场景</Typography.Text>
              <Select
                size="small"
                value={scenario}
                style={{ width: 140 }}
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
          </Space>
        </Header>
        <Content style={{ padding: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
