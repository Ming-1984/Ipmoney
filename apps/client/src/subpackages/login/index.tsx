import { View, Text, Image, Button as TaroButton } from '@tarojs/components';
import Taro, { useDidHide, useDidShow, useUnload } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { applyAuthSnapshot, isOnboardingDone } from '../../lib/auth';
import { DEMO_LOGIN_ENABLED } from '../../constants';
import { apiPost } from '../../lib/api';
import { isTabPageUrl, normalizePageUrl } from '../../lib/navigation';
import { useRouteStringParam } from '../../lib/routeParams';
import { ensurePrivacyAuthorizationOrThrow, isWeappPrivacyEnvironment } from '../../lib/privacyAuthorization';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { Button, Input, toast } from '../../ui/nutui';
import brandLogoPng from '../../assets/brand/logo.png';

type AuthTokenResponse = components['schemas']['AuthTokenResponse'];
type VerificationStatus = components['schemas']['VerificationStatus'];
type VerificationType = components['schemas']['VerificationType'];

type LoginTab = 'quick' | 'sms';

export default function LoginPage() {
  const env = useMemo(() => Taro.getEnv(), []);
  const canWechatLogin = env === Taro.ENV_TYPE.WEAPP;
  const privacyReady = useMemo(() => isWeappPrivacyEnvironment(), []);

  const [activeTab, setActiveTab] = useState<LoginTab>(canWechatLogin ? 'quick' : 'sms');
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(false);
  const pageVisibleRef = useRef(true);
  const phoneAuthPromptActiveRef = useRef(false);
  const actionSeqRef = useRef(0);
  const redirectParam = useRouteStringParam('redirect');
  const redirectUrl = useMemo(() => {
    if (!redirectParam) return '';
    try {
      return decodeURIComponent(redirectParam);
    } catch {
      return redirectParam;
    }
  }, [redirectParam]);
  const safeRedirectUrl = useMemo(() => normalizePageUrl(redirectUrl), [redirectUrl]);

  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useDidShow(() => {
    pageVisibleRef.current = true;
    phoneAuthPromptActiveRef.current = false;
  });

  useDidHide(() => {
    if (phoneAuthPromptActiveRef.current) return;
    pageVisibleRef.current = false;
    actionSeqRef.current += 1;
    setBusy(false);
  });

  useUnload(() => {
    pageVisibleRef.current = false;
    phoneAuthPromptActiveRef.current = false;
    actionSeqRef.current += 1;
  });

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

  const ensureAgreement = useCallback(() => {
    if (agree) return true;
    toast('请先阅读并同意《用户服务协议》和《隐私政策》');
    return false;
  }, [agree]);

  const afterLogin = useCallback(
    (auth: AuthTokenResponse, opts?: { seq?: number }) => {
      if (opts?.seq !== undefined && opts.seq !== actionSeqRef.current) return;
      if (!pageVisibleRef.current) return;
      const token = auth.accessToken || '';
      if (!token) {
        toast('登录失败，请稍后重试');
        return;
      }
      const vt = (auth.user?.verificationType || null) as VerificationType | null;
      const vs = (auth.user?.verificationStatus || null) as VerificationStatus | null;
      const onboardingDone = Boolean(vt) || isOnboardingDone();
      applyAuthSnapshot({
        token,
        onboardingDone,
        verificationType: vt,
        verificationStatus: vs,
      });

      toast('登录成功', { icon: 'success' });

      const goNext = () => {
        const pages = Taro.getCurrentPages();
        const canGoBack = pages.length > 1;

        if (safeRedirectUrl && !safeRedirectUrl.startsWith('/subpackages/login/index')) {
          if (isTabPageUrl(safeRedirectUrl)) {
            Taro.switchTab({ url: safeRedirectUrl });
            return;
          }
          Taro.redirectTo({ url: safeRedirectUrl });
          return;
        }

        const nextUrl = !vt ? '/subpackages/onboarding/choose-identity/index' : '/pages/home/index';

        if (!vt) {
          Taro.redirectTo({ url: nextUrl });
          return;
        }
        if (canGoBack) {
          Taro.navigateBack();
          return;
        }
        Taro.switchTab({ url: nextUrl });
      };

      const nextSeq = opts?.seq ?? actionSeqRef.current;
      setTimeout(() => {
        if (nextSeq !== actionSeqRef.current || !pageVisibleRef.current) return;
        goNext();
      }, 200);
    },
    [safeRedirectUrl],
  );

  const loginWithWechatPhone = useCallback(
    async (phoneCode: string) => {
      if (busy) return;
      const seq = ++actionSeqRef.current;
      setBusy(true);
      try {
        await ensurePrivacyAuthorizationOrThrow();
        const loginRes = await Taro.login();
        const code = String(loginRes?.code || '').trim();
        if (!code) throw new Error('无法获取微信登录凭证');

        const auth = await apiPost<AuthTokenResponse>('/auth/wechat/phone-login', { code, phoneCode });
        if (seq !== actionSeqRef.current || !pageVisibleRef.current) return;
        afterLogin(auth, { seq });
      } catch (e: any) {
        if (seq !== actionSeqRef.current || !pageVisibleRef.current) return;
        toast(e?.message || '登录失败');
      } finally {
        if (seq === actionSeqRef.current && pageVisibleRef.current) {
          setBusy(false);
        }
      }
    },
    [afterLogin, busy],
  );

  const onQuickWechatPhoneLogin = useCallback(
    (e: any) => {
      phoneAuthPromptActiveRef.current = false;

      const phoneCode = String(e?.detail?.code || '').trim();
      const errMsg = String(e?.detail?.errMsg || '').toLowerCase();
      if (!phoneCode) {
        if (errMsg.includes('deny') || errMsg.includes('cancel')) {
          toast('你已取消微信手机号授权，可改用短信验证码登录');
          return;
        }
        toast('未获取到手机号，请重试');
        return;
      }

      void loginWithWechatPhone(phoneCode);
    },
    [loginWithWechatPhone],
  );

  const demoLogin = useCallback(async () => {
    if (!DEMO_LOGIN_ENABLED || busy) return;
    if (!ensureAgreement()) return;
    const seq = ++actionSeqRef.current;
    setBusy(true);
    try {
      await ensurePrivacyAuthorizationOrThrow();
      const auth = await apiPost<AuthTokenResponse>('/auth/wechat/mp-login', { code: 'demo' });
      if (seq !== actionSeqRef.current || !pageVisibleRef.current) return;
      afterLogin(auth, { seq });
    } catch (e: any) {
      if (seq !== actionSeqRef.current || !pageVisibleRef.current) return;
      toast(e?.message || '登录失败');
    } finally {
      if (seq === actionSeqRef.current && pageVisibleRef.current) {
        setBusy(false);
      }
    }
  }, [afterLogin, busy, ensureAgreement]);

  const sendSms = useCallback(async () => {
    if (busy) return;
    if (!ensureAgreement()) return;
    const p = phone.trim();
    if (!p) {
      toast('请输入手机号');
      return;
    }
    const seq = ++actionSeqRef.current;
    setBusy(true);
    try {
      const res = await apiPost<{ cooldownSeconds: number }>('/auth/sms/send', { phone: p, purpose: 'LOGIN' });
      if (seq !== actionSeqRef.current || !pageVisibleRef.current) return;
      setCooldown(Number(res?.cooldownSeconds || 60));
      toast('验证码已发送', { icon: 'success' });
    } catch (e: any) {
      if (seq !== actionSeqRef.current || !pageVisibleRef.current) return;
      toast(e?.message || '发送失败');
    } finally {
      if (seq === actionSeqRef.current && pageVisibleRef.current) {
        setBusy(false);
      }
    }
  }, [busy, ensureAgreement, phone]);

  const verifySms = useCallback(async () => {
    if (busy) return;
    if (!ensureAgreement()) return;
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
    const seq = ++actionSeqRef.current;
    setBusy(true);
    try {
      const auth = await apiPost<AuthTokenResponse>('/auth/sms/verify', { phone: p, code: c });
      if (seq !== actionSeqRef.current || !pageVisibleRef.current) return;
      afterLogin(auth, { seq });
    } catch (e: any) {
      if (seq !== actionSeqRef.current || !pageVisibleRef.current) return;
      toast(e?.message || '登录失败');
    } finally {
      if (seq === actionSeqRef.current && pageVisibleRef.current) {
        setBusy(false);
      }
    }
  }, [afterLogin, busy, ensureAgreement, phone, smsCode]);

  return (
    <View className="container login-page">
      <PageHeader title="登录" subtitle="欢迎回来" />
      <View className="login-hero">
        <View className="login-hero-bg" />
        <Image className="login-hero-ill" src={brandLogoPng} mode="aspectFit" />
        <Text className="login-hero-title">登录解锁专利点金台</Text>
        <Text className="login-hero-desc">登录后可收藏、咨询、下单；主体需审核通过后可交易。</Text>
      </View>

      <Surface className="login-card">
        {DEMO_LOGIN_ENABLED ? (
          <>
            <View className="login-panel">
              <Text className="login-panel-title">开发一键登录</Text>
              <Text className="login-panel-subtitle">仅开发/测试环境可见</Text>
              <Spacer size={10} />
              <Button className="login-primary-btn" loading={busy} disabled={busy} onClick={() => void demoLogin()}>
                体验登录
              </Button>
            </View>
            <Spacer size={12} />
          </>
        ) : null}
        {canWechatLogin ? (
          <View className="login-tabs">
            <Text
              className={`login-tab ${activeTab === 'quick' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('quick')}
            >
              手机号快捷登录
            </Text>
            <Text
              className={`login-tab ${activeTab === 'sms' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('sms')}
            >
              短信验证码登录
            </Text>
          </View>
        ) : null}

        <Spacer size={12} />

        {activeTab === 'quick' && canWechatLogin ? (
          <View className="login-panel">
            <Text className="login-panel-title">手机号快捷登录</Text>
            <Text className="login-panel-subtitle">使用微信官方手机号授权能力，一步完成登录与手机号绑定</Text>
            <Spacer size={10} />
            <TaroButton
              className="login-primary-btn login-wechat-btn"
              loading={busy}
              disabled={busy || !agree || !privacyReady}
              openType="getPhoneNumber"
              onClick={() => {
                phoneAuthPromptActiveRef.current = true;
              }}
              onGetPhoneNumber={onQuickWechatPhoneLogin}
            >
              微信手机号快捷登录
            </TaroButton>
          </View>
        ) : null}

        {activeTab === 'sms' ? (
          <View className="login-panel">
            <Text className="login-panel-title">短信验证码登录</Text>
            <Text className="login-panel-subtitle">输入手机号和验证码完成登录</Text>
            <Spacer size={12} />

            <View className="login-field">
              <Text className="login-field-label">手机号</Text>
              <View className="login-field-input">
                <Input value={phone} onChange={setPhone} placeholder="请输入手机号" type="digit" clearable />
              </View>
            </View>

            <Spacer size={10} />
            <Button
              className="login-code-btn"
              variant="ghost"
              loading={busy}
              disabled={busy || cooldown > 0}
              onClick={() => void sendSms()}
            >
              {cooldown > 0 ? `重新发送(${cooldown}s)` : '发送验证码'}
            </Button>

            <Spacer size={12} />
            <View className="login-field">
              <Text className="login-field-label">验证码</Text>
              <View className="login-field-input">
                <Input
                  value={smsCode}
                  onChange={setSmsCode}
                  placeholder="请输入短信验证码"
                  type="digit"
                  clearable
                />
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
          <View className={`login-agreement-check ${agree ? 'is-checked' : ''}`} onClick={() => setAgree((v) => !v)}>
            <Text className="login-agreement-check-mark">{agree ? '✓' : ''}</Text>
          </View>
          <Text className="login-agreement-text">我已阅读并同意</Text>
          <Text className="login-agreement-link" onClick={() => Taro.navigateTo({ url: '/subpackages/legal/terms/index' })}>
            《用户服务协议》
          </Text>
          <Text className="login-agreement-text">和</Text>
          <Text className="login-agreement-link" onClick={() => Taro.navigateTo({ url: '/subpackages/legal/privacy/index' })}>
            《隐私政策》
          </Text>
        </View>
      </Surface>
    </View>
  );
}
