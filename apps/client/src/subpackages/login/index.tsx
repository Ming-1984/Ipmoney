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
import { ensurePrivacyAuthorizationOrThrow } from '../../lib/privacyAuthorization';
import { PageHeader, Spacer } from '../../ui/layout';
import { Button, Input, toast } from '../../ui/nutui';
import brandLogoPng from '../../assets/brand/logo.png';

type AuthTokenResponse = components['schemas']['AuthTokenResponse'];
type VerificationStatus = components['schemas']['VerificationStatus'];
type VerificationType = components['schemas']['VerificationType'];

function buildQuery(params?: Record<string, any>): string {
  if (!params) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.join('&');
}

function getPageUrl(page: any): string {
  const route = String(page?.route || page?.__route__ || '').trim();
  if (!route) return '';
  const path = route.startsWith('/') ? route : `/${route}`;
  const query = buildQuery(page?.options || {});
  return query ? `${path}?${query}` : path;
}

export default function LoginPage() {
  const env = useMemo(() => Taro.getEnv(), []);
  const canWechatLogin = env === Taro.ENV_TYPE.WEAPP;
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(false);
  const pageVisibleRef = useRef(true);
  const phoneAuthPromptActiveRef = useRef(false);
  const agreementConfirmingRef = useRef(false);
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
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const ensureAgreement = useCallback(async () => {
    if (agree) return true;
    if (agreementConfirmingRef.current) return false;
    agreementConfirmingRef.current = true;
    try {
      const res = await Taro.showModal({
        title: '请先确认协议',
        content: '请确认已阅读并同意《用户服务协议》及《隐私政策》。',
        confirmText: '同意',
        cancelText: '取消',
        showCancel: true,
      });
      const ok = Boolean(res.confirm);
      if (ok) setAgree(true);
      return ok;
    } catch (error) {
      console.warn('[login] agreement modal failed', error);
      toast('协议确认弹窗打开失败，请稍后重试');
      return false;
    } finally {
      agreementConfirmingRef.current = false;
    }
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
          const previousPage = pages[pages.length - 2] as any;
          const previousUrl = normalizePageUrl(getPageUrl(previousPage));
          if (previousUrl === safeRedirectUrl) {
            Taro.navigateBack();
            return;
          }
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
          toast('你已取消微信手机号授权，可改用验证码登录');
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
    if (!(await ensureAgreement())) return;
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
    if (!(await ensureAgreement())) return;
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
    if (!(await ensureAgreement())) return;
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
      <PageHeader title="登录" brand={false} />
      <View className="login-brand">
        <View className="login-brand-bg" />
        <Image className="login-brand-ill" src={brandLogoPng} mode="aspectFit" />
        <Text className="login-brand-title">登录解锁专利点金台</Text>
        <View className="login-brand-desc">
          <Text className="login-brand-desc-line">登录后可收藏、咨询、下单</Text>
          <Text className="login-brand-desc-line">主体需审核通过后可交易</Text>
        </View>
      </View>

      <View className="login-card">
        {DEMO_LOGIN_ENABLED ? (
          <View className="login-dev-panel">
            <View className="login-panel">
              <Text className="login-panel-title">开发一键登录</Text>
              <Text className="login-panel-subtitle">仅开发/测试环境可见</Text>
              <Spacer size={10} />
              <Button className="login-primary-btn" loading={busy} disabled={busy} onClick={() => void demoLogin()}>
                体验登录
              </Button>
            </View>
            <Spacer size={18} />
          </View>
        ) : null}

        <View className="login-panel">
          <View className="login-field-row login-phone-row">
            <Text className="login-field-label">+86</Text>
            <View className="login-field-input">
              <Input
                value={phone}
                onChange={setPhone}
                placeholder="请输入手机号"
                placeholderClass="login-input-placeholder"
                placeholderStyle="font-size:24rpx;color:#b9ada2;"
                type="digit"
                clearable
                cursorColor="#1a1108"
              />
            </View>
          </View>

          <View className="login-field-row login-code-row">
            <View className="login-field-input">
              <Input
                value={smsCode}
                onChange={setSmsCode}
                placeholder="请输入短信验证码"
                placeholderClass="login-input-placeholder"
                placeholderStyle="font-size:24rpx;color:#b9ada2;"
                type="digit"
                clearable
                cursorColor="#1a1108"
              />
            </View>
            <View
              className={`login-code-inline-btn ${busy || cooldown > 0 ? 'is-disabled' : ''}`}
              hoverClass={busy || cooldown > 0 ? 'none' : 'login-code-inline-btn-active'}
              onClick={() => {
                if (busy || cooldown > 0) return;
                void sendSms();
              }}
            >
              {cooldown > 0 ? `${cooldown}s重发` : '获取验证码'}
            </View>
          </View>

          <View className="login-agreement">
            <View className={`login-agreement-check ${agree ? 'is-checked' : ''}`} onClick={() => setAgree((v) => !v)}>
              <Text className="login-agreement-check-mark">{agree ? '✓' : ''}</Text>
            </View>
            <Text className="login-agreement-text">我已阅读并同意</Text>
            <Text className="login-agreement-link" onClick={() => Taro.navigateTo({ url: '/subpackages/legal/terms/index' })}>
              《用户服务协议》
            </Text>
            <Text className="login-agreement-text">及</Text>
            <Text className="login-agreement-link" onClick={() => Taro.navigateTo({ url: '/subpackages/legal/privacy/index' })}>
              《隐私政策》
            </Text>
          </View>

          <Button className="login-primary-btn" loading={busy} disabled={busy} onClick={() => void verifySms()}>
            登录
          </Button>

          {canWechatLogin ? (
            <>
              <View className="login-divider">
                <View className="login-divider-line" />
                <Text className="login-divider-text">或</Text>
                <View className="login-divider-line" />
              </View>
              {agree ? (
                <TaroButton
                  className="login-quick-btn"
                  hoverClass="login-quick-btn-active"
                  loading={busy}
                  disabled={busy}
                  openType="getPhoneNumber"
                  onClick={() => {
                    phoneAuthPromptActiveRef.current = true;
                  }}
                  onGetPhoneNumber={onQuickWechatPhoneLogin}
                >
                  微信快捷登录
                </TaroButton>
              ) : (
                <View
                  className="login-quick-btn"
                  hoverClass="login-quick-btn-active"
                  onClick={() => {
                    void ensureAgreement();
                  }}
                >
                  微信快捷登录
                </View>
              )}
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}
