import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import {
  clearVerificationStatus,
  clearVerificationType,
  isOnboardingDone,
  setOnboardingDone,
  setToken,
  setVerificationStatus,
  setVerificationType,
} from '../../lib/auth';
import { apiPost } from '../../lib/api';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { Button, Input, toast } from '../../ui/nutui';
import logoGif from '../../assets/brand/logo.gif';

type AuthTokenResponse = components['schemas']['AuthTokenResponse'];
type VerificationStatus = components['schemas']['VerificationStatus'];
type VerificationType = components['schemas']['VerificationType'];

type LoginTab = 'wechat' | 'sms';

export default function LoginPage() {
  const env = useMemo(() => Taro.getEnv(), []);
  const canWechatLogin = env === Taro.ENV_TYPE.WEAPP;

  const [activeTab, setActiveTab] = useState<LoginTab>(canWechatLogin ? 'wechat' : 'sms');
  const [busy, setBusy] = useState(false);

  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!canWechatLogin && activeTab !== 'sms') {
      setActiveTab('sms');
    }
  }, [activeTab, canWechatLogin]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const afterLogin = useCallback(
    (auth: AuthTokenResponse) => {
      setToken(auth.accessToken || 'demo-token');

      const vt = (auth.user?.verificationType || null) as VerificationType | null;
      const vs = (auth.user?.verificationStatus || null) as VerificationStatus | null;
      const nickname = String(auth.user?.nickname || '').trim();
      const avatarUrl = String(auth.user?.avatarUrl || '').trim();

      if (vt) setVerificationType(vt);
      else clearVerificationType();

      if (vs) setVerificationStatus(vs);
      else clearVerificationStatus();

      setOnboardingDone(Boolean(vt) || isOnboardingDone());

      const needProfile = canWechatLogin && (!nickname || !avatarUrl);

      toast('登录成功', { icon: 'success' });
      setTimeout(() => {
        const pages = Taro.getCurrentPages();
        const canGoBack = pages.length > 1;

        const nextType = !vt ? 'redirectTo' : canGoBack ? 'navigateBack' : 'switchTab';
        const nextUrl = !vt ? '/pages/onboarding/choose-identity/index' : '/pages/home/index';

        if (needProfile) {
          const qs = `from=login&nextType=${nextType}${nextUrl ? `&nextUrl=${encodeURIComponent(nextUrl)}` : ''}`;
          Taro.redirectTo({ url: `/pages/profile/edit/index?${qs}` });
          return;
        }

        if (nextType === 'redirectTo') {
          Taro.redirectTo({ url: nextUrl });
          return;
        }
        if (nextType === 'navigateBack') {
          Taro.navigateBack();
          return;
        }
        Taro.switchTab({ url: nextUrl });
      }, 200);
    },
    [canWechatLogin],
  );

  const wechatLogin = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      let code = 'demo-code';
      try {
        const res = await Taro.login();
        if (res?.code) code = res.code;
      } catch (_) {
        // non-weapp env: fallback to demo code
      }

      const auth = await apiPost<AuthTokenResponse>('/auth/wechat/mp-login', { code });
      afterLogin(auth);
    } catch (e: any) {
      toast(e?.message || '登录失败');
    } finally {
      setBusy(false);
    }
  }, [afterLogin, busy]);

  const sendSms = useCallback(async () => {
    if (busy) return;
    const p = phone.trim();
    if (!p) {
      toast('请输入手机号');
      return;
    }
    setBusy(true);
    try {
      const res = await apiPost<{ cooldownSeconds: number }>('/auth/sms/send', { phone: p, purpose: 'LOGIN' });
      setCooldown(Number(res?.cooldownSeconds || 60));
      toast('验证码已发送', { icon: 'success' });
    } catch (e: any) {
      toast(e?.message || '发送失败');
    } finally {
      setBusy(false);
    }
  }, [busy, phone]);

  const verifySms = useCallback(async () => {
    if (busy) return;
    const p = phone.trim();
    const c = smsCode.trim();
    if (!p) {
      toast('请输入手机号');
      return;
    }
    if (!c) {
      toast('请输入验证码');
      return;
    }
    setBusy(true);
    try {
      const auth = await apiPost<AuthTokenResponse>('/auth/sms/verify', { phone: p, code: c });
      afterLogin(auth);
    } catch (e: any) {
      toast(e?.message || '登录失败');
    } finally {
      setBusy(false);
    }
  }, [afterLogin, busy, phone, smsCode]);

  return (
    <View className="container login-page">
      <PageHeader title="登录" subtitle="欢迎回来" />
      <View className="login-hero">
        <View className="login-hero-bg" />
        <View className="login-brand">
          <View className="login-brand-logo">
            <Image src={logoGif} mode="aspectFit" className="login-brand-logo-img" />
          </View>
          <View>
            <Text className="login-brand-title">IPMONEY</Text>
            <Text className="login-brand-subtitle">专利点金台</Text>
          </View>
        </View>
        <Text className="login-hero-desc">登录后可收藏、咨询、下单；主体需审核通过后可交易。</Text>
      </View>

      <Surface className="login-card">
        {canWechatLogin ? (
          <View className="login-tabs">
            <Text
              className={`login-tab ${activeTab === 'wechat' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('wechat')}
            >
              微信登录
            </Text>
            <Text
              className={`login-tab ${activeTab === 'sms' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('sms')}
            >
              短信登录
            </Text>
          </View>
        ) : null}

        <Spacer size={12} />

        {activeTab === 'wechat' && canWechatLogin ? (
          <View className="login-panel">
            <Text className="login-panel-title">微信一键登录</Text>
            <Text className="login-panel-subtitle">授权后可同步头像昵称</Text>
            <Spacer size={10} />
            <Button className="login-primary-btn" loading={busy} disabled={busy} onClick={() => void wechatLogin()}>
              微信一键登录
            </Button>
          </View>
        ) : null}

        {activeTab === 'sms' ? (
          <View className="login-panel">
            <Text className="login-panel-title">手机号登录</Text>
            <Text className="login-panel-subtitle">用于电脑端/浏览器登录</Text>
            <Spacer size={12} />

            <View className="login-field">
              <Text className="login-field-label">手机号</Text>
              <View className="login-field-input">
                <Input value={phone} onChange={setPhone} placeholder="请输入手机号" type="digit" clearable />
              </View>
            </View>

            <Spacer size={10} />
            <Button variant="ghost" loading={busy} disabled={busy || cooldown > 0} onClick={() => void sendSms()}>
              {cooldown > 0 ? `重新发送(${cooldown}s)` : '发送验证码'}
            </Button>

            <Spacer size={12} />
            <View className="login-field">
              <Text className="login-field-label">验证码</Text>
              <View className="login-field-input">
                <Input value={smsCode} onChange={setSmsCode} placeholder="请输入短信验证码" type="digit" clearable />
              </View>
            </View>

            <Spacer size={12} />
            <Button className="login-primary-btn" loading={busy} disabled={busy} onClick={() => void verifySms()}>
              登录
            </Button>
          </View>
        ) : null}

        <Spacer size={10} />
        <View className="login-agreement">
          <Text className="login-agreement-text">登录即同意</Text>
          <Text className="login-agreement-link" onClick={() => Taro.navigateTo({ url: '/pages/legal/terms/index' })}>
            《用户协议》
          </Text>
          <Text className="login-agreement-text">和</Text>
          <Text className="login-agreement-link" onClick={() => Taro.navigateTo({ url: '/pages/legal/privacy/index' })}>
            《隐私政策》
          </Text>
        </View>
      </Surface>
    </View>
  );
}
