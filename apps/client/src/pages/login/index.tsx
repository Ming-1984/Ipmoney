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
import { PageHeader, SectionHeader, Spacer, Surface, TipBanner } from '../../ui/layout';
import { Button, Input, toast } from '../../ui/nutui';

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
  }, [canWechatLogin]);

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
    <View className="container">
      <PageHeader title="登录" subtitle="登录后可收藏、咨询与交易；部分主体需资料审核通过后才能交易。" />
      <Spacer />

      <TipBanner tone="info" title="提示">
        游客可浏览列表与详情；收藏/咨询/下单/支付需登录；交易需审核通过。小程序内支持微信一键登录，电脑端可使用短信登录。
      </TipBanner>

      {canWechatLogin ? (
        <>
          <Spacer size={12} />
          <Surface>
            <SectionHeader title="微信登录" subtitle="小程序内支持一键授权登录" density="compact" />
            <Spacer size={8} />
            <Button loading={busy} disabled={busy} onClick={() => void wechatLogin()}>
              微信一键登录
            </Button>
          </Surface>
        </>
      ) : null}

      <Spacer size={12} />

      <Surface>
        <SectionHeader title="短信登录" subtitle="用于电脑端/浏览器登录" density="compact" />
        <Spacer size={10} />

        <Text className="muted">手机号</Text>
        <Spacer size={6} />
        <Input value={phone} onChange={setPhone} placeholder="请输入手机号" type="digit" clearable />

        <Spacer size={10} />
        <Button variant="ghost" loading={busy} disabled={busy || cooldown > 0} onClick={() => void sendSms()}>
          {cooldown > 0 ? `重新发送(${cooldown}s)` : '发送验证码'}
        </Button>

        <Spacer size={10} />
        <Text className="muted">验证码</Text>
        <Spacer size={6} />
        <Input value={smsCode} onChange={setSmsCode} placeholder="输入短信验证码" type="digit" clearable />

        <Spacer size={12} />
        <Button loading={busy} disabled={busy} onClick={() => void verifySms()}>
          登录
        </Button>
      </Surface>
    </View>
  );
}
