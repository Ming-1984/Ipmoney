import { View, Text, Image, Button as TaroButton } from '@tarojs/components';
import Taro, { useDidHide, useDidShow, useUnload } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import {
  applyAuthSnapshot,
  clearToken,
  getToken,
  getVerificationStatus,
  getVerificationType,
  isOnboardingDone,
  onAuthChanged,
} from '../../lib/auth';
import { DEMO_LOGIN_ENABLED } from '../../constants';
import { apiGet, apiPost } from '../../lib/api';
import { getDetailCache, setDetailCache } from '../../lib/detailCache';
import { displayInitial, displayUserName } from '../../lib/displayText';
import { ensurePrivacyAuthorizationOrThrow } from '../../lib/privacyAuthorization';
import { verificationStatusLabel, verificationTypeLabel } from '../../lib/labels';
import { ensureRegionNamesReady, profileRegionDisplayName } from '../../lib/regions';
import { ErrorCard } from '../../ui/StateCards';
import { Surface } from '../../ui/layout';
import { Avatar, Button, Input, PullToRefresh, toast } from '../../ui/nutui';

import iconUser from '../../assets/icons/icon-user-purple.svg';
import iconPublishPatent from '../../assets/icons/icon-publish-patent.svg';
import iconOrderBuyer from '../../assets/icons/icon-order-buyer.svg';
import iconOrderSeller from '../../assets/icons/icon-order-seller.svg';
import iconContractCenter from '../../assets/icons/icon-contract-center.svg';
import iconInvoiceCenter from '../../assets/icons/icon-invoice-center.svg';
import iconNotification from '../../assets/icons/icon-notification.svg';
import iconMeFavorites from '../../assets/icons/icon-me-favorites.svg';
import iconMeCsCenter from '../../assets/icons/icon-me-cs-center.svg';
import iconMeAddress from '../../assets/icons/icon-me-address.svg';
import iconMeIdentity from '../../assets/icons/icon-me-identity.svg';
import iconMeProfile from '../../assets/icons/icon-me-profile.svg';
import iconMeAbout from '../../assets/icons/icon-me-about.svg';
import iconMeTradeRules from '../../assets/icons/icon-me-trade-rules.svg';
import brandLogoPng from '../../assets/brand/logo.png';

type Me = {
  id: string;
  phone?: string;
  nickname?: string;
  displayName?: string;
  avatarUrl?: string;
  role?: string;
  verificationStatus?: string;
  verificationType?: string;
  regionCode?: string;
  createdAt?: string;
  updatedAt?: string;
};

type UserVerification = components['schemas']['UserVerification'];
type AuthTokenResponse = components['schemas']['AuthTokenResponse'];
type VerificationStatus = components['schemas']['VerificationStatus'];
type VerificationType = components['schemas']['VerificationType'];

type IconItem = { key: string; label: string; icon: string; onClick: () => void };
type ToolItem = { key: string; label: string; icon: string; value?: string; onClick: () => void };
type AuthState = {
  token: string | null;
  onboardingDone: boolean;
  verificationType: VerificationType | null;
  verificationStatus: VerificationStatus | null;
};

function svgDataUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const ME_PUBLISH_PATENT_ICON = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <path d="M9.5 4.5h9.8L24.5 9.7v17.8h-17V6.5a2 2 0 0 1 2-2Z" stroke="#FF5F00" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M19.3 4.5v5.2h5.2" stroke="#FF5F00" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M12.2 19.5h7.6" stroke="#FF5F00" stroke-width="2.2" stroke-linecap="round"/>
</svg>
`);

const ME_PUBLISH_ACHIEVEMENT_ICON = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <path d="M16 22v-2.2c0-1 .5-1.9 1.4-2.5a6.8 6.8 0 1 0-8.2-6.6" stroke="#FF5F00" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M12.3 25h7.4" stroke="#FF5F00" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M13.7 28h4.6" stroke="#FF5F00" stroke-width="2.2" stroke-linecap="round"/>
</svg>
`);

const ME_PROFILE_CACHE_SCOPE = 'me-profile';
const ME_PROFILE_CACHE_KEY = 'self';

