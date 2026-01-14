import { Button, Card, Form, Input, Typography } from 'antd';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import logoPng from '../assets/brand/logo.png';

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
            <img src={logoPng} alt="" />
          </div>
          <div>
            <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 0 }}>
              Ipmoney 管理后台
            </Typography.Title>
            <Typography.Text type="secondary">Ipmoney · P0 演示骨架</Typography.Text>
          </div>
        </div>
        <Typography.Paragraph type="secondary">
          登录逻辑后续对接 JWT + RBAC；当前为演示占位。
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
            登录（演示）
          </Button>
        </Form>
      </Card>
    </div>
  );
}
