import { Alert, Button, Card, Form, Input, Space, Tabs, Typography, message } from 'antd';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiGet, apiPost } from '../lib/api';
import { clearAdminToken, setAdminToken } from '../lib/auth';
import logoPng from '../assets/brand/logo.png';

type SessionInfo = {
  userId: string;
  isAdmin: boolean;
  role?: string;
  roleNames?: string[];
  roleIds?: string[];
  permissions?: string[];
  nickname?: string;
};

type SmsSendResponse = { cooldownSeconds: number; debugCode?: string };
type SmsVerifyResponse = { accessToken: string };

export function LoginPage() {
  const navigate = useNavigate();
  const [tokenForm] = Form.useForm<{ token: string }>();
  const [smsForm] = Form.useForm<{ phone: string; code: string }>();
  const [activeTab, setActiveTab] = useState<'sms' | 'token'>('sms');
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const demoToken = String(import.meta.env.VITE_DEMO_ADMIN_TOKEN || '').trim();

  const cooldownText = useMemo(() => {
    if (cooldown <= 0) return '发送验证码';
    return `${cooldown}s 后重试`;
  }, [cooldown]);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const validateSessionAndEnter = async (token: string) => {
    setAdminToken(token);
    try {
      const session = await apiGet<SessionInfo>('/auth/session');
      if (!session?.isAdmin) {
        throw new Error('该账号不是后台员工账号，请联系管理员开通角色权限。');
      }
      navigate('/', { replace: true });
    } catch (e: any) {
      clearAdminToken();
      throw e;
    }
  };

  const onTokenLogin = async (values: { token: string }) => {
    const token = String(values?.token || '').trim();
    if (!token) return;
    setSubmitting(true);
    setAuthError(null);
    try {
      await validateSessionAndEnter(token);
    } catch (e: any) {
      const msg = e?.message || '登录失败，请检查 token 与权限。';
      setAuthError(msg);
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onSendSmsCode = async () => {
    const phone = String(smsForm.getFieldValue('phone') || '').trim();
    if (!phone) {
      smsForm.setFields([{ name: 'phone', errors: ['请输入手机号'] }]);
      return;
    }
    setSending(true);
    setAuthError(null);
    try {
      const res = await apiPost<SmsSendResponse>('/auth/sms/send', { phone, purpose: 'LOGIN' });
      setCooldown(Math.max(0, Number(res?.cooldownSeconds || 0)));
      setDebugCode(res?.debugCode || null);
      message.success('验证码已发送');
    } catch (e: any) {
      const msg = e?.message || '发送验证码失败';
      setAuthError(msg);
      message.error(msg);
    } finally {
      setSending(false);
    }
  };

  const onSmsLogin = async (values: { phone: string; code: string }) => {
    setSubmitting(true);
    setAuthError(null);
    try {
      const res = await apiPost<SmsVerifyResponse>('/auth/sms/verify', {
        phone: String(values.phone || '').trim(),
        code: String(values.code || '').trim(),
      });
      const token = String(res?.accessToken || '').trim();
      if (!token) throw new Error('登录返回 token 为空');
      await validateSessionAndEnter(token);
    } catch (e: any) {
      const msg = e?.message || '登录失败，请检查验证码和账号权限。';
      setAuthError(msg);
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

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
      <Card style={{ width: 460 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
          <div className="ipm-logo-mark" aria-hidden="true">
            <img src={logoPng} alt="" />
          </div>
          <div>
            <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 0 }}>
              Ipmoney 管理后台
            </Typography.Title>
            <Typography.Text type="secondary">员工登录与权限控制</Typography.Text>
          </div>
        </div>

        <Typography.Paragraph type="secondary">
          推荐使用手机号验证码登录。Token 登录仅用于开发联调和应急排障。
        </Typography.Paragraph>

        {authError ? <Alert style={{ marginBottom: 12 }} type="error" showIcon message={authError} /> : null}
        {debugCode ? (
          <Alert
            style={{ marginBottom: 12 }}
            type="warning"
            showIcon
            message={`开发环境验证码：${debugCode}`}
            description="仅开发环境显示，生产不会返回验证码明文。"
          />
        ) : null}

        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'sms' | 'token')}
          items={[
            {
              key: 'sms',
              label: '手机号登录',
              children: (
                <Form form={smsForm} layout="vertical" onFinish={onSmsLogin}>
                  <Form.Item
                    label="手机号"
                    name="phone"
                    rules={[
                      { required: true, message: '请输入手机号' },
                      { pattern: /^[0-9]{6,20}$/, message: '手机号格式不正确' },
                    ]}
                  >
                    <Input placeholder="例如 13800138000" autoComplete="tel" />
                  </Form.Item>
                  <Form.Item label="验证码" required>
                    <Space.Compact style={{ width: '100%' }}>
                      <Form.Item
                        name="code"
                        noStyle
                        rules={[
                          { required: true, message: '请输入验证码' },
                          { pattern: /^[0-9]{4,8}$/, message: '验证码格式不正确' },
                        ]}
                      >
                        <Input placeholder="请输入验证码" autoComplete="one-time-code" />
                      </Form.Item>
                      <Button disabled={cooldown > 0} loading={sending} onClick={onSendSmsCode}>
                        {cooldownText}
                      </Button>
                    </Space.Compact>
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={submitting} block>
                    登录后台
                  </Button>
                </Form>
              ),
            },
            {
              key: 'token',
              label: 'Token 登录',
              children: (
                <Form
                  form={tokenForm}
                  layout="vertical"
                  initialValues={demoToken ? { token: demoToken } : undefined}
                  onFinish={onTokenLogin}
                >
                  <Form.Item
                    label="Access Token"
                    name="token"
                    rules={[
                      { required: true, message: '请输入 token' },
                      { min: 8, message: 'token 长度至少 8 位' },
                    ]}
                  >
                    <Input placeholder="粘贴 Access Token（不含 Bearer）" autoComplete="off" />
                  </Form.Item>
                  {demoToken ? (
                    <Button
                      block
                      onClick={() => {
                        tokenForm.setFieldsValue({ token: demoToken });
                      }}
                      style={{ marginBottom: 12 }}
                    >
                      使用 Demo Token
                    </Button>
                  ) : null}
                  <Button type="primary" htmlType="submit" loading={submitting} block>
                    登录后台
                  </Button>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

