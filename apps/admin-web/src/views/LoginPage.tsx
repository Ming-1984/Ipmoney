import { Button, Card, Form, Input, Typography } from 'antd';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { setAdminToken } from '../lib/auth';
import logoPng from '../assets/brand/logo.png';

export function LoginPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<{ token: string }>();
  const demoToken = String(import.meta.env.VITE_DEMO_ADMIN_TOKEN || '').trim();

  return (
    <div
      className="admin-login-page"
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
            <Typography.Text type="secondary">运营审核与订单结算</Typography.Text>
          </div>
        </div>

        <Typography.Paragraph type="secondary">
          用于认证审核、上架审核和订单履约管理。
        </Typography.Paragraph>

        <Form
          form={form}
          layout="vertical"
          initialValues={demoToken ? { token: demoToken } : undefined}
          onFinish={(values) => {
            const token = String(values?.token || '').trim();
            if (!token) return;
            setAdminToken(token);
            navigate('/', { replace: true });
          }}
        >
          <Form.Item
            label="Access Token"
            name="token"
            rules={[
              { required: true, message: '请输入管理端 token' },
              { min: 8, message: 'token 长度至少 8 位' },
            ]}
          >
            <Input placeholder="Paste admin token (without 'Bearer ')" autoComplete="off" />
          </Form.Item>

          {demoToken ? (
            <Button
              block
              onClick={() => {
                form.setFieldsValue({ token: demoToken });
              }}
              style={{ marginBottom: 12 }}
            >
              Use demo token
            </Button>
          ) : null}

          <Button type="primary" htmlType="submit" block>
            Sign in
          </Button>
        </Form>
      </Card>
    </div>
  );
}