function readAuthState(): AuthState {
  return {
    token: getToken(),
    onboardingDone: isOnboardingDone(),
    verificationType: getVerificationType(),
    verificationStatus: getVerificationStatus(),
  };
}

export default function MePage() {
  const authTokenRef = useRef<string | null>(null);
  const pageVisibleRef = useRef(true);
  const phoneAuthPromptActiveRef = useRef(false);
  const loadMeSeqRef = useRef(0);
  const verificationSeqRef = useRef(0);
  const loginActionSeqRef = useRef(0);
  const logoutSeqRef = useRef(0);
  const loadMeRef = useRef<((options?: { silent?: boolean }) => Promise<void>) | null>(null);
  const env = useMemo(() => Taro.getEnv(), []);
  const canWechatLogin = env === Taro.ENV_TYPE.WEAPP;
  const [auth, setAuth] = useState<AuthState>(() => readAuthState());
  const syncAuthState = useCallback(() => {
    const next = readAuthState();
    setAuth((prev) => {
      if (
        prev.token === next.token &&
        prev.onboardingDone === next.onboardingDone &&
        prev.verificationType === next.verificationType &&
        prev.verificationStatus === next.verificationStatus
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  useDidShow(() => {
    pageVisibleRef.current = true;
    phoneAuthPromptActiveRef.current = false;
    syncAuthState();
    if (authTokenRef.current) {
      void loadMeRef.current?.({ silent: true });
    }
  });

  useDidHide(() => {
    if (phoneAuthPromptActiveRef.current) return;
    pageVisibleRef.current = false;
    loadMeSeqRef.current += 1;
    verificationSeqRef.current += 1;
    loginActionSeqRef.current += 1;
    logoutSeqRef.current += 1;
    setBusy(false);
    setRefreshing(false);
  });

  useUnload(() => {
    pageVisibleRef.current = false;
    phoneAuthPromptActiveRef.current = false;
    loadMeSeqRef.current += 1;
    verificationSeqRef.current += 1;
    loginActionSeqRef.current += 1;
    logoutSeqRef.current += 1;
  });

  useEffect(() => {
    const off = onAuthChanged(() => {
      syncAuthState();
    });
    return () => off();
  }, [syncAuthState]);

  const initialCachedMe = getDetailCache<Me>(ME_PROFILE_CACHE_SCOPE, ME_PROFILE_CACHE_KEY);
  const [meLoading, setMeLoading] = useState(Boolean(auth.token) && !initialCachedMe);
  const [meError, setMeError] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(initialCachedMe);
  const [orderTab, setOrderTab] = useState<'orders' | 'publish'>('orders');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(false);
  const agreementConfirmingRef = useRef(false);
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    authTokenRef.current = auth.token;
  }, [auth.token]);

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
      console.warn('[me] agreement modal failed', error);
      toast('协议确认弹窗打开失败，请稍后重试');
      return false;
    } finally {
      agreementConfirmingRef.current = false;
    }
  }, [agree]);

  const loadMe = useCallback(async (options?: { silent?: boolean }) => {
    if (!auth.token) return;
    const currentToken = auth.token;
    const seq = ++loadMeSeqRef.current;
    const silent = Boolean(options?.silent);
    const cached = !silent ? getDetailCache<Me>(ME_PROFILE_CACHE_SCOPE, ME_PROFILE_CACHE_KEY) : null;
    const hasCached = Boolean(cached);
    if (!silent) {
      if (cached) {
        setMe(cached);
        setMeLoading(false);
      } else {
        setMeLoading(true);
      }
    }
    setMeError(null);
    try {
      await ensureRegionNamesReady();
      const d = await apiGet<Me>('/me');
      if (seq !== loadMeSeqRef.current || !pageVisibleRef.current || authTokenRef.current !== currentToken) return;
      setMe(d);
      setDetailCache(ME_PROFILE_CACHE_SCOPE, ME_PROFILE_CACHE_KEY, d);
    } catch (e: any) {
      if (seq !== loadMeSeqRef.current || !pageVisibleRef.current || authTokenRef.current !== currentToken) return;
      if (!hasCached) {
        setMeError(e?.message || '加载失败');
        setMe(null);
      }
    } finally {
      if (seq !== loadMeSeqRef.current || !pageVisibleRef.current || authTokenRef.current !== currentToken) return;
      if (!silent) setMeLoading(false);
    }
  }, [auth.token]);
  loadMeRef.current = loadMe;

  const syncVerification = useCallback(async () => {
    if (!auth.token) return;
    const currentToken = auth.token;
    const seq = ++verificationSeqRef.current;
    if (!auth.onboardingDone) {
      if (seq !== verificationSeqRef.current || !pageVisibleRef.current || authTokenRef.current !== currentToken) return;
      applyAuthSnapshot({
        token: currentToken,
        onboardingDone: false,
        verificationType: null,
        verificationStatus: null,
      });
      syncAuthState();
      return;
    }
    try {
      const v = await apiGet<UserVerification>('/me/verification');
      if (seq !== verificationSeqRef.current || !pageVisibleRef.current || authTokenRef.current !== currentToken) return;
      applyAuthSnapshot({
        token: currentToken,
        onboardingDone: true,
        verificationType: (v?.type || null) as VerificationType | null,
        verificationStatus: (v?.status || null) as VerificationStatus | null,
      });
    } catch (e: any) {
      if (seq !== verificationSeqRef.current || !pageVisibleRef.current || authTokenRef.current !== currentToken) return;
      const statusCode = Number(e?.statusCode || 0);
      const code = String(e?.code || '');
      if (statusCode === 404 || code === 'NOT_FOUND') {
        applyAuthSnapshot({
          token: currentToken,
          onboardingDone: false,
          verificationType: null,
          verificationStatus: null,
        });
      }
    } finally {
      if (seq !== verificationSeqRef.current || !pageVisibleRef.current || authTokenRef.current !== currentToken) return;
      syncAuthState();
    }
  }, [auth.onboardingDone, auth.token, syncAuthState]);

  const refresh = useCallback(async () => {
    if (!auth.token) return;
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([loadMe({ silent: true }), syncVerification()]);
    } finally {
      setRefreshing(false);
    }
  }, [auth.token, loadMe, refreshing, syncVerification]);

  useEffect(() => {
    if (!auth.token) {
      loadMeSeqRef.current += 1;
      verificationSeqRef.current += 1;
      setMe(null);
      return;
    }
    void loadMe();
  }, [auth.token, loadMe]);

  useEffect(() => {
    if (!auth.token || !auth.onboardingDone) return;
    void syncVerification();
  }, [auth.onboardingDone, auth.token, syncVerification]);

  const afterLogin = useCallback((authToken: AuthTokenResponse) => {
    const token = authToken.accessToken || '';
    if (!token) {
      toast('登录失败，请稍后重试');
      return;
    }
    if (!pageVisibleRef.current) return;
    const vt = (authToken.user?.verificationType || null) as VerificationType | null;
    const vs = (authToken.user?.verificationStatus || null) as VerificationStatus | null;

    const onboardingDone = Boolean(vt) || isOnboardingDone();
    applyAuthSnapshot({
      token,
      onboardingDone,
      verificationType: vt,
      verificationStatus: vs,
    });
    setAuth({
      token,
      onboardingDone,
      verificationType: vt,
      verificationStatus: vs,
    });

    toast('登录成功', { icon: 'success' });

    const goNext = () => {
      const pages = Taro.getCurrentPages();
      const canGoBack = pages.length > 1;
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

    const nextSeq = loginActionSeqRef.current;
    setTimeout(() => {
      if (nextSeq !== loginActionSeqRef.current || !pageVisibleRef.current) return;
      goNext();
    }, 200);
  }, []);

  const loginWithWechatPhone = useCallback(
    async (phoneCode: string) => {
      if (busy) return;
      const seq = ++loginActionSeqRef.current;
      setBusy(true);
      try {
        await ensurePrivacyAuthorizationOrThrow();
        const loginRes = await Taro.login();
        const code = String(loginRes?.code || '').trim();
        if (!code) throw new Error('无法获取微信登录凭证');

        const authToken = await apiPost<AuthTokenResponse>('/auth/wechat/phone-login', { code, phoneCode });
        if (seq !== loginActionSeqRef.current || !pageVisibleRef.current) return;
        afterLogin(authToken);
      } catch (e: any) {
        if (seq !== loginActionSeqRef.current || !pageVisibleRef.current) return;
        toast(e?.message || '登录失败');
      } finally {
        if (seq === loginActionSeqRef.current && pageVisibleRef.current) {
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
    const seq = ++loginActionSeqRef.current;
    setBusy(true);
    try {
      await ensurePrivacyAuthorizationOrThrow();
      const authToken = await apiPost<AuthTokenResponse>('/auth/wechat/mp-login', { code: 'demo' });
      if (seq !== loginActionSeqRef.current || !pageVisibleRef.current) return;
      afterLogin(authToken);
    } catch (e: any) {
      if (seq !== loginActionSeqRef.current || !pageVisibleRef.current) return;
      toast(e?.message || '登录失败');
    } finally {
      if (seq === loginActionSeqRef.current && pageVisibleRef.current) {
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
    const seq = ++loginActionSeqRef.current;
    setBusy(true);
    try {
      const res = await apiPost<{ cooldownSeconds: number }>('/auth/sms/send', { phone: p, purpose: 'LOGIN' });
      if (seq !== loginActionSeqRef.current || !pageVisibleRef.current) return;
      setCooldown(Number(res?.cooldownSeconds || 60));
      toast('验证码已发送', { icon: 'success' });
    } catch (e: any) {
      if (seq !== loginActionSeqRef.current || !pageVisibleRef.current) return;
      toast(e?.message || '发送失败');
    } finally {
      if (seq === loginActionSeqRef.current && pageVisibleRef.current) {
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
    const seq = ++loginActionSeqRef.current;
    setBusy(true);
    try {
      const authToken = await apiPost<AuthTokenResponse>('/auth/sms/verify', { phone: p, code: c });
      if (seq !== loginActionSeqRef.current || !pageVisibleRef.current) return;
      afterLogin(authToken);
    } catch (e: any) {
      if (seq !== loginActionSeqRef.current || !pageVisibleRef.current) return;
      toast(e?.message || '登录失败');
    } finally {
      if (seq === loginActionSeqRef.current && pageVisibleRef.current) {
        setBusy(false);
      }
    }
  }, [afterLogin, busy, ensureAgreement, phone, smsCode]);

  const verification = useMemo(() => {
    return { type: auth.verificationType, status: auth.verificationStatus };
  }, [auth.verificationStatus, auth.verificationType]);

  const buildOrderUrl = useCallback((role: 'BUYER' | 'SELLER', opts?: { tab?: string; status?: string }) => {
    const base = `/subpackages/orders/index?role=${role}`;
    if (opts?.status) return `${base}&status=${encodeURIComponent(opts.status)}`;
    if (opts?.tab) return `${base}&tab=${encodeURIComponent(opts.tab)}`;
    return base;
  }, []);
  const openProfileSettings = useCallback(() => {
    Taro.navigateTo({ url: '/subpackages/profile/edit/index' });
  }, []);

  const orderManageItems = useMemo<IconItem[]>(
    () => [
      { key: 'buyer', label: '买家订单', icon: iconOrderBuyer, onClick: () => Taro.navigateTo({ url: buildOrderUrl('BUYER') }) },
      { key: 'seller', label: '卖家订单', icon: iconOrderSeller, onClick: () => Taro.navigateTo({ url: buildOrderUrl('SELLER') }) },
      { key: 'contract', label: '合同中心', icon: iconContractCenter, onClick: () => Taro.navigateTo({ url: '/subpackages/contracts/index' }) },
      { key: 'invoice', label: '发票管理', icon: iconInvoiceCenter, onClick: () => Taro.navigateTo({ url: '/subpackages/invoices/index' }) },
    ],
    [buildOrderUrl],
  );

  const publishItems = useMemo<IconItem[]>(
    () => [
      { key: 'listings', label: '我的专利', icon: ME_PUBLISH_PATENT_ICON, onClick: () => Taro.navigateTo({ url: '/subpackages/my-listings/index' }) },
      { key: 'achievements', label: '我的专利成果', icon: ME_PUBLISH_ACHIEVEMENT_ICON, onClick: () => Taro.navigateTo({ url: '/subpackages/my-achievements/index' }) },
    ],
    [],
  );

  const favoriteItems = useMemo<ToolItem[]>(
    () => [
      {
        key: 'favorites',
        label: '我的收藏',
        icon: iconMeFavorites,
        onClick: () => Taro.navigateTo({ url: '/subpackages/favorites/index' }),
      },
    ],
    [],
  );

  const serviceItems = useMemo<ToolItem[]>(
    () => [
      {
        key: 'support',
        label: '客服中心',
        icon: iconMeCsCenter,
        onClick: () => Taro.navigateTo({ url: '/subpackages/support/index' }),
      },
      {
        key: 'notice',
        label: '通知',
        icon: iconNotification,
        onClick: () => Taro.navigateTo({ url: '/subpackages/notifications/index' }),
      },
      {
        key: 'address',
        label: '地址管理',
        icon: iconMeAddress,
        onClick: () => Taro.navigateTo({ url: '/subpackages/addresses/index' }),
      },
      {
        key: 'patent-claims',
        label: '专利认领记录',
        icon: iconPublishPatent,
        onClick: () => Taro.navigateTo({ url: '/subpackages/patent-claims/index' }),
      },
      {
        key: 'maintenance',
        label: '年费托管',
        icon: iconContractCenter,
        onClick: () => Taro.navigateTo({ url: '/subpackages/maintenance/index' }),
      },
    ],
    [],
  );

  const accountItems = useMemo<ToolItem[]>(
    () => [
      {
        key: 'identity',
        label: '身份/认证',
        value: verificationStatusLabel(verification.status),
        icon: iconMeIdentity,
        onClick: () => Taro.navigateTo({ url: '/subpackages/onboarding/choose-identity/index' }),
      },
      {
        key: 'profile',
        label: '资料设置',
        icon: iconMeProfile,
        onClick: openProfileSettings,
      },
      {
        key: 'about',
        label: '关于与合规',
        icon: iconMeAbout,
        onClick: () => Taro.navigateTo({ url: '/subpackages/about/index' }),
      },
      {
        key: 'rules',
        label: '交易规则',
        icon: iconMeTradeRules,
        onClick: () => Taro.navigateTo({ url: '/subpackages/trade-rules/index' }),
      },
    ],
    [openProfileSettings, verification.status],
  );

  const displayName = displayUserName(me, '平台用户');
  const displayInitialText = displayInitial(displayName, '平');
  const displayPhone = me?.phone || '未绑定手机号';
  const rawRegion = profileRegionDisplayName(me?.id, me?.regionCode);
  const displayRegion = rawRegion && rawRegion !== me?.regionCode && !/^\d+$/.test(rawRegion) ? rawRegion : '';
  const displayRegionText = displayRegion || '未设置';
  const orderItems = orderTab === 'orders' ? orderManageItems : publishItems;

  if (!auth.token) {
    return (
      <View className="container me-page me-page-locked page-locked">
        <View className="me-login-wrap">
          <View className="me-login-brand">
            <View className="me-login-brand-bg" />
            <Image className="me-login-ill" src={brandLogoPng} mode="aspectFit" />
            <Text className="me-login-title">登录解锁专利点金台</Text>
            <View className="me-login-desc">
              <Text className="me-login-desc-line">登录后可收藏、咨询、下单</Text>
              <Text className="me-login-desc-line">主体需审核通过后可交易</Text>
            </View>
          </View>

          <View className="me-login-card">
            {DEMO_LOGIN_ENABLED ? (
              <View className="me-login-dev-panel">
                <Button
                  className="me-login-btn me-login-btn-demo"
                  variant="default"
                  loading={busy}
                  disabled={busy}
                  onClick={() => void demoLogin()}
                >
                  开发一键登录
                </Button>
              </View>
            ) : null}

            <View className="me-login-field-row me-login-phone-row">
              <Text className="me-login-label">+86</Text>
              <View className="me-login-input">
                <Input
                  value={phone}
                  onChange={setPhone}
                  placeholder="请输入手机号"
                  placeholderClass="me-login-placeholder"
                  placeholderStyle="font-size:24rpx;color:#b9ada2;"
                  type="digit"
                  clearable
                  cursorColor="#1a1108"
                />
              </View>
            </View>

            <View className="me-login-field-row me-login-code-row">
              <View className="me-login-input">
                <Input
                  value={smsCode}
                  onChange={setSmsCode}
                  placeholder="请输入短信验证码"
                  placeholderClass="me-login-placeholder"
                  placeholderStyle="font-size:24rpx;color:#b9ada2;"
                  type="digit"
                  clearable
                  cursorColor="#1a1108"
                />
              </View>
              <View
                className={`me-login-send ${busy || cooldown > 0 ? 'is-disabled' : ''}`}
                hoverClass={busy || cooldown > 0 ? 'none' : 'me-login-send-active'}
                onClick={() => {
                  if (busy || cooldown > 0) return;
                  void sendSms();
                }}
              >
                {cooldown > 0 ? `${cooldown}s重发` : '获取验证码'}
              </View>
            </View>

            <View className="me-login-agreement">
              <View className={`me-login-agreement-check ${agree ? 'is-checked' : ''}`} onClick={() => setAgree((v) => !v)}>
                <Text className="me-login-agreement-check-mark">{agree ? '✓' : ''}</Text>
              </View>
              <Text className="me-login-agreement-text">我已阅读并同意</Text>
              <Text className="me-login-agreement-link" onClick={() => Taro.navigateTo({ url: '/subpackages/legal/terms/index' })}>
                《用户服务协议》
              </Text>
              <Text className="me-login-agreement-text">及</Text>
              <Text className="me-login-agreement-link" onClick={() => Taro.navigateTo({ url: '/subpackages/legal/privacy/index' })}>
                《隐私政策》
              </Text>
            </View>

            <Button className="me-login-submit" loading={busy} disabled={busy} onClick={() => void verifySms()}>
              登录
            </Button>

            {canWechatLogin ? (
              <>
                <View className="me-login-divider">
                  <View className="me-login-divider-line" />
                  <Text className="me-login-divider-text">或</Text>
                  <View className="me-login-divider-line" />
                </View>
                {agree ? (
                  <TaroButton
                    className="me-login-btn me-login-btn-quick me-login-btn-wechat"
                    hoverClass="me-login-btn-wechat-active"
                    disabled={busy}
                    loading={busy}
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
                    className="me-login-btn me-login-btn-quick me-login-btn-wechat"
                    hoverClass="me-login-btn-wechat-active"
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

  return (
    <PullToRefresh type="primary" disabled={refreshing} onRefresh={refresh}>
      <View className="container me-page">
        <View className="me-header" onClick={openProfileSettings}>
          <View className="me-header-row">
            <View className="me-avatar-wrap">
              {auth.token && me ? (
                <Avatar
                  size="72"
                  src={me.avatarUrl || ''}
                  icon={<Text className="me-avatar-text">{displayInitialText}</Text>}
                />
              ) : (
                <View className="me-avatar-placeholder">
                  <Image className="me-avatar-icon" src={iconUser} svg mode="aspectFit" />
                </View>
              )}
            </View>
            <View className="me-header-meta">
              <View className="me-name-row">
                <Text className="me-name">{auth.token ? displayName : '未登录'}</Text>
                {verification.type ? <View className="me-tag me-tag-outline">{verificationTypeLabel(verification.type)}</View> : null}
                {verification.status ? (
                  <View className="me-tag me-tag-status">{verificationStatusLabel(verification.status)}</View>
                ) : null}
              </View>
              {auth.token ? (
                <View className="me-info-row">
                  <Text className="me-subtitle me-info-item">{displayPhone}</Text>
                  <Text className="me-info-dot">·</Text>
                  <Text className="me-subtitle me-info-item">地区：{displayRegionText}</Text>
                </View>
              ) : (
                <View className="me-status-row">
                  <Text className="me-subtitle">登录后可进行咨询、下单和支付</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <>
          {meError ? <ErrorCard message={meError} onRetry={loadMe} /> : null}

          <View className="me-order-card">
            <View className="me-order-tabs">
              <View className={`me-order-tab ${orderTab === 'orders' ? 'active' : ''}`} onClick={() => setOrderTab('orders')}>
                <Text>订单管理</Text>
                {orderTab === 'orders' ? <View className="me-order-indicator" /> : null}
              </View>
              <View className={`me-order-tab ${orderTab === 'publish' ? 'active' : ''}`} onClick={() => setOrderTab('publish')}>
                <Text>发布管理</Text>
                {orderTab === 'publish' ? <View className="me-order-indicator" /> : null}
              </View>
            </View>
            <View className="me-order-grid">
              {orderItems.map((item) => (
                <View key={item.key} className="me-order-item" onClick={item.onClick}>
                  <View className="me-order-icon">
                    <Image className="me-order-icon-img" src={item.icon} svg mode="aspectFit" />
                  </View>
                  <Text className="me-order-label">{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className="me-section-card">
            <View className="me-section-header">
              <Text className="me-section-title">我的收藏</Text>
            </View>
            <View className="me-tools-list">
              {favoriteItems.map((item) => (
                <View key={item.key} className="me-tool-item" onClick={item.onClick}>
                  <View className="me-tool-left">
                    <View className="me-tool-icon">
                      <Image className="me-tool-icon-img" src={item.icon} svg mode="aspectFit" />
                    </View>
                    <Text className="me-tool-title">{item.label}</Text>
                  </View>
                  <View className="me-tool-right">
                    {item.value ? <Text className="me-tool-value">{item.value}</Text> : null}
                    <Text className="me-tool-arrow">›</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className="me-section-card">
            <View className="me-section-header">
              <Text className="me-section-title">消息与服务</Text>
            </View>
            <View className="me-tools-list">
              {serviceItems.map((item) => (
                <View key={item.key} className="me-tool-item" onClick={item.onClick}>
                  <View className="me-tool-left">
                    <View className="me-tool-icon">
                      <Image className="me-tool-icon-img" src={item.icon} svg mode="aspectFit" />
                    </View>
                    <Text className="me-tool-title">{item.label}</Text>
                  </View>
                  <View className="me-tool-right">
                    {item.value ? <Text className="me-tool-value">{item.value}</Text> : null}
                    <Text className="me-tool-arrow">›</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className="me-section-card">
            <View className="me-section-header">
              <Text className="me-section-title">账号与合规</Text>
            </View>
            <View className="me-tools-list">
              {accountItems.map((item) => (
                <View key={item.key} className="me-tool-item" onClick={item.onClick}>
                  <View className="me-tool-left">
                    <View className="me-tool-icon">
                      <Image className="me-tool-icon-img" src={item.icon} svg mode="aspectFit" />
                    </View>
                    <Text className="me-tool-title">{item.label}</Text>
                  </View>
                  <View className="me-tool-right">
                    {item.value ? <Text className="me-tool-value">{item.value}</Text> : null}
                    <Text className="me-tool-arrow">›</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <Surface className="me-logout-card" padding="md">
            <Button
              variant="ghost"
              onClick={() => {
                const seq = ++logoutSeqRef.current;
                clearToken();
                toast('已退出登录', { icon: 'success' });
                setTimeout(() => {
                  if (seq !== logoutSeqRef.current || !pageVisibleRef.current) return;
                  Taro.reLaunch({ url: '/pages/home/index' });
                }, 200);
              }}
            >
              退出登录
            </Button>
          </Surface>
        </>
      </View>
    </PullToRefresh>
  );
}
