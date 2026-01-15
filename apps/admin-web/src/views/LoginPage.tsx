import { Button, Card, Form, Input, Typography } from 'antd';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import logoGif from '../assets/brand/logo.gif';

export function LoginPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'var(--ipm-bg)',
      }}
    >
      <Card style={{ width: 420 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
          <div className="ipm-logo-mark" aria-hidden="true">
            <img src={logoGif} alt="" />
          </div>
          <div>
            <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 0 }}>
              Ipmoney 管理后台
            </Typography.Title>
            <Typography.Text type="secondary">运营审核与订单管理</Typography.Text>
          </div>
        </div>
        <Typography.Paragraph type="secondary">
          用于审核上架、需求、成果、认证以及订单履约与结算管理。
        </Typography.Paragraph>
        <Form
          layout="vertical"
          onFinish={() => {
            navigate('/');
          }}
        >
          <Form.Item label="账号" name="username" rules={[{ required: true }]}>
            <Input placeholder="admin" />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true }]}>
            <Input.Password placeholder="••••••••" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
