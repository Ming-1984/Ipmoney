import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

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
import { PageHeader, Spacer } from '../../ui/layout';
import { Button, Input } from '../../ui/nutui';

type AuthTokenResponse = components['schemas']['AuthTokenResponse'];
type VerificationStatus = components['schemas']['VerificationStatus'];
type VerificationType = components['schemas']['VerificationType'];

export default function LoginPage() {
  const env = useMemo(() => Taro.getEnv(), []);
  const canWechatLogin = env === Taro.ENV_TYPE.WEAPP;

  const [busy, setBusy] = useState(false);

  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const afterLogin = useCallback((auth: AuthTokenResponse) => {
    setToken(auth.accessToken || 'demo-token');

    const vt = (auth.user?.verificationType || null) as VerificationType | null;
    const vs = (auth.user?.verificationStatus || null) as VerificationStatus | null;

    if (vt) setVerificationType(vt);
    else clearVerificationType();

    if (vs) setVerificationStatus(vs);
    else clearVerificationStatus();

    setOnboardingDone(Boolean(vt) || isOnboardingDone());

    Taro.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => {
      if (!vt) {
        Taro.redirectTo({ url: '/pages/onboarding/choose-identity/index' });
        return;
      }

      const pages = Taro.getCurrentPages();
      if (pages.length > 1) {
        Taro.navigateBack();
        return;
      }
      Taro.switchTab({ url: '/pages/home/index' });
    }, 200);
  }, []);

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
      Taro.showToast({ title: e?.message || '登录失败', icon: 'none' });
    } finally {
      setBusy(false);
    }
  }, [afterLogin, busy]);

  const sendSms = useCallback(async () => {
    if (busy) return;
    const p = phone.trim();
    if (!p) {
      Taro.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }
    setBusy(true);
    try {
      const res = await apiPost<{ cooldownSeconds: number }>('/auth/sms/send', { phone: p, purpose: 'LOGIN' });
      setCooldown(Number(res?.cooldownSeconds || 60));
      Taro.showToast({ title: '验证码已发送', icon: 'success' });
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '发送失败', icon: 'none' });
    } finally {
      setBusy(false);
    }
  }, [busy, phone]);

  const verifySms = useCallback(async () => {
    if (busy) return;
    const p = phone.trim();
    const c = smsCode.trim();
    if (!p) {
      Taro.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }
    if (!c) {
      Taro.showToast({ title: '请输入验证码', icon: 'none' });
      return;
    }
    setBusy(true);
    try {
      const auth = await apiPost<AuthTokenResponse>('/auth/sms/verify', { phone: p, code: c });
      afterLogin(auth);
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '登录失败', icon: 'none' });
    } finally {
      setBusy(false);
    }
  }, [afterLogin, busy, phone, smsCode]);

  return (
    <View className="container">
      <PageHeader title="登录" subtitle="登录后可收藏、咨询与交易；首次进入需选择身份，部分主体需资料审核。" />
      <Spacer />

      <View className="card">
        <Text className="text-card-title">微信登录</Text>
        <View style={{ height: '10rpx' }} />
        <Text className="muted">{canWechatLogin ? '小程序内可一键微信授权登录' : 'H5 端用于预览，可先快速登录体验流程'}</Text>
        <View style={{ height: '12rpx' }} />
        <Button loading={busy} disabled={busy} onClick={() => void wechatLogin()}>
          {canWechatLogin ? '微信授权登录' : '快速登录（预览）'}
        </Button>
      </View>

      <View style={{ height: '16rpx' }} />

      <View className="card">
        <Text className="text-card-title">短信登录</Text>
        <View style={{ height: '10rpx' }} />
        <Text className="muted">用于 H5 端登录；如收不到验证码，请检查手机号或稍后重试。</Text>
        <View style={{ height: '12rpx' }} />

        <Text className="muted">手机号</Text>
        <View style={{ height: '8rpx' }} />
        <Input value={phone} onChange={setPhone} placeholder="请输入手机号" type="digit" clearable />

        <View style={{ height: '12rpx' }} />
        <View className="row" style={{ gap: '12rpx', alignItems: 'center' }}>
          <View className="flex-1">
            <Button variant="ghost" loading={busy} disabled={busy || cooldown > 0} onClick={() => void sendSms()}>
              {cooldown > 0 ? `重新发送(${cooldown}s)` : '发送验证码'}
            </Button>
          </View>
        </View>

        <View style={{ height: '12rpx' }} />
        <Text className="muted">验证码</Text>
        <View style={{ height: '8rpx' }} />
        <Input value={smsCode} onChange={setSmsCode} placeholder="输入短信验证码" type="digit" clearable />

        <View style={{ height: '12rpx' }} />
        <Button loading={busy} disabled={busy} onClick={() => void verifySms()}>
          短信验证码登录
        </Button>
      </View>
    </View>
  );
}
